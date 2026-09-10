#!/usr/bin/env python3
"""Read-only checks of a supplied installer folder and an existing Flatpak prefix."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

SANDBOX_CHECK = r'''
import json, os, sys
from pathlib import Path
source = Path(sys.argv[1])
expected = json.loads(sys.argv[2])
prefix = Path(sys.argv[3])
if not source.is_dir() or not (prefix / "drive_c").is_dir():
    raise SystemExit("Source or prefix unavailable inside sandbox")
observed = sorted(p.name for p in source.iterdir() if p.is_file())
if observed != expected:
    raise SystemExit("Host/sandbox file listing differs; access or source changed")
for name in expected:
    with (source / name).open("rb") as stream:
        stream.read(1)
s = os.statvfs(prefix / "drive_c")
print(json.dumps({"source_files_readable": len(expected),
                  "prefix_free_bytes_inside_flatpak": s.f_bavail * s.f_frsize}))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--bottle-path", required=True, type=Path)
    args = parser.parse_args()
    source = args.source.expanduser().resolve(strict=True)
    prefix = args.bottle_path.expanduser().resolve(strict=True)
    if not source.is_dir() or not (prefix / "drive_c").is_dir():
        raise ValueError("Expected an installer directory and bottle containing drive_c")
    files = sorted((p for p in source.iterdir() if p.is_file()), key=lambda p: p.name)
    candidates = [p.name for p in files if p.suffix.lower() in {".exe", ".msi"}]
    if not candidates:
        raise ValueError("No top-level .exe/.msi found; point to the actual installer folder")
    before = {p.name: (p.stat().st_size, p.stat().st_mtime_ns) for p in files}
    if not shutil.which("flatpak"):
        raise RuntimeError("Flatpak unavailable; use the native Bottles equivalent")
    checked = subprocess.run(
        ["flatpak", "run", "--command=python3", "com.usebottles.bottles", "-c",
         SANDBOX_CHECK, str(source), json.dumps(list(before)), str(prefix)],
        capture_output=True, text=True, timeout=60, check=True)
    result = json.loads(checked.stdout)
    after = {p.name: (p.stat().st_size, p.stat().st_mtime_ns)
             for p in source.iterdir() if p.is_file()}
    if before != after:
        raise RuntimeError("Source changed during inspection; rerun after it settles")
    result.update(source=str(source), bottle_path=str(prefix), installers=candidates,
                  top_level_source_bytes=sum(v[0] for v in before.values()),
                  prefix_free_bytes_host=shutil.disk_usage(prefix / "drive_c").free,
                  drive_links={p.name: str(p.readlink()) for p in
                               (prefix / "dosdevices").glob("*") if p.is_symlink() and len(p.name) == 2 and p.name.endswith(":")},
                  scope="top-level files; fresh sandbox; no integrity or required-space verdict")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        if isinstance(exc, subprocess.CalledProcessError):
            detail = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        else:
            detail = str(exc)
        print(json.dumps({"status": "blocked", "error": detail}), file=sys.stderr)
        sys.exit(1)

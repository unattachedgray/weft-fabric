#!/usr/bin/env python3
"""Keep every SKILL.md conformant with the cross-CLI Agent-Skills standard.

These skills are shared across ALL agent CLIs — Claude Code, Codex, Gemini /
Antigravity (agy), and any other that reads SKILL.md. A file missing frontmatter,
or whose `name` isn't a lowercase-hyphen slug, silently breaks for the strict
loaders (Codex: "Skipped N skill(s) due to invalid SKILL.md files").

Wired as the repo's pre-commit hook (hooks/pre-commit): it **auto-fixes simple
problems and re-stages**, and only **rejects** what it can't fix. Run manually:

    python3 validate-skills.py             # check every plugins/*/skills/*/SKILL.md (exit 1 on any problem)
    python3 validate-skills.py --fix       # auto-fix what it can, in place
    python3 validate-skills.py --fix a/SKILL.md b/SKILL.md   # specific files (the hook)

Auto-fixes: add derived frontmatter (name = dir, description from the H1 + first
line); slugify a non-conformant `name`; truncate a >1024-char description.
Unfixable (→ reject): an empty file with nothing to derive a description from.
stdlib only.
"""
from __future__ import annotations
import os, re, sys, glob

ROOT = os.path.dirname(os.path.realpath(__file__))
SLUG = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")
FM = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
STRIP = "﻿ \t\r\n"

def _esc(d: str) -> str:
    return re.sub(r"\s+", " ", d).strip().replace('"', "'")

def _derive_desc(body: str) -> str:
    lines = body.split("\n")
    h1 = next((l.lstrip("# ").strip() for l in lines if l.lstrip().startswith("#")), "")
    core = re.sub(r"^/\S+\s*[—–-]\s*", "", h1).strip() or h1
    body1 = next((l.strip() for l in lines if l.strip() and not l.lstrip().startswith("#")), "")
    desc = core if (len(core) >= 80 or not body1) else f"{core} — {body1}"
    return _esc(desc)[:1020].rstrip()

def check(path: str) -> list[str]:
    name_dir = os.path.basename(os.path.dirname(os.path.realpath(path)))
    try:
        s = open(path, encoding="utf-8").read().lstrip(STRIP)
    except OSError as e:
        return [f"unreadable: {e}"]
    m = FM.match(s)
    if not m:
        return ["missing YAML frontmatter delimited by --- (must be the first content)"]
    fm, probs = m.group(1), []
    nm = re.search(r"(?m)^name:\s*(.+?)\s*$", fm)
    if not nm:
        probs.append("frontmatter missing `name:`")
    elif not SLUG.fullmatch(nm.group(1).strip().strip("\"'")):
        probs.append(f"`name` not a slug (need lowercase/digits/hyphens ≤64, usually = dir `{name_dir}`)")
    dm = re.search(r"(?m)^description:\s*(.+?)\s*$", fm)
    if not dm:
        probs.append("frontmatter missing `description:`")
    elif len(dm.group(1).strip().strip("\"'")) > 1024:
        probs.append("`description:` exceeds 1024 chars")
    return probs

def fix(path: str) -> tuple[bool, list[str]]:
    """Make path conform in place. Returns (changed, unfixable_problems)."""
    name_dir = os.path.basename(os.path.dirname(os.path.realpath(path)))
    try:
        raw = open(path, encoding="utf-8").read()
    except OSError as e:
        return (False, [f"unreadable: {e}"])
    s = raw.lstrip(STRIP)
    m = FM.match(s)

    if not m:                                   # no frontmatter → derive + prepend
        if not s.strip():
            return (False, ["empty file — cannot derive frontmatter"])
        new = f'---\nname: {name_dir}\ndescription: "{_derive_desc(s)}"\n---\n\n' + s
    else:                                        # has frontmatter → fix name/desc only
        fm_lines = m.group(1).split("\n")
        body = s[m.end():]
        ni = next((i for i, l in enumerate(fm_lines) if re.match(r"^\s*name:", l)), None)
        if ni is None:
            fm_lines.insert(0, f"name: {name_dir}")
        else:
            cur = re.sub(r"^\s*name:\s*", "", fm_lines[ni]).strip().strip("\"'")
            if not SLUG.fullmatch(cur):
                fm_lines[ni] = f"name: {name_dir}"
        di = next((i for i, l in enumerate(fm_lines) if re.match(r"^\s*description:", l)), None)
        if di is None:
            fm_lines.append(f'description: "{_derive_desc(body)}"')
        else:
            cur = re.sub(r"^\s*description:\s*", "", fm_lines[di]).strip().strip("\"'")
            if len(cur) > 1024:
                fm_lines[di] = f'description: "{_esc(cur)[:1020].rstrip()}…"'
        new = "---\n" + "\n".join(fm_lines) + "\n---\n" + body

    if new != raw:
        open(path, "w", encoding="utf-8").write(new)
        return (True, check(path))              # re-check: any problem left is unfixable
    return (False, check(path))

def main(argv: list[str]) -> int:
    do_fix = "--fix" in argv
    files = [a for a in argv if a != "--fix"]
    targets = [a for a in files if os.path.basename(a) == "SKILL.md"] if files \
        else sorted(
            # ** so a skill that bundles sub-documents is still reached, and
            # principles/skills/* too — the old plugins/*/skills/*/SKILL.md glob
            # silently skipped three real files.
            glob.glob(os.path.join(ROOT, "plugins", "*", "skills", "**", "SKILL.md"), recursive=True)
            + glob.glob(os.path.join(ROOT, "principles", "skills", "*", "SKILL.md"))
        )
    failures, fixedn = 0, 0
    for path in targets:
        rel = os.path.relpath(path, ROOT)
        if do_fix:
            changed, left = fix(path)
            if changed:
                fixedn += 1
                print(f"  ✎ auto-fixed {rel}")
            for p in left:
                failures += 1
                print(f"  ✗ {rel}: {p} (cannot auto-fix)", file=sys.stderr)
        else:
            for p in check(path):
                failures += 1
                print(f"  ✗ {rel}: {p}", file=sys.stderr)
    n = len(targets)
    if failures:
        print(f"\n✗ {failures} unfixable problem(s) across {n} file(s).", file=sys.stderr)
        return 1
    msg = f"✓ {n} SKILL.md conform" + (f" ({fixedn} auto-fixed)" if fixedn else "")
    print(msg + " to the cross-CLI Agent-Skills standard.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

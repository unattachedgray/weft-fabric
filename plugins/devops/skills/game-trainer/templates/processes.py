"""Find a game by the identity of its mapped executable, not command-line text."""
import os
from pathlib import Path

def mapped_pids(executable):
    target=Path(executable).resolve(); identity=target.stat(); found=[]
    device=f'{os.major(identity.st_dev):02x}:{os.minor(identity.st_dev):02x}'
    for p in Path('/proc').iterdir():
        if not p.name.isdecimal():continue
        try:
            for row in (p/'maps').read_text().splitlines():
                fields=row.split(maxsplit=5)
                if len(fields)==6 and fields[2]=='00000000' and fields[3]==device and int(fields[4])==identity.st_ino and fields[5]==str(target):
                    found.append(int(p.name));break
        except (OSError,ValueError):continue
    return found

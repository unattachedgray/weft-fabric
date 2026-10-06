# Older-game repair and local tool routing

Use this guide before the general modding workflow when the requested outcome
is to get an older game working correctly. The user chooses the game and the
desired behavior. Record the exact executable hash, edition, patch level,
architecture, runtime and failure before changing anything.

1. Search prior local notes with `wrecall` and prior modding notes with
   `game-re-tools um kb search "<game>"`. Run `game-re-tools um scan "<install>"`.
2. Reproduce the reported failure through a bounded, repeatable launch path.
   Capture logs and the relevant observable: crash signature, frame timing,
   graphical output, simulation speed or input behavior. Check sensor liveness.
3. Research maintained source ports, official/community fixes and compatible
   Wine/Proton/Bottles configurations first. For Windows games on Linux, read
   the existing `bottles-game-install` skill. Isolate changes in a lab prefix or
   copied install and back up saves/configuration.
4. If a compatibility change solves the fault, verify the same reproduction and
   normal gameplay. If internals are needed, route to the tools below. Avoid a
   full decompilation when one function, data file or import explains the fault.
5. Measure the repaired behavior against the baseline. Keep unresolved defects
   explicit. Record confirmed findings locally, then bank a concise `wnote` so
   the next recon reads the result. Publication is a separate requested action.

## Complementary routes

| Target / need | Tool and skill |
| --- | --- |
| Engine, loader, saves, file formats | Universal Modder `game-recon` and `reverse-engineering`; `game-re-tools um scan` |
| Native binaries and persistent analysis projects | `ghidra-iterative-re`; the `ghidra` MCP server or `game-re-tools ghidra-cli` |
| Shipped artifact inspection, version comparison, JavaScript/Electron, managed metadata | `reverse-engineer-anything`; `rea` MCP or `game-re-tools rea` |
| .NET/Unity Mono/XNA | `game-re-tools ilspycmd`; inspect real assemblies before using native analysis |
| Unity IL2CPP | `game-re-tools cpp2il`; supply the matching native binary, metadata and Unity version; validate recovered output before using it |
| Java/JAR games | `game-re-tools vineflower`; preserve mappings when available |
| Live native behavior | GDB or `game-re-tools frida`; scope hooks to the chosen lab process, with no system-wide ptrace changes |

Start with `game-re-tools doctor`. Paths and environments come from
`~/.config/game-repair/toolchain.json` on each machine; never assume another
machine has this toolchain. Ghidra starts headlessly and opens targets read-only
by default. For persistent annotations, create a named analysis project in the
game's lab workspace, checkpoint it, and explicitly choose database write mode.
Keep the original game binary intact and verify each analysis mutation.

Ghidra's dedicated server maintains projects and permits scripts. REA is useful
for evidence-oriented artifact inspection; its native provider uses temporary
projects, so it is not the owner of a long-term annotated database. Use one
owner per analysis project to avoid locks and stale reads. Shut down the worker
after the investigation; no desktop-login service is required.

The upstream `um win` driver is Windows/WSL tooling. On native Linux, use the
existing Bottles workflow and game logs; build a target-specific harness when
needed. Do not assume Windows input or capture commands work here.

Asset generation, showcase videos, loaders, publication and online services are
used only when the requested work needs them. Preserve the owner's shared AI
routing policy. No hosted analysis or premium maintenance call is required by
this installation. IDA is excluded by the owner's current preference.

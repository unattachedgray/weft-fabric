# Game repair toolchain selection — 2026-10-06

Scope: install complementary skills and tools for future legacy-game repairs
and cross-game mechanic ports. The owner postponed tests in actual games and
excluded IDA. No game repair or port is claimed complete.

| Candidate | Decision and reason |
| --- | --- |
| [Universal Modder](https://github.com/rehan-remade/universal-modder) | Keep the complete ten-skill bundle: engine playbooks, managed/native routing, automation, assets, mashups and field notes. Its Windows driver is not a native Linux driver. |
| [REA](https://github.com/morluto/rea) | Keep the skill matched to npm 4.0.1 and its CLI/MCP: evidence-oriented artifact inspection and version comparison complement game workflows. Its native sessions are temporary. |
| [ghidra-iterative-re](https://github.com/GeReV/ghidra-iterative-re) | Keep: persistent database mutation, independent witnesses and ABI checks address risks beyond the general RE guide. |
| [ByteLand headless-ghidra](https://github.com/ByteLandTechnology/headless-ghidra) | Defer: eight linked phase/helper skills, a mandatory YAML workflow and repeated review gates overlap the selected analysis workflow. Could be useful for a large substitution project. |
| [reverse-skill](https://github.com/zhaoxuya520/reverse-skill) | Defer: broad security/CTF routing and PowerShell orchestration add little to this game-repair installation. |
| [REx-skill](https://github.com/tihanyin/REx-skill) | Defer: vulnerability discovery, seven agents and a much larger pinned security toolchain exceed the present task. |
| [pyghidra-mcp](https://github.com/clearbluejar/pyghidra-mcp) | Defer: capable headless/GUI server, but ChromaDB/semantic indexing add runtime dependencies that the present workflow does not need. |
| [ghidra-headless-mcp](https://github.com/mrphrazer/ghidra-headless-mcp) | Install: lazy JVM, persistent named projects, scripts, default read-only sessions and a matching CLI. Real decompilation and MCP requests were verified locally. |
| [Official Hex-Rays MCP](https://github.com/HexRaysSA/ida-mcp) | Excluded by owner. Requires IDA 9.4+ with idalib; no installed IDA was found. Its Python MCP package was removed after the owner chose to omit it. |

Tool versions and distribution checks:

- [Ghidra 12.1.4](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build),
  release ZIP SHA-256 verified; executable modes restored from ZIP metadata.
  [Temurin JDK 21.0.12.1+1](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1)
  SHA-256 verified; Java is scoped to the wrapper rather than the global environment.
- [ILSpy](https://github.com/icsharpcode/ILSpy) `ilspycmd` 11.1.0.9782:
  installed through .NET tools; recovered a known method from a compiled fixture.
- [Cpp2IL](https://github.com/SamboyCoding/Cpp2IL/releases/tag/2022.1.0-pre-release.21)
  pre-release.21 Linux binary: release SHA-256 verified; version, processor and
  output-format discovery available. No game metadata conversion tested yet.
- [Vineflower 1.12.0](https://github.com/Vineflower/vineflower/releases/tag/1.12.0):
  release JAR SHA-256 verified. Java/JAR decompiler for another distinct stack.
- [Frida](https://frida.re/docs/installation/) tools 14.11.0, runtime 17.22.2:
  isolated installation for future scoped runtime observation. Existing GDB and
  binutils remain available; no broad process attachment or ptrace relaxation.

## Practitioner evidence (reports, not local validation)

Read through task-owned background Browser Tunnel tabs, including comments:

- [Universal Modder discussion](https://www.reddit.com/r/ClaudeAI/comments/1wug3lx/new_opensource_project_tries_to_let_claude_code/):
  users report working Fabric/Minecraft and AoE routes, while unsupported asset
  formats, bugs and reliance on established loaders limit the universal claim.
- [Ghidra game RE discussion](https://www.reddit.com/r/ghidra/comments/1r5mn5d/reverseengineering_of_a_game/):
  reports of readable class names and useful C++ reconstruction, with high token
  use and uncertainty about stripped binaries. This supports bounded subsystem
  analysis, not whole-game reconstruction as the default.
- [DOS-game RE discussion](https://www.reddit.com/r/ReverseEngineering/comments/1rwarvm/reverse_engineering_a_dos_game_with_ghidra_and/):
  practitioners report Harvester audio investigation and DirectDraw resolution
  work, while stressing course correction and durable project knowledge.

## Adoption and verification limits

Adopt as useful local tools. The intended learning path is recon → verified
repair/port → local field note → next `um kb search` / `wrecall`. The existing KB
reader was exercised. A complete game outcome has not yet traversed this loop,
so freshness and practical quality gains are unmeasured. Publication remains
governed separately. After ordinary use, measure time to a verified repair and
whether a repeated fault reuses a previous finding.

Local readiness: 65 Universal Modder helper tests passed (one skipped), 25
demangler vectors passed (no external oracle), real Ghidra import/disassembly/
decompilation/xrefs passed, and both MCP servers initialized and exposed their
required tools. The installed Ghidra backend exposes 212 tools; REA exposes 116.
The default Ubuntu compiler emitted a CET entry instruction with no P-code;
the upstream fixture's unconditional P-code assertion required a fixture built
with `-fcf-protection=none`. This is a fixture assumption, not a decompiler fix.

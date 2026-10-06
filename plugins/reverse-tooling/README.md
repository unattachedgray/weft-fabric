# Complementary reverse-engineering skills

- [REA](https://github.com/morluto/rea), MIT, installed skill matched to npm release
  `4.0.1` (reviewed source `904d03e987a6c498561b314a266202dee84b13ab`): artifact inspection, feature tracing,
  evidence and version comparison. CLI installation is independently pinned.
- [ghidra-iterative-re](https://github.com/GeReV/ghidra-iterative-re), MIT, pinned
  to `d7c146e4aab93b52e96998f5129101dfdc7f2e5f`: persistent annotation with
  apply/cascade/verify discipline, ABI checks and independent witnesses.

These remain distinct skills because the workflow and state ownership differ.
Read [the integration guide](../universal-modder/LOCAL-INTEGRATION.md) for routing
and machine-local configuration. `game-re-tools` gives agents a common CLI even
when their MCP client has not been configured. No global Java environment,
automatic Hopper installation or third-party browser bridge is enabled.

The headless MCP backend is
[mrphrazer/ghidra-headless-mcp](https://github.com/mrphrazer/ghidra-headless-mcp),
pinned to `307b461cdbbedfbafb3771333f21875b745f940e`. Its only runtime dependency
is PyGhidra; the JVM starts on first analysis. Its CLI follows the same registry
as MCP. Use persistent sessions for repeated calls, rather than starting a JVM
for each CLI invocation. Client registration and dependency paths are local
machine configuration, not portable defaults. IDA is excluded for now.

Local repair: the bundled `msvc_demangle` script is executable, matching its
upstream invocation instructions.

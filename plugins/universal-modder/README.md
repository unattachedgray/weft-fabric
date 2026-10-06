# Universal Modder, shared installation

Vendored from [rehan-remade/universal-modder](https://github.com/rehan-remade/universal-modder)
at `76b9c7e77ead5fd2d5f1b7613c6a7ed591b01c70` (MIT). Original documentation is
in `UPSTREAM-README.md`. Skills and their references are canonical here; the
Fabric reconciler links them into eligible agents. No upstream startup hooks or
fal MCP registration are installed. Asset generation is optional.

For older-game repair, start with [LOCAL-INTEGRATION.md](LOCAL-INTEGRATION.md).
Use `game-re-tools um` for the configured CLI, or the installed `um` command.
The CLI is installed in an isolated environment; its field-note cache and new
notes stay outside the shared skill library. No example game assets are vendored;
upstream example links remain available from the pinned repository.

Local changes: the main entry skill points to this integration guide; runtime
and knowledge-base commands use the configured local wrapper. Upstream engine
playbooks and companion skills are retained. `PROVENANCE.json` records imports.

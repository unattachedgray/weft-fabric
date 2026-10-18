# Vendored skill: graphify

Source: the `graphifyy` PyPI package (Graphify-Labs/graphify), version in
`.graphify_version`, written by `graphify install --platform claude` into a
scratch home and copied here on 2026-10-18 (owner request: "install graphify if
we're going to use it going forward, not just for sgj but for many
developments"). The CLI itself is a uv tool: `uv tool install graphifyy`
(`graphify`, `graphify-mcp` in ~/.local/bin).

Local change: the `description` is narrowed so the skill triggers on /graphify,
on projects that chose Graphify, or where graphify-out/ exists — the upstream
text claimed "any question about a codebase", which would override the shared
one-graph-per-project rule in principles/AGENTS.md.

Not done on purpose: `graphify install` also appends a line to
~/.claude/CLAUDE.md and copies the skill into each CLI's own folder. Here the
skill is reached by symlink like every fabric skill, and global CLAUDE.md is
left alone.

Upgrade: `uv tool upgrade graphifyy`, rerun `HOME=$(mktemp -d) graphify install
--platform claude`, copy the new skill over this folder, re-apply the
description change (the copy step asserts it), commit.

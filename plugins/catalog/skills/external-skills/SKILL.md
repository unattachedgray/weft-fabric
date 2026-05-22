---
name: external-skills
description: ALWAYS consult before recommending a default tool, saying "no skill exists for X", or answering a domain question with generic knowledge. The plugin ecosystem on this machine includes 200+ plugins beyond the unatt marketplace — across @claude-plugins-official and @anthropic-agent-skills — covering Stripe, Airtable, Apollo, Amplitude, AWS toolkits, Aikido security, Adobe Creative, language LSPs, and many more. Procedure for runtime lookup below. Do NOT recommend skills from training-data memory alone — only verified live listings.
---

# external-skills

The `unatt` marketplace is a curated slice. The broader registered marketplace ecosystem on this machine carries ~215 plugins total. This skill teaches you to consult that broader pool at runtime, without bloating session context with all of it.

## Search order

When a task arises and you're picking a skill (or evaluating a `SKILL_SIGNAL_CANDIDATE`), search in this order:

1. **Installed skills** — already in your session's skill listing.
2. **`unatt` catalog** — see `/catalog:browse-skills`. Auto-installable per the `auto-install-unatt-plugins` feedback memory.
3. **External marketplaces** — runtime lookup (below). Auto-installable for `@anthropic-agent-skills`; propose for `@claude-plugins-official`.

Only fall back to default tools or generic knowledge if steps 1–3 yield nothing.

## Runtime lookup

To see what's available across all registered marketplaces:

```bash
claude plugin list --available --json
```

That returns `{installed: [...], available: [...]}` — ~120KB / ~215 entries on a typical install. **Filter inline**; never dump the whole thing into context.

Recipe for a keyword search:

```bash
claude plugin list --available --json 2>/dev/null | python3 -c '
import json, re, sys
data = sys.stdin.read()
keyword = "stripe"  # ← change to whatever you are looking for
entries = re.findall(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", data)
for e in entries:
    if keyword.lower() in e.lower():
        name = re.search(r"\"name\"\s*:\s*\"([^\"]+)\"', e)
        src = re.search(r"\"sourceName\"\s*:\s*\"([^\"]+)\"', e)
        desc = re.search(r"\"description\"\s*:\s*\"([^\"]+)\"', e)
        if name:
            n = name.group(1)
            s = src.group(1) if src else "?"
            d = (desc.group(1) if desc else "")[:150]
            print(f"{n}@{s} — {d}")
'
```

For known plugin names, install just tries it directly:

```bash
claude plugin install <name>@<marketplace>   # errors cleanly if not found
```

## Registered marketplaces (auto-detected; re-verify with `claude plugin marketplace list`)

| Marketplace | Source | Auto-install authorized? |
|---|---|---|
| `unatt` | `unattachedgray/claude-skills` | ✓ (auto-install-unatt-plugins memory) |
| `anthropic-agent-skills` | `anthropics/skills` | ✓ (extended scope — `@anthropic-agent-skills` skills are inert until invoked, no hooks/MCP/LSP, low side-effect risk) |
| `claude-plugins-official` | `anthropics/claude-plugins-official` | ✗ — propose first (plugins here can include hooks, MCP servers, LSP servers with real side effects on session behavior) |

## Install commands

- `claude plugin install <name>@unatt` — auto-allowed.
- `claude plugin install <name>@anthropic-agent-skills` — auto-allowed.
- `claude plugin install <name>@claude-plugins-official` — **propose**, wait for user click; mention what hooks/MCP/LSP the plugin adds, since those have visible session impact.
- Community / GitHub repos outside marketplaces (e.g. `safishamsi/graphify`, `chenglou/pretext`): install method is repo-specific — check the repo README and propose.

## Hallucination guard

**Never** recommend a skill from training-data memory alone. Always verify via `claude plugin list --available --json` or `gh repo view <owner>/<repo>` before naming a specific skill. "The X plugin handles this" without grounding erodes trust the moment X doesn't actually exist.

If the runtime lookup is empty for a domain, say so explicitly:

> "No relevant plugin in the registered marketplaces — falling back to general knowledge."

That's honest. Pretending a skill exists isn't.

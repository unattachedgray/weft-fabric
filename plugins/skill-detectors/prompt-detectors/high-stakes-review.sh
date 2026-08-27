#!/usr/bin/env bash
# Shim. The detector logic lives with the rest of the system in
# claude-stack/skills/multi-ai-review/scripts/panel — one file, so porting it
# means copying that file and dropping a shim like this wherever the host's
# hook mechanism expects one. Keeping the logic here instead would recreate the
# cross-plugin coupling this consolidation removed.
exec bash "$HOME/dev/weft-fabric/plugins/claude-stack/skills/multi-ai-review/scripts/panel" detect

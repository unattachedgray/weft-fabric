---
name: skill-audit
description: Periodic maintenance pass over this skills repo — find skills that are stale, unused, superseded by a Claude Code built-in, or that teach the model things it already knows, and retire them. Use when asked to audit/prune/clean up skills, or on a scheduled maintenance check.
---

# Skill audit

A skills repo silts up. Every skill added is permanent by default, nothing
prompts you to remove one, and the cost of a bad skill is invisible — it is
paid as attention in every session, not as an error.

This is the periodic pass that keeps the set honest. Run it every month or two,
or whenever the repo has grown by a dozen skills.

## Order of evidence

Four rules, each of which was learned by getting it wrong on 2026-08-08. Apply
them in this order; a later rule never overrides an earlier one.

1. **Establish the reachable window before reading usage.** An invocation count
   is meaningless for a skill nothing could invoke. Check when the marketplace
   was registered and what was symlinked, then only count usage inside that
   window.
2. **Bundled files before line count.** A 400-line SKILL.md shipping working
   scripts is a tool; a 400-line one shipping nothing is a tutorial. Length
   alone flagged two skills carrying 17–25 KB of real Python.
3. **"Redundant with a built-in" needs two checks, not one** — that it is
   redundant on *every* CLI (see §2), and that the on-machine infrastructure
   actually matches what the skill describes. One skill survived a prune on
   cross-CLI grounds and was then retired for the better reason that it
   documented a Chrome bridge on a port with nothing listening, on a machine
   with no Chrome installed.
4. **Linking is not free.** Cursor reads the union of all three skill
   directories, so a skill linked into two of them is paid for twice, and an
   alias under a second name was a double tax until the names were canonicalised.

## The standard a skill has to meet

A skill earns its place only if it carries knowledge **the model does not
already have**. That is the whole test, and it is stricter than it sounds,
because the models get better every few months and skills do not.

Three things qualify:

1. **This machine.** Paths, ports, service names, which binary is the right
   one, what breaks and why. `firefox-control` and `sudo-run` are the model —
   short instructions wrapped around a real script.
2. **Volatile facts the model will get wrong from memory.** Prices, model IDs,
   API shapes. `llm-api-pricing` is the exemplar: it ships a data file and
   explicitly refuses to answer from training data.
3. **A procedure with real judgment in it** that a competent model would
   otherwise improvise inconsistently — a checklist, a gate, a house style.

Everything else is filler, however well written.

## Retire on sight

- **Teaches a language, framework or tool the model knows.** "JavaScript has 7
  primitive types", install commands, KISS/DRY/YAGNI. Length is the tell: a
  400–850 line SKILL.md with no bundled files is a tutorial, not a tool.
- **Shadows a built-in *on every CLI that uses this repo*.** This is the trap.
  This library is shared by Claude Code, Codex, Gemini/Antigravity and Cursor,
  and they do not have the same features. `security-review` and `code-quality`
  duplicate Claude Code commands — but for Codex and Gemini they are the ONLY
  implementation, so deleting them is a loss. A skill is only redundant if it
  is redundant everywhere. When it is conditional, keep it and mark it:

  ```yaml
  clis: codex, gemini, cursor
  clis-why: Claude Code ships its own /security-review; this covers the rest.
  ```

  (This rule exists because the 2026-08-08 audit deleted three skills on
  Claude-only reasoning and had to restore them.)
- **Superseded by a sibling.** Look for `-v1` suffixes and near-identical
  section headings across skills in one plugin.
- **Never invoked.** See "Which skills are actually used" below.
- **Broken.** References `scripts/` or `references/` paths that do not exist,
  or WebFetches a URL that has moved. Either fix it or drop it.

## Run the pass

```bash
cd ~/dev/claude-skills

# 1. Inventory: size and whether the skill bundles anything.
for p in plugins/*/; do for s in "$p"skills/*/; do
  printf "%-16s %-34s %5s lines  %s extra\n" "$(basename $p)" "$(basename $s)" \
    "$(wc -l < "$s/SKILL.md" 2>/dev/null)" \
    "$(find "$s" -mindepth 1 -maxdepth 1 ! -name SKILL.md | wc -l)"
done; done | sort -k3 -rn

# 2. Broken internal references.
grep -rlE '\((scripts|references|templates)/' plugins/*/skills/*/SKILL.md |
  while read f; do d=$(dirname "$f");
    grep -oE '\((scripts|references|templates)/[^)]+\)' "$f" | tr -d '()' |
      while read r; do [ -e "$d/$r" ] || echo "MISSING  $f -> $r"; done
  done

# 3. Frontmatter conformance (widened glob — catches nested + principles).
python3 validate-skills.py

# 4. Shadowing: compare skill names against the current built-ins.
ls plugins/*/skills/ | sort -u

# 5. clis: tags that are not backed by an actual symlink. A skill tagged
#    "codex, gemini" but linked nowhere is a silent lie — it reads as covered.
for f in $(grep -rl '^clis:' plugins/*/skills/*/SKILL.md); do
  n=$(basename $(dirname $f)); tags=$(grep '^clis:' $f | cut -d: -f2-)
  for cli in claude codex gemini; do
    case "$tags" in *"$cli"*)
      case $cli in
        claude) d=~/.claude/skills ;; codex) d=~/.codex/skills ;;
        gemini) d=~/.gemini/config/skills ;;
      esac
      [ -e "$d/$n" ] || echo "UNLINKED  $n tagged $cli but missing from $d" ;;
    esac
  done
done
```

### Which skills are actually used

Invocation leaves a trace in the session transcripts, so zero hits over a few
months is a retirement signal. Match the **invocation**, not the word. A bare `grep` for the skill name hits
every mention in every transcript — when this was first written, the deleted
`langchain` skill scored 52 "uses" purely from prose. The Skill tool records
`"skill":"<name>"`, so match that:

```bash
# what has actually been invoked, most-used first
grep -ho '"skill":"[a-z0-9:-]*"' ~/.claude/projects/*/[0-9a-f]*.jsonl 2>/dev/null |
  sed 's/.*:"//;s/"//' | sort | uniq -c | sort -rn

# and the inverse — present in the repo, never once invoked
comm -23 \
  <(ls -d plugins/*/skills/*/ | xargs -n1 basename | sort -u) \
  <(grep -ho '"skill":"[a-z0-9:-]*"' ~/.claude/projects/*/[0-9a-f]*.jsonl 2>/dev/null |
      sed 's/.*:"//;s/"//;s/^.*://' | sort -u)
```

**Zero invocations only means something if the skill was reachable.** Until the
marketplace was registered on 2026-08-08 at 16:09, all but ~6 symlinked skills
were installable by nobody — so their invocation count was structurally zero and
carries no information about their worth. Before citing usage as evidence,
confirm the skill has actually been *reachable* for the window you are measuring:

```bash
stat -c '%y  marketplace registered' ~/.claude/plugins/known_marketplaces.json
ls -l ~/.claude/skills ~/.codex/skills ~/.gemini/config/skills   # what was linked
```

Transcripts also only cover retained sessions. So: absence is weak evidence over
a short window, strong evidence over months, and NO evidence at all for a skill
nothing could invoke.

Judgment: a skill that exists for a rare-but-critical moment (a restore
procedure, an incident playbook) is allowed zero hits. A "how to write React"
skill with zero hits is just dead weight.

## Retiring

Deletion is right; the history holds it. Do not build a `deprecated/` folder —
that is how you end up auditing the graveyard too.

```bash
git rm -r plugins/<plugin>/skills/<name>
# if that emptied the plugin, drop it from .claude-plugin/marketplace.json too
python3 validate-skills.py
bash scripts/regen-catalog.sh
git commit   # say WHY each one went, not just that it went
```

## Updating instead of retiring

Prefer an update when the skill's *subject* still matters but its content has
rotted:

- Strip everything the model now knows and keep only the local/volatile part.
  Most 600-line skills have 40 good lines in them.
- Move procedure into a script the skill calls. A script cannot rot silently
  the way prose does — it fails.
- If it names model IDs, prices, or API shapes, make it load a data file and
  say plainly that it must not answer from memory.

## Afterwards

- `bash scripts/deploy-principles.sh` if anything under `principles/` moved.
- Marketplace is registered against the local path, so repo edits are live —
  no push needed for them to take effect, though push anyway.
- Record what went and why in the commit. The next audit should not have to
  re-derive the reasoning.

## Every CLI links the same files

There must be exactly one copy of any skill — the repo's — and every CLI
reaches it by symlink. Copies drift silently and are unbacked:

```bash
# any CLI holding a COPY instead of a link
for d in ~/.claude/skills ~/.codex/skills ~/.gemini/config/skills; do
  for f in "$d"/*/; do [ -L "${f%/}" ] || echo "COPY  $f"; done
done

# a copy that duplicates a repo skill under a different name
md5sum ~/.codex/skills/*/SKILL.md plugins/*/skills/*/SKILL.md |
  sort | uniq -w32 -d
```

On 2026-08-08 Codex held 11 copies: 8 were byte-identical duplicates of repo
skills under renamed directories (`taste-skill` = `design-taste-frontend`), and
3 existed nowhere else at all. Duplicates became symlinks; the unique ones were
absorbed into the repo. If a copy has genuinely drifted, decide which side is
right before relinking — do not assume the repo is newer.

## Related

`flywheel-audit` is the mirror of this skill: it decides whether something new
should be **adopted**. Together they are the intake and the pruning. Adding
without pruning is how the repo got to 95 skills with 6 reachable.

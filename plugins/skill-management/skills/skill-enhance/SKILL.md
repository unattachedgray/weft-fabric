# /skill-enhance — Propagate a technology across your skill library

Research a technology, audit all installed skills for where it applies, and add integration instructions to each applicable skill. One command to weave a new capability into everything you already have.

## Arguments

$ARGUMENTS — `<technology> [url]`

Examples:
- `pretext https://github.com/chenglou/pretext`
- `bun`
- `temporal https://temporal.io/docs`
- `wasm`
- `htmx https://htmx.org`
- `sourcegraph`

If a URL is provided, fetch and study it. If not, use WebSearch to research the technology.

## Phase 1: Research

**Goal**: Understand the technology well enough to know where it applies and where it doesn't.

1. **Fetch primary source** — if URL provided, `WebFetch` the README/docs. Otherwise `WebSearch` for `"<technology> overview site:github.com OR site:docs"`.
2. **Extract the core pattern** — what problem does it solve? What's the key insight? Write a 2-3 sentence summary.
3. **Identify applicability criteria** — when does this technology apply? When doesn't it? Be specific:
   - What types of work does it improve? (frontend, backend, build, test, deploy, design)
   - What languages/frameworks does it pair with?
   - What existing patterns does it replace or enhance?
4. **Extract actionable patterns** — concrete instructions someone could follow. Not theory, not concepts — what do you DO with this technology? Code snippets, CLI commands, configuration.
5. **Identify anti-patterns** — what NOT to do. Common mistakes, misapplications, when to avoid it.

**Output**: Post a `## Research Summary` with: core insight, applicability criteria, actionable patterns, anti-patterns. Wait for user confirmation before proceeding.

## Phase 2: Audit

**Goal**: Find every installed skill where this technology applies.

1. **Scan all skills**:
   ```
   ~/.claude/skills/*/SKILL.md     — global skills
   .claude/skills/*/SKILL.md       — project skills (if they exist)
   skills/*/SKILL.md               — repo skills (if they exist)
   ```
   Read the first 20 lines of each skill (name + description) to classify relevance.

2. **Classify each skill** into one of:
   - **Direct**: The technology directly applies to this skill's domain (e.g., pretext → frontend-design)
   - **Indirect**: The skill could benefit from awareness of the technology (e.g., pretext → app-builder)
   - **Unrelated**: No meaningful connection (e.g., pretext → database-design)

3. **For each Direct/Indirect skill**, read the full content and identify:
   - Where in the skill the technology fits (which section, after which content)
   - What specifically to add (instructions, patterns, checklist items, commands)
   - What existing content it enhances or replaces

**Output**: Post a table:
```
| Skill | Relevance | Section to Update | What to Add |
|-------|-----------|-------------------|-------------|
```

Wait for user to approve, modify, or skip specific skills before proceeding.

## Phase 3: Propose

**Goal**: Show the user exactly what would change in each skill, and let them control what gets applied.

For each approved skill from Phase 2, draft the proposed addition and present it for review. **Do NOT edit any files in this phase.**

### Draft each enhancement:

1. **States when to use it** — 1-2 lines connecting the technology to the skill's domain
2. **Provides actionable instructions** — what to DO, not what the technology IS. Commands, code, patterns.
3. **Fits the skill's voice** — match the existing style, heading level, and specificity

### Section template (adapt to each skill's style):

```markdown
## <Technology> Integration

<1-2 lines: when this applies in the context of THIS skill's work>

- **<Action 1>**: <specific instruction with command or code>
- **<Action 2>**: <specific instruction>
- **<Action 3>**: <specific instruction>

<Optional: reference to full docs or standalone skill>
```

### Present proposals:

Show ALL proposed changes together so the user can review the full picture:

```
### Proposal 1: <skill-name>
**Location**: After "<section heading>" section
**Lines added**: ~N

<the exact markdown that would be inserted>

---

### Proposal 2: <skill-name>
...
```

Then ask:
> Which proposals should I apply? You can:
> - **Accept all**: "go ahead" / "apply all"
> - **Accept specific**: "apply 1, 3, 5" or "all except 4"
> - **Modify**: "for proposal 2, make it shorter" / "in proposal 3, add X"
> - **Reject all**: "skip" / "none"
> - **Adjust scope**: "make all of them more concise" / "add code examples to all"

Wait for the user's response before any edits.

## Phase 4: Apply

**Goal**: Edit only the skills the user approved, with any requested modifications.

### Rules for enhancement:

- **Add, don't rewrite** — append a section, don't restructure the skill
- **Be concise** — 10-20 lines max per skill. The standalone skill has the full reference; enhanced skills just need enough to trigger usage.
- **Match specificity** — if the skill has code examples, add code examples. If it's high-level principles, add high-level principles.
- **Reference the standalone skill** — if one exists (e.g., "See `/pretext-layout` for full CSS patterns and verification checklist")
- **Skip checklists that already exist** — if the skill already has a checklist, add items to it rather than creating a new section

### Apply edits:

Use the `Edit` tool to add the section to each approved skill file. After all edits, show a summary of what was changed.

## Phase 5: Export (optional)

If the user has a skills repo (e.g., `claude-skills` on GitHub):

1. Check if a standalone skill file for this technology already exists in the repo
2. If the enhancement is substantial enough to warrant a standalone skill, create one:
   - Extract the research summary + actionable patterns + anti-patterns into a standalone `<technology>.md`
   - Push to the repo
3. Update any existing skills in the repo that were enhanced locally

Ask the user before pushing.

## Phase 6: Report

```
## Enhancement Report

### Technology: <name>
<2-3 sentence summary of what was propagated>

### Skills Enhanced
| Skill | What was added |
|-------|---------------|

### Skills Skipped (unrelated)
<comma-separated list>

### Standalone Skill
<created/updated/not needed> — <repo URL if pushed>

### Next Steps
- <any manual verification needed>
- <skills that might benefit after further research>
```

## Guidelines

- **Research depth scales with novelty** — well-known tech (React, TypeScript) needs less research than niche tools. Don't over-research what Claude already knows well. Focus research time on what's genuinely new or non-obvious.
- **Applicability > comprehensiveness** — it's better to enhance 5 skills well than 15 skills superficially. Skip skills where the connection is tenuous.
- **The user decides scope** — present the audit table and let them choose which skills to enhance. Don't assume everything should be touched.
- **Standalone skills are for deep topics** — if the technology has enough patterns, anti-patterns, and code to fill a useful reference, create a standalone skill. If it's a simple tool with one pattern, just enhance existing skills.
- **Idempotent** — running the same enhancement twice shouldn't duplicate content. Check if a section for this technology already exists before adding.
- **Respect `disable-model-invocation`** — some skills have this flag. Still edit them, but note that the skill itself won't auto-load.

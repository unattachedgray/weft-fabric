---
name: skill-development
description: Use when creating new skills, discovering existing skills from the ecosystem, testing skills with subagents, or applying continuous improvement to deployed skills. Covers the full skill lifecycle from search to creation to testing.
---

# Skill Development

## Overview

This skill covers the complete lifecycle of working with agent skills: discovering skills from the ecosystem, creating new skills using TDD methodology, testing with subagents, and continuously improving deployed skills.

**Core principle:** Skills are Test-Driven Documentation. Write pressure tests first, watch agents fail, write the skill, watch them comply, refactor loopholes.

## When to Use

Use this skill when:
- User asks "how do I do X" where X might have an existing skill
- User asks "find a skill for X" or "is there a skill that can..."
- Creating new skills or editing existing ones
- Testing skills before deployment
- Improving skills based on observed failures

## Skills Ecosystem Discovery

### What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem. Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools.

**Key commands:**
- `npx skills find [query]` - Search for skills interactively or by keyword
- `npx skills add <package>` - Install a skill from GitHub or other sources
- `npx skills check` - Check for skill updates
- `npx skills update` - Update all installed skills

**Browse skills at:** https://skills.sh/

### Discovery Process

**Step 1: Identify the need**
- Domain (e.g., React, testing, deployment)
- Specific task (e.g., writing tests, PR reviews)
- Likelihood a skill exists for this common task

**Step 2: Search**
```bash
npx skills find [query]
```

Examples:
- "how do I make my React app faster?" → `npx skills find react performance`
- "help with PR reviews?" → `npx skills find pr review`
- "create a changelog" → `npx skills find changelog`

**Step 3: Present options**
When skills are found, present:
1. Skill name and description
2. Install command
3. Link to skills.sh

**Step 4: Install if requested**
```bash
npx skills add <owner/repo@skill> -g -y
```

The `-g` flag installs globally and `-y` skips confirmation.

### Common Skill Categories

| Category        | Example Queries                          |
| --------------- | ---------------------------------------- |
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing         | testing, jest, playwright, e2e           |
| DevOps          | deploy, docker, kubernetes, ci-cd        |
| Documentation   | docs, readme, changelog, api-docs        |
| Code Quality    | review, lint, refactor, best-practices   |
| Design          | ui, ux, design-system, accessibility     |
| Productivity    | workflow, automation, git                |

**When no skills found:** Acknowledge the gap, offer direct help, suggest they could create their own skill with `npx skills init`.

## Skill Creation with TDD

**Creating skills IS Test-Driven Development applied to process documentation.**

### TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| Test case | Pressure scenario with subagent |
| Production code | Skill document (SKILL.md) |
| Test fails (RED) | Agent violates rule without skill |
| Test passes (GREEN) | Agent complies with skill present |
| Refactor | Close loopholes while maintaining compliance |

### When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious to you
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in CLAUDE.md)

### Skill Types

**Technique:** Concrete method with steps (condition-based-waiting, root-cause-tracing)
**Pattern:** Way of thinking about problems (flatten-with-flags, test-invariants)
**Reference:** API docs, syntax guides, tool documentation

### Directory Structure

```
skills/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

Flat namespace for searchability. Separate files only for heavy reference (100+ lines) or reusable tools.

### SKILL.md Structure

**Frontmatter (YAML):**
- Only `name` and `description` (max 1024 chars total)
- `name`: letters, numbers, hyphens only (no special chars)
- `description`: Third-person, starts with "Use when...", describes ONLY triggering conditions

**CRITICAL: Description = When to Use, NOT What the Skill Does**

Testing shows that descriptions summarizing workflow cause Claude to follow the summary instead of reading the full skill. Keep descriptions to triggering conditions only.

```yaml
# ❌ BAD: Summarizes workflow
description: Use when executing plans - dispatches subagent per task with code review between tasks

# ✅ GOOD: Just triggering conditions
description: Use when executing implementation plans with independent tasks in the current session
```

**Body structure:**
```markdown
# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to Use
Bullet list with SYMPTOMS and use cases
When NOT to use

## Quick Reference
Table or bullets for scanning

## Implementation
Inline code for simple patterns, link to file for heavy reference

## Common Mistakes
What goes wrong + fixes
```

### Claude Search Optimization (CSO)

**1. Rich Description Field**
- Start with "Use when..."
- Describe the problem/symptoms, not the solution workflow
- Third person (injected into system prompt)
- Never summarize the skill's process in description

**2. Keyword Coverage**
- Error messages: "Hook timed out", "ENOTEMPTY", "race condition"
- Symptoms: "flaky", "hanging", "zombie", "pollution"
- Synonyms: "timeout/hang/freeze"
- Tools: actual commands, library names

**3. Descriptive Naming**
- Active voice, verb-first
- ✅ `creating-skills` not `skill-creation`
- ✅ `condition-based-waiting` not `async-test-helpers`

**4. Token Efficiency**
Target word counts:
- getting-started workflows: <150 words each
- Frequently-loaded skills: <200 words total
- Other skills: <500 words

Move details to tool `--help`, use cross-references, compress examples, eliminate redundancy.

### The Iron Law

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

Applies to new skills AND edits to existing skills.

No exceptions for "simple additions", "documentation updates", or anything else. Delete untested changes and start over.

## RED-GREEN-REFACTOR for Skills

### RED: Write Failing Test (Baseline)

Run pressure scenario with subagent WITHOUT the skill. Document:
- What choices did they make?
- What rationalizations did they use (verbatim)?
- Which pressures triggered violations?

This is "watch the test fail" - see what agents naturally do.

### GREEN: Write Minimal Skill

Write skill addressing those specific rationalizations. Don't add hypothetical cases.

Run same scenarios WITH skill. Agent should now comply.

### REFACTOR: Close Loopholes

Agent found new rationalization? Add explicit counter. Re-test until bulletproof.

## Testing Skill Types

### Discipline-Enforcing Skills
Test with academic questions, pressure scenarios, multiple combined pressures.
Success: Agent follows rule under maximum pressure.

### Technique Skills
Test with application scenarios, variations, missing information.
Success: Agent applies technique to new scenario.

### Pattern Skills
Test with recognition scenarios, application, counter-examples.
Success: Agent identifies when/how to apply pattern.

### Reference Skills
Test with retrieval scenarios, application, gap testing.
Success: Agent finds and correctly applies reference information.

## Bulletproofing Against Rationalization

### Close Every Loophole Explicitly

Don't just state the rule - forbid specific workarounds:

```markdown
Write code before test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete
```

### Build Rationalization Table

Capture rationalizations from baseline testing:

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
```

### Create Red Flags List

```markdown
## Red Flags - STOP and Start Over

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"

**All of these mean: Delete code. Start over with TDD.**
```

## Continuous Improvement

**After deploying skills:**
- Monitor for violations in practice
- Capture new rationalizations agents use
- Add explicit counters to skill
- Re-test to verify closure
- Update CSO keywords if discovery fails

Skills are living documents. When agents find loopholes, plug them and re-deploy.

## Skill Creation Checklist

**RED Phase - Write Failing Test:**
- [ ] Create pressure scenarios (3+ combined pressures for discipline skills)
- [ ] Run scenarios WITHOUT skill - document baseline verbatim
- [ ] Identify patterns in rationalizations/failures

**GREEN Phase - Write Minimal Skill:**
- [ ] Name uses only letters, numbers, hyphens
- [ ] YAML frontmatter with only name and description (max 1024 chars)
- [ ] Description starts with "Use when..." with specific triggers
- [ ] Description written in third person
- [ ] Keywords throughout for search
- [ ] Clear overview with core principle
- [ ] Address specific baseline failures from RED
- [ ] One excellent code example (not multi-language)
- [ ] Run scenarios WITH skill - verify compliance

**REFACTOR Phase - Close Loopholes:**
- [ ] Identify NEW rationalizations from testing
- [ ] Add explicit counters
- [ ] Build rationalization table from all iterations
- [ ] Create red flags list
- [ ] Re-test until bulletproof

**Quality Checks:**
- [ ] Small flowchart only if decision non-obvious
- [ ] Quick reference table
- [ ] Common mistakes section
- [ ] No narrative storytelling
- [ ] Supporting files only for tools or heavy reference

**Deployment:**
- [ ] Commit skill to git and push to fork
- [ ] Consider contributing back via PR

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Writing skill before testing | Delete skill, run baseline first |
| Description summarizes workflow | Rewrite to only describe triggering conditions |
| Multi-language examples | Pick one excellent example in most relevant language |
| Generic template code | Use real scenario, ready to adapt |
| Testing after writing | Violation of Iron Law - delete and start over |

## The Bottom Line

**Creating skills IS TDD for process documentation.**

Same Iron Law: No skill without failing test first.
Same cycle: RED (baseline) → GREEN (write skill) → REFACTOR (close loopholes).
Same benefits: Better quality, fewer surprises, bulletproof results.

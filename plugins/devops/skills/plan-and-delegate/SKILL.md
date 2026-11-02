---
name: plan-and-delegate
description: Plan a multi-file change with a strong model, have a cheap sandboxed implementer write each task in its own worktree, then review and merge it yourself. Use only when the owner asks to delegate or plan-and-delegate, or for a change of three or more independent tasks that would spend real Claude or Astra quota. Not for small fixes, debugging, or anything touching credentials.
clis: claude, codex
clis-why: The planner and reviewer must be the strong lane. Economy CLIs are the implementers here, not the users of this skill.
---
# Plan and delegate

The strong model decides and reviews. A cheap model types. This spends premium quota on judgment
and economy quota on volume, which is the routing policy applied to code. Pattern adapted from
`writing-plans` and `subagent-driven-development` in obra/superpowers (MIT).

## The gate

Skip this skill and do the work directly when any of these holds:

- The change is under three independent tasks. The ceremony costs more than it saves.
- The task needs a design decision the plan cannot settle.
- It touches credentials, security boundaries, migrations or `principles/AGENTS.md`.
- You cannot state a command that proves the task is done.

## 1. Plan

Write the plan to the scratchpad. Each task needs:

- An ID and one goal.
- The exact files, and the files it must not touch.
- Every decision already made: names, signatures, formats. The implementer has none of your context.
- An acceptance command that fails now and passes when the task is done. Run it first and watch it fail.

Tasks must be independent, so no two tasks edit one file. Put the design in the plan, not the
implementer's hands: a plan that says "choose a good approach" delegates judgment to the cheap lane.

## 2. Delegate

```bash
scripts/delegate run --repo <path> --task <id> --prompt-file <task.md> --accept '<command>'
```

The implementer runs in a `bwrap` sandbox: read-only system, private `/tmp`, credentials masked, one
throwaway worktree writable. It cannot commit, push or merge. Never add that authority. The default is
`opencode-go/glm-5.3-flash`; pick another with `--impl <provider/model>`. Do not use Contributor
models, which train on prompts. Grok is not an implementer here.

## 3. Review

Read the diff yourself, in the worktree the script prints. A passing acceptance command proves the
command, not the change. Check the requirements line by line, and look for scope creep, stubs and
tests that were weakened to pass. Do not trust the implementer's report of what it did.

Send fixes back with `--feedback <file>` on the same task. Three rounds is the cap: then take the task
yourself. An 18-round fix loop is what the upstream cap exists to stop.

## 4. Land

Nothing lands without a reviewer. Apply the reviewed work yourself, then record the outcome:

```bash
scripts/delegate verdict --task <id> --outcome merged|rejected|taken-over
scripts/delegate clean --task <id>
```

## Stop rule

`scripts/delegate report` prints merge rate and fix rounds per task. Before each new plan, read it. If
the last five tasks merged under 60%, or averaged over two rounds, stop delegating and raise it with the
owner: reviewing has cost more than writing would.

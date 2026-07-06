# Feature Dev Hat

**Mindset**: Read before you write. Match existing patterns exactly. One change at a time, test-first. The best new code looks like it was always there. Maps to the `/dev` BUILD phase.

## Checklist
- [ ] Read the surrounding code; matched its style, naming, and idioms.
- [ ] Failing test written first (new/refactor); watched it fail for the right reason.
- [ ] Implemented the minimal code to pass — no speculative features.
- [ ] Type check after each file; tests after each logical group.
- [ ] Functions <50 lines, files <500; split proactively.
- [ ] Comments explain WHY, never WHAT.
- [ ] Orphans from my change removed (unused imports/vars/functions).

## Output Format
```
## Build
**Changed**: {file → what}
**Tests**: {added; red→green confirmed}
**Verification**: {type check + test result}
```

## Anti-Patterns
- Writing before reading the existing patterns.
- Refactoring adjacent code that isn't part of the task.
- Batching many unrelated changes into one pass.

# Debugger Hat

**Mindset**: Build a red-capable feedback loop *before* theorizing. A tight pass/fail signal that goes red on THIS bug finds the cause; staring at code does not. Maps to `/dev debug` mode. For hard bugs and perf regressions, invoke the **`diagnosing-bugs`** skill.

## Checklist
- [ ] Reproduced: exact error, exact trigger, captured.
- [ ] A red-capable loop exists (test/script/curl) that you have run and seen go red.
- [ ] Minimized: smallest input/scenario that still fails.
- [ ] 3-5 ranked, falsifiable hypotheses before touching anything.
- [ ] One variable changed per probe; debug logs tagged `[DEBUG-xxxx]`.
- [ ] Root cause fixed (not the symptom); regression test added.
- [ ] All `[DEBUG-...]` instrumentation removed afterward.

## Output Format
```
## Debug
**Symptom**: {observed}
**Repro**: {command that goes red}
**Hypotheses**: {ranked, falsifiable}
**Root cause**: {what + evidence}
**Fix**: {change + regression test}
```

## Anti-Patterns
- Hypothesizing before a repro loop exists.
- "Log everything and grep."
- Fixing the symptom and leaving the cause.

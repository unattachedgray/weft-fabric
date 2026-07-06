# Architect Hat

**Mindset**: Think in boundaries, interfaces, and data flow — not implementation. Decide *where* things live and *how* they talk before *how* they work. Prefer the simplest structure that survives the next three changes. Favor deep modules (simple interface, real work hidden) over shallow ones. Maps to the `/dev` PLAN phase.

## Checklist
- [ ] Module boundaries drawn: what each owns, one sentence each.
- [ ] Interfaces defined before internals — inputs, outputs, error contract.
- [ ] Data flow traced end-to-end; no hidden global coupling.
- [ ] One alternative design considered and explicitly rejected (with the reason).
- [ ] Blast radius named: what breaks if this design is wrong?
- [ ] Simplest version that delivers the value (YAGNI) — no speculative flexibility.
- [ ] Fits existing patterns/conventions in the codebase.

## Output Format
```
## Architecture
**Approach**: {2-3 sentences}
**Boundaries**: {module → responsibility}
**Interfaces**: {signatures / contracts}
**Data flow**: {A → B → C}
**Rejected**: {alternative + why}
**Risks**: {blast radius, size limits}
```

## Anti-Patterns
- Designing implementation detail instead of boundaries.
- Adding configurability or abstraction nobody asked for.
- Skipping the rejected-alternative (anchoring on the first idea).
- Interfaces that leak internals.

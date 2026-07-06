# Security Reviewer Hat

**Mindset**: Assume every input is hostile and every boundary is an attack surface. Absence of a known exploit is not evidence of safety. For serious paths (auth, payments, data, migrations), escalate to the installed **`agent-skills:security-auditor`** agent for an independent audit — this is the `/dev serious` security gate.

## Checklist (OWASP-oriented)
- [ ] Injection: SQL/NoSQL/command/template inputs parameterized, never string-built.
- [ ] AuthN/AuthZ: every protected action checks identity AND permission; no IDOR.
- [ ] Secrets: none hardcoded; read from env/secret store; never logged.
- [ ] Input validation: type, range, length, format on all untrusted input.
- [ ] Deserialization: no unsafe eval/pickle/YAML-load on untrusted data.
- [ ] Supply chain: new deps vetted; lockfile pinned; no typosquats.
- [ ] Output encoding: XSS-safe rendering; no raw HTML from user input.
- [ ] Sensitive data: encrypted at rest/in transit; minimal exposure in responses.

## Output Format
```
## Security Review
**Critical**: {exploitable now — block ship}
**High**: {likely exploitable}
**Hardening**: {defense-in-depth suggestions}
**Verdict**: PASS / FAIL
```

## Anti-Patterns
- "It's internal, so it's safe."
- Trusting client-side validation.
- Adding a security check as a follow-up instead of a gate.

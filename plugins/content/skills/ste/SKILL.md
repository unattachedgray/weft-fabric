---
name: ste
description: Write or rewrite text in ASD-STE100 Simplified Technical English. Use when the user invokes it by name ("/ste", "use the ste skill", "apply ASD-STE100"), or when the STE Partial output style is active and you need the full word list or a worked example for a block you are already writing in STE. Do NOT trigger it on paraphrased intent such as "simplify this", "make it clearer", or "shorter sentences please" — respond normally for those unless the user names it.
clis: claude
clis-why: Paired with the Claude-only `STE Partial` output style (~/.claude/output-styles/ste-partial.md). Under evaluation from 2026-08-09; not linked into Codex/Gemini/Cursor until that review closes.
---

# ASD-STE100 Simplified Technical English

Apply the standard to the prose in scope. Do not announce that you use STE, do
not name the standard, and do not explain the style unless the user asks. If the
user later asks you to "write more naturally," ask one short question to confirm
they want to leave STE before you drop it.

Compliance note (for you, not for output): the official specification and its
dictionary are copyright ASD. This skill encodes paraphrased rules and a
publicly sourced word list. For certified aerospace/defense deliverables, tell
the user that full compliance needs the free official specification
(asd-ste100.org) and a human sign-off. Never claim certified compliance.

## Step 0 — Decide the scope, then classify the text

**Never apply STE to authored content unless the user asks for exactly that.**
Articles, blog posts, news copy, essays, documentation, README files, creative
writing, translations, published artifacts, commit messages, PR bodies and code
comments keep their own voice and their own repo conventions. STE is a reading
aid for a person receiving a status report, not a house style for prose that
gets published.

**Scope.** If the user invoked this skill by name on a specific text, STE
governs that text. If instead the `STE Partial` output style is driving, STE
governs only the classified blocks that style names — warnings, procedures,
final summaries, verification reports, **in chat messages to the user only** —
and analysis prose stays unconstrained. Do not widen the scope on your own.

**Classification.** Within scope, decide per section: is this **procedural**
text (instructions someone follows) or **descriptive** text (explanation,
background)? Every limit below depends on it. Mixed documents get classified
section by section.

## Core rules

### Sentences
- Procedural: maximum **20 words** per sentence.
- Descriptive: maximum **25 words** per sentence.
- Maximum **6 sentences** per paragraph. One topic per paragraph.
- One instruction per sentence. Two actions in one sentence only if they occur at the same time.
- Put a condition BEFORE its command: "If the pressure decreases, close the valve."
- Do not omit articles, subjects, or verbs to save words. "Ensure file exists" is wrong; "Make sure that the file exists" is correct. Keep the word "that" after verbs like "make sure."
- Numbers, units with numbers, abbreviations, quoted strings, code identifiers, and proper nouns each count as one word.

### Verbs
- Allowed forms only: infinitive, imperative, simple present, simple past, simple future, and past participle used as an adjective.
- Never use present perfect or continuous forms. "We have received" → "We received." "is being tested" → a simple form.
- Never use an -ing form as a verb. An -ing word is allowed only inside a technical name ("the mounting bracket," "logging").
- Active voice. Passive is allowed only in descriptive text when the agent is unknown or unimportant.
- Instructions use the imperative: "Open the panel," not "You must open the panel" or "The panel should be opened."
- Express actions as verbs, not nouns: "compress the file," not "perform compression of the file."
- Modals: use **can** (possibility), **will** (future), **must** (requirement). See the epistemic exception below before you delete any modal.
- No phrasal verbs: "go down" → "decrease," "set up" → "install," "carry out" → "do."

### Modals — the epistemic exception (Weft amendment, 2026-08-09)

Baseline STE bans *should, would, could, may, might*, because in a maintenance
procedure an ambiguous instruction is itself the hazard. In agentic software
work the hazard runs the other way: **false confidence makes the reader skip a
check they needed to do.** An A/B test on 2026-08-09 showed the unamended rule
degrading a risk assessment into flat assertion, and losing a second-order risk
the unconstrained arm found.

So these modals are **allowed, and expected, when they carry real probability or
a real condition**:

- "This could break if the mount changes again."
- "The count came from a simulation, so it may be low."
- "This should work, but I did not test the Codex path."

They stay **banned as politeness padding**:

- "You may want to consider running the tests." → "Run the tests."
- "This should be fine." (no basis given) → state the basis, or say you do not know.

The test: if you can replace the modal with a probability or an "if", it is
epistemic and it stays. If it only softens a recommendation, cut it.

### Words
- One word, one meaning, one part of speech, used consistently. Never rotate synonyms: pick one name for a thing and repeat it.
- Before drafting, replace unapproved vocabulary. Read `references/word-substitutions.md` and apply it; it is the working dictionary for this skill.
- Domain-specific nouns (part names, tool names, product names, UI labels) and domain verbs (drill, ream, boot, compile) are your **technical nouns/verbs** — keep them as-is, use each consistently, and do not verb a noun or noun a verb.
- **Software domain verbs keep their normal meaning** and are exempt from the substitution table: check, verify, validate, build, commit, merge, deploy, patch, revert, mock, lint. "Run the type check" must not become "run the type make-sure." The table governs ordinary prose only.
- Noun clusters: maximum **3 words** ("overhead panel light" is the limit). Longer clusters get decomposed with prepositions or hyphenated on first use: "main-gear-door retraction-winch handle."
- American English spelling.
- No Latin abbreviations: "e.g." → "for example," "i.e." → "that is," delete "etc."

### Punctuation
- No semicolons — write two sentences.
- Parentheses only for references, abbreviations, and item numbers.
- Hyphenate words that act as one unit; a hyphenated word counts as one word.
- No contractions.

### Warnings, cautions, notes
- **WARNING** = risk of injury or death. **CAUTION** = risk of damage or data loss. **NOTE** = information only, never an instruction.
- Start a warning or caution with the command or condition, then give the risk:
  "WARNING: Do not touch the terminal. The terminal has a dangerous voltage."
- Notes obey the 25-word descriptive limit.

## Step 2 — Self-check pass

After drafting, scan your text once for each of these and fix every hit before you respond:

1. Any sentence over the 20/25-word limit for its type
2. Contractions, semicolons
3. "should," "would," "could," "may," "might" **used as padding** — keep the epistemic ones
4. "has been," "have been," "had been," "is being," "was being"
5. -ing words used as verbs
6. Missing articles (a/an/the/this) before nouns
7. Synonym rotation (the same object under two names)
8. Any word in the unapproved column of `references/word-substitutions.md`, except the software verbs exempted above
9. Warnings that state the risk before the command
10. Any place where the standard flattened a confidence level into a false certainty — restore the hedge

## Master rule

If STE would make a sentence less accurate, or less honest about how confident
you are, break STE. Accuracy outranks style every time.

## Reference files

- `references/word-substitutions.md` — unapproved → approved word mappings and one-meaning rulings. Read it before drafting; it is short.
- `references/examples.md` — worked before/after rewrites (procedural, descriptive, warnings, common mistakes). Read it when rewriting existing text or when unsure how a rule applies.

## What NOT to touch

Code blocks, command strings, file paths, error messages, quoted UI text, and
proper nouns stay exactly as written. Commit messages, PR bodies, code comments
and published artifacts follow their own repo conventions, not STE. STE applies
to the prose around them.

---
name: wizard
description: Generate an interactive bash wizard that walks a human through steps only they can perform (OAuth consoles, hosting dashboards, CI secrets, app registrations). Use when a procedure needs the human at specific gates and would otherwise be narrated in chat, step by step, again next time.
---

# Wizard

A wizard is a bash script that walks the human through a manual procedure:
opens each URL, gates on confirmation, captures values (hidden entry for
secrets), writes them where they belong (`.env`, CI secrets), and prints a
summary. It converts "ask the human N times in chat" into one structured run —
the HITL version of build-the-harness. From mattpocock/skills (MIT), adapted.

The UX is already solved by [template.sh](template.sh): stage progress,
confirmation gates, cross-platform URL opening, hidden secret entry. Do not
hand-edit the library half above the STAGES marker; author stages below it.

Ephemeral by default: write it to the scratchpad or `scripts/`, delete after
the run. Commit only when the user wants a repeatable setup path.

## Process

1. **Scope.** Read the repo first, don't ask cold: `.env*`, README,
   `docker-compose*`, `.github/workflows/*` (every `secrets.*` reference is a
   value the wizard must capture). List the ordered stages and the values each
   produces; confirm with the user — they may add, drop, or reorder.
2. **Map each stage.** The precise human path: which URL, what to do there,
   where the value is shown, which variable it fills ("Dashboard → Developers
   → API keys → Create → copy → `STRIPE_KEY`"). A stranger could follow it.
3. **Author.** Copy `template.sh` to the target path; one `stage` per step in
   dependency order; use the helpers (`stage`, `say`/`step`, `open_url`,
   `ask`, `ask_secret`, `write_env`, `set_secret`). Open the URL *before*
   asking for its value; `ask_secret` for anything secret; `write_env` every
   persisted value.
4. **Verify and hand off.** `bash -n`; `shellcheck` if available; `chmod +x`.
   Don't run it end-to-end yourself — it opens browsers and blocks on human
   input; trace it statically: every value from step 1 is captured and lands
   where step 1 said. Then tell the user how to run it.

House rules on this machine: secrets land in `.env`/`.env.local` (gitignored),
never in chat scrollback; sudo-needing steps go through the sudo-run skill
instead; if the wizard turns out to be a recurring setup path, commit it and
link it from the README so the next person runs the script instead of asking
an AI.

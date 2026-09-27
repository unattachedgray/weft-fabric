#!/usr/bin/env python3
"""Find LLM call sites in a codebase and rank how "decision-shaped" each one looks.

    python3 scan.py <repo-root> [--all]

Deterministic and stdlib-only, so every CLI and machine gets the same inventory.
For each file that calls an LLM (HTTP endpoint, SDK, or CLI subprocess) it prints the
call lines and a decision score: how many label/verdict/score/route cues appear within
40 lines of the call. A high score is a lead for the audit, not a verdict: read the code.
--all also lists files whose score is 0.
"""
from __future__ import annotations

import os
import re
import sys

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", "web_dist",
             ".next", "target", "vendor", "site-packages", ".mypy_cache", ".pytest_cache", "coverage"}
EXTS = {".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".go", ".rs", ".rb", ".java", ".kt", ".sh", ".php"}

CALL = {
    "http": re.compile(r"/v1/chat/completions|/v1/messages\b|/v1/responses\b|api\.openai\.com|api\.anthropic\.com|"
                       r"generativelanguage\.googleapis|openrouter\.ai/api|api\.cerebras\.ai|api\.groq\.com|"
                       r"api\.deepseek\.com|api\.mistral\.ai|api\.x\.ai|api\.together\.xyz|api\.cohere\.com|127\.0\.0\.1:1234|localhost:1234|:11434/api|"
                       r"127\.0\.0\.1:8090|localhost:8090"),
    "sdk": re.compile(r"\bfrom openai\b|\bimport openai\b|\bimport anthropic\b|\bfrom anthropic\b|\bnew OpenAI\(|"
                      r"\bnew Anthropic\(|\bChatOpenAI\(|\bChatAnthropic\(|\blitellm\.|\bollama\.(chat|generate)|"
                      r"@ai-sdk/|generateText\(|generateObject\(|streamText\(|@anthropic-ai/sdk|@google/generative-ai|"
                      r"\bfrom [\"']ai[\"']|@langchain|\blangchain\b|llamaindex|@xai/sdk|@azure/openai|\bbedrock\b|"
                      r"chat\.completions\.create|messages\.create\(|generateContent\("),
    "cli": re.compile(r"""["']claude["']\s*,\s*["']-p["']|\bclaude -p\b|codex["']?\s*,?\s*["']?exec\b|\bcodex exec\b|"""
                      r"""\bgemini -p\b|cursor-agent|\bagy\b.{0,20}\bexec|\bgrok\b.{0,20}-p\b"""),
    "typed": re.compile(r"/v1/systemone|typesafe|typed_decisions"),
}
# Pattern lists merged with github.com/MagicBeansAI/jev-audit (MIT); this scanner adds gateway,
# local-server and subscription-CLI calls, which that scanner does not see.
CUES = re.compile(
    r"classif|categor|\bverdict\b|\blabel\b|\bone of\b|yes or no|yes/no|true/false|\bscore\b|\brate\b.{0,15}\b(1|0)\s*[-–]\s*(5|10|100)\b|"
    r"\bconfidence\b|\broute\b|\brouting\b|\bintent\b|\brelevan|\bspam\b|\btoxic|\bsentiment\b|\bpriority\b|\burgen|"
    r"\bsufficien|\bjudge\b|\bpass/fail\b|\bapprove\b|\bescalat|\bdecide\b|\bchoose\b|\bselect (one|the best)|\benum\b|"
    r"return only (json|one)|answer with (only|exactly)|\bsupported\b|\brefuted\b",
    re.I)
WINDOW = 40


def scan_file(path: str):
    try:
        lines = open(path, encoding="utf-8", errors="replace").read().splitlines()
    except OSError:
        return None
    calls = [(i, kind) for i, line in enumerate(lines) for kind, rx in CALL.items() if rx.search(line)]
    if not calls:
        return None
    score = 0
    for i, kind in calls:
        if kind == "typed":
            continue
        lo, hi = max(0, i - WINDOW), min(len(lines), i + WINDOW)
        score = max(score, sum(1 for l in lines[lo:hi] if CUES.search(l)))
    return score, calls, lines


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_all = "--all" in sys.argv
    root = args[0] if args else "."
    found = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for f in files:
            if os.path.splitext(f)[1] in EXTS and "test" not in f.lower():
                p = os.path.join(base, f)
                r = scan_file(p)
                if r:
                    found.append((p, *r))
    found.sort(key=lambda x: -x[1])
    typed = [p for p, _, calls, _ in found if any(k == "typed" for _, k in calls)]
    print(f"# {len(found)} files call an LLM or a typed-decision API under {os.path.abspath(root)}")
    print(f"# already on typed decisions: {len(typed)}")
    for path, score, calls, lines in found:
        if score == 0 and not show_all:
            continue
        kinds = sorted({k for _, k in calls})
        print(f"\n{os.path.relpath(path, root)}  decision-cues={score}  kinds={','.join(kinds)}")
        for i, kind in calls[:6]:
            print(f"  {i + 1:5d} [{kind}] {lines[i].strip()[:110]}")
        if len(calls) > 6:
            print(f"        … {len(calls) - 6} more call lines")


if __name__ == "__main__":
    main()

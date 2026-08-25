#!/usr/bin/env python3
"""unslop-lint — deterministic AI-cliche detector for published prose (2026-08-23).

WHY: the owner adopted the unslop idea (pstack/Lauren Tan; also
mattpocock/skills) for articles and the news pipeline. The removal half is a
word/pattern list — a decision we can state as a rule, so it is code, not a
model call (CLAUDE.md: deterministic beats LLM). The "soul" half stays prose
guidance in the doc-article skill; a linter cannot measure voice.

Scope: PUBLISHED prose only — articles (web/fb/pages-src), news text, /doc/
pages. Never terminal replies (those follow the STE output style) and never
code comments.

Lexicon policy (from the checklist research, DECISIONS 2026-08-23): every
entry must actually fire on real output or it is dead weight — run with
`--stats` over the corpus periodically and prune entries that never fired.
KO entries marked PROVISIONAL were seeded from known LLM-Korean cliches, not
yet all observed in our corpus.

Usage:
  unslop-lint.py FILE [FILE...]      # report findings, exit 1 if any
  unslop-lint.py --report FILE...    # report only, always exit 0
  unslop-lint.py --json FILE...      # machine-readable
  unslop-lint.py --stats FILE...     # which lexicon entries fired (pruning aid)

HTML input is de-tagged line by line; <script>/<style> blocks are skipped.
"""
from __future__ import annotations

import html as _html
import json
import re
import sys
from pathlib import Path

# ── lexicons ──────────────────────────────────────────────────────────────
# kind, regex, note. High precision over recall: a false positive teaches the
# writer to ignore the gate (Urbach 2014: imposed checklists → null effect).

EN_PATTERNS = [
    ("en-vocab", r"\bdelve(?:s|d)?\b", "AI vocabulary"),
    ("en-vocab", r"\btapestry\b", "abstract tapestry"),
    ("en-vocab", r"\btestament to\b", "puffery"),
    ("en-vocab", r"\bpivotal\b", "puffery"),
    ("en-vocab", r"\bshowcas(?:e|es|ing)\b", "AI vocabulary"),
    ("en-vocab", r"\bcrucial\b", "AI vocabulary"),
    ("en-vocab", r"\bfoster(?:s|ing)\b", "AI vocabulary"),
    ("en-vocab", r"\bgarner(?:s|ed)?\b", "AI vocabulary"),
    ("en-vocab", r"\bintricate\b", "AI vocabulary"),
    ("en-vocab", r"\bever-evolving\b|\bevolving landscape\b|\blandscape of\b", "abstract landscape"),
    ("en-vocab", r"\bgroundbreaking\b|\brenowned\b|\bbreathtaking\b|\bstunning\b", "promotional"),
    ("en-is", r"\bserves as\b|\bstands as\b|\bboasts\b", 'fancy "is" — just say is/has'),
    ("en-frame", r"\bnot (?:just|only|merely)\b[^.\n]{0,60}\bbut\b", '"not just X but Y" — state the point'),
    ("en-frame", r"\bit(?:'s| is) (?:important|worth) (?:to note|noting)\b", "filler frame"),
    ("en-frame", r"\bin conclusion\b|\bmoreover\b|\bfurthermore\b|\badditionally\b", "essay connective"),
]

# LLM-Korean cliches. Sources: observed news/article drafts + known K-blog slop.
KO_PATTERNS = [
    ("ko-cliche", r"귀추가\s*주목", "기사 상투구"),
    ("ko-cliche", r"이목[이을]\s*집중", "기사 상투구"),
    ("ko-cliche", r"눈길을\s*끌", "기사 상투구"),
    ("ko-cliche", r"화제가\s*되고\s*있", "기사 상투구"),
    ("ko-cliche", r"주목\s*받고\s*있다", "기사 상투구 PROVISIONAL"),
    ("ko-cliche", r"자리매김", "puffery"),
    ("ko-cliche", r"새로운\s*지평", "puffery"),
    ("ko-cliche", r"괄목할\s*만한", "puffery"),
    ("ko-cliche", r"한\s*획을\s*긋", "puffery"),
    ("ko-cliche", r"시사하는\s*바가\s*크", "필러 프레임"),
    ("ko-cliche", r"중요한\s*시사점", "필러 프레임 PROVISIONAL"),
    ("ko-blog", r"알아보(?:겠습니다|도록\s*하겠습니다)", "블로그 슬롭"),
    ("ko-blog", r"살펴보(?:겠습니다|도록\s*하겠습니다)", "블로그 슬롭"),
    ("ko-blog", r"에\s*대해\s*알아보", "블로그 슬롭"),
    ("ko-blog", r"마무리하며|마치며", "블로그 슬롭 PROVISIONAL"),
    ("ko-frame", r"결론적으로", "에세이 연결어 PROVISIONAL"),
    ("ko-frame", r"다양한\s*측면에서", "빈 수식"),
    ("ko-frame", r"중요한\s*역할을\s*(?:하고|한다|합니다)", "빈 수식"),
]

# Em dashes: an AI tell in both languages; Korean prose almost never needs one.
# ASCII "--" counts only when space-delimited — bare "--" is CSS vars/dasharray
# (MEASURED 2026-08-23: 669/1116 first-run findings were SVG attributes).
DASH_RE = re.compile(r"[—―]|(?<=\s)--(?=\s)")
# 가운뎃점: legitimate in names (김·이·박) but LLM Korean uses it as a comma
# substitute constantly — owner ruled it out of published prose (2026-08-23).
# digit·digit is exempt: 3·1 운동, 5·16, 12·12 — 가운뎃점 in historical-date
# proper names IS the standard orthography (and agents split three ways on it
# until this rule existed, MEASURED 2026-08-23).
KDOT_RE = re.compile(r"(?<![0-9])[·ㆍ](?![0-9])")
# official proper names whose LEGAL/registered form contains 가운뎃점 — changing
# them would misname the entity. Grow only with a verified official form.
KDOT_PROPER = ("기념·도서관", "제재·부과금")
# text inside quote marks is someone else's words (quoted speech, cited
# headline, book title) — exempt, matching the <blockquote> rule.
QUOTE_SPAN_RE = re.compile(r"「[^」]*」|『[^』]*』|“[^”]*”|\u201c[^\u201d]*\u201d|"
                           r"\"[^\"]{2,200}?\"|'[^'\n]{2,200}?'")
# Owner's ruling on dash classes (2026-08-23): quote-attribution lines (start
# with a dash) and short heading/label/table lines are legitimate typography —
# exempt. Only mid-sentence dashes in prose lines are the AI tell.
ATTRIBUTION_RE = re.compile(r"^\s*[—―]")
LABEL_MAX_CHARS = 45

TAG_RE = re.compile(r"<[^>]*>")
SKIP_BLOCK_RE = re.compile(r"<(script|style)\b", re.I)
SKIP_BLOCK_END_RE = re.compile(r"</(script|style)>", re.I)

ALL_PATTERNS = [(k, re.compile(p, re.I), note) for k, p, note in EN_PATTERNS] + \
               [(k, re.compile(p), note) for k, p, note in KO_PATTERNS]


def lint_lines(lines: list[str], is_html: bool) -> list[dict]:
    findings = []
    in_skip = False
    in_tag = False
    table_depth = 0
    for i, raw in enumerate(lines, 1):
        line = raw
        if is_html:
            if in_skip:
                if SKIP_BLOCK_END_RE.search(line):
                    in_skip = False
                continue
            if SKIP_BLOCK_RE.search(line) and not SKIP_BLOCK_END_RE.search(line):
                in_skip = True
                continue
            # TRAP (MEASURED 2026-08-23): tags span lines (an SVG <path> with a
            # 40-line attribute list). A line that continues an open tag is
            # attribute text, not prose — drop up to the closing ">".
            if in_tag:
                if ">" in line:
                    line = line.split(">", 1)[1]
                    in_tag = False
                else:
                    continue
            # data tables are not prose, and blockquotes are someone else's words —
            # dash/kdot there is formatting or the source's own punctuation, not the AI tell
            table_depth += len(re.findall(r"<(?:table|blockquote)\b", raw, re.I))
            close_after = len(re.findall(r"</(?:table|blockquote)>", raw, re.I))
            line = TAG_RE.sub(" ", line)
            if "<" in line:
                line = line.split("<", 1)[0]
                in_tag = True
            in_table = table_depth > 0
            table_depth = max(0, table_depth - close_after)
            if in_table:
                continue
        line = _html.unescape(line)      # &mdash;/&middot; are the same tell
        spans = [m.span() for m in QUOTE_SPAN_RE.finditer(line)]
        def _quoted(pos):
            return any(a <= pos < b for a, b in spans)
        stripped = line.strip()
        prose = len(stripped) > LABEL_MAX_CHARS and not ATTRIBUTION_RE.match(stripped)
        if prose:
            for m in DASH_RE.finditer(line):
                if _quoted(m.start()):
                    continue
                findings.append({"line": i, "kind": "dash", "match": m.group(0),
                                 "note": "mid-sentence dash — period, comma, or parentheses", "text": stripped[:120]})
        for m in KDOT_RE.finditer(line):
            if _quoted(m.start()):
                continue
            ctx = line[max(0, m.start() - 12):m.end() + 12]
            if any(prop in ctx for prop in KDOT_PROPER):
                continue
            findings.append({"line": i, "kind": "kdot", "match": m.group(0),
                             "note": "가운뎃점 — 쉼표나 조사로 풀기", "text": stripped[:120]})
        for kind, rx, note in ALL_PATTERNS:
            for m in rx.finditer(line):
                findings.append({"line": i, "kind": kind, "match": m.group(0),
                                 "note": note, "text": line.strip()[:120]})
    return findings


def lint_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    is_html = path.suffix.lower() in {".html", ".htm"} or text.lstrip()[:1] == "<"
    return lint_lines(text.splitlines(), is_html)


def main(argv: list[str]) -> int:
    flags = {a for a in argv if a.startswith("--")}
    files = [Path(a) for a in argv if not a.startswith("--")]
    if not files:
        print(__doc__.strip().splitlines()[0])
        print("usage: unslop-lint.py [--report|--json|--stats] FILE...")
        return 2
    per_file = {}
    for f in files:
        if not f.is_file():
            print(f"unslop-lint: no such file: {f}", file=sys.stderr)
            return 2
        per_file[str(f)] = lint_file(f)
    total = sum(len(v) for v in per_file.values())
    if "--json" in flags:
        print(json.dumps(per_file, ensure_ascii=False, indent=1))
    elif "--stats" in flags:
        from collections import Counter
        c = Counter((x["kind"], x["match"].lower()) for v in per_file.values() for x in v)
        for (kind, match), n in c.most_common():
            print(f"{n:4d}  {kind:10s} {match}")
        print(f"-- {total} findings / {len(files)} files; lexicon entries that never fire are prune candidates")
    else:
        for fn, v in per_file.items():
            for x in v:
                print(f"{fn}:{x['line']}: [{x['kind']}] {x['match']!r} — {x['note']}")
        print(f"unslop-lint: {total} finding(s) in {len(files)} file(s)")
    if "--report" in flags or "--stats" in flags:
        return 0
    return 1 if total else 0


def _selftest() -> int:
    html = """<style>a { color: var(--x); }</style>
<path
 style="stroke: var(--mk-c-ink); stroke-dasharray: 4,3"
 d="M0 0"/>
<p>이드리시가 그린 세계지도에서 지도의 동쪽 끝 — 화면 왼쪽 — 바다에 섬들이 떠 있다. A crucial choice.</p>
<p>그는 기록의 계보를 따라 delved -- yes -- deeper into the archive. 그래서 귀추가 주목된다.</p>
<table><tr><td>고려충신 직제학 정희(鄭熙) 사단 — 화담사·경현사 배향, 표 안이므로 잡히면 안 된다</td></tr></table>"""
    f = lint_lines(html.splitlines(), is_html=True)
    kinds = sorted(x["kind"] for x in f)
    assert kinds.count("dash") == 4, f  # 2 em + 2 spaced "--", zero CSS hits
    assert "en-vocab" in kinds and "ko-cliche" in kinds, f
    assert not any("--mk" in x["match"] or "--x" in x["match"] for x in f), f
    plain = lint_lines(["A testament to progress in every field of it — truly."], is_html=False)
    assert {x["kind"] for x in plain} == {"en-vocab", "dash"}, plain
    # owner's exemptions: attribution start, short label; 가운뎃점 flagged anywhere
    ex = lint_lines(["— 술레이만, 『중국과 인도 소식』 73쪽 (김정위 2005 재인용)",
                     "제3장 : 전언의 계보 — 베끼고, 굳어지다",
                     "이 문장은 마흔다섯 자를 넘기는 보통 산문 줄이라 가운데 있는 대시가 — 이렇게 — 잡혀야 한다",
                     "라우트·번들 확인"], is_html=False)
    ks = [x["kind"] for x in ex]
    assert ks.count("dash") == 2 and ks.count("kdot") == 1, ex
    # entities count; digit·digit and quoted spans do not
    ex2 = lint_lines(["5·16 군사정변 직후의 일이고 3·1 운동과는 무관하다는 것이 통설로 굳어져 왔다",
                      "그가 말했다. 「소유·인사 구조가 문제다」 라는 제목의 기사가 나란히 실렸기 때문이다",
                      "표기는 다르지만 같은 대시다 &mdash; 실체가 같으면 잡는다 &middot; 그래서 이 줄은 두 번 걸린다"],
                     is_html=False)
    ks2 = [x["kind"] for x in ex2]
    assert ks2.count("kdot") == 1 and ks2.count("dash") == 1, ex2
    ex3 = lint_lines(["최은순은 지방행정제재·부과금 체납 전국 개인 1위에 올랐고 건물은 압류됐다"], is_html=False)
    assert not ex3, ex3
    print("selftest ok")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(_selftest())
    sys.exit(main(sys.argv[1:]))

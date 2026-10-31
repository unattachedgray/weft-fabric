#!/usr/bin/env node
// Render a page in headless Chromium, measure it, and report what source checks cannot see.
//
//   render-check.mjs <url|file.html> [--widths 1440,390] [--out DIR] [--json] [--operate] [--no-history]
//                    [--no-scripts] [--allow-remote]
//
// Exit 0 clean, 2 findings, 1 could not render. Needs no packages: Node's WebSocket drives Chromium.
// Findings are advisory. A signature of each render lands in the history, so a new page is compared
// with past work, which is the one sameness measure nobody can game with a rule.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const has = (name) => { const i = argv.indexOf(`--${name}`); if (i < 0) return false; argv.splice(i, 1); return true; };
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); if (i < 0) return fallback; const [, v] = argv.splice(i, 2); return v; };
const asJson = has('json'), operate = has('operate'), noHistory = has('no-history'), noScripts = has('no-scripts'), remoteOk = has('allow-remote');
const widths = opt('widths', '1440,390').split(',').map(Number);
const out = opt('out', null);
const target = argv[0];
const printProbe = argv[0] === '--print-probe';
if (!target && !printProbe) { console.error('usage: render-check.mjs <url|file.html> [--widths 1440,390] [--out DIR] [--json] [--operate]'); process.exit(1); }
const url = printProbe ? 'file:///' : /^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(target)).href;
// Ubuntu blocks Chromium's sandbox here, so it runs without one. That is acceptable for your own local
// pages only: a remote page needs --allow-remote, and untrusted local files need --no-scripts.
if (!/^file:|^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) && !remoteOk) { console.error('Refusing a remote page without a browser sandbox. Pass --allow-remote to accept that.'); process.exit(1); }
const HISTORY = join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'design-taste/signatures.jsonl');

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const path of ['/usr/bin/chromium', '/usr/bin/google-chrome']) if (existsSync(path)) return path;
  const cache = join(homedir(), '.cache/ms-playwright');
  if (existsSync(cache)) {
    const shells = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
    for (const shell of shells) {
      for (const folder of readdirSync(join(cache, shell))) {
        const path = join(cache, shell, folder, 'chrome-headless-shell');
        if (existsSync(path)) return path;
      }
    }
  }
  throw new Error('No Chromium found. Set CHROME_PATH.');
}

class Session {
  constructor(socket) { this.socket = socket; this.id = 0; this.waiting = new Map(); this.listeners = [];
    socket.addEventListener('message', ({ data }) => { const m = JSON.parse(data);
      if (m.id && this.waiting.has(m.id)) { const [ok, no] = this.waiting.get(m.id); this.waiting.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
      else for (const fn of this.listeners) fn(m); }); }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((ok, no) => { this.waiting.set(id, [ok, no]); this.socket.send(JSON.stringify({ id, method, params, sessionId })); }); }
  once(method, sessionId, ms) { return new Promise((ok) => { const t = setTimeout(ok, ms); const fn = (m) => { if (m.method === method && m.sessionId === sessionId) { clearTimeout(t); ok(); } }; this.listeners.push(fn); }); }
}

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'render-check-'));
  const child = spawn(findBrowser(), ['--headless', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const ws = await new Promise((ok, no) => { let text = ''; const t = setTimeout(() => no(new Error('Chromium did not start')), 15000);
    child.stderr.on('data', (d) => { text += d; const m = text.match(/ws:\/\/\S+/); if (m) { clearTimeout(t); ok(m[0]); } });
    child.on('exit', () => no(new Error('Chromium exited: ' + text.slice(-200)))); });
  const socket = new WebSocket(ws);
  await new Promise((ok, no) => { socket.onopen = ok; socket.onerror = no; });
  return { session: new Session(socket), close() { socket.close(); child.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 300); } };
}

// Runs inside the page. Everything measured here is what a visitor receives.
const PROBE = String(function probe() {
  const W = innerWidth, H = innerHeight, found = [];
  const add = (group, rule, why) => found.push({ group, rule, why });
  const rgb = (s) => { const m = s && s.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return { r, g, b, a }; };
  const visible = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.width > 0 && r.height > 0; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return { h: 0, s: 0, l };
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(2 * l - 1)), l }; };
  const ground = (el) => { let solid = null; const stack = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none') return null; const c = rgb(s.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) { solid = c; break; } } }
    let base = solid || { r: 255, g: 255, b: 255 }; for (const c of stack.reverse()) if (c !== solid) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; return base; };
  const textNodes = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const n = walker.currentNode; if (n.textContent.trim().length > 1 && n.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(n.parentElement.tagName)) textNodes.push(n); }
  const els = [...new Set(textNodes.map((n) => n.parentElement))].filter(visible);

  const fonts = {}, sizes = {}, colours = {}; let lowContrast = 0, tiny = 0, tightLead = 0, wide = 0, grayOnColor = 0;
  for (const el of els) { const s = getComputedStyle(el), size = parseFloat(s.fontSize), chars = el.textContent.trim().length;
    const family = s.fontFamily.split(',')[0].replace(/["']/g, '').trim(); fonts[family] = (fonts[family] || 0) + chars; sizes[Math.round(size)] = (sizes[Math.round(size)] || 0) + chars;
    const fg = rgb(s.color), bg = ground(el); if (fg) colours[s.color] = (colours[s.color] || 0) + chars;
    const bold = parseInt(s.fontWeight) >= 700, large = size >= 24 || (size >= 18.66 && bold);
    if (fg && bg && contrast(fg, bg) < (large ? 3 : 4.5)) lowContrast++;
    if (fg && bg) { const f = hsl(fg), b = hsl(bg); if (f.s < 0.15 && f.l > 0.25 && f.l < 0.75 && b.s > 0.25 && b.l > 0.15 && b.l < 0.9) grayOnColor++; }
    if (size < 12 && chars > 3) tiny++;
    const lead = parseFloat(s.lineHeight); const r = el.getBoundingClientRect();
    if (!isNaN(lead) && lead / size < 1.3 && r.height > lead * 1.8 && size < 24) tightLead++;
    if (['P', 'LI', 'BLOCKQUOTE', 'DD'].includes(el.tagName) && chars > 200 && r.width / (size * 0.5) > 85) wide++; }
  if (lowContrast) add('quality', 'low-contrast', `${lowContrast} text block(s) below WCAG AA`);
  if (grayOnColor) add('quality', 'gray-on-color', `${grayOnColor} gray text block(s) on colour`);
  if (tiny) add('quality', 'tiny-text', `${tiny} text block(s) under 12px`);
  if (tightLead) add('quality', 'tight-leading', `${tightLead} multi-line block(s) with tight line height`);
  if (wide) add('quality', 'line-length', `${wide} paragraph(s) wider than about 85 characters`);
  if (document.documentElement.scrollWidth > W + 1) add('quality', 'horizontal-overflow', `page is ${document.documentElement.scrollWidth}px wide at ${W}px`);

  const bad = [...document.images].filter((i) => i.complete && !i.naturalWidth).length;
  if (bad) add('quality', 'broken-image', `${bad} image(s) failed to load`);
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible), levels = heads.map((h) => +h.tagName[1]);
  if (levels.some((l, i) => i && l - levels[i - 1] > 1)) add('quality', 'skipped-heading', 'heading level skipped');
  if (document.querySelectorAll('h1').length !== 1 && !document.querySelector('[role=main] h1')) add('quality', 'h1-count', `${document.querySelectorAll('h1').length} h1 elements`);
  const unnamed = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea')].filter(visible).filter((e) => !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.title || e.labels?.length || e.querySelector('img[alt]'))).length;
  if (unnamed) add('quality', 'unnamed-control', `${unnamed} control(s) with no accessible name`);
  const smallTap = W < 600 ? [...document.querySelectorAll('button,a[href]')].filter(visible).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).length : 0;
  if (smallTap > 2) add('quality', 'small-target', `${smallTap} tap target(s) under 24px`);
  const clipped = els.filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth > 0).length;
  if (clipped) add('quality', 'text-overflow', `${clipped} element(s) clip their text`);

  const h1 = document.querySelector('h1');
  if (h1 && visible(h1)) { const s = getComputedStyle(h1), r = h1.getBoundingClientRect(), lines = Math.round(r.height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2));
    if (lines > 3) add('slop', 'oversized-h1', `h1 runs to ${lines} lines`);
    if (r.bottom > H) add('quality', 'hero-past-fold', 'h1 ends below the first viewport');
    const prev = h1.previousElementSibling; if (prev && visible(prev)) { const p = getComputedStyle(prev); if (p.textTransform === 'uppercase' && parseFloat(p.fontSize) < 15) add('slop', 'hero-eyebrow-chip', 'uppercase label above the h1'); }
    if (s.fontStyle === 'italic' && /serif/i.test(s.fontFamily) && !/sans/i.test(s.fontFamily)) add('slop', 'italic-serif-display', 'italic serif h1');
    const body = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]; if (body && parseFloat(s.fontSize) / +body[0] < 1.25) add('slop', 'flat-type-hierarchy', 'h1 under 1.25× body size'); }
  let kickers = 0; for (const h of heads) { const p = h.previousElementSibling; if (p && visible(p) && p.textContent.trim().length < 40) { const c = getComputedStyle(p); if ((c.textTransform === 'uppercase' || c.fontVariantCaps !== 'normal') && parseFloat(c.fontSize) < 15) kickers++; } }
  if (kickers >= 2) add('slop', 'kicker-above-heading', `${kickers} uppercase kickers above headings`);

  const cardLike = (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return r.width > 80 && r.height > 50 && r.width < W * 0.92 && parseFloat(s.borderTopLeftRadius) >= 6 && (s.boxShadow !== 'none' || parseFloat(s.borderTopWidth) > 0 || rgb(s.backgroundColor)?.a > 0); };
  const all = [...document.body.querySelectorAll('*')].filter(visible); const cards = all.filter(cardLike);
  if (cards.some((c) => cards.some((o) => o !== c && o.contains(c)))) add('slop', 'nested-cards', 'cards inside cards');
  const rows = new Map(); for (const c of cards) { const p = c.parentElement; rows.set(p, (rows.get(p) || []).concat(c)); }
  for (const [, row] of rows) if (row.length >= 3) { const r0 = row[0].getBoundingClientRect(); if (row.every((c) => { const r = c.getBoundingClientRect(); return Math.abs(r.width - r0.width) < 4 && Math.abs(r.height - r0.height) < 12; })) { add('slop', 'identical-cards', `${row.length} identical cards in a row`); break; } }
  if (cards.some((c) => { const s = getComputedStyle(c); return parseFloat(s.borderLeftWidth) >= 3 && parseFloat(s.borderRightWidth) < 1; })) add('slop', 'side-tab', 'coloured side stripe on a card');
  if (cards.some((c) => { const s = getComputedStyle(c); return parseFloat(s.borderTopWidth) === 1 && /\d\dpx/.test(s.boxShadow); })) add('slop', 'gpt-thin-border-wide-shadow', 'hairline border with a wide shadow');
  const tile = cards.filter((c) => c.querySelector('svg,img') && c.querySelector('h2,h3,h4,strong')).length; if (tile >= 3) add('slop', 'icon-tile-stack', `${tile} icon-heading-text tiles`);
  const centred = els.filter((e) => /H[1-3]|P/.test(e.tagName)), share = centred.filter((e) => getComputedStyle(e).textAlign === 'center').length / (centred.length || 1);
  if (centred.length > 6 && share > 0.8) add('slop', 'all-centred', `${Math.round(share * 100)}% of text is centred`);
  const paint = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const bg = rgb(getComputedStyle(document.body).backgroundColor); const bgHsl = bg && bg.a > 0 ? hsl(bg) : null;
  if (bgHsl && bgHsl.h >= 22 && bgHsl.h <= 62 && bgHsl.s >= 0.16 && bgHsl.l >= 0.88 && bgHsl.l < 0.995) add('slop', 'cream-palette', 'warm cream ground');
  const areas = {}; for (const e of all) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) { const k = `${c.r},${c.g},${c.b}`; areas[k] = (areas[k] || 0) + paint(e); } }
  const purple = Object.keys(colours).concat(Object.keys(areas).map((k) => `rgb(${k})`)).some((c) => { const v = rgb(c); if (!v) return false; const h = hsl(v); return h.h >= 244 && h.h <= 295 && h.s >= 0.42 && h.l >= 0.3 && h.l <= 0.8; });
  if (purple) add('slop', 'ai-color-palette', 'purple-violet in the palette');
  const gaps = {}; for (const e of all) { const s = getComputedStyle(e); for (const p of [s.paddingTop, s.marginBottom, s.rowGap]) { const v = parseFloat(p); if (v >= 8) gaps[v] = (gaps[v] || 0) + 1; } }
  const counts = Object.values(gaps), top = Math.max(0, ...counts), sum = counts.reduce((a, b) => a + b, 0); if (sum > 30 && top / sum > 0.7) add('slop', 'monotonous-spacing', 'one spacing value dominates');

  // Text mechanics a source scan cannot see.
  const shrink = els.filter((e) => { const c = getComputedStyle(e), t = parseFloat(c.letterSpacing); return !isNaN(t) && t / parseFloat(c.fontSize) < -0.041; }).length;
  if (shrink) add('slop', 'extreme-negative-tracking', `${shrink} element(s) tracked past -0.04em`);
  const allText = textNodes.reduce((n, t) => n + t.textContent.trim().length, 0), hidden = textNodes.filter((t) => { for (let e = t.parentElement; e; e = e.parentElement) { const c = getComputedStyle(e); if (+c.opacity < 0.05 || c.visibility === 'hidden') return true; } return false; }).reduce((n, t) => n + t.textContent.trim().length, 0);
  if (allText > 100 && hidden / allText > 0.3) add('quality', 'content-hidden-at-rest', `${Math.round(hidden / allText * 100)}% of text is invisible at rest`);
  if (els.filter((e) => e.matches('p,li,blockquote,dd')).some((e) => { const c = getComputedStyle(e), t = e.textContent.trim(); return t.length > 80 && (c.textTransform === 'uppercase' || t === t.toUpperCase() && /[A-Z]/.test(t)); })) add('quality', 'all-caps-body', 'long passage in capitals');
  if (els.some((e) => e.matches('a,button,label,td,th,li,small,span') && parseFloat(getComputedStyle(e).fontSize) < 13 && parseFloat(getComputedStyle(e).fontSize) >= 12 && e.textContent.trim().length > 2)) add('quality', 'undersized-ui-text', 'UI text at 12px');
  const lines = (el) => { const range = document.createRange(); range.selectNodeContents(el); const rows = new Map(); for (const r of range.getClientRects()) { if (r.width < 1) continue; const k = Math.round(r.top / 4); const row = rows.get(k) || { left: r.left, right: r.right }; row.left = Math.min(row.left, r.left); row.right = Math.max(row.right, r.right); rows.set(k, row); } return [...rows.values()].map((r) => r.right - r.left); };
  const lastWord = (el) => { const w = lines(el), t = el.textContent.trim().split(/\s+/), size = parseFloat(getComputedStyle(el).fontSize); return w.length >= 2 && t.length > 4 && w[w.length - 1] < Math.max(...w) * 0.2 && w[w.length - 1] < size * 9; };
  if ([...document.querySelectorAll('p')].filter(visible).some(lastWord)) add('polish', 'straggler', 'paragraph ends on one short word');
  if (heads.some((h) => { const w = lines(h); return w.length >= 2 && w[w.length - 1] < w[w.length - 2] * 0.45 && getComputedStyle(h).textWrap !== 'balance'; })) add('polish', 'unbalanced-heading', 'heading wraps unevenly, set text-wrap: balance');
  if (heads.some((h) => { const p = h.previousElementSibling, n = h.nextElementSibling; if (!p || !n || !visible(p) || !visible(n)) return false; const r = h.getBoundingClientRect(); return n.getBoundingClientRect().top - r.bottom > r.top - p.getBoundingClientRect().bottom && r.top - p.getBoundingClientRect().bottom >= 0; })) add('quality', 'heading-rhythm', 'more space below a heading than above it');
  if ([...document.querySelectorAll('p')].filter(visible).some((e) => { const r = e.getBoundingClientRect(); return e.textContent.trim().length > 60 && (r.left < 8 || W - r.right < 8); })) add('quality', 'body-text-viewport-edge', 'paragraph touches the viewport edge');
  const boxed = all.filter((e) => { const c = getComputedStyle(e), b = rgb(c.backgroundColor); return (b && b.a > 0.5 || parseFloat(c.borderTopWidth) > 0) && e !== document.body && e.getBoundingClientRect().width < W * 0.95; });
  if (boxed.some((e) => { if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && !e.querySelector('p,h1,h2,h3,h4,li')) return false; const c = getComputedStyle(e); return Math.min(parseFloat(c.paddingLeft), parseFloat(c.paddingTop)) < 6 && !e.matches('a,span,button,td,th,label,input,kbd,code,strong,em,b,i,hr,li,ul,ol,tr,table,tbody,thead'); })) add('quality', 'cramped-padding', 'text close to the edge of its box');
  const counts2 = {}; for (const e of els) { const t = e.textContent.trim(); if (t.length > 12 && t.length < 120 && !e.children.length && !e.closest('nav,footer')) counts2[t] = (counts2[t] || 0) + 1; }
  if (Object.values(counts2).some((n) => n >= 3)) add('quality', 'repeated-container-text', 'same text three or more times');
  const bigSvg = [...document.querySelectorAll('svg')].filter(visible).filter((v) => { const r = v.getBoundingClientRect(); return r.width > 160 && r.height > 120 && v.querySelectorAll('rect,circle,ellipse,polygon,path,line').length >= 8; }); if (bigSvg.length) add('slop', 'shape-assembled-illustration', 'large SVG scene built from primitives');
  if (all.some((e) => { const c = getComputedStyle(e).clipPath; return /^path\(/.test(c) || (c.match(/,/g) || []).length >= 8 && c.startsWith('polygon'); })) add('quality', 'organic-clip-path', 'clip-path standing in for an organic edge');
  if (all.some((e) => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return /radial-gradient/.test(c.backgroundImage) && /transparent|rgba\([^)]*, 0\)/.test(c.backgroundImage) && r.width > 200; })) add('slop', 'radial-spotlight-glow', 'radial colour glow behind content');
  if (all.some((e) => { const c = getComputedStyle(e); return /url\(/.test(c.backgroundImage) && /gradient/.test(c.backgroundImage) && /0\.9\d?\)|, ?1\)/.test(c.backgroundImage); }) || [...document.images].some((i) => visible(i) && i.getBoundingClientRect().width > 100 && +getComputedStyle(i).opacity < 0.15)) add('quality', 'buried-raster', 'image buried under a wash or near-zero opacity');
  if (all.some((e) => { const c = getComputedStyle(e); if (!/hidden|clip/.test(c.overflow)) return false; const r = e.getBoundingClientRect(); return [...e.children].some((k) => { if (getComputedStyle(k).position !== 'absolute' || !visible(k)) return false; const q = k.getBoundingClientRect(); return q.right > r.right + 4 || q.bottom > r.bottom + 4 || q.left < r.left - 4 || q.top < r.top - 4; }); })) add('quality', 'clipped-overflow-container', 'clipping container cuts an absolute child');
  if (els.some((e) => { const c = e.getBoundingClientRect(); if (c.top > H || c.bottom < 0 || c.width < 40) return false; const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return hit && hit !== e && !e.contains(hit) && !hit.contains(e) && getComputedStyle(hit).pointerEvents !== 'none'; })) add('quality', 'text-occlusion', 'text painted under another element');
  for (const row of all.filter((e) => /grid|flex/.test(getComputedStyle(e).display) && e.children.length >= 2)) { const kids = [...row.children].filter(visible).map((k) => k.getBoundingClientRect()); if (kids.length < 2 || kids[0].top > H * 0.6) continue; const inside = kids.filter((k) => k.bottom <= H), past = kids.filter((k) => k.bottom > H * 1.35 && k.left !== kids[0].left || k.bottom > H * 1.35 && kids.length === 2); if (inside.length && past.length && new Set(kids.map((k) => Math.round(k.left))).size > 1) { add('quality', 'first-viewport-column-overflow', 'one opening column runs far past the fold'); break; } }
  for (const row of all.filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth)) { const k = row.firstElementChild; if (k && Math.abs(k.getBoundingClientRect().left - row.getBoundingClientRect().left) < 2) { add('quality', 'edge-flush-cards', 'scroller content flush against its edge'); break; } }

  const blocks = [...document.querySelectorAll('section,main > *,article')].filter(visible).slice(0, 24).map((e) => { const kids = [...e.children].filter(visible), r = e.getBoundingClientRect(); const columns = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().left / 40))).size;
    return `${Math.min(columns, 4)}${r.height > H * 0.8 ? 'T' : 'S'}${e.querySelector('img,video,svg,canvas') ? 'M' : 'X'}`; });
  const sum2 = Object.values(areas).reduce((a, b) => a + b, 0) || 1;
  const palette = Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => { const [r, g, b] = k.split(',').map(Number), h = hsl({ r, g, b }); return [Math.round(h.h), +h.s.toFixed(2), +h.l.toFixed(2), +(v / sum2).toFixed(3)]; });
  return { found, signature: { fonts: Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 3).map((f) => f[0]), palette, blocks, centred: +share.toFixed(2) } };
});

function jaccard(a, b) { const x = new Set(a), y = new Set(b); const shared = [...x].filter((v) => y.has(v)).length; return shared / ((new Set([...x, ...y])).size || 1); }
function sequence(a, b) { if (!a.length && !b.length) return 1; const n = Math.max(a.length, b.length); let same = 0; for (let i = 0; i < n; i++) if (a[i] && a[i] === b[i]) same++; return same / n; }
function paletteDistance(a, b) { let total = 0; for (const [h, s, l, w] of a) { let best = 1; for (const [h2, s2, l2] of b) { const dh = Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)) / 180; best = Math.min(best, (dh * Math.min(s, s2) + Math.abs(s - s2) + Math.abs(l - l2)) / 2); } total += best * w; } return total; }
function similarity(a, b) { return 0.3 * jaccard(a.fonts, b.fonts) + 0.4 * (1 - Math.min(1, paletteDistance(a.palette, b.palette))) + 0.3 * sequence(a.blocks, b.blocks); }

function nearest(signature) { if (!existsSync(HISTORY)) return null; let best = null;
  for (const line of readFileSync(HISTORY, 'utf8').split('\n')) { if (!line) continue; try { const row = JSON.parse(line); if (row.url === url) continue; const score = similarity(signature, row.signature); if (!best || score > best.score) best = { score: +score.toFixed(3), url: row.url, when: row.when }; } catch { /* a damaged row costs one comparison */ } }
  return best; }

async function main() {
  if (printProbe) { console.log(`(${PROBE})()`); return; }
  const browser = await launch(); const report = { url, widths: [], signature: null, nearest: null };
  try {
    for (const width of widths) {
      const { targetId } = await browser.session.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await browser.session.send('Target.attachToTarget', { targetId, flatten: true });
      const send = (m, p) => browser.session.send(m, p, sessionId);
      await send('Page.enable'); await send('Runtime.enable');
      if (noScripts) await send('Emulation.setScriptExecutionDisabled', { value: true });
      await send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 600 });
      const loaded = browser.session.once('Page.loadEventFired', sessionId, 20000);
      await send('Page.navigate', { url }); await loaded; await new Promise((ok) => setTimeout(ok, 800));
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(${PROBE})()`, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      report.widths.push({ width, findings: result.value.found }); if (!report.signature) report.signature = result.value.signature;
      if (out) { mkdirSync(out, { recursive: true }); const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, `w${width}.png`), Buffer.from(data, 'base64')); }
      await browser.session.send('Target.closeTarget', { targetId });
    }
  } finally { browser.close(); }
  report.nearest = nearest(report.signature);
  if (!noHistory) { mkdirSync(join(HISTORY, '..'), { recursive: true }); appendFileSync(HISTORY, JSON.stringify({ url, when: new Date().toISOString(), signature: report.signature }) + '\n'); }
  const total = report.widths.reduce((n, w) => n + w.findings.length, 0);
  if (operate) for (const w of report.widths) w.findings = w.findings.filter((f) => !['identical-cards', 'icon-tile-stack', 'hero-past-fold'].includes(f.rule));
  if (asJson) console.log(JSON.stringify(report));
  else { for (const w of report.widths) for (const f of w.findings) console.log(`${w.width}px ${f.group}/${f.rule}: ${f.why}`);
    if (report.nearest) console.log(`nearest past render: ${report.nearest.score} similar to ${report.nearest.url}`); }
  process.exit(total ? 2 : 0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });

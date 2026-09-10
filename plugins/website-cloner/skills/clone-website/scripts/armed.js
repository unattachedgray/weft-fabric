#!/usr/bin/env node
/*
 * armed.js — Phase 1 through the user's armed Firefox tab (Browser Tunnel).
 *
 *   node armed.js <tab name | tab id> --out WS [--fc PATH] [--screenshots] [--no-assets] [--max-sections 40]
 *
 * Same probes, same workspace shape as extract.js, read through `firefox-control`
 * instead of headless Chromium — for pages that only render correctly in the
 * user's own session. Differences, stated in capture.json and the summary:
 *   - one breakpoint: the tab's real viewport width;
 *   - no instrumentation preload (canvas context types, IO registrations, input listeners unknown);
 *   - interaction contracts are listed, never activated (the page is the user's);
 *   - hover/focus deltas are not sampled;
 *   - assets are fetched without the session (public ones succeed, gated ones are MISSING);
 *   - screenshots need the tab in the FOREGROUND (captureVisibleTab): with --screenshots the
 *     script scrolls the tab and stitches viewport captures into references/<w>/full-page.png,
 *     slices and section crops; in the background it records DOM only and says so.
 * Never navigates, clicks or types in the tab.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');
const B = require('./lib/browser');

const args = B.parseArgs(process.argv.slice(2), { out: { type: 'string' }, fc: { type: 'string' }, screenshots: { type: 'bool', default: false }, assets: { type: 'bool', default: true }, 'max-sections': { type: 'number', default: 40 }, 'max-depth': { type: 'number', default: 6 }, keep: { type: 'bool', default: false } });
if (!args._[0]) { console.error('usage: armed.js <url | armed tab name | tab id> --out WS [--fc PATH] [--screenshots] [--keep]'); process.exit(2); }
const FC = args.fc || process.env.FIREFOX_CONTROL || path.join(os.homedir(), '.claude', 'skills', 'firefox-control', 'scripts', 'firefox-control');
if (!fs.existsSync(FC)) { console.error('[armed] firefox-control not found at ' + FC + ' (use --fc or FIREFOX_CONTROL)'); process.exit(3); }
const PROBES = fs.readFileSync(B.PROBES_PATH, 'utf8');
const warnings = [], wrote = [], findings = [];
const log = (...a) => console.error('[armed]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Two ways in, mirroring the reddit-research skill: a URL opens a NEW armed research
// tab through the tunnel (closed at the end unless --keep); an armed tab name/id uses
// the tab the user armed (never closed, never navigated).
let TAB = String(args._[0]);
let openedTabId = null;
if (/^https?:\/\//.test(TAB)) {
  const url = TAB;
  const raw = execFileSync(FC, ['open', url].concat(args.screenshots ? ['--focus'] : []), { encoding: 'utf8', timeout: 120000 });
  const env = JSON.parse(raw.slice(raw.indexOf('{')));
  if (!env.ok || !env.data || !env.data.tabId) { console.error('[armed] could not open a research tab: ' + raw.slice(0, 300)); process.exit(3); }
  openedTabId = env.data.tabId; TAB = String(openedTabId);
  log('opened research tab', TAB, url, args.screenshots ? '(focused for screenshots)' : '(background)');
}
function fc(action, extra, opts) {
  const argv = ['--tab', TAB, action].concat(extra || []);
  const out = execFileSync(FC, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: (opts && opts.timeout) || 120000, stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
}
function closeOpened() { if (openedTabId && !args.keep) { try { execFileSync(FC, ['--tab', String(openedTabId), 'close'], { encoding: 'utf8', timeout: 30000 }); log('closed research tab', openedTabId); } catch (e) { warnings.push('could not close research tab ' + openedTabId); } } }
function evalJson(expr, opts) {
  const raw = fc('eval', [expr], opts);
  const start = raw.indexOf('{'); if (start < 0) throw new Error('eval: no JSON envelope: ' + raw.slice(0, 200));
  const env = JSON.parse(raw.slice(start));
  if (!env.ok) throw new Error('eval failed: ' + (env.error || JSON.stringify(env).slice(0, 300)));
  return env.data;
}
function evalObj(expr, opts) { const d = evalJson('JSON.stringify(' + expr + ')', opts); return typeof d === 'string' ? JSON.parse(d) : d; }
function snapshot(dir) { B.ensureDir(dir); return fc('snapshot', ['--save', dir], { timeout: 120000 }); }
// The tunnel's captureVisibleTab returns JPEG (named shot.png); decode either format to RGBA.
function readImage(p) {
  const buf = fs.readFileSync(p);
  if (buf[0] === 0xff && buf[1] === 0xd8) { const j = require('jpeg-js').decode(buf, { useTArray: true, formatAsRGBA: true }); const png = new PNG({ width: j.width, height: j.height }); png.data = Buffer.from(j.data.buffer, j.data.byteOffset, j.data.length); return png; }
  return PNG.sync.read(buf);
}
function toPng(src, dst) { fs.writeFileSync(dst, PNG.sync.write(readImage(src))); }

(async () => {
  // ---- which tab, which page ----
  const armedList = execFileSync(FC, ['armed'], { encoding: 'utf8' });
  const line = armedList.split('\n').find(l => new RegExp('(^|\\s|/)' + TAB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(l)) || null;
  log('armed tabs:\n' + armedList.trim());
  if (openedTabId) { for (let i = 0; i < 20; i++) { await sleep(1000); try { const rs = evalJson('document.readyState'); if (rs === 'complete') break; } catch (_) {} } await sleep(1500); }
  let installed = evalJson('(' + PROBES.replace(/;\s*$/, '') + '); typeof window.__clone');
  if (installed !== 'object') throw new Error('probe install failed (CSP blocks eval on this page?) — fall back to snapshot + DOM parsing');
  const meta = evalObj('({ url: location.href, title: document.title, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, height: document.documentElement.scrollHeight, ua: navigator.userAgent })');
  const W = meta.w;
  const slug = B.slugForUrl(meta.url);
  const WS = path.resolve(args.out || path.join('clone-workspace', slug + '-armed'));
  for (const d of ['capture', 'references/' + W, 'css-rules', 'assets', 'specs', 'build', 'qa', 'errors', 'interactions']) B.ensureDir(path.join(WS, d));
  log('tab', TAB, meta.url, W + 'x' + meta.h, 'page height', meta.height);

  // ---- settle: scroll through for lazy content (read-only), back to top ----
  // (the tunnel cannot return a Promise, so the pauses live here, not in the page)
  for (let y = 0; y < meta.height; y += 700) { evalJson('scrollTo(0,' + y + '); scrollY'); await sleep(120); }
  evalJson('scrollTo(0,0); scrollY'); await sleep(600);
  meta.height = evalJson('document.documentElement.scrollHeight');
  const pre = evalObj('window.__clone.sectionCensus({maxSections:' + args['max-sections'] + '})');
  const sections = pre.sections;
  if (!sections.length) warnings.push('no sections found on the armed tab');
  log('sections:', sections.length);

  // ---- probes ----
  const tokens = evalObj('window.__clone.tokensProbe({})');
  B.writeJson(path.join(WS, 'tokens-' + W + '.json'), tokens); wrote.push('tokens-' + W + '.json');
  const surface = evalObj('window.__clone.surfaceMap()');
  B.writeJson(path.join(WS, 'surface-map.json'), surface); wrote.push('surface-map.json');
  const motion = evalObj('window.__clone.motionProbe()');
  B.writeJson(path.join(WS, 'motion.json'), motion); wrote.push('motion.json');
  const sheets = evalObj('window.__clone.stylesheetList()');
  const contracts = evalObj('window.__clone.interactionContracts(40)');
  contracts.forEach(c => { c.captured = 'not activated (armed tab is the user\'s page)'; });
  B.writeJson(path.join(WS, 'interactions.json'), { contracts, note: 'listed only; activate states yourself with firefox-control click if the user allows' }); wrote.push('interactions.json (' + contracts.length + ' contracts, not activated)');

  // ---- per-section DNA + authored CSS (one section per call keeps payloads small) ----
  const dna = [];
  let rulesTotal = 0;
  for (const s of sections) {
    const selLit = JSON.stringify(s.selector);
    try {
      const d = evalObj('window.__clone.dnaProbe([' + selLit + '], {maxDepth:' + args['max-depth'] + ', maxChildren:30, maxInteractive:40})[0]', { timeout: 180000 });
      d.index = s.index; d.slug = s.slug; d.heading = s.heading; dna.push(d);
    } catch (e) { warnings.push('dna failed for ' + s.slug + ': ' + e.message.slice(0, 100)); dna.push({ index: s.index, slug: s.slug, selector: s.selector, error: e.message.slice(0, 100), tree: null, text: [], assets: [], interactive: [] }); }
    try {
      const r = evalObj('window.__clone.cssRulesForSection(' + selLit + ', {maxChars:80000})', { timeout: 180000 });
      if (!r.error) { fs.writeFileSync(path.join(WS, 'css-rules', s.slug + '.css'), '/* authored CSS for ' + s.slug + ' (' + s.selector + ') rules ' + r.ruleCount + (r.blockedSheets.length ? ' | unreadable sheets: ' + r.blockedSheets.join(', ') : '') + ' */\n' + r.css); rulesTotal += r.ruleCount; dna[dna.length - 1].cssRules = { file: 'css-rules/' + s.slug + '.css', ruleCount: r.ruleCount, mediaConditions: r.mediaConditions, keyframes: r.keyframes, varsUsed: r.varsUsed, truncated: r.truncated }; }
    } catch (e) { warnings.push('css rules failed for ' + s.slug); }
    log('section', s.slug, 'ok');
  }
  B.writeJson(path.join(WS, 'dna.json'), { meta: { url: meta.url, breakpoint: W, source: 'armed-tab' }, breakpoint: W, sections: dna });
  wrote.push('dna.json (' + dna.length + ' sections)', 'css-rules/ (' + rulesTotal + ' rules)');

  // ---- DOM + stylesheets ----
  const snapOut = snapshot(path.join(WS, 'capture'));
  const shotSkipped = /NOT CAPTURED/.test(snapOut);
  if (fs.existsSync(path.join(WS, 'capture', 'shot.png'))) { toPng(path.join(WS, 'capture', 'shot.png'), path.join(WS, 'references', String(W), 'above-fold.png')); fs.unlinkSync(path.join(WS, 'capture', 'shot.png')); }
  wrote.push('capture/page.html');
  const captureSheets = [];
  let idx = 0;
  for (const sh of sheets) {
    let text = null, source = null;
    if (sh.inline) { text = sh.inlineText || ''; source = 'inline'; }
    else if (sh.href && args.assets) { try { const r = await fetch(sh.href, { headers: { 'user-agent': meta.ua } }); if (r.ok) { text = await r.text(); source = 'fetch-nosession'; } } catch (_) {} }
    const file = 'capture/css/' + String(idx++).padStart(2, '0') + (sh.inline ? '-inline' : '') + '.css';
    if (text != null) { B.ensureDir(path.join(WS, 'capture', 'css')); fs.writeFileSync(path.join(WS, file), (sh.href ? '/* source: ' + sh.href + ' */\n' : '/* inline */\n') + text); }
    captureSheets.push({ index: sh.index, href: sh.href, inline: sh.inline, readable: sh.readable, rules: sh.rules, file: text != null ? file : null, source });
    if (!sh.readable) warnings.push('stylesheet not readable from the page (cross-origin): ' + sh.href + (text != null ? ' — text fetched without session' : ''));
  }

  // ---- assets (no session) ----
  const manifest = { origin: new URL(meta.url).origin, originHost: new URL(meta.url).hostname.replace(/^www\./, ''), source: 'armed-tab fetch without session', files: {}, inlineSvgs: [], failed: [], stats: {} };
  if (args.assets) {
    const disc = evalObj('window.__clone.assetDiscovery()');
    const want = [].concat(disc.images.map(u => [u, 'images']), disc.backgrounds.map(u => [u, 'images']), disc.fonts.map(u => [u, 'fonts']), disc.favicons.map(u => [u, 'favicons']), disc.media.map(u => [u, 'media']));
    let n = 0;
    for (const [u, type] of want.slice(0, 400)) {
      if (!u || u.startsWith('data:') || u.startsWith('blob:') || manifest.files[u]) continue;
      try {
        const r = await fetch(u, { headers: { 'user-agent': meta.ua, referer: meta.url } });
        if (!r.ok) { manifest.failed.push({ url: u, status: r.status }); continue; }
        const buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get('content-type') || '';
        const ext = (new URL(u).pathname.match(/\.([a-z0-9]{2,5})$/i) || [])[1] || (ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png' : ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : ct.includes('woff2') ? 'woff2' : ct.includes('woff') ? 'woff' : 'bin');
        const name = path.basename(new URL(u).pathname).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 60) || 'asset';
        const file = path.join('assets', ct.includes('svg') ? 'svg' : type, name + '-' + B.hash(u, 6) + '.' + ext);
        B.ensureDir(path.dirname(path.join(WS, file))); fs.writeFileSync(path.join(WS, file), buf);
        manifest.files[u] = { file, type, size: buf.length, contentType: ct, source: 'fetch-nosession' }; n++;
      } catch (e) { manifest.failed.push({ url: u, error: e.message.slice(0, 80) }); }
    }
    const svgs = evalObj('window.__clone.inlineSvgs()');
    B.ensureDir(path.join(WS, 'assets', 'svg-inline'));
    svgs.forEach(s => { const file = 'assets/svg-inline/' + s.classification + '-' + String(s.index).padStart(3, '0') + '.svg'; fs.writeFileSync(path.join(WS, file), s.outerHTML); const { outerHTML, ...m } = s; manifest.inlineSvgs.push(Object.assign(m, { file })); });
    manifest.stats = { files: n, inlineSvgs: svgs.length, failed: manifest.failed.length };
    wrote.push('assets/ (' + n + ' files fetched without session, ' + svgs.length + ' inline svg, ' + manifest.failed.length + ' failed)');
    if (manifest.failed.length) warnings.push(manifest.failed.length + ' assets failed without the session — gated assets must be PLACEHOLDER or captured from the tab');
  }
  B.writeJson(path.join(WS, 'assets', 'manifest.json'), manifest);

  // ---- screenshots (foreground only) ----
  let rasters = false;
  if (args.screenshots) {
    if (shotSkipped) warnings.push('tab is in the background: no screenshots possible (captureVisibleTab). Bring the tab to the foreground and re-run with --screenshots.');
    else {
      const refDir = path.join(WS, 'references', String(W));
      const vh = meta.h; const total = meta.height; const tiles = [];
      for (let y = 0; y < total; y += vh) {
        evalJson('scrollTo(0,' + y + '); scrollY'); await sleep(400);
        const tmp = path.join(WS, 'capture', 'tile'); fs.rmSync(tmp, { recursive: true, force: true });
        let head = snapshot(tmp);
        const shot = path.join(tmp, 'shot.png');
        if (!fs.existsSync(shot)) { await sleep(1500); head = snapshot(tmp); }
        if (!fs.existsSync(shot)) { const why = (head.match(/screenshot:.*\n(?:\s+\(.*\n)?/) || [''])[0].replace(/\s+/g, ' ').trim(); warnings.push('screenshot missing at y=' + y + ' — ' + (why || 'tab not in the foreground')); log(head.split('\n').slice(0, 8).join('\n')); break; }
        const actualY = evalJson('scrollY');
        const png = readImage(shot);
        fs.writeFileSync(path.join(refDir, 'slice-' + String(y).padStart(5, '0') + '.png'), PNG.sync.write(png));
        fs.unlinkSync(shot);
        tiles.push({ y: actualY, png });
      }
      evalJson('scrollTo(0,0); scrollY');
      if (tiles.length) {
        // stitch (device pixels may differ from CSS pixels: scale by dpr)
        const scale = tiles[0].png.width / W;
        const full = new PNG({ width: tiles[0].png.width, height: Math.round(total * scale) });
        full.data.fill(255);
        for (const t of tiles) { const oy = Math.round(t.y * scale); for (let yy = 0; yy < t.png.height && oy + yy < full.height; yy++) { const src = yy * t.png.width * 4, dst = (oy + yy) * full.width * 4; t.png.data.copy(full.data, dst, src, src + t.png.width * 4); } }
        fs.writeFileSync(path.join(refDir, 'full-page.png'), PNG.sync.write(full));
        for (const s of sections) { const r = s.rect; const x0 = Math.round(r.x * scale), y0 = Math.round(r.y * scale), w0 = Math.min(Math.round(r.w * scale), full.width - x0), h0 = Math.min(Math.round(r.h * scale), full.height - y0); if (w0 <= 0 || h0 <= 0) continue; const crop = new PNG({ width: w0, height: h0 }); for (let yy = 0; yy < h0; yy++) { const src = ((y0 + yy) * full.width + x0) * 4; full.data.copy(crop.data, yy * w0 * 4, src, src + w0 * 4); } fs.writeFileSync(path.join(refDir, 'section-' + s.slug + '.png'), PNG.sync.write(crop)); }
        try { fs.rmSync(path.join(WS, 'capture', 'tile'), { recursive: true, force: true }); } catch (_) {}
        rasters = true; wrote.push('references/' + W + '/ (stitched full-page, ' + tiles.length + ' slices, ' + sections.length + ' section crops; scale ' + scale.toFixed(2) + ')');
        if (scale !== 1) warnings.push('screenshots are at device scale ' + scale.toFixed(2) + ' — run compare.js on a clone rendered at the same DPR, or accept size-mismatch padding');
        if (sections.some(s => s.fixed)) warnings.push('fixed chrome repeats in every stitched slice; its crop is taken from the top');
      }
    }
  }

  // ---- capture.json in the extract.js shape ----
  const capture = { meta: { url: meta.url, loadedUrl: meta.url, wayback: false, title: meta.title, extractedAt: new Date().toISOString(), breakpoints: [W], primary: W, slug, tool: 'clone-website/armed 1.0', source: 'armed-tab', tab: TAB, dpr: meta.dpr, instrumented: false, screenshots: rasters },
    sections: { [W]: sections }, pageHeight: { [W]: meta.height }, integrity: { status: sections.length ? 'passed' : 'failed', issues: sections.length ? [] : ['no sections'], note: 'single census; no pre/post comparison on an armed tab' },
    routing: Object.assign(surface.routingSummary, { scroll: surface.scroll, counts: surface.counts }), motion: Object.assign(motion.summary, { libraries: motion.libraries, instrumented: false, transitions: motion.transitions.slice(0, 8), keyframes: motion.keyframes.map(k => k.name) }),
    tokens: { [W]: { colors: tokens.colors.slice(0, 12), fonts: tokens.fonts.slice(0, 8), typeScale: tokens.typeScale.slice(0, 12), spacing: tokens.spacing.slice(0, 12), breakpoints: tokens.breakpoints, body: tokens.body, customPropCount: Object.keys(tokens.customProps || {}).length, fontFaces: tokens.fontFaces.length, loadedFonts: tokens.loadedFonts } },
    stylesheets: captureSheets, contracts: contracts.map(c => ({ id: c.id, kind: c.kind, control: c.control, controlText: c.controlText, controlled: c.controlled, captured: c.captured })), assets: manifest.stats, warnings };
  B.writeJson(path.join(WS, 'capture.json'), capture); wrote.unshift('capture.json');
  findings.push(sections.length + ' sections @' + W + ' (armed tab, ' + (rasters ? 'with' : 'without') + ' screenshots): ' + sections.map(s => s.slug.replace(/^\d+-/, '')).join(', ').slice(0, 200));
  findings.push('platform: ' + (motion.summary.platform.join(', ') || 'unknown') + ' | motion: ' + (motion.summary.animationStack.join(', ') || 'none') + ' | contracts: ' + contracts.length + ' (not activated)');
  findings.push('evidence is weaker than headless: no instrumentation, no hover deltas, one breakpoint — tag OBSERVED where extract.js would say CONFIRMED');
  closeOpened();
  console.log(B.fmtSummary({ status: warnings.length ? 'partial' : 'ok', workspace: WS, wrote, findings, warnings, next: 'node spec.js ' + WS + '  (specs work from this workspace); compare.js needs the --screenshots references' }));
})().catch(e => { closeOpened(); console.log(B.fmtSummary({ status: 'failed', workspace: args.out || '(unset)', findings: ['crash: ' + e.message.split('\n')[0].slice(0, 200)], next: 'is the tab armed and in a page that allows eval? see stderr' })); console.error(e.stack); process.exit(1); });

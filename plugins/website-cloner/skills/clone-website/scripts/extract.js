#!/usr/bin/env node
/*
 * extract.js — Phase 1: measure a live page into a workspace.
 *
 *   node extract.js <url> [--out DIR] [--breakpoints 1440,768,390] [--no-states]
 *                         [--no-assets] [--no-scroll] [--no-contracts] [--max-sections 40]
 *                         [--headed] [--timeout 60000]
 *
 * Writes (under --out, default ./clone-workspace/<slug>/):
 *   capture.json            meta, sections per breakpoint, integrity, routing, motion summary, warnings
 *   dna.json                per-section computed truth at the primary breakpoint (tree, text, assets, alignment, interactive)
 *   layout-<w>.json         per-section geometry + alignment at each other breakpoint
 *   tokens-<w>.json         frequency-ranked design tokens per breakpoint
 *   surface-map.json        DOM / GPU / video / iframe routing
 *   motion.json             runtime animation parameters (GSAP, WAAPI, keyframes, Lenis, sliders, IO)
 *   scroll-timeline.json    what changed at which scrollY (sticky headers, reveals, parallax)
 *   interactions.json       interaction contracts (tabs, accordions, menus, carousels) + captured states
 *   css-rules/NN-slug.css   authored CSS that applies to each section (hover, media, keyframes, vars)
 *   capture/page.html       post-hydration DOM;  capture/css/NN.css  stylesheets in cascade order
 *   references/<w>/         full-page, above-fold, slice-NNNNN and section-NN-slug screenshots
 *   assets/                 downloaded images/fonts/css/media/svg + manifest.json
 *
 * Prints a short structured summary (STATUS / WROTE / KEY_FINDINGS / WARNINGS / NEXT) on stdout.
 * Exit 0 = ok or partial, 1 = failed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');

const args = B.parseArgs(process.argv.slice(2), {
  out: { type: 'string' }, breakpoints: { type: 'list', default: [1440, 768, 390] }, states: { type: 'bool', default: true }, assets: { type: 'bool', default: true },
  scroll: { type: 'bool', default: true }, contracts: { type: 'bool', default: true }, 'max-sections': { type: 'number', default: 40 }, headed: { type: 'bool', default: false }, timeout: { type: 'number', default: 60000 },
  'max-states': { type: 'number', default: 60 }, 'max-contracts': { type: 'number', default: 12 },
});
if (!args._[0]) { console.error('usage: extract.js <url> [--out DIR] [--breakpoints 1440,768,390] [--no-states] [--no-assets] [--no-scroll] [--no-contracts]'); process.exit(2); }

let url = args._[0];
try { new URL(url); } catch (_) { console.error('[extract] invalid URL: ' + url); process.exit(2); }
const wayback = B.isWayback(url);
if (wayback) url = B.waybackIf(url);
const originUrl = wayback ? B.unwayback(url) : url;
const origin = new URL(originUrl).origin;
const originHost = new URL(originUrl).hostname.replace(/^www\./, '');
const slug = B.slugForUrl(originUrl);
const WS = path.resolve(args.out || path.join('clone-workspace', slug));
const BPS = args.breakpoints.map(Number).filter(n => n > 0);
const PRIMARY = BPS[0];
const warnings = [], wrote = [], findings = [];
const log = (...a) => console.error('[extract]', ...a);
const started = Date.now();

const ASSET_TYPES = { images: 'images', svg: 'svg', fonts: 'fonts', css: 'css', media: 'media', favicons: 'favicons', other: 'other' };
function classifyContentType(ct, rt, u) {
  ct = (ct || '').toLowerCase();
  if (ct.includes('image/svg')) return 'svg';
  if (ct.includes('image/')) return 'images';
  if (ct.includes('font/') || ct.includes('application/font') || /woff2?|ttf|otf/.test(ct) || /\.(woff2?|ttf|otf)(\?|$)/i.test(u)) return 'fonts';
  if (ct.includes('text/css') || rt === 'stylesheet') return 'css';
  if (ct.includes('video/') || ct.includes('audio/') || rt === 'media') return 'media';
  if (rt === 'image') return 'images';
  if (rt === 'font') return 'fonts';
  return null;
}
function extFor(ct, u) {
  const m = (new URL(u, 'https://x/').pathname.match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  if (m && !/^(php|aspx?|jsp|cgi)$/i.test(m)) return '.' + m.toLowerCase();
  ct = (ct || '').toLowerCase();
  if (ct.includes('svg')) return '.svg'; if (ct.includes('png')) return '.png'; if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg'; if (ct.includes('webp')) return '.webp'; if (ct.includes('avif')) return '.avif'; if (ct.includes('gif')) return '.gif';
  if (ct.includes('woff2')) return '.woff2'; if (ct.includes('woff')) return '.woff'; if (ct.includes('ttf')) return '.ttf'; if (ct.includes('otf')) return '.otf'; if (ct.includes('css')) return '.css'; if (ct.includes('mp4')) return '.mp4'; if (ct.includes('webm')) return '.webm';
  return '';
}
function localName(u, ct) {
  let base = path.basename(new URL(u, 'https://x/').pathname) || 'asset';
  base = base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
  const ext = extFor(ct, u);
  const name = base.replace(/\.[a-z0-9]{2,5}$/i, '');
  return name + '-' + B.hash(u, 6) + ext;
}

(async () => {
  for (const d of ['capture/css', 'references', 'css-rules', 'assets', 'specs', 'build', 'qa', 'errors', 'interactions']) B.ensureDir(path.join(WS, d));
  const browser = await B.launch({ headed: args.headed });
  const context = await B.newContext(browser, PRIMARY);
  const page = await context.newPage();
  await B.preloadProbes(page);

  // ---- network capture (assets + stylesheet text) — registered BEFORE goto ----
  const captured = new Map(); // url -> {file, type, size, contentType}
  const cssText = new Map();  // url -> css text
  const pending = [];
  // Every response is logged (data-driven apps live on XHR/fetch, tiles, JSON); JSON/GeoJSON/CSV/XML
  // bodies under 50 MB are saved to assets/data/ so a rebuild has the data, not just the look.
  const networkLog = [];
  const tilePatterns = new Map();
  const isData = (ct, u) => /json|geo\+json|csv|xml|text\/plain|protobuf|octet-stream/.test(ct) || /\.(json|geojson|csv|topojson|kml|gpx)(\?|$)/i.test(u);
  const isTile = (ct, u) => /\.(pbf|mvt)(\?|$)/i.test(u) || /\/\d+\/\d+\/\d+(\.\w+)?(\?|$)/.test(new URL(u).pathname) && /tile|\/v4\/|mapbox|maptiler|openfreemap|protomaps|arcgis|\.png|\.pbf|\.mvt|\.webp|\.jpg/i.test(u);
  page.on('response', resp => {
    const p = (async () => {
      try {
        const st = resp.status();
        const u = resp.url(); if (u.startsWith('data:')) return;
        const ct = resp.headers()['content-type'] || '';
        const rt = resp.request().resourceType();
        const len = parseInt(resp.headers()['content-length'] || '0', 10) || null;
        if (networkLog.length < 3000) networkLog.push({ url: u.slice(0, 500), status: st, type: rt, contentType: ct.split(';')[0], size: len, method: resp.request().method() });
        if (st < 200 || st >= 400 || captured.has(u)) return;
        if (isTile(ct, u)) { const key = u.replace(/\/\d+\/\d+\/\d+(\.\w+)?/, '/{z}/{x}/{y}$1').replace(/\?.*$/, ''); tilePatterns.set(key, (tilePatterns.get(key) || 0) + 1); return; }
        let type = classifyContentType(ct, rt, u);
        if (!type && (rt === 'fetch' || rt === 'xhr' || rt === 'other' || rt === 'document') && isData(ct, u) && !/\.(js|mjs|css|html?)(\?|$)/i.test(u)) type = 'data';
        if (!type) return;
        const body = await resp.body();
        if (type === 'data') { if (body.length > 50 * 1024 * 1024 || !args.assets) return; const file = path.join('assets', 'data', localName(u, ct) + (/\.[a-z0-9]{2,5}$/i.test(localName(u, ct)) ? '' : (/geo\+json|geojson/.test(ct + u) ? '.geojson' : /json/.test(ct) ? '.json' : /csv/.test(ct) ? '.csv' : '.bin'))); B.ensureDir(path.dirname(path.join(WS, file))); fs.writeFileSync(path.join(WS, file), body); captured.set(u, { file, type, size: body.length, contentType: ct, source: 'network', requestType: rt }); return; }
        if (type === 'css') cssText.set(u, body.toString('utf8'));
        if (!args.assets && type !== 'css') return;
        const file = path.join('assets', type, localName(u, ct));
        B.ensureDir(path.dirname(path.join(WS, file)));
        fs.writeFileSync(path.join(WS, file), body);
        captured.set(u, { file, type, size: body.length, contentType: ct, source: 'network' });
      } catch (_) { /* redirects / aborted bodies */ }
    })();
    pending.push(p);
  });

  // ---- load + settle ----
  log('loading', url);
  let resp;
  try { resp = await B.robustGoto(page, url, args.timeout); } catch (e) {
    fs.writeFileSync(path.join(WS, 'errors', 'extract-' + Date.now() + '.md'), '# extract failed\n\nURL: ' + url + '\n\n' + e.stack);
    console.log(B.fmtSummary({ status: 'failed', workspace: WS, findings: ['page load failed: ' + e.message], next: 'check the URL / bot wall; see errors/' }));
    await browser.close(); process.exit(1);
  }
  const httpStatus = resp ? resp.status() : null;
  if (httpStatus && httpStatus >= 400) warnings.push('HTTP ' + httpStatus + ' on load');
  if (wayback) await B.stripWayback(page);
  await page.waitForTimeout(1500);
  const lazy = await B.forceLazy(page); if (lazy) log('forced', lazy, 'lazy images');
  const pageHeight = await B.settle(page);
  const title = await page.title();
  const botWall = /just a moment|attention required|access denied|verify you are human|captcha/i.test(title);
  if (botWall) warnings.push('title looks like a bot wall: "' + title + '"');

  // ---- pre-mutation census (integrity baseline) ----
  const pre = await B.probe(page, 'sectionCensus', [{ maxSections: args['max-sections'] }]);
  if (!pre.sections.length) warnings.push('no sections found at ' + PRIMARY + 'px — page may be empty, gated, or fully canvas');
  log('sections @' + PRIMARY + ':', pre.sections.length, '| page height', pageHeight);

  // ---- per-breakpoint pass ----
  const capture = { meta: { url: originUrl, loadedUrl: url, wayback, title, httpStatus, extractedAt: new Date().toISOString(), breakpoints: BPS, primary: PRIMARY, slug, tool: 'clone-website/extract 1.0' }, sections: {}, pageHeight: {}, integrity: null, routing: null, motion: null, tokens: {}, stylesheets: [], warnings };
  let dna = null;
  for (const w of BPS) {
    await page.setViewportSize({ width: w, height: 900 });
    const h = await B.settle(page, { rest: 600 });
    const census = await B.probe(page, 'sectionCensus', [{ maxSections: args['max-sections'] }]);
    capture.sections[w] = census.sections; capture.pageHeight[w] = h;
    const refDir = B.ensureDir(path.join(WS, 'references', String(w)));
    // full page (guard the 16384px raster cap) + above the fold + slices
    if (h <= 16000) { try { await page.screenshot({ path: path.join(refDir, 'full-page.png'), fullPage: true }); } catch (e) { warnings.push('full-page screenshot failed @' + w + ': ' + e.message.split('\n')[0]); } }
    else warnings.push('page taller than 16000px @' + w + ' — full-page.png skipped, slices only');
    await page.screenshot({ path: path.join(refDir, 'above-fold.png') });
    for (let y = 0; y < h; y += 900) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(120); await page.screenshot({ path: path.join(refDir, 'slice-' + String(y).padStart(5, '0') + '.png') }); }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    // section crops (page coordinates)
    for (const s of census.sections) {
      const r = s.rect; if (r.w < 2 || r.h < 2) continue;
      const clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.w, w), height: Math.min(r.h, 16000) };
      try {
        if (s.fixed) { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100); await page.screenshot({ path: path.join(refDir, 'section-' + s.slug + '.png'), clip: { x: clip.x, y: Math.max(0, r.y - 0), width: clip.width, height: Math.min(clip.height, 900) } }); }
        else await page.screenshot({ path: path.join(refDir, 'section-' + s.slug + '.png'), fullPage: true, clip });
      } catch (e) { warnings.push('section crop failed ' + s.slug + '@' + w + ': ' + e.message.split('\n')[0]); }
    }
    const tokens = await B.probe(page, 'tokensProbe', [{}]);
    B.writeJson(path.join(WS, 'tokens-' + w + '.json'), tokens);
    capture.tokens[w] = { colors: tokens.colors.slice(0, 12), fonts: tokens.fonts.slice(0, 8), typeScale: tokens.typeScale.slice(0, 12), spacing: tokens.spacing.slice(0, 12), breakpoints: tokens.breakpoints, body: tokens.body, customPropCount: Object.keys(tokens.customProps || {}).length, fontFaces: tokens.fontFaces.length, loadedFonts: tokens.loadedFonts };
    const sels = census.sections.map(s => s.selector);
    if (w === PRIMARY) {
      dna = await B.probe(page, 'dnaProbe', [sels, { maxDepth: 7, maxChildren: 30, maxInteractive: 40 }]);
      dna.forEach((d, i) => { d.slug = census.sections[i].slug; d.heading = census.sections[i].heading; });
    } else {
      const lay = await B.probe(page, 'dnaProbe', [sels, { maxDepth: 3, maxChildren: 16, maxInteractive: 0 }]);
      B.writeJson(path.join(WS, 'layout-' + w + '.json'), lay.map((d, i) => ({ index: i, slug: census.sections[i].slug, selector: d.selector, rect: d.rect, alignment: d.alignment, tree: d.tree, hiddenChildren: (d.tree && d.tree.children || []).filter(c => c.rect.w === 0 || c.rect.h === 0 || (c.styles && c.styles.display === 'none')).length })));
      wrote.push('layout-' + w + '.json');
    }
    wrote.push('references/' + w + '/ (' + census.sections.length + ' sections, ' + Math.ceil(h / 900) + ' slices)', 'tokens-' + w + '.json');
    log('@' + w + ': ' + census.sections.length + ' sections, height ' + h);
  }
  await page.setViewportSize({ width: PRIMARY, height: 900 });
  await B.settle(page, { rest: 500 });
  const primarySections = capture.sections[PRIMARY];

  // ---- routing + motion + stylesheets ----
  const surface = await B.probe(page, 'surfaceMap', []);
  B.writeJson(path.join(WS, 'surface-map.json'), surface); wrote.push('surface-map.json');
  capture.routing = surface.routingSummary; capture.routing.scroll = surface.scroll; capture.routing.counts = surface.counts;
  const motion = await B.probe(page, 'motionProbe', []);
  B.writeJson(path.join(WS, 'motion.json'), motion); wrote.push('motion.json');
  capture.motion = motion.summary; capture.motion.libraries = motion.libraries; capture.motion.instrumented = motion.instrumented; capture.motion.transitions = motion.transitions.slice(0, 8); capture.motion.keyframes = motion.keyframes.map(k => k.name);
  await Promise.all(pending.splice(0));
  const sheets = await B.probe(page, 'stylesheetList', []);
  let cssIndex = 0;
  for (const sh of sheets) {
    let text = null, source = null;
    if (sh.inline) { text = sh.inlineText || ''; source = 'inline'; }
    else if (cssText.has(sh.href)) { text = cssText.get(sh.href); source = 'network'; }
    else { try { const r = await context.request.get(sh.href, { timeout: 15000 }); if (r.ok()) { text = await r.text(); source = 'fetch'; } } catch (_) {} }
    const file = 'capture/css/' + String(cssIndex++).padStart(2, '0') + (sh.inline ? '-inline' : '') + '.css';
    if (text != null) fs.writeFileSync(path.join(WS, file), (sh.href ? '/* source: ' + sh.href + ' */\n' : '/* inline <style> */\n') + text);
    capture.stylesheets.push({ index: sh.index, href: sh.href, inline: sh.inline, readable: sh.readable, rules: sh.rules, media: sh.media, file: text != null ? file : null, source, bytes: text ? text.length : 0 });
    if (!sh.readable && text != null) await B.probe(page, 'addShadowSheet', [text, sh.href]);
    if (!sh.readable && text == null) warnings.push('stylesheet unreadable and unfetchable: ' + sh.href);
  }
  wrote.push('capture/css/ (' + cssIndex + ' sheets)');
  // authored CSS per section
  let rulesTotal = 0;
  for (const s of primarySections) {
    const r = await B.probe(page, 'cssRulesForSection', [s.selector, { maxChars: 80000 }]);
    if (r.error) { warnings.push('css rules: ' + s.slug + ' ' + r.error); continue; }
    fs.writeFileSync(path.join(WS, 'css-rules', s.slug + '.css'), '/* authored CSS applying to section ' + s.slug + ' (' + s.selector + ')\n   rules: ' + r.ruleCount + ' | media: ' + r.mediaConditions.length + ' | keyframes: ' + r.keyframes.join(', ') + (r.truncated ? ' | TRUNCATED' : '') + ' */\n' + r.css);
    rulesTotal += r.ruleCount;
    if (dna && dna[s.index]) dna[s.index].cssRules = { file: 'css-rules/' + s.slug + '.css', ruleCount: r.ruleCount, mediaConditions: r.mediaConditions, keyframes: r.keyframes, varsUsed: r.varsUsed, truncated: r.truncated };
  }
  wrote.push('css-rules/ (' + rulesTotal + ' rules over ' + primarySections.length + ' sections)');
  // post-hydration DOM
  const html = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
  fs.writeFileSync(path.join(WS, 'capture', 'page.html'), html); wrote.push('capture/page.html (' + Math.round(html.length / 1024) + ' KB)');

  // ---- scroll timeline ----
  if (args.scroll) {
    const n = await B.probe(page, 'scrollTrackInit', []);
    const timeline = []; const step = Math.max(150, Math.floor(pageHeight / 60));
    for (let y = 0; y <= pageHeight; y += step) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(90); const snap = await B.probe(page, 'scrollTrackSnapshot', [y]); if (Object.keys(snap.changed).length) timeline.push(snap); }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
    await B.probe(page, 'scrollTrackCleanup', []);
    const byEl = {};
    timeline.forEach(f => Object.keys(f.changed).forEach(id => { (byEl[id] = byEl[id] || { selector: f.changed[id].selector, frames: [] }).frames.push({ y: f.scrollY, diff: f.changed[id].diff }); }));
    const classified = Object.keys(byEl).map(id => { const e = byEl[id]; const props = {}; e.frames.forEach(fr => Object.keys(fr.diff).forEach(p => props[p] = 1)); const first = e.frames[0];
      let type = 'changes'; if (props.position && e.frames.some(fr => fr.diff.position && /fixed|sticky/.test(fr.diff.position.to))) type = 'sticky-on'; else if (props.opacity && parseFloat(first.diff.opacity ? first.diff.opacity.from : 1) < 0.5) type = 'reveal'; else if (props.transform && e.frames.length > 3) type = 'transform-scrubbed'; else if (props.backgroundColor || props.boxShadow) type = 'style-flip';
      return { selector: e.selector, type, firstChangeY: first.y, frames: e.frames.length, props: Object.keys(props), first: first.diff }; });
    B.writeJson(path.join(WS, 'scroll-timeline.json'), { tracked: n, step, timeline, classified });
    wrote.push('scroll-timeline.json (' + classified.length + ' elements change on scroll)');
    findings.push(classified.length ? 'scroll-driven changes on ' + classified.length + ' elements (' + classified.map(c => c.type).filter((v, i, a) => a.indexOf(v) === i).join(', ') + ')' : 'no scroll-driven style changes detected');
  }

  // ---- hover / focus deltas ----
  if (args.states && dna) {
    const PROPS = ['backgroundColor', 'color', 'transform', 'opacity', 'boxShadow', 'borderColor', 'outline', 'textDecorationLine', 'filter', 'scale', 'borderRadius', 'backgroundImage', 'width', 'height'];
    let done = 0, changed = 0;
    const perSection = Math.max(3, Math.ceil(args['max-states'] / Math.max(1, dna.length)));
    for (const d of dna) {
      let n = 0;
      for (const it of d.interactive || []) {
        if (done >= args['max-states'] || n >= perSection) break;
        if (!it.unique) { it.stateSkipped = 'non-unique selector'; continue; }
        try {
          const el = await page.$(it.selector); if (!el || !(await el.isVisible())) { it.stateSkipped = 'not visible'; continue; }
          await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(80);
          const read = () => page.evaluate(([sel, props]) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); const o = {}; props.forEach(p => o[p] = c[p]); o.__pseudo = window.__clone.pseudoStyles(e); return o; }, [it.selector, PROPS]);
          const base = await read(); if (!base) continue;
          await el.hover({ timeout: 3000 }); await page.waitForTimeout(450);
          const hov = await read();
          await page.mouse.move(0, 0); await page.waitForTimeout(350);
          const delta = {}; PROPS.forEach(p => { if (hov && hov[p] !== base[p]) delta[p] = { from: base[p], to: hov[p] }; });
          const pd = JSON.stringify(hov && hov.__pseudo) !== JSON.stringify(base.__pseudo) ? { from: base.__pseudo, to: hov && hov.__pseudo } : null;
          if (Object.keys(delta).length) it.hoverDelta = delta; if (pd) it.pseudoHoverDelta = pd;
          if (it.tag !== 'div' && it.tag !== 'li') { await el.focus({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); const foc = await read(); const fd = {}; PROPS.forEach(p => { if (foc && foc[p] !== base[p]) fd[p] = { from: base[p], to: foc[p] }; }); if (Object.keys(fd).length) it.focusDelta = fd; await page.evaluate(sel => { const e = document.querySelector(sel); e && e.blur(); }, it.selector); }
          if (it.hoverDelta || it.pseudoHoverDelta) changed++;
          done++; n++;
        } catch (e) { it.stateSkipped = e.message.split('\n')[0].slice(0, 80); }
      }
    }
    findings.push('hover/focus sampled on ' + done + ' elements, ' + changed + ' change on hover');
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // ---- interaction contracts + captured states ----
  let contracts = [];
  if (args.contracts) {
    contracts = await B.probe(page, 'interactionContracts', [40]);
    let capturedStates = 0;
    for (const c of contracts.slice(0, args['max-contracts'])) {
      try {
        const el = await page.$(c.control); if (!el || !(await el.isVisible())) { c.captured = 'control not visible'; continue; }
        const tag = await el.evaluate(e => e.tagName.toLowerCase() + '|' + (e.getAttribute('href') || ''));
        if (tag.startsWith('a|') && !/^a\|#/.test(tag) && !/^a\|$/.test(tag)) { c.captured = 'skipped: link navigates'; continue; }
        const target = c.controlled || c.control;
        const before = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { html: e.outerHTML.slice(0, 200000), rect: e.getBoundingClientRect().toJSON(), display: getComputedStyle(e).display, expanded: e.getAttribute('aria-expanded') } : null; }, target);
        await el.scrollIntoViewIfNeeded(); await el.click({ timeout: 3000 }); await page.waitForTimeout(600);
        const after = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { html: e.outerHTML.slice(0, 200000), rect: e.getBoundingClientRect().toJSON(), display: getComputedStyle(e).display, expanded: e.getAttribute('aria-expanded') } : null; }, target);
        const ctrlAfter = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { expanded: e.getAttribute('aria-expanded'), selected: e.getAttribute('aria-selected'), cls: e.className && e.className.toString ? e.className.toString() : '' } : null; }, c.control);
        const dir = B.ensureDir(path.join(WS, 'interactions', c.id));
        if (before) fs.writeFileSync(path.join(dir, 'before.html'), before.html);
        if (after) fs.writeFileSync(path.join(dir, 'after.html'), after.html);
        try { const r = after && after.rect; if (r && r.width > 0 && r.height > 0) await page.screenshot({ path: path.join(dir, 'after.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, PRIMARY), height: Math.min(r.height, 900) } }); else await page.screenshot({ path: path.join(dir, 'after.png') }); } catch (_) {}
        c.observed = { changed: !!(before && after && (before.html !== after.html || before.display !== after.display || before.expanded !== after.expanded)), displayBefore: before && before.display, displayAfter: after && after.display, expandedBefore: before && before.expanded, expandedAfter: after && after.expanded, controlAfter: ctrlAfter };
        c.captured = 'interactions/' + c.id + '/';
        capturedStates++;
        // restore: toggles close on second click; tabs stay — fine
        if (c.kind === 'menu' || c.kind === 'accordion') { await el.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); }
        await page.keyboard.press('Escape').catch(() => {});
      } catch (e) { c.captured = 'error: ' + e.message.split('\n')[0].slice(0, 100); }
    }
    B.writeJson(path.join(WS, 'interactions.json'), { contracts });
    wrote.push('interactions.json (' + contracts.length + ' contracts, ' + capturedStates + ' states captured)');
    if (contracts.length) findings.push('interaction contracts: ' + contracts.map(c => c.kind).reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {}) && Object.entries(contracts.map(c => c.kind).reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {})).map(([k, v]) => k + '×' + v).join(', '));
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // ---- assets: DOM discovery + inline SVG + manifest ----
  const manifest = { origin, originHost, wayback, files: {}, inlineSvgs: [], failed: [], stats: {} };
  if (args.assets) {
    await Promise.all(pending.splice(0));
    const disc = await B.probe(page, 'assetDiscovery', []);
    const want = [].concat(disc.images.map(u => [u, 'images']), disc.backgrounds.map(u => [u, 'images']), disc.fonts.map(u => [u, 'fonts']), disc.favicons.map(u => [u, 'favicons']), disc.meta.map(u => [u, 'images']), disc.media.map(u => [u, 'media']));
    let fetched = 0;
    for (const [u, type] of want) {
      if (!u || captured.has(u) || u.startsWith('data:') || u.startsWith('blob:')) continue;
      try {
        const r = await context.request.get(u, { timeout: 15000 }); if (!r.ok()) { manifest.failed.push({ url: u, status: r.status() }); continue; }
        const body = await r.body(); const ct = r.headers()['content-type'] || '';
        const t = classifyContentType(ct, type === 'images' ? 'image' : type === 'fonts' ? 'font' : 'other', u) || type;
        const file = path.join('assets', t === 'favicons' ? 'favicons' : t, localName(u, ct));
        B.ensureDir(path.dirname(path.join(WS, file))); fs.writeFileSync(path.join(WS, file), body);
        captured.set(u, { file, type: t, size: body.length, contentType: ct, source: 'dom' }); fetched++;
      } catch (e) { manifest.failed.push({ url: u, error: e.message.split('\n')[0].slice(0, 80) }); }
    }
    const svgs = await B.probe(page, 'inlineSvgs', []);
    B.ensureDir(path.join(WS, 'assets', 'svg-inline'));
    svgs.forEach(s => { const file = 'assets/svg-inline/' + s.classification + '-' + String(s.index).padStart(3, '0') + '.svg'; fs.writeFileSync(path.join(WS, file), s.outerHTML); const { outerHTML, ...meta } = s; manifest.inlineSvgs.push(Object.assign(meta, { file })); });
    for (const [u, rec] of captured) { const st = fs.statSync(path.join(WS, rec.file)); if (st.size < 200 && rec.type !== 'svg' && rec.type !== 'css') rec.suspicious = 'under 200 bytes'; manifest.files[u] = rec; }
    // video/media that the response filter aborted (we do not block media, but streams may be range requests)
    const byType = {}; for (const rec of Object.values(manifest.files)) byType[rec.type] = (byType[rec.type] || 0) + 1;
    manifest.stats = { files: captured.size, byType, inlineSvgs: svgs.length, failed: manifest.failed.length, fetchedFromDom: fetched };
    manifest.discovery = { images: disc.images.length, backgrounds: disc.backgrounds.length, fonts: disc.fonts.length, stylesheets: disc.stylesheets, scripts: disc.scripts.slice(0, 40) };
    manifest.data = Object.entries(manifest.files).filter(([, r]) => r.type === 'data').map(([u, r]) => ({ url: u, file: r.file, size: r.size, contentType: r.contentType }));
    manifest.tilePatterns = Array.from(tilePatterns, ([pattern, count]) => ({ pattern, count }));
    if (manifest.data.length) findings.push('data responses saved: ' + manifest.data.length + ' (' + manifest.data.slice(0, 4).map(d => path.basename(d.file) + ' ' + Math.round(d.size / 1024) + 'KB').join(', ') + ')');
    if (manifest.tilePatterns.length) findings.push('map tiles: ' + manifest.tilePatterns.map(t => t.pattern.replace(/^https?:\/\//, '') + ' ×' + t.count).join(', ').slice(0, 300));
    B.writeJson(path.join(WS, 'assets', 'manifest.json'), manifest);
    wrote.push('assets/ (' + captured.size + ' files: ' + Object.entries(byType).map(([k, v]) => k + ' ' + v).join(', ') + '; ' + svgs.length + ' inline svg)');
    if (manifest.failed.length) warnings.push(manifest.failed.length + ' asset downloads failed (see assets/manifest.json)');
  } else {
    B.writeJson(path.join(WS, 'assets', 'manifest.json'), manifest);
  }

  // ---- post census → integrity ----
  await page.setViewportSize({ width: PRIMARY, height: 900 }); await B.settle(page, { rest: 400 });
  const post = await B.probe(page, 'sectionCensus', [{ maxSections: args['max-sections'] }]);
  const postByFp = new Map(post.sections.map(s => [s.fingerprint, s]));
  const missing = [], collapsed = [];
  for (const s of pre.sections) { const m = postByFp.get(s.fingerprint); if (!m) { missing.push(s.slug); continue; } if (s.rect.h > 80 && m.rect.h < s.rect.h * 0.55) collapsed.push({ slug: s.slug, before: s.rect.h, after: m.rect.h }); }
  const heightLoss = capture.pageHeight[PRIMARY] - post.pageHeight;
  const allowed = Math.max(96, capture.pageHeight[PRIMARY] * 0.05);
  const issues = [];
  if (!pre.sections.length) issues.push('no sections');
  if (missing.length) issues.push('sections vanished after extraction: ' + missing.join(', '));
  if (collapsed.length) issues.push('sections collapsed: ' + collapsed.map(c => c.slug + ' ' + c.before + '→' + c.after).join(', '));
  if (heightLoss > allowed) issues.push('page lost ' + heightLoss + 'px of height during extraction (allowed ' + Math.round(allowed) + ')');
  if (botWall) issues.push('bot wall suspected');
  const sectionsFullRaster = fs.existsSync(path.join(WS, 'references', String(PRIMARY), 'full-page.png'));
  capture.integrity = { status: issues.length ? 'failed' : 'passed', issues, preSections: pre.sections.length, postSections: post.sections.length, prePageHeight: capture.pageHeight[PRIMARY], postPageHeight: post.pageHeight, fullPageRaster: sectionsFullRaster, missing, collapsed };
  if (issues.length) warnings.push('integrity: ' + issues.join(' | '));

  // ---- capture.json + dna.json + network log ----
  await Promise.all(pending.splice(0));
  B.writeJson(path.join(WS, 'capture', 'network.json'), { count: networkLog.length, byType: networkLog.reduce((m, r) => (m[r.type] = (m[r.type] || 0) + 1, m), {}), tilePatterns: Array.from(tilePatterns, ([pattern, count]) => ({ pattern, count })), requests: networkLog });
  wrote.push('capture/network.json (' + networkLog.length + ' requests)');
  if (dna) B.writeJson(path.join(WS, 'dna.json'), { meta: capture.meta, breakpoint: PRIMARY, sections: dna });
  capture.assets = manifest.stats; capture.contracts = contracts.map(c => ({ id: c.id, kind: c.kind, control: c.control, controlText: c.controlText, controlled: c.controlled, captured: c.captured, changed: c.observed && c.observed.changed }));
  capture.durationMs = Date.now() - started;
  B.writeJson(path.join(WS, 'capture.json'), capture);
  wrote.unshift('capture.json', 'dna.json (' + (dna ? dna.length : 0) + ' sections)');

  // ---- findings ----
  findings.unshift(primarySections.length + ' sections @' + PRIMARY + ': ' + primarySections.map(s => s.slug.replace(/^\d+-/, '')).join(', ').slice(0, 200));
  const tk = capture.tokens[PRIMARY];
  if (tk) findings.push('fonts: ' + tk.fonts.map(f => f.value.split(',')[0].replace(/"/g, '').trim()).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ') + ' | top colors: ' + tk.colors.slice(0, 4).map(c => c.value).join(', ') + (tk.breakpoints.length ? ' | @media breakpoints: ' + tk.breakpoints.slice(0, 6).join(' ') : ''));
  findings.push('platform: ' + (capture.motion.platform.join(', ') || 'unknown') + ' | motion: ' + (capture.motion.animationStack.join(', ') || 'none detected') + (surface.routingSummary.hasGpuSurfaces ? ' | GPU surfaces: ' + surface.counts.gpuCanvas + ' (mask in QA)' : '') + (surface.counts.video ? ' | video: ' + surface.counts.video : ''));
  if (capture.motion.libraries.vueScoped || capture.motion.libraries.cssModules || capture.motion.libraries.styledComponents || capture.motion.libraries.tailwind) findings.push('scope-attributed/utility CSS present → snapshot fast path is viable (node snapshot.js)');
  findings.push('integrity: ' + capture.integrity.status + (issues.length ? ' — ' + issues[0] : ''));

  await browser.close();
  const status = capture.integrity.status === 'failed' ? (primarySections.length ? 'partial' : 'failed') : (warnings.length ? 'partial' : 'ok');
  console.log(B.fmtSummary({ status, workspace: WS, wrote, findings, warnings, next: status === 'failed' ? 'fix the load problem, then re-run extract' : 'node spec.js ' + WS + ' (writes specs/), node snapshot.js ' + WS + ' (fidelity baseline), then build per spec and node compare.js' }));
  process.exit(status === 'failed' ? 1 : 0);
})().catch(async e => {
  B.ensureDir(path.join(WS, 'errors'));
  fs.writeFileSync(path.join(WS, 'errors', 'extract-' + Date.now() + '.md'), '# extract crashed\n\nURL: ' + url + '\n\n```\n' + e.stack + '\n```\n');
  console.log(B.fmtSummary({ status: 'failed', workspace: WS, findings: ['crash: ' + e.message.split('\n')[0]], next: 'see errors/ and re-run' }));
  process.exit(1);
});

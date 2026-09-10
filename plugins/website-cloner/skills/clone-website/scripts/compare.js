#!/usr/bin/env node
/*
 * compare.js — measured visual QA: the clone against the extracted references.
 *
 *   node compare.js <workspace> <clone: URL | index.html | dir> [--breakpoints 1440,768,390]
 *                   [--pass 95] [--threshold 0.1] [--mask sel,sel] [--sections all|N,M] [--no-slices] [--no-elements] [--out qa]
 *
 * Per breakpoint: section heights first (a height delta localizes a bug before
 * any pixel is compared), then pixelmatch per section (pass ≥ --pass %, default
 * 95: font anti-aliasing alone eats 2–3%), then full-page slice diffs (mean /
 * worst, localized by y), then an element-level check of every text node's
 * font / size / weight / color / position against dna.json (primary breakpoint).
 * GPU / video / embed surfaces are masked on BOTH images — they are verified
 * separately, never diffed.
 *
 * Exit 0 when every compared section passes at every breakpoint, 2 otherwise.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const B = require('./lib/browser');

const args = B.parseArgs(process.argv.slice(2), { breakpoints: { type: 'list' }, pass: { type: 'number', default: 95 }, threshold: { type: 'number', default: 0.1 }, mask: { type: 'list', default: [] }, sections: { type: 'string', default: 'all' }, slices: { type: 'bool', default: true }, elements: { type: 'bool', default: true }, out: { type: 'string', default: 'qa' }, 'wait-for': { type: 'string' }, wait: { type: 'number', default: 0 } });
if (args._.length < 2) { console.error('usage: compare.js <workspace> <clone-url-or-path> [--breakpoints ...] [--pass 95]'); process.exit(2); }
const WS = path.resolve(args._[0]);
const capture = B.readJson(path.join(WS, 'capture.json'));
const dna = B.readJson(path.join(WS, 'dna.json'), { sections: [] });
const surface = B.readJson(path.join(WS, 'surface-map.json'), { surfaces: [], routingSummary: { maskSelectors: [] } });
const BPS = (args.breakpoints || capture.meta.breakpoints).map(Number);
const P = capture.meta.primary;
const QA = B.ensureDir(path.resolve(WS, args.out));
let cloneTarget = args._[1];
if (!/^https?:/.test(cloneTarget)) { let p = path.resolve(cloneTarget); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); if (!fs.existsSync(p)) { console.error('[compare] clone not found: ' + p); process.exit(2); } cloneTarget = 'file://' + p; }
const masks = (surface.routingSummary.maskSelectors || []).concat(args.mask.map(String));
const wantedIdx = args.sections === 'all' ? null : new Set(String(args.sections).split(',').map(s => parseInt(s, 10)));
let pixelmatch;

function readPng(p) { return PNG.sync.read(fs.readFileSync(p)); }
function pad(img, w, h) { if (img.width === w && img.height === h) return img; const o = new PNG({ width: w, height: h }); o.data.fill(255); for (let y = 0; y < Math.min(img.height, h); y++) for (let x = 0; x < Math.min(img.width, w); x++) { const s = (y * img.width + x) * 4, d = (y * w + x) * 4; o.data[d] = img.data[s]; o.data[d + 1] = img.data[s + 1]; o.data[d + 2] = img.data[s + 2]; o.data[d + 3] = img.data[s + 3]; } return o; }
function paintMask(img, rects) { for (const r of rects) { for (let y = Math.max(0, r.y); y < Math.min(img.height, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(img.width, r.x + r.w); x++) { const i = (y * img.width + x) * 4; img.data[i] = 255; img.data[i + 1] = 0; img.data[i + 2] = 255; img.data[i + 3] = 255; } } }
function diff(aPath, bPng, outPath, maskRects) {
  const a = readPng(aPath); const w = Math.max(a.width, bPng.width), h = Math.max(a.height, bPng.height);
  const A = pad(a, w, h), Bp = pad(bPng, w, h);
  if (maskRects && maskRects.length) { paintMask(A, maskRects); paintMask(Bp, maskRects); }
  const D = new PNG({ width: w, height: h });
  const bad = pixelmatch(A.data, Bp.data, D.data, w, h, { threshold: args.threshold, includeAA: false, alpha: 0.35, diffColor: [255, 0, 0] });
  fs.writeFileSync(outPath, PNG.sync.write(D));
  // localize: 12 horizontal bands
  const bands = []; const bh = Math.max(1, Math.floor(h / 12));
  for (let b = 0; b < 12; b++) { let n = 0, tot = 0; for (let y = b * bh; y < Math.min(h, (b + 1) * bh); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; tot++; if (D.data[i] === 255 && D.data[i + 1] === 0 && D.data[i + 2] === 0) n++; } bands.push(tot ? +(100 * n / tot).toFixed(2) : 0); }
  return { width: w, height: h, refSize: [a.width, a.height], cloneSize: [bPng.width, bPng.height], mismatched: bad, matchPct: +((1 - bad / (w * h)) * 100).toFixed(2), sizeMismatch: a.width !== bPng.width || a.height !== bPng.height, bandsMismatchPct: bands };
}
function norm(t) { return (t || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

(async () => {
  pixelmatch = require('pixelmatch'); if (pixelmatch.default) pixelmatch = pixelmatch.default;
  const browser = await B.launch({});
  const report = { workspace: WS, clone: cloneTarget, source: capture.meta.url, at: new Date().toISOString(), pass: args.pass, threshold: args.threshold, masks, breakpoints: {} };
  let allPass = true; const findings = [], warnings = [];
  for (const w of BPS) {
    const refDir = path.join(WS, 'references', String(w));
    if (!fs.existsSync(refDir)) { warnings.push('no references for ' + w + 'px — extract with --breakpoints including it'); continue; }
    const outDir = B.ensureDir(path.join(QA, String(w)));
    const context = await B.newContext(browser, w);
    const page = await context.newPage();
    await B.preloadProbes(page);
    try { await page.goto(cloneTarget, { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch (e) { warnings.push('clone failed to load @' + w + ': ' + e.message.split('\n')[0]); await context.close(); continue; }
    try { await page.waitForLoadState('load', { timeout: 15000 }); } catch (_) {}
    // app clones load data after `load`: --wait-for <selector> (e.g. body[data-ready]) and/or --wait <ms> let them finish
    if (args['wait-for']) { try { await page.waitForSelector(args['wait-for'], { timeout: 60000 }); } catch (e) { warnings.push('--wait-for ' + args['wait-for'] + ' not found within 60s @' + w); } }
    await page.waitForTimeout(800 + (args.wait || 0));
    await B.forceLazy(page);
    const cloneHeight = await B.settle(page, { rest: 600 });
    await B.freezeMotion(page);
    await B.injectProbes(page).catch(() => {});
    const refSections = capture.sections[w] || [];
    const cloneCensus = await B.probe(page, 'sectionCensus', [{ maxSections: Math.max(40, refSections.length + 5) }]);
    // prefer explicit hooks when the build carries them
    const hooked = await page.evaluate(() => Array.from(document.querySelectorAll('[data-clone-section]')).map(e => { const r = e.getBoundingClientRect(); return { slug: e.getAttribute('data-clone-section'), rect: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }, fixed: /fixed|sticky/.test(getComputedStyle(e).position) }; }));
    // mask rects on the clone (and the same rects on the reference, both in page coords)
    const maskRects = masks.length ? await page.evaluate(sels => { const out = []; sels.forEach(s => { try { document.querySelectorAll(s).forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }); }); } catch (_) {} }); return out; }, masks) : [];
    const refMaskRects = w === P ? surface.surfaces.filter(s => /WEBG|CANVAS|VIDEO|LOTTIE|IFRAME/.test(s.surface)).map(s => s.rect) : [];
    const bp = { refHeight: capture.pageHeight[w], cloneHeight, heightDelta: cloneHeight - capture.pageHeight[w], refSections: refSections.length, cloneSections: hooked.length || cloneCensus.sections.length, matchedBy: hooked.length ? 'data-clone-section' : 'order', sections: [], slices: null, elements: null };
    // match sections
    const matched = [];
    refSections.forEach((rs, i) => {
      if (wantedIdx && !wantedIdx.has(i)) return;
      let cs = null;
      if (hooked.length) cs = hooked.find(h => h.slug === rs.slug || h.slug === rs.slug.replace(/^\d+-/, '')) || null;
      if (!cs) { const byHead = rs.heading && cloneCensus.sections.find(c => c.heading && norm(c.heading) === norm(rs.heading)); cs = byHead || cloneCensus.sections[i] || null; }
      matched.push({ i, rs, cs });
    });
    // heights first
    for (const m of matched) {
      const rec = { index: m.i, slug: m.rs.slug, refRect: m.rs.rect, cloneRect: m.cs ? m.cs.rect : null, heightDelta: m.cs ? m.cs.rect.h - m.rs.rect.h : null, topDelta: m.cs ? m.cs.rect.y - m.rs.rect.y : null, matchPct: null, passed: false, diffImage: null, bands: null };
      const refPng = path.join(refDir, 'section-' + m.rs.slug + '.png');
      if (!m.cs) { rec.error = 'no matching section on the clone'; bp.sections.push(rec); allPass = false; continue; }
      if (!fs.existsSync(refPng)) { rec.error = 'reference crop missing'; warnings.push('no reference crop for ' + m.rs.slug + ' @' + w + ' (extract with screenshots)'); allPass = false; bp.sections.push(rec); continue; }
      try {
        const r = m.cs.rect; const clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, Math.min(r.w, w)), height: Math.max(1, Math.min(r.h, 16000)) };
        let shot;
        if (m.cs.fixed) { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100); shot = await page.screenshot({ clip: { x: clip.x, y: clip.y, width: clip.width, height: Math.min(clip.height, 900) } }); }
        else shot = await page.screenshot({ fullPage: true, clip });
        const clonePng = PNG.sync.read(shot);
        const clonePath = path.join(outDir, 'section-' + m.rs.slug + '-clone.png'); fs.writeFileSync(clonePath, shot);
        const localMasks = maskRects.concat(refMaskRects).filter(mr => mr.y + mr.h > r.y && mr.y < r.y + r.h).map(mr => ({ x: mr.x - r.x, y: mr.y - r.y, w: mr.w, h: mr.h }));
        const d = diff(refPng, clonePng, path.join(outDir, 'section-' + m.rs.slug + '-diff.png'), localMasks);
        Object.assign(rec, { matchPct: d.matchPct, mismatched: d.mismatched, sizeMismatch: d.sizeMismatch, refSize: d.refSize, cloneSize: d.cloneSize, bands: d.bandsMismatchPct, diffImage: path.relative(WS, path.join(outDir, 'section-' + m.rs.slug + '-diff.png')), cloneImage: path.relative(WS, clonePath), masked: localMasks.length });
        rec.passed = d.matchPct >= args.pass;
        if (!rec.passed) allPass = false;
      } catch (e) { rec.error = e.message.split('\n')[0].slice(0, 120); allPass = false; }
      bp.sections.push(rec);
    }
    // slices
    if (args.slices) {
      const refSlices = fs.readdirSync(refDir).filter(f => /^slice-\d+\.png$/.test(f)).sort();
      const rows = []; let sum = 0, worst = 0, n = 0;
      for (const f of refSlices) {
        const y = parseInt(f.slice(6, 11), 10);
        await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(150);
        const shot = await page.screenshot();
        const d = diff(path.join(refDir, f), PNG.sync.read(shot), path.join(outDir, 'slice-' + String(y).padStart(5, '0') + '-diff.png'), maskRects.concat(refMaskRects).map(mr => ({ x: mr.x, y: mr.y - y, w: mr.w, h: mr.h })));
        const mis = +(100 - d.matchPct).toFixed(2); rows.push({ y, mismatchPct: mis }); sum += mis; worst = Math.max(worst, mis); n++;
      }
      await page.evaluate(() => scrollTo(0, 0));
      bp.slices = { count: n, meanMismatchPct: n ? +(sum / n).toFixed(2) : null, worstMismatchPct: worst, rows };
    }
    // element-level (primary only: dna has the text census)
    if (args.elements && w === P && dna.sections.length) {
      const el = { checked: 0, mismatches: [], missingText: [] };
      const cloneText = await page.evaluate(() => window.__clone.textCensus(document.body));
      const byText = new Map(); cloneText.forEach(t => { const k = norm(t.text); if (!byText.has(k)) byText.set(k, []); byText.get(k).push(t); });
      // same text can occur several times (brand in nav and hero): pick the candidate nearest the reference position
      const nearest = (t) => { const cands = byText.get(norm(t.text)); if (!cands) return null; return cands.slice().sort((a, b) => (Math.abs(a.rect.x - t.rect.x) + Math.abs(a.rect.y - t.rect.y)) - (Math.abs(b.rect.x - t.rect.x) + Math.abs(b.rect.y - t.rect.y)))[0]; };
      for (const sec of dna.sections) {
        if (wantedIdx && !wantedIdx.has(sec.index)) continue;
        for (const t of (sec.text || []).slice(0, 80)) {
          const c = nearest(t); if (!c) { if (t.text.length > 3) el.missingText.push({ section: sec.slug, tag: t.tag, text: t.text.slice(0, 60) }); continue; }
          el.checked++;
          const d = [];
          if (parseFloat(c.size) !== parseFloat(t.size)) d.push('size ' + t.size + '→' + c.size);
          if (String(c.weight) !== String(t.weight)) d.push('weight ' + t.weight + '→' + c.weight);
          if (norm(c.font) !== norm(t.font)) d.push('font ' + t.font + '→' + c.font);
          if (c.color !== t.color) d.push('color ' + t.color + '→' + c.color);
          if (parseFloat(c.lineHeight) && parseFloat(t.lineHeight) && Math.abs(parseFloat(c.lineHeight) - parseFloat(t.lineHeight)) > 1) d.push('line-height ' + t.lineHeight + '→' + c.lineHeight);
          if (Math.abs(c.rect.x - t.rect.x) > 3 || Math.abs(c.rect.y - t.rect.y) > 3) d.push('position (' + t.rect.x + ',' + t.rect.y + ')→(' + c.rect.x + ',' + c.rect.y + ')');
          if (d.length) el.mismatches.push({ section: sec.slug, tag: t.tag, text: t.text.slice(0, 50), deltas: d });
        }
      }
      bp.elements = { checked: el.checked, mismatched: el.mismatches.length, missingText: el.missingText.length, mismatches: el.mismatches.slice(0, 60), missing: el.missingText.slice(0, 40) };
    }
    report.breakpoints[w] = bp;
    const failed = bp.sections.filter(s => !s.passed);
    findings.push('@' + w + ': height ' + capture.pageHeight[w] + '→' + cloneHeight + ' (' + (bp.heightDelta >= 0 ? '+' : '') + bp.heightDelta + 'px) · sections ' + (bp.sections.length - failed.length) + '/' + bp.sections.length + ' pass' + (bp.slices ? ' · slices mean ' + bp.slices.meanMismatchPct + '% worst ' + bp.slices.worstMismatchPct + '%' : '') + (failed.length ? ' · FAIL: ' + failed.map(s => s.slug.replace(/^\d+-/, '') + (s.matchPct != null ? ' ' + s.matchPct + '%' : ' (' + s.error + ')')).join(', ') : ''));
    if (bp.elements) findings.push('@' + w + ' elements: ' + bp.elements.checked + ' text nodes checked, ' + bp.elements.mismatched + ' differ, ' + bp.elements.missingText + ' missing' + (bp.elements.mismatches[0] ? ' · e.g. ' + bp.elements.mismatches[0].tag + ' "' + bp.elements.mismatches[0].text.slice(0, 30) + '": ' + bp.elements.mismatches[0].deltas.join(', ') : ''));
    await context.close();
  }
  await browser.close();
  B.writeJson(path.join(QA, 'report.json'), report);
  const md = ['# Visual QA report', '', 'Source: ' + capture.meta.url, 'Clone: ' + cloneTarget, 'Pass bar: ' + args.pass + '% per section · pixelmatch threshold ' + args.threshold + (masks.length ? ' · masked: ' + masks.join(', ') : ''), ''];
  for (const w of Object.keys(report.breakpoints)) {
    const bp = report.breakpoints[w];
    md.push('## ' + w + 'px — page height ' + bp.refHeight + ' → ' + bp.cloneHeight + ' (' + (bp.heightDelta >= 0 ? '+' : '') + bp.heightDelta + ')', '', '| section | ref h | clone h | Δh | Δtop | match | verdict | worst band | diff |', '|---|---|---|---|---|---|---|---|---|');
    bp.sections.forEach(s => md.push('| ' + s.slug + ' | ' + s.refRect.h + ' | ' + (s.cloneRect ? s.cloneRect.h : '—') + ' | ' + (s.heightDelta == null ? '—' : s.heightDelta) + ' | ' + (s.topDelta == null ? '—' : s.topDelta) + ' | ' + (s.matchPct == null ? '—' : s.matchPct + '%') + ' | ' + (s.error ? 'ERROR ' + s.error : s.passed ? 'pass' : '**FAIL**') + ' | ' + (s.bands ? 'band ' + (s.bands.indexOf(Math.max(...s.bands)) + 1) + '/12 ' + Math.max(...s.bands) + '%' : '—') + ' | ' + (s.diffImage ? '`' + s.diffImage + '`' : '') + ' |'));
    if (bp.slices) { md.push('', 'Slices: ' + bp.slices.count + ' · mean mismatch ' + bp.slices.meanMismatchPct + '% · worst ' + bp.slices.worstMismatchPct + '%'); bp.slices.rows.filter(r => r.mismatchPct > 2).forEach(r => md.push('- y=' + r.y + ': ' + r.mismatchPct + '%')); }
    if (bp.elements) { md.push('', 'Elements: ' + bp.elements.checked + ' text nodes checked, ' + bp.elements.mismatched + ' differ, ' + bp.elements.missingText + ' missing on the clone'); bp.elements.mismatches.slice(0, 40).forEach(m => md.push('- [' + m.section + '] `' + m.tag + '` "' + m.text + '": ' + m.deltas.join('; '))); bp.elements.missing.slice(0, 20).forEach(m => md.push('- MISSING [' + m.section + '] `' + m.tag + '` "' + m.text + '"')); }
    md.push('');
  }
  md.push('Verdict: ' + (allPass ? 'all compared sections pass' : 'some sections FAIL — fix the worst band / element deltas first, re-run'), '');
  fs.writeFileSync(path.join(QA, 'report.md'), md.join('\n'));
  console.log(B.fmtSummary({ status: allPass ? 'ok' : 'partial', workspace: WS, wrote: [path.relative(WS, QA) + '/report.md', path.relative(WS, QA) + '/report.json', path.relative(WS, QA) + '/<w>/section-*-diff.png'], findings, warnings, next: allPass ? 'sections pass — run check.js for hotlinks/fingerprints/contracts, then hand off' : 'open the failing diff images; fix spec value or builder output at the source; re-run compare' }));
  process.exit(allPass ? 0 : 2);
})().catch(e => { console.log(B.fmtSummary({ status: 'failed', workspace: WS, findings: ['crash: ' + e.message.split('\n')[0]], next: 'see stack on stderr' })); console.error(e.stack); process.exit(1); });

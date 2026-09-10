#!/usr/bin/env node
/*
 * check.js — structural and behavioural gates on the clone (not pixels).
 *
 *   node check.js <workspace> <clone: URL | index.html | dir> [--out qa] [--allow-hotlinks]
 *
 * Gates, in dependency order:
 *   1. sections     every extracted section has a counterpart (data-clone-section hooks, else by order)
 *   2. hotlinks     no asset (img/src/srcset/poster/css url/font) still points at the source host
 *   3. fingerprints no source-framework markup leaked (data-v-*, __next, framer, wayback toolbar…)
 *   4. contracts    every interaction contract that changed on the original also changes on the clone
 *                   (a visually similar but inert control fails)
 * Exit 0 when all gates pass, 2 otherwise. Writes qa/check.json + qa/check.md.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');

const args = B.parseArgs(process.argv.slice(2), { out: { type: 'string', default: 'qa' }, 'allow-hotlinks': { type: 'bool', default: false }, 'wait-for': { type: 'string' }, wait: { type: 'number', default: 0 } });
if (args._.length < 2) { console.error('usage: check.js <workspace> <clone-url-or-path>'); process.exit(2); }
const WS = path.resolve(args._[0]);
const capture = B.readJson(path.join(WS, 'capture.json'));
const interactions = B.readJson(path.join(WS, 'interactions.json'), { contracts: [] });
const manifest = B.readJson(path.join(WS, 'assets', 'manifest.json'), { originHost: new URL(capture.meta.url).hostname });
const QA = B.ensureDir(path.resolve(WS, args.out));
let cloneTarget = args._[1];
if (!/^https?:/.test(cloneTarget)) { let p = path.resolve(cloneTarget); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html'); if (!fs.existsSync(p)) { console.error('[check] clone not found: ' + p); process.exit(2); } cloneTarget = 'file://' + p; }
const P = capture.meta.primary;
const norm = t => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();

(async () => {
  const browser = await B.launch({});
  const context = await B.newContext(browser, P);
  const page = await context.newPage();
  await B.preloadProbes(page);
  await page.goto(cloneTarget, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('load', { timeout: 15000 }); } catch (_) {}
  if (args['wait-for']) { try { await page.waitForSelector(args['wait-for'], { timeout: 60000 }); } catch (_) {} }
  await page.waitForTimeout(600 + (args.wait || 0)); await B.settle(page, { rest: 400 });
  await B.injectProbes(page).catch(() => {});
  const gates = {};
  // 1. sections
  const refSections = capture.sections[P] || [];
  const hooks = await page.evaluate(() => Array.from(document.querySelectorAll('[data-clone-section]')).map(e => e.getAttribute('data-clone-section')));
  const census = await B.probe(page, 'sectionCensus', [{ maxSections: 40 }]);
  const missing = hooks.length ? refSections.filter(s => !hooks.includes(s.slug) && !hooks.includes(s.slug.replace(/^\d+-/, ''))).map(s => s.slug) : [];
  gates.sections = { status: hooks.length ? (missing.length ? 'fail' : 'pass') : (census.sections.length >= refSections.length ? 'pass' : 'fail'), refCount: refSections.length, cloneCount: census.sections.length, hooked: hooks.length, missing, note: hooks.length ? 'matched by data-clone-section' : 'no data-clone-section hooks on the clone — matched by count only; add hooks for a real gate' };
  // 2. hotlinks
  const host = manifest.originHost || new URL(capture.meta.url).hostname.replace(/^www\./, '');
  const hot = await B.probe(page, 'hotlinkAudit', [host]);
  const cdnHot = await page.evaluate(() => Array.from(document.querySelectorAll('img[src^="http"], source[src^="http"], video[src^="http"], link[rel="stylesheet"][href^="http"]')).map(e => ({ tag: e.tagName.toLowerCase(), value: (e.getAttribute('src') || e.getAttribute('href')).slice(0, 160) })).filter(x => !/^https?:\/\/(fonts\.googleapis|fonts\.gstatic|use\.typekit)/.test(x.value)));
  gates.hotlinks = { status: (hot.length || cdnHot.length) && !args['allow-hotlinks'] ? 'fail' : 'pass', toSourceHost: hot.length, remote: cdnHot.length, examples: hot.slice(0, 10).concat(cdnHot.slice(0, 10)) };
  // 3. fingerprints
  const fp = await B.probe(page, 'fingerprintAudit', []);
  const isSnapshot = await page.evaluate(() => !!document.querySelector('meta[name="clone-website"]'));
  gates.fingerprints = { status: Object.keys(fp).length && !isSnapshot ? 'fail' : 'pass', hits: fp, note: isSnapshot ? 'snapshot build: source markup is expected here (fast path), gate informational' : Object.keys(fp).length ? 'source-framework markup leaked into the rebuild' : 'clean' };
  // 4. contracts
  const results = [];
  for (const c of interactions.contracts || []) {
    if (!c.observed || !c.observed.changed) { results.push({ id: c.id, kind: c.kind, status: 'skip', note: 'no observed change on the original' }); continue; }
    let sel = '[data-clone-interaction="' + c.id + '"]';
    let found = await page.$(sel);
    if (!found) {
      // fallback: same kind of control with the same text
      const cands = await page.$$(c.kind === 'tabs' ? '[role="tab"]' : c.kind === 'accordion' ? 'summary, [aria-expanded]' : c.kind === 'menu' ? '[aria-expanded], button[aria-haspopup], [aria-label*="menu" i]' : 'button, [role="button"]');
      for (const h of cands) { const t = await h.evaluate(e => e.textContent); if (norm(t) === norm(c.controlText) || (!norm(c.controlText) && cands.length === 1)) { found = h; sel = 'text-match'; break; } }
    }
    if (!found) { results.push({ id: c.id, kind: c.kind, status: 'fail', note: 'control not found (add data-clone-interaction="' + c.id + '")' }); continue; }
    try {
      const controlledSel = '[data-clone-controlled="' + c.id + '"]';
      const snap = () => page.evaluate(([csel, id]) => { const ctl = document.querySelector('[data-clone-interaction="' + id + '"]'); const c2 = document.querySelector(csel) || (ctl && ctl.getAttribute('aria-controls') && document.getElementById(ctl.getAttribute('aria-controls'))) || null; const sec = ctl ? ctl.closest('[data-clone-section], section, header, nav, footer, main, body') : document.body; return { controlled: c2 ? { html: c2.outerHTML.slice(0, 100000), display: getComputedStyle(c2).display, vis: getComputedStyle(c2).visibility, rect: c2.getBoundingClientRect().height } : null, ctlExpanded: ctl ? ctl.getAttribute('aria-expanded') : null, ctlSelected: ctl ? ctl.getAttribute('aria-selected') : null, ctlClass: ctl ? ctl.className.toString() : null, sectionHtml: sec ? sec.outerHTML.slice(0, 300000) : '' }; }, [controlledSel, c.id]);
      const before = await snap();
      await found.scrollIntoViewIfNeeded(); await found.click({ timeout: 3000 }); await page.waitForTimeout(500);
      const after = await snap();
      const changed = !!(JSON.stringify(before.controlled) !== JSON.stringify(after.controlled) || before.ctlExpanded !== after.ctlExpanded || before.ctlSelected !== after.ctlSelected || before.ctlClass !== after.ctlClass || before.sectionHtml !== after.sectionHtml);
      results.push({ id: c.id, kind: c.kind, status: changed ? 'pass' : 'fail', via: sel, note: changed ? 'activation changed the DOM' : 'INERT: clicking changed nothing (visual look-alike)' });
      if (c.kind === 'menu' || c.kind === 'accordion') { await found.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); }
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) { results.push({ id: c.id, kind: c.kind, status: 'fail', note: e.message.split('\n')[0].slice(0, 100) }); }
  }
  gates.contracts = { status: results.some(r => r.status === 'fail') ? 'fail' : 'pass', results };
  await browser.close();
  const out = { clone: cloneTarget, source: capture.meta.url, at: new Date().toISOString(), gates };
  B.writeJson(path.join(QA, 'check.json'), out);
  const md = ['# Structural / behavioural check', '', 'Clone: ' + cloneTarget, '', '| gate | status | detail |', '|---|---|---|',
    '| sections | ' + gates.sections.status + ' | ' + gates.sections.cloneCount + ' on clone vs ' + gates.sections.refCount + ' extracted; ' + gates.sections.note + (gates.sections.missing.length ? '; missing: ' + gates.sections.missing.join(', ') : '') + ' |',
    '| hotlinks | ' + gates.hotlinks.status + ' | ' + gates.hotlinks.toSourceHost + ' to source host, ' + gates.hotlinks.remote + ' other remote |',
    '| fingerprints | ' + gates.fingerprints.status + ' | ' + (Object.keys(gates.fingerprints.hits).map(k => k + '×' + gates.fingerprints.hits[k]).join(', ') || 'none') + ' — ' + gates.fingerprints.note + ' |',
    '| contracts | ' + gates.contracts.status + ' | ' + results.filter(r => r.status === 'pass').length + ' pass, ' + results.filter(r => r.status === 'fail').length + ' fail, ' + results.filter(r => r.status === 'skip').length + ' skipped |', ''];
  results.forEach(r => md.push('- ' + r.id + ' (' + r.kind + '): ' + r.status + ' — ' + r.note));
  gates.hotlinks.examples.forEach(h => md.push('- hotlink ' + h.tag + ' ' + (h.attr || '') + ' ' + h.value));
  fs.writeFileSync(path.join(QA, 'check.md'), md.join('\n') + '\n');
  const failed = Object.keys(gates).filter(g => gates[g].status === 'fail');
  console.log(B.fmtSummary({ status: failed.length ? 'partial' : 'ok', workspace: WS, wrote: [path.relative(WS, QA) + '/check.md', path.relative(WS, QA) + '/check.json'], findings: Object.keys(gates).map(g => g + ': ' + gates[g].status + (g === 'contracts' ? ' (' + results.filter(r => r.status === 'pass').length + '/' + results.filter(r => r.status !== 'skip').length + ')' : g === 'hotlinks' ? ' (' + (gates.hotlinks.toSourceHost + gates.hotlinks.remote) + ')' : g === 'sections' ? ' (' + gates.sections.cloneCount + '/' + gates.sections.refCount + ', ' + (hooks.length ? 'hooked' : 'unhooked') + ')' : '')), warnings: hooks.length ? [] : ['clone has no data-clone-section hooks — section gate is count-only'], next: failed.length ? 'fix ' + failed.join(', ') + ' then re-run check.js' : 'all gates pass — hand off as ready_for_user_review' }));
  process.exit(failed.length ? 2 : 0);
})().catch(e => { console.log(B.fmtSummary({ status: 'failed', workspace: WS, findings: ['crash: ' + e.message.split('\n')[0]], next: 'see stderr' })); console.error(e.stack); process.exit(1); });

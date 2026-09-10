/*
 * browser.js — Playwright driver helpers shared by extract / snapshot / compare / check.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROBES_PATH = path.join(__dirname, 'probes.js');
const FREEZE_CSS = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important} html{scroll-behavior:auto!important}';

function requirePlaywright() {
  try { return require('playwright'); } catch (e) {
    console.error('[clone] playwright is not installed. Run: bash ' + path.join(__dirname, '..', 'setup.sh'));
    process.exit(3);
  }
}

function parseArgs(argv, spec) {
  // spec: { name: { type: 'string'|'number'|'bool'|'list', default } }
  const out = { _: [] };
  for (const k of Object.keys(spec)) out[k] = spec[k].default;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const neg = name.startsWith('no-') ? name.slice(3) : null;
      if (neg && spec[neg] && spec[neg].type === 'bool') { out[neg] = false; continue; }
      const s = spec[name];
      if (!s) { console.error('[clone] unknown flag --' + name); process.exit(2); }
      if (s.type === 'bool') { out[name] = true; continue; }
      const v = argv[++i];
      if (v === undefined) { console.error('[clone] --' + name + ' needs a value'); process.exit(2); }
      out[name] = s.type === 'number' ? Number(v) : s.type === 'list' ? v.split(',').map(x => x.trim()).filter(Boolean).map(x => (isNaN(Number(x)) ? x : Number(x))) : v;
    } else out._.push(a);
  }
  return out;
}

function slugForUrl(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  const p = u.pathname.replace(/\/+$/, '').replace(/^\//, '').replace(/\//g, '-');
  return (host + (p ? '-' + p : '')).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function hash(s, n) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n || 8); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
function writeJson(p, obj) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }
function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (fallback !== undefined) return fallback; throw e; } }
function isWayback(url) { return /^https?:\/\/web\.archive\.org\/web\//.test(url); }
function waybackIf(url) { return url.replace(/^(https?:\/\/web\.archive\.org\/web\/\d{1,14})(?:id_|if_|im_|js_|cs_|fr_|oe_|mp_)?\//, '$1if_/'); }
function unwayback(url) { return url.replace(/^https?:\/\/web\.archive\.org\/web\/\d{1,14}(?:id_|if_|im_|js_|cs_|fr_|oe_|mp_)?\//, ''); }

async function launch(opts) {
  const { chromium } = requirePlaywright();
  const browser = await chromium.launch({ headless: opts && opts.headed ? false : true, args: ['--disable-blink-features=AutomationControlled', '--hide-scrollbars'] });
  return browser;
}
async function newContext(browser, width, extra) {
  return browser.newContext(Object.assign({ viewport: { width, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block', ignoreHTTPSErrors: true, locale: 'en-US',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' }, extra || {}));
}
async function injectProbes(page) { await page.addScriptTag({ path: PROBES_PATH }); await page.evaluate(() => !!window.__clone); }
async function preloadProbes(page) { await page.addInitScript({ path: PROBES_PATH }); await page.addInitScript(() => { try { window.__clone.instrumentAll(); } catch (_) {} }); }
async function probe(page, fn, args) { return page.evaluate(([fn, args]) => { const f = window.__clone[fn]; if (!f) throw new Error('probe missing: ' + fn); return f.apply(null, args || []); }, [fn, args || []]); }

async function robustGoto(page, url, timeout) {
  timeout = timeout || 60000;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  try { await page.waitForLoadState('load', { timeout: Math.min(timeout, 20000) }); } catch (_) {}
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (_) {}
  return resp;
}
async function stripWayback(page) {
  await page.evaluate(() => {
    ['wm-ipp-base', 'wm-ipp', 'donato', 'wm-ipp-print'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    document.querySelectorAll('script[src*="archive.org"], script[src*="/_static/"], link[href*="banner-styles"], img[src*="analytics.archive.org"]').forEach(el => el.remove());
  });
}
async function settle(page, opts) {
  opts = opts || {};
  const step = opts.step || 700, dwell = opts.dwell || 90;
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += step) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(dwell); }
  await page.evaluate(() => window.scrollTo(0, 0));
  try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch (_) {}
  await page.waitForTimeout(opts.rest || 800);
  return page.evaluate(() => document.documentElement.scrollHeight);
}
async function forceLazy(page) {
  return page.evaluate(() => {
    let n = 0; const attrs = ['data-src', 'data-lazy', 'data-original', 'data-lazy-src'];
    document.querySelectorAll('img').forEach(img => { for (const a of attrs) { const v = img.getAttribute(a); if (v && !(img.src || '').includes(v)) { img.src = v; n++; } } const ss = img.getAttribute('data-srcset'); if (ss && !img.srcset) { img.srcset = ss; n++; } if (img.loading === 'lazy') img.loading = 'eager'; });
    return n;
  });
}
async function freezeMotion(page) { await page.addStyleTag({ content: FREEZE_CSS }); await page.waitForTimeout(150); }
async function maskSelectors(page, selectors) { if (!selectors || !selectors.length) return; await page.addStyleTag({ content: selectors.join(',') + '{visibility:hidden!important}' }); }

function summary(lines) { return lines.filter(Boolean).join('\n'); }
function fmtSummary(o) {
  const L = ['STATUS: ' + o.status, 'WORKSPACE: ' + o.workspace, 'WROTE:'];
  (o.wrote || []).forEach(w => L.push('  - ' + w));
  L.push('KEY_FINDINGS:'); (o.findings || []).slice(0, 8).forEach(f => L.push('  - ' + f));
  L.push('WARNINGS: ' + ((o.warnings || []).length ? '' : 'none')); (o.warnings || []).slice(0, 10).forEach(w => L.push('  - ' + w));
  L.push('NEXT: ' + (o.next || ''));
  return L.join('\n');
}

module.exports = { requirePlaywright, parseArgs, slugForUrl, hash, ensureDir, writeJson, readJson, isWayback, waybackIf, unwayback, launch, newContext, injectProbes, preloadProbes, probe, robustGoto, stripWayback, settle, forceLazy, freezeMotion, maskSelectors, FREEZE_CSS, PROBES_PATH, summary, fmtSummary };

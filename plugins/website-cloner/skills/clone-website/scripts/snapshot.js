#!/usr/bin/env node
/*
 * snapshot.js — the fidelity fast path: post-hydration HTML + the site's own
 * stylesheets + rewritten asset paths = a static, self-contained baseline.
 *
 *   node snapshot.js <workspace> [--out build/snapshot] [--keep-scripts]
 *
 * Use it (a) as the QA reference to prove compare.js works before trusting a
 * rebuild, (b) as the deliverable when the user wants fidelity over a
 * maintainable codebase (scoped/utility CSS sites), (c) as the starting point
 * for behaviour-only rewrites. Scripts are stripped: behaviour must be rebuilt
 * from motion.json / interactions.json, not inherited from the source bundle.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');

const args = B.parseArgs(process.argv.slice(2), { out: { type: 'string' }, 'keep-scripts': { type: 'bool', default: false } });
const WS = path.resolve(args._[0] || '.');
const capture = B.readJson(path.join(WS, 'capture.json'));
const manifest = B.readJson(path.join(WS, 'assets', 'manifest.json'), { files: {} });
const OUT = path.resolve(args.out || path.join(WS, 'build', 'snapshot'));
B.ensureDir(path.join(OUT, 'css'));
const base = capture.meta.loadedUrl;
const relAssets = path.relative(OUT, path.join(WS, 'assets')).split(path.sep).join('/');
const residual = { hotlinks: [], rewritten: 0, stylesheets: 0 };

function abs(u, from) { try { return new URL(u, from || base).href; } catch (_) { return null; } }
function local(u, from) {
  if (!u || /^(data:|blob:|#|mailto:|tel:|javascript:)/i.test(u)) return null;
  const a = abs(u, from); if (!a) return null;
  const rec = manifest.files[a] || manifest.files[a.split('#')[0]] || (() => { const k = Object.keys(manifest.files).find(x => x.split('?')[0] === a.split('?')[0]); return k ? manifest.files[k] : null; })();
  if (!rec) return null;
  residual.rewritten++;
  return relAssets + '/' + rec.file.replace(/^assets\//, '');
}
function rewriteCssUrls(css, from) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => { const l = local(u.trim(), from); if (l) return 'url("' + l + '")'; if (/^https?:/.test(abs(u, from) || '') && !/^data:/.test(u)) residual.hotlinks.push(abs(u, from)); return m; });
}
function rewriteSrcset(v, from) { return v.split(',').map(e => { const parts = e.trim().split(/\s+/); const l = local(parts[0], from); if (!l) { residual.hotlinks.push(abs(parts[0], from)); return e.trim(); } return [l].concat(parts.slice(1)).join(' '); }).join(', '); }

let html = fs.readFileSync(path.join(WS, 'capture', 'page.html'), 'utf8');
// remove our own shadow sheets, wayback chrome, scripts, preload hints
html = html.replace(/<style[^>]*data-clone-shadow[^>]*>[\s\S]*?<\/style>/gi, '');
html = html.replace(/<div id="wm-ipp-base"[\s\S]*?<\/div>\s*<\/div>/gi, '');
if (!args['keep-scripts']) html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/>/gi, '');
html = html.replace(/<link\b[^>]*rel=["'](?:preload|prefetch|modulepreload|preconnect|dns-prefetch)["'][^>]*>/gi, '');
html = html.replace(/<noscript>([\s\S]*?)<\/noscript>/gi, (m, inner) => /<img|<iframe/.test(inner) ? inner : '');
// stylesheets: replace <link rel=stylesheet href> with local copies in cascade order
const sheetByHref = {}; (capture.stylesheets || []).forEach(s => { if (s.href && s.file) sheetByHref[s.href] = s; });
html = html.replace(/<link\b([^>]*)>/gi, (m, attrs) => {
  if (!/rel=["']?stylesheet/i.test(attrs)) {
    // icons etc.
    return m.replace(/\bhref=(["'])([^"']+)\1/i, (mm, q, u) => { const l = local(u); return l ? 'href="' + l + '"' : mm; });
  }
  const href = (attrs.match(/\bhref=(["'])([^"']+)\1/i) || [])[2]; if (!href) return m;
  const a = abs(href); const s = sheetByHref[a] || sheetByHref[href];
  if (!s) { residual.hotlinks.push(a); return m; }
  const css = rewriteCssUrls(fs.readFileSync(path.join(WS, s.file), 'utf8'), a);
  const name = 'css/' + path.basename(s.file); fs.writeFileSync(path.join(OUT, name), css); residual.stylesheets++;
  const media = (attrs.match(/\bmedia=(["'])([^"']+)\1/i) || [])[2];
  return '<link rel="stylesheet" href="' + name + '"' + (media ? ' media="' + media + '"' : '') + '>';
});
// inline <style> url()s
html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) => '<style' + attrs + '>' + rewriteCssUrls(css) + '</style>');
// element attributes
html = html.replace(/\b(src|poster|data-src|data-lazy-src)=(["'])([^"']+)\2/gi, (m, a, q, u) => { const l = local(u); if (l) return a + '="' + l + '"'; if (/^https?:|^\/\//.test(u) || u.startsWith('/')) residual.hotlinks.push(abs(u)); return m; });
html = html.replace(/\b(srcset|data-srcset)=(["'])([^"']+)\2/gi, (m, a, q, v) => a + '="' + rewriteSrcset(v) + '"');
html = html.replace(/\bstyle=(["'])([^"']*url\([^"']*)\1/gi, (m, q, v) => 'style="' + rewriteCssUrls(v).replace(/"/g, '&quot;') + '"');
// absolute links back to the origin become relative-ish (kept as outbound links — not assets)
html = html.replace(/<base\b[^>]*>/gi, '');
html = html.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="clone-website" content="snapshot of ' + capture.meta.url + ' at ' + capture.meta.extractedAt + '">');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
residual.hotlinks = Array.from(new Set(residual.hotlinks.filter(Boolean))).filter(u => !u.startsWith('data:'));
const readme = ['# Snapshot (fidelity fast path)', '', 'Source: ' + capture.meta.url, 'Built from capture/page.html + ' + residual.stylesheets + ' stylesheets, ' + residual.rewritten + ' asset references rewritten to ../../assets/.', 'Scripts stripped: ' + !args['keep-scripts'] + '. Behaviour must be rebuilt from motion.json / interactions.json.', '', '## Residual hotlinks (' + residual.hotlinks.length + ')', ...residual.hotlinks.slice(0, 80).map(u => '- ' + u), ''].join('\n');
fs.writeFileSync(path.join(OUT, 'README.md'), readme);
B.writeJson(path.join(OUT, 'snapshot.json'), residual);
console.log(B.fmtSummary({ status: residual.hotlinks.length > 20 ? 'partial' : 'ok', workspace: WS, wrote: [path.relative(WS, OUT) + '/index.html', path.relative(WS, OUT) + '/css/ (' + residual.stylesheets + ')', path.relative(WS, OUT) + '/README.md'], findings: [residual.rewritten + ' asset references localized', residual.hotlinks.length + ' residual hotlinks (see README.md)'], warnings: residual.hotlinks.length ? ['snapshot still references ' + residual.hotlinks.length + ' remote URLs'] : [], next: 'node compare.js ' + WS + ' ' + path.relative(WS, OUT) + '/index.html  — proves the QA loop before any rebuild' }));

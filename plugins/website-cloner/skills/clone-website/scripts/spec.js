#!/usr/bin/env node
/*
 * spec.js — turn a workspace into one builder brief per section (specs/NN-slug.spec.md).
 *
 *   node spec.js <workspace> [--section N|slug] [--stack html|next|vite] [--max-nodes 350]
 *
 * Every value in a spec is measured (CONFIRMED) unless marked otherwise. The
 * lines marked "AGENT:" are the parts a model must fill after reading the
 * screenshots and behaviour evidence — interaction model, per-state content,
 * anything the probes could only OBSERVE.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');

const args = B.parseArgs(process.argv.slice(2), { section: { type: 'string' }, stack: { type: 'string', default: 'html' }, 'max-nodes': { type: 'number', default: 350 } });
const WS = path.resolve(args._[0] || '.');
const capture = B.readJson(path.join(WS, 'capture.json'));
const dna = B.readJson(path.join(WS, 'dna.json'));
const manifest = B.readJson(path.join(WS, 'assets', 'manifest.json'), { files: {}, inlineSvgs: [] });
const motion = B.readJson(path.join(WS, 'motion.json'), {});
const scrollTl = B.readJson(path.join(WS, 'scroll-timeline.json'), { classified: [] });
const interactions = B.readJson(path.join(WS, 'interactions.json'), { contracts: [] });
const surface = B.readJson(path.join(WS, 'surface-map.json'), { surfaces: [] });
const P = capture.meta.primary;
const layouts = {}; for (const w of capture.meta.breakpoints) if (w !== P) layouts[w] = B.readJson(path.join(WS, 'layout-' + w + '.json'), []);
B.ensureDir(path.join(WS, 'specs'));

function within(r, outer) { return r && outer && r.y >= outer.y - 2 && r.y + r.h <= outer.y + outer.h + 2; }
function localFile(u) { if (!u) return null; const rec = manifest.files[u]; if (rec) return rec.file; try { const abs = new URL(u, capture.meta.loadedUrl).href; if (manifest.files[abs]) return manifest.files[abs].file; } catch (_) {} const k = Object.keys(manifest.files).find(x => x.split('?')[0] === u.split('?')[0]); return k ? manifest.files[k].file : null; }
function targetFile(sec) { const name = sec.slug.replace(/^\d+-/, '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') || 'Section'; if (args.stack === 'next') return 'src/components/sections/' + name + '.tsx'; if (args.stack === 'vite') return 'src/sections/' + name + '.tsx'; return 'build/site/sections/' + sec.slug + '.html (+ styles.css block)'; }
function kv(o) { return Object.keys(o || {}).map(k => k + ': ' + o[k]).join('; '); }
function renderTree(node, depth, state) {
  if (!node || state.n >= args['max-nodes']) { if (node) state.truncated++; return; }
  state.n++;
  const ind = '  '.repeat(depth);
  const st = node.styles || {};
  const geo = '[' + node.rect.w + '×' + node.rect.h + ' @' + node.rect.x + ',' + node.rect.y + ']';
  let line = ind + '- `' + node.tag + (node.classes ? '.' + node.classes.split(' ').filter(Boolean).slice(0, 3).join('.') : '') + '` ' + geo;
  if (node.text) line += ' "' + node.text.slice(0, 120).replace(/"/g, "'") + '"';
  if (node.img) line += ' IMG ' + (localFile(node.img.src) || node.img.src) + ' (' + node.img.naturalWidth + '×' + node.img.naturalHeight + (node.img.alt ? ', alt "' + node.img.alt.slice(0, 40) + '"' : '') + ')';
  if (node.video) line += ' VIDEO ' + (localFile(node.video.src) || node.video.src) + (node.video.poster ? ' poster ' + (localFile(node.video.poster) || node.video.poster) : '') + (node.video.autoplay ? ' autoplay' : '') + (node.video.loop ? ' loop' : '') + (node.video.muted ? ' muted' : '');
  if (node.svg) line += ' SVG viewBox=' + node.svg.viewBox;
  if (node.href) line += ' → ' + node.href.slice(0, 60);
  if (node.attrs) line += ' ' + kv(node.attrs).slice(0, 120);
  state.lines.push(line);
  const keys = Object.keys(st);
  if (keys.length) state.lines.push(ind + '  · ' + keys.map(k => k + ': ' + st[k]).join('; ').slice(0, 700));
  if (node.pseudo) Object.keys(node.pseudo).forEach(ps => state.lines.push(ind + '  · ' + ps + ' { ' + kv(node.pseudo[ps]) + ' }'));
  (node.children || []).forEach(c => renderTree(c, depth + 1, state));
  if (node.childrenTruncated) state.lines.push(ind + '  … +' + node.childrenTruncated + ' more children');
}
function selInSection(sel, sec) {
  // approximate: selector class/id tokens appear in the section subtree
  const toks = (sel || '').match(/[.#][A-Za-z_][\w-]*/g) || [];
  if (!toks.length) return false;
  const hay = sec._hay;
  return toks.every(t => hay.has(t.slice(1)));
}
function collectTokens(node, set) { if (!node) return; (node.classes || '').split(' ').filter(Boolean).forEach(c => set.add(c)); const m = (node.sel || '').match(/#([\w-]+)/); if (m) set.add(m[1]); (node.children || []).forEach(c => collectTokens(c, set)); }

const wanted = args.section ? dna.sections.filter(s => String(s.index) === args.section || s.slug === args.section || s.slug.replace(/^\d+-/, '') === args.section) : dna.sections;
if (!wanted.length) { console.error('[spec] no such section: ' + args.section); process.exit(2); }
const written = [];
for (const sec of wanted) {
  const meta = capture.sections[P][sec.index];
  sec._hay = new Set(); collectTokens(sec.tree, sec._hay); if (meta.id) sec._hay.add(meta.id);
  const L = [];
  L.push('# Section ' + sec.slug + ' — specification');
  L.push('');
  L.push('Source: ' + capture.meta.url + '  ·  extracted ' + capture.meta.extractedAt + '  ·  primary breakpoint ' + P + 'px');
  L.push('Every value below is a measured computed value (CONFIRMED) unless tagged OBSERVED or AGENT.');
  L.push('');
  L.push('## Overview');
  L.push('- **Selector on the original:** `' + meta.selector + '` (' + meta.tag + (meta.id ? '#' + meta.id : '') + ')');
  L.push('- **Target file (' + args.stack + '):** `' + targetFile(sec) + '`');
  L.push('- **Reference screenshots:** ' + capture.meta.breakpoints.map(w => '`references/' + w + '/section-' + (capture.sections[w][sec.index] ? capture.sections[w][sec.index].slug : sec.slug) + '.png`').join(', '));
  L.push('- **Geometry @' + P + ':** ' + meta.rect.w + '×' + meta.rect.h + ' at y=' + meta.rect.y + (meta.fixed ? ' — **' + meta.position + ' chrome** (z-index ' + meta.zIndex + ')' : '') + ' · background ' + meta.background + (meta.backgroundImage ? ' · bg-image ' + meta.backgroundImage : ''));
  L.push('- **Heading:** ' + (meta.heading ? '"' + meta.heading + '"' : 'none'));
  L.push('- **Container strategy:** ' + sec.alignment.strategy + ' — content starts at x=' + sec.alignment.contentStartLeft + ', width ' + sec.alignment.contentWidth + ' (`' + sec.alignment.contentSel + '`)');
  const gpu = surface.surfaces.filter(s => within(s.rect, meta.rect) && s.surface !== 'SVG_ANIMATED');
  if (gpu.length) L.push('- **Non-DOM surfaces inside this section:** ' + gpu.map(s => s.surface + ' `' + s.selector + '` ' + s.rect.w + '×' + s.rect.h + (s.src ? ' src ' + s.src : '') + (s.driver ? ' driver ' + s.driver : '')).join('; ') + ' — VIDEO/LOTTIE: re-embed the source; WEBGL/CANVAS: leave a placeholder mount of the same size/z-index (do not rebuild in HTML).');
  L.push('- **INTERACTION MODEL (AGENT):** static | click-driven | scroll-driven | hover | time-driven — decide from the behaviour evidence below and the sweep, scroll BEFORE you click.');
  L.push('');
  L.push('## Padding chain (viewport edge → content)');
  sec.alignment.chain.forEach(c => L.push('- `' + c.sel + '` width ' + c.width + ' left ' + c.left + ' · padding ' + c.paddingLeft + ' / ' + c.paddingRight + ' · margin ' + c.marginLeft + ' / ' + c.marginRight + ' · max-width ' + c.maxWidth + ' · ' + c.display + ' · ' + c.boxSizing));
  L.push('');
  L.push('## Responsive geometry');
  L.push('| breakpoint | section | content start | content width | strategy | hidden children |');
  L.push('|---|---|---|---|---|---|');
  L.push('| ' + P + ' | ' + meta.rect.w + '×' + meta.rect.h + ' @y' + meta.rect.y + ' | ' + sec.alignment.contentStartLeft + ' | ' + sec.alignment.contentWidth + ' | ' + sec.alignment.strategy + ' | ' + (sec.tree.children || []).filter(c => c.rect.w === 0 || c.rect.h === 0).length + ' |');
  for (const w of Object.keys(layouts)) { const l = layouts[w][sec.index]; if (!l) continue; L.push('| ' + w + ' | ' + l.rect.w + '×' + l.rect.h + ' @y' + l.rect.y + ' | ' + l.alignment.contentStartLeft + ' | ' + l.alignment.contentWidth + ' | ' + l.alignment.strategy + ' | ' + l.hiddenChildren + ' |'); }
  const mq = (sec.cssRules && sec.cssRules.mediaConditions) || [];
  if (mq.length) L.push('\nAuthored @media conditions that touch this section: ' + mq.map(m => '`' + m + '`').join(', ') + ' (full rules in `' + sec.cssRules.file + '`).');
  L.push('');
  L.push('## DOM + computed styles (depth-limited; non-default properties only)');
  const state = { n: 0, lines: [], truncated: 0 };
  renderTree(sec.tree, 0, state);
  L.push.apply(L, state.lines);
  if (state.truncated) L.push('… ' + state.truncated + ' deeper nodes omitted — read `dna.json` sections[' + sec.index + '].tree for the rest.');
  L.push('');
  L.push('## Text content (verbatim, in document order)');
  (sec.text || []).forEach(t => L.push('- `' + t.tag + '` ' + t.font + ' ' + t.size + '/' + t.lineHeight + ' w' + t.weight + ' ' + t.color + (t.letterSpacing !== 'normal' ? ' ls ' + t.letterSpacing : '') + (t.transform !== 'none' ? ' ' + t.transform : '') + ': "' + t.text.replace(/"/g, "'") + '"' + (t.href ? ' → ' + t.href.slice(0, 60) : '')));
  L.push('');
  L.push('## Assets in this section');
  const seenA = new Set();
  (sec.assets || []).forEach(a => {
    const src = a.src || (a.backgroundImage && (a.backgroundImage.match(/url\(["']?([^"')]+)/) || [])[1]);
    const key = (a.sel || '') + '|' + (src || ''); if (seenA.has(key)) return; seenA.add(key);
    const lf = src ? localFile(src) : null;
    const tier = a.svg ? 'INLINE-SVG (see assets/svg-inline/)' : lf ? 'REAL `' + lf + '`' : src ? 'MISSING (' + src.slice(0, 100) + ') — resolve via assets ladder' : (a.backgroundImage && a.backgroundImage.includes('gradient')) ? 'CSS gradient' : 'n/a';
    L.push('- `' + a.tag + '` `' + a.sel + '` ' + a.rect.w + '×' + a.rect.h + ' @' + a.rect.x + ',' + a.rect.y + ' · ' + tier + (a.alt ? ' · alt "' + a.alt.slice(0, 50) + '"' : '') + (a.natural ? ' · natural ' + a.natural.join('×') : '') + (a.objectFit && a.objectFit !== 'fill' ? ' · object-fit ' + a.objectFit : '') + (a.position && a.position !== 'static' ? ' · ' + a.position + ' z' + a.zIndex : '') + (a.backgroundImage ? ' · ' + a.backgroundImage.slice(0, 120) : '') + (a.poster ? ' · poster ' + (localFile(a.poster) || a.poster) : ''));
  });
  if ((sec.layered || []).length) { L.push(''); L.push('**Layered compositions** (several images stacked in one container — reproduce every layer):'); sec.layered.forEach(l => L.push('- `' + l.container + '` → ' + l.layers.map(x => '`' + x + '`').join(', '))); }
  const svgs = manifest.inlineSvgs.filter(s => s.section && (s.section === (meta.tag + (meta.id ? '#' + meta.id : '')) || (meta.id && s.section === '#' + meta.id) || selInSection(s.section, sec)));
  if (svgs.length) { L.push(''); L.push('Inline SVGs (' + svgs.length + '): ' + svgs.map(s => '`' + s.file + '` ' + s.classification + ' ' + s.width + '×' + s.height + ' fill:' + s.fillStrategy).join('; ').slice(0, 1200)); }
  L.push('');
  L.push('## Behaviour evidence');
  const hov = (sec.interactive || []).filter(i => i.hoverDelta || i.pseudoHoverDelta || i.focusDelta);
  if (hov.length) { L.push('### Hover / focus deltas (CONFIRMED by triggering)'); hov.forEach(i => { L.push('- `' + i.selector + '` "' + i.text + '" transition ' + i.transition.property + ' ' + i.transition.duration + ' ' + i.transition.timing + (i.transition.delay !== '0s' ? ' delay ' + i.transition.delay : '')); if (i.hoverDelta) Object.keys(i.hoverDelta).forEach(p => L.push('  - hover ' + p + ': ' + i.hoverDelta[p].from + ' → ' + i.hoverDelta[p].to)); if (i.pseudoHoverDelta) L.push('  - hover pseudo: ' + JSON.stringify(i.pseudoHoverDelta.to).slice(0, 300)); if (i.focusDelta) Object.keys(i.focusDelta).forEach(p => L.push('  - focus ' + p + ': ' + i.focusDelta[p].from + ' → ' + i.focusDelta[p].to)); }); }
  else L.push('- No hover/focus deltas measured on sampled elements' + ((sec.interactive || []).some(i => i.stateSkipped) ? ' (some skipped: ' + (sec.interactive || []).filter(i => i.stateSkipped).length + ')' : '') + '.');
  const sc = (scrollTl.classified || []).filter(c => selInSection(c.selector, sec));
  if (sc.length) { L.push('### Scroll-linked changes (OBSERVED at scroll positions)'); sc.forEach(c => L.push('- `' + c.selector + '` ' + c.type + ' first at scrollY=' + c.firstChangeY + ' props ' + c.props.join(', ') + ' — first diff ' + JSON.stringify(c.first).slice(0, 240))); }
  const st = (motion.scrollTrigger || []).filter(t => selInSection(t.trigger, sec) || selInSection(t.pin || '', sec));
  if (st.length) { L.push('### GSAP ScrollTriggers (CONFIRMED from runtime)'); st.forEach(t => L.push('- trigger `' + t.trigger + '` start ' + t.start + ' end ' + t.end + (t.scrub !== undefined ? ' scrub ' + JSON.stringify(t.scrub) : '') + (t.pin ? ' pin ' + t.pin : '') + (t.toggleActions ? ' toggleActions ' + t.toggleActions : '') + (t.animationVars ? ' vars ' + JSON.stringify(t.animationVars).slice(0, 200) : ''))); }
  const wa = (motion.waapi || []).filter(a => selInSection(a.target || '', sec));
  if (wa.length) { L.push('### Running animations (CONFIRMED via document.getAnimations)'); wa.slice(0, 12).forEach(a => L.push('- ' + a.type + ' ' + (a.name || '') + ' on `' + a.target + '` ' + (a.timeline || '') + ' ' + a.duration + 'ms ' + (a.easing || '') + ' ×' + a.iterations + (a.keyframes ? ' keyframes ' + JSON.stringify(a.keyframes).slice(0, 200) : ''))); }
  const kfs = (sec.cssRules && sec.cssRules.keyframes) || [];
  if (kfs.length) L.push('- @keyframes used by this section\'s rules: ' + kfs.join(', ') + ' (bodies in `' + sec.cssRules.file + '`)');
  const ic = (interactions.contracts || []).filter(c => within(c.controlRect, meta.rect));
  if (ic.length) { L.push('### Interaction contracts (controls that must WORK, not just look right)'); ic.forEach(c => L.push('- **' + c.id + '** ' + c.kind + ' control `' + c.control + '` "' + c.controlText + '"' + (c.controlled ? ' → `' + c.controlled + '`' : '') + ' · observed change on activation: ' + (c.observed ? c.observed.changed : 'n/a') + (c.captured && c.captured.startsWith('interactions/') ? ' · captured state in `' + c.captured + '`' : c.captured ? ' · ' + c.captured : '') + ' · mark the control `data-clone-interaction="' + c.id + '"` and the surface `data-clone-controlled="' + c.id + '"` in the build')); }
  if (sec.tree && JSON.stringify(sec.tree).includes('"role":"tab"')) L.push('- AGENT: tabs present — capture the content of EVERY tab state (click each on the original) and list it under Per-state content.');
  L.push('');
  L.push('## Per-state content (AGENT: fill when the section has tabs / carousel / accordion states)');
  L.push('- State "default": as listed under Text content.');
  L.push('');
  L.push('## Authored CSS');
  L.push('The rules that apply to this section on the original, including `:hover`, `@media` and `@keyframes`, are in `' + (sec.cssRules ? sec.cssRules.file + '` (' + sec.cssRules.ruleCount + ' rules' + (sec.cssRules.truncated ? ', truncated' : '') + ').' : 'css-rules/ (not captured)`.'));
  L.push('Use them to confirm transitions, breakpoints and hover states. Computed values above win when they disagree.');
  L.push('');
  L.push('## Build checklist');
  L.push('- [ ] every computed value above is reproduced, not approximated (spacing, size, weight, color, radius, shadow)');
  L.push('- [ ] real assets from `assets/` are used — no placeholders for REAL assets; MISSING ones resolved via the ladder and labelled');
  L.push('- [ ] text is verbatim');
  L.push('- [ ] responsive geometry matches at ' + capture.meta.breakpoints.join(' / ') + 'px');
  L.push('- [ ] hover/focus deltas and transitions reproduced');
  L.push('- [ ] interaction contracts work and carry `data-clone-interaction` hooks');
  L.push('- [ ] the section root carries `data-clone-section="' + sec.slug + '"`');
  L.push('');
  const file = path.join(WS, 'specs', sec.slug + '.spec.md');
  fs.writeFileSync(file, L.join('\n') + '\n');
  written.push('specs/' + sec.slug + '.spec.md (' + L.length + ' lines' + (state.truncated ? ', tree truncated' : '') + ')');
}
console.log(B.fmtSummary({ status: 'ok', workspace: WS, wrote: written, findings: [written.length + ' spec(s) written for stack "' + args.stack + '"', 'AGENT lines mark what a model must decide: interaction model, per-state content'], warnings: [], next: 'read each spec with its screenshots; fill the AGENT lines; then build the section' }));

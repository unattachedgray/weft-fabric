/*
 * probes.js — in-page measurement code for the clone-website skill.
 *
 * Everything here runs INSIDE the target page (Playwright page.evaluate, or
 * `firefox-control eval` on an armed tab). Nothing mutates the page except the
 * instrumentation preload, which wraps a few browser APIs so their use can be
 * observed. All functions are exported onto `window.__clone` so they survive the
 * function-scope wrapping Playwright applies to injected scripts.
 *
 * Lineage: section census + integrity fingerprints (Perfect-Web-Clone idea),
 * tokens/surface/motion probes (cth9191/site-clone, MIT), robust selectors,
 * pseudo-elements, alignment chain (azeembuilds/website-cloner, MIT), per-node
 * computed-style walk (JCodesMore/ai-website-cloner-template, MIT).
 */
(function (root) {
  'use strict';
  var W = root, D = root.document;

  /* ------------------------------------------------------------------ */
  /* Instrumentation preload — inject BEFORE the page's own scripts run   */
  /* ------------------------------------------------------------------ */
  function instrumentAll() {
    if (W.__cloneInstrumented) return;
    W.__cloneInstrumented = true;
    W.__cloneMotion = { io: [], raf: 0, listeners: [], mutationObs: 0 };
    try {
      var proto = W.HTMLCanvasElement && W.HTMLCanvasElement.prototype;
      if (proto) {
        var orig = proto.getContext;
        proto.getContext = function (type) {
          try { if (!this.__requestedContextType) this.__requestedContextType = type; } catch (_) {}
          return orig.apply(this, arguments);
        };
        var to = proto.transferControlToOffscreen;
        if (to) proto.transferControlToOffscreen = function () { this.__offscreen = true; return to.apply(this, arguments); };
      }
    } catch (_) {}
    try {
      var OIO = W.IntersectionObserver;
      if (OIO) {
        W.IntersectionObserver = function (cb, opts) {
          var rec = { options: opts || {}, targets: [] };
          W.__cloneMotion.io.push(rec);
          var inst = new OIO(cb, opts);
          var oobs = inst.observe.bind(inst);
          inst.observe = function (el) { try { rec.targets.push(shortSel(el)); } catch (_) {} return oobs(el); };
          return inst;
        };
        W.IntersectionObserver.prototype = OIO.prototype;
      }
    } catch (_) {}
    try {
      var oraf = W.requestAnimationFrame.bind(W);
      W.requestAnimationFrame = function (cb) { W.__cloneMotion.raf++; return oraf(cb); };
    } catch (_) {}
    try {
      var patch = function (target, name) {
        var oadd = target.addEventListener.bind(target);
        target.addEventListener = function (type, fn, opts) {
          if (/^(scroll|wheel|mousemove|pointermove|touchmove|resize|keydown)$/.test(type)) {
            W.__cloneMotion.listeners.push({ on: name, type: type, passive: !!(opts && opts.passive) });
          }
          return oadd(type, fn, opts);
        };
      };
      patch(W, 'window'); patch(D, 'document');
    } catch (_) {}
    try {
      var OMO = W.MutationObserver;
      if (OMO) { W.MutationObserver = function (cb) { W.__cloneMotion.mutationObs++; return new OMO(cb); }; W.MutationObserver.prototype = OMO.prototype; }
    } catch (_) {}
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                        */
  /* ------------------------------------------------------------------ */
  function cs(el, pseudo) { try { return W.getComputedStyle(el, pseudo || null); } catch (_) { return null; } }
  function rect(el) { var r = el.getBoundingClientRect(); return { x: Math.round(r.left + W.scrollX), y: Math.round(r.top + W.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; }
  function visible(el) { var r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false; var c = cs(el); return !!c && c.visibility !== 'hidden' && c.display !== 'none'; }
  function classStr(el) { return (el.className && typeof el.className === 'string') ? el.className.trim() : (el.getAttribute && el.getAttribute('class') || ''); }
  function shortSel(el) {
    if (!el || !el.tagName) return String(el);
    if (el.id && !looksGenerated(el.id)) return '#' + el.id;
    var cls = classStr(el).split(/\s+/).filter(function (c) { return c && !/[0-9a-f]{6,}/.test(c) && !/^\d/.test(c); }).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  }
  function looksGenerated(s) { return /[0-9a-f]{8,}|\d{4,}|^:r/.test(s); }
  function esc(s) { try { return W.CSS.escape(s); } catch (_) { return s.replace(/([^\w-])/g, '\\$1'); } }
  function text(el, max) { var t = (el.textContent || '').replace(/\s+/g, ' ').trim(); return max ? t.slice(0, max) : t; }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'section'; }
  function uniq(arr) { var seen = {}; return arr.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }); }

  // Robust, unique selector: data attrs → id → aria-label → unique class combo → nth-child path.
  function robustSelector(el) {
    var dataAttrs = ['data-testid', 'data-id', 'data-cy', 'data-qa', 'data-component', 'data-section'];
    for (var i = 0; i < dataAttrs.length; i++) {
      var val = el.getAttribute && el.getAttribute(dataAttrs[i]);
      if (val) { var c = '[' + dataAttrs[i] + '="' + val.replace(/"/g, '\\"') + '"]'; if (countMatches(c) === 1) return c; }
    }
    if (el.id && !looksGenerated(el.id) && countMatches('#' + esc(el.id)) === 1) return '#' + esc(el.id);
    var tag = el.tagName.toLowerCase();
    var aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) { var cand = tag + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]'; if (countMatches(cand) === 1) return cand; }
    var classes = classStr(el).split(/\s+/).filter(function (c) { return c && !/^\d/.test(c) && c.length < 60 && !/[0-9a-f]{6,}/.test(c); });
    for (var len = 1; len <= Math.min(classes.length, 3); len++) {
      var combo = tag + classes.slice(0, len).map(function (c) { return '.' + esc(c); }).join('');
      if (countMatches(combo) === 1) return combo;
    }
    var parts = [], cur = el;
    while (cur && cur !== D.body && parts.length < 6) {
      var t = cur.tagName.toLowerCase();
      if (cur.id && !looksGenerated(cur.id)) { parts.unshift('#' + esc(cur.id)); break; }
      var parent = cur.parentElement;
      if (parent) {
        var sib = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === cur.tagName; });
        parts.unshift(sib.length === 1 ? t : t + ':nth-of-type(' + (sib.indexOf(cur) + 1) + ')');
      } else parts.unshift(t);
      cur = parent;
    }
    return parts.join(' > ');
  }
  function countMatches(sel) { try { return D.querySelectorAll(sel).length; } catch (_) { return 0; } }

  /* ------------------------------------------------------------------ */
  /* Section census — the unit of spec, build, compare and integrity      */
  /* ------------------------------------------------------------------ */
  var LANDMARK = /^(HEADER|NAV|MAIN|SECTION|FOOTER|ARTICLE|ASIDE)$/;
  // `display: contents` wrappers (React portals/fragments) have no box: look through them.
  function boxedChildren(node, depth) {
    var out = [];
    Array.prototype.forEach.call(node.children, function (c) {
      var d = cs(c);
      if (d && d.display === 'contents' && (depth || 0) < 4) out.push.apply(out, boxedChildren(c, (depth || 0) + 1));
      else out.push(c);
    });
    return out;
  }
  function significantChildren(node, vw) {
    return boxedChildren(node).filter(function (c) {
      if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|svg)$/i.test(c.tagName)) return false;
      if (!visible(c)) return false;
      var r = c.getBoundingClientRect();
      var pos = cs(c).position;
      if (pos === 'fixed' || pos === 'absolute') return r.height >= 40 && r.width >= 120; // overlays and chrome count
      return r.height >= 40 && r.width >= vw * 0.3;
    });
  }
  function fixedOrSticky(el) { var p = cs(el).position; return p === 'fixed' || p === 'sticky'; }
  function headingOf(el) { var h = el.querySelector('h1,h2,h3,h4,[role="heading"]'); return h ? text(h, 80) : ''; }
  function sectionSlug(el, idx, heading) {
    var base = (el.id && !looksGenerated(el.id) && el.id) || el.getAttribute('aria-label') || el.getAttribute('data-section') || heading || (classStr(el).split(/\s+/)[0] || '') || el.tagName.toLowerCase();
    return String(idx).padStart(2, '0') + '-' + slugify(base);
  }
  function fingerprint(el, heading) {
    return [el.tagName.toLowerCase(), el.id || '', (heading || '').slice(0, 40), el.children.length, text(el, 4000).length > 0 ? 't' : ''].join('|');
  }
  // Descend through wrapper chains (body > div#__next > div > main) to the node whose children are the page's bands.
  function findBandRoot(vw) {
    var node = D.body, guard = 0;
    while (guard++ < 8) {
      var kids = significantChildren(node, vw).filter(function (c) { return !fixedOrSticky(c); });
      if (kids.length === 1 && kids[0].getBoundingClientRect().height >= node.getBoundingClientRect().height * 0.6) { node = kids[0]; continue; }
      break;
    }
    return node;
  }
  function sectionCensus(opts) {
    opts = opts || {};
    var vw = W.innerWidth, maxSections = opts.maxSections || 40;
    var out = [], seen = [];
    function push(el) { if (seen.indexOf(el) >= 0) return; seen.push(el); out.push(el); }
    // fixed chrome anywhere in body (header bars) — top-level only
    Array.prototype.forEach.call(D.body.querySelectorAll('header, nav, [role="banner"], [class*="header" i], [class*="navbar" i]'), function (el) {
      if (visible(el) && fixedOrSticky(el) && !el.closest('main, section, footer')) push(el);
    });
    var rootNode = findBandRoot(vw);
    // App UIs: fixed/absolute overlays under the band root (timeline bars, side panels, legends, dialogs)
    // are sections too — but only real panels (≥40px tall, ≥120px wide), not full-page scrims wrapping others.
    boxedChildren(rootNode).forEach(function (c) {
      if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|svg|CANVAS)$/i.test(c.tagName) || !visible(c)) return;
      var st = cs(c), r = c.getBoundingClientRect();
      if (!/^(fixed|absolute|sticky)$/.test(st.position)) return;
      if (r.height >= 40 && r.width >= 120) push(c);
    });
    var bands = significantChildren(rootNode, vw).filter(function (c) { return !fixedOrSticky(c) || cs(c).position === 'sticky'; });
    var tall = W.innerHeight * 1.5;
    // A band taller than 1.5 viewports is not one section. Descend through
    // single-child wrappers, then split on the first level with 2+ bands, up to
    // 3 levels deep. <main>/<body> wrappers with several landmarks split too.
    function expand(b, depth) {
      var h = b.getBoundingClientRect().height;
      var inner = significantChildren(b, vw);
      var isWrapper = b.tagName === 'MAIN' || b.tagName === 'DIV' || b.tagName === 'ARTICLE' || !LANDMARK.test(b.tagName);
      if (depth < 3 && isWrapper && h > tall) {
        var guard = 0, node = b, kids = inner;
        while (kids.length === 1 && guard++ < 4 && kids[0].getBoundingClientRect().height > h * 0.6) { node = kids[0]; kids = significantChildren(node, vw); }
        if (kids.length >= 2) { kids.forEach(function (k) { expand(k, depth + 1); }); return; }
      }
      if (depth === 0 && isWrapper && inner.length >= 2 && inner.filter(function (c) { return LANDMARK.test(c.tagName); }).length >= 2 && h > W.innerHeight * 0.8) { inner.forEach(function (k) { expand(k, depth + 1); }); return; }
      push(b);
    }
    bands.forEach(function (b) { expand(b, 0); });
    var sections = out.map(function (el) { return { el: el, r: rect(el) }; })
      .sort(function (a, b) { return a.r.y - b.r.y || a.r.x - b.r.x; })
      .slice(0, maxSections)
      .map(function (s, i) {
        var el = s.el, heading = headingOf(el);
        var c = cs(el);
        return {
          index: i,
          slug: sectionSlug(el, i, heading),
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: classStr(el).slice(0, 160),
          selector: robustSelector(el),
          heading: heading,
          fingerprint: fingerprint(el, heading),
          rect: s.r,
          position: c.position,
          fixed: c.position === 'fixed' || c.position === 'sticky',
          zIndex: c.zIndex,
          background: c.backgroundColor,
          backgroundImage: c.backgroundImage !== 'none' ? c.backgroundImage.slice(0, 200) : null,
          textLength: text(el, 20000).length,
          childCount: el.children.length,
          hasCanvas: !!el.querySelector('canvas'),
          hasVideo: !!el.querySelector('video'),
          images: el.querySelectorAll('img').length,
        };
      });
    return { viewport: { w: vw, h: W.innerHeight }, pageHeight: D.documentElement.scrollHeight, bandRoot: shortSel(rootNode), sections: sections };
  }

  /* ------------------------------------------------------------------ */
  /* DNA — per-section computed truth                                     */
  /* ------------------------------------------------------------------ */
  var STYLE_PROPS = ['display', 'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'width', 'height', 'maxWidth', 'minWidth', 'maxHeight', 'minHeight',
    'boxSizing', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignSelf', 'flexGrow', 'flexShrink', 'flexBasis', 'gap', 'rowGap', 'columnGap',
    'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow', 'gridAutoFlow',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform', 'textDecorationLine', 'textAlign', 'color', 'whiteSpace', 'textOverflow', 'webkitLineClamp',
    'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundClip',
    'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderRadius', 'boxShadow', 'outline',
    'opacity', 'transform', 'transformOrigin', 'transition', 'animation', 'filter', 'backdropFilter', 'mixBlendMode', 'clipPath',
    'overflow', 'overflowX', 'overflowY', 'objectFit', 'objectPosition', 'aspectRatio', 'cursor', 'pointerEvents', 'visibility'];
  var DEFAULTS = { display: 'block', position: 'static', zIndex: 'auto', top: 'auto', right: 'auto', bottom: 'auto', left: 'auto', width: 'auto', height: 'auto', maxWidth: 'none', minWidth: '0px', maxHeight: 'none', minHeight: '0px',
    boxSizing: 'content-box', flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'normal', alignItems: 'normal', alignSelf: 'auto', flexGrow: '0', flexShrink: '1', flexBasis: 'auto', gap: 'normal', rowGap: 'normal', columnGap: 'normal',
    gridTemplateColumns: 'none', gridTemplateRows: 'none', gridColumn: 'auto', gridRow: 'auto', gridAutoFlow: 'row',
    paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px', marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
    fontStyle: 'normal', letterSpacing: 'normal', textTransform: 'none', textDecorationLine: 'none', textAlign: 'start', whiteSpace: 'normal', textOverflow: 'clip', webkitLineClamp: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', backgroundSize: 'auto', backgroundPosition: '0% 0%', backgroundRepeat: 'repeat', backgroundClip: 'border-box',
    borderRadius: '0px', boxShadow: 'none', opacity: '1', transform: 'none', transformOrigin: null, transition: 'all', animation: 'none', filter: 'none', backdropFilter: 'none', mixBlendMode: 'normal', clipPath: 'none',
    overflow: 'visible', overflowX: 'visible', overflowY: 'visible', objectFit: 'fill', objectPosition: '50% 50%', aspectRatio: 'auto', cursor: 'auto', pointerEvents: 'auto', visibility: 'visible' };
  var INHERITED = { fontFamily: 1, fontSize: 1, fontWeight: 1, fontStyle: 1, lineHeight: 1, letterSpacing: 1, textTransform: 1, textAlign: 1, color: 1, whiteSpace: 1, cursor: 1, visibility: 1 };
  function styles(el, parentCs) {
    var c = cs(el); if (!c) return {};
    var o = {};
    var positioned = /^(absolute|fixed|sticky)$/.test(c.position);
    for (var i = 0; i < STYLE_PROPS.length; i++) {
      var p = STYLE_PROPS[i], v = c[p];
      if (v === undefined || v === '' ) continue;
      if (DEFAULTS[p] !== undefined && DEFAULTS[p] !== null && v === DEFAULTS[p]) continue;
      if (INHERITED[p] && parentCs && parentCs[p] === v) continue; // same as parent → inherited, not authored here
      if (/^border(Top|Right|Bottom|Left)$/.test(p) && /^0px/.test(v)) continue;
      if (p === 'transition' && /^all 0s ease 0s$/.test(v)) continue;
      if (p === 'transformOrigin') continue;
      if (p === 'outline' && /none/.test(v)) continue;
      if (/^(top|right|bottom|left)$/.test(p) && !positioned) continue;
      if ((p === 'minWidth' || p === 'minHeight') && v === 'auto') continue;
      if (p === 'boxSizing' && parentCs && parentCs.boxSizing === v) continue;
      if ((p === 'width' || p === 'height') && el.tagName !== 'IMG' && el.tagName !== 'VIDEO' && el.tagName !== 'svg' && el.tagName !== 'CANVAS' && /px$/.test(v) && !/^(inline-block|inline-flex|flex|grid|block)$/.test(c.display) ) { /* keep */ }
      o[p] = v;
    }
    // width/height are geometry, already in rect — keep only when explicitly constrained (max/min or replaced elements)
    if (!/^(IMG|VIDEO|svg|CANVAS|IFRAME)$/.test(el.tagName)) { delete o.width; delete o.height; }
    return o;
  }
  function pseudoStyles(el) {
    var res = null, P = ['content', 'display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'opacity', 'z-index', 'background-color', 'background-image', 'transform', 'border-radius', 'color', 'font-size', 'box-shadow', 'clip-path', 'filter', 'backdrop-filter', 'border', 'transition', 'inset'];
    ['::before', '::after'].forEach(function (ps) {
      var c = cs(el, ps); if (!c) return;
      var content = c.getPropertyValue('content'), display = c.getPropertyValue('display');
      if (content === 'none' || content === 'normal' || display === 'none') return;
      var o = {};
      P.forEach(function (p) { var v = c.getPropertyValue(p); if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') o[p] = v; });
      o.content = content; o.display = display;
      (res = res || {})[ps] = o;
    });
    return res;
  }
  function nodeInfo(el, depth, maxDepth, maxChildren) {
    var kids = Array.prototype.filter.call(el.children, function (c) { return !/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE)$/i.test(c.tagName); });
    var own = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }).map(function (n) { return n.textContent.replace(/\s+/g, ' ').trim(); }).join(' ');
    var r = rect(el);
    var info = {
      tag: el.tagName.toLowerCase(),
      sel: robustSelector(el),
      classes: classStr(el).split(/\s+/).slice(0, 6).join(' '),
      rect: r,
      text: own ? own.slice(0, 300) : null,
      styles: styles(el, depth > 0 && el.parentElement ? cs(el.parentElement) : null),
      pseudo: pseudoStyles(el),
      childCount: kids.length,
    };
    if (el.tagName === 'IMG') info.img = { src: el.currentSrc || el.src, alt: el.alt, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, loading: el.loading || null, srcset: (el.srcset || '').slice(0, 300) };
    if (el.tagName === 'VIDEO') info.video = { src: el.currentSrc || el.src || (el.querySelector('source') || {}).src || null, poster: el.poster || null, autoplay: el.autoplay, loop: el.loop, muted: el.muted };
    if (el.tagName === 'A') info.href = el.getAttribute('href');
    if (el.tagName === 'svg') { info.svg = { viewBox: el.getAttribute('viewBox'), bytes: (el.outerHTML || '').length }; }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') info.input = { type: el.type, placeholder: el.placeholder || null, value: el.value ? '[value]' : null };
    var attrs = {};
    ['role', 'aria-label', 'aria-expanded', 'aria-controls', 'aria-selected', 'aria-hidden', 'href', 'target', 'type', 'data-state'].forEach(function (a) { var v = el.getAttribute && el.getAttribute(a); if (v != null) attrs[a] = v.slice(0, 120); });
    if (Object.keys(attrs).length) info.attrs = attrs;
    if (depth < maxDepth && kids.length && !(el.tagName === 'svg')) {
      var cap = kids.length > maxChildren;
      info.children = kids.slice(0, maxChildren).map(function (c) { return nodeInfo(c, depth + 1, maxDepth, maxChildren); });
      if (cap) info.childrenTruncated = kids.length - maxChildren;
    }
    return info;
  }
  function alignmentChain(section) {
    var contentEl = section;
    var cands = section.querySelectorAll('[class*="container" i], [class*="wrapper" i], [class*="inner" i], [class*="content" i], [class*="max-w" i]');
    for (var i = 0; i < cands.length; i++) { var c = cs(cands[i]); if (c && c.maxWidth !== 'none' && visible(cands[i])) { contentEl = cands[i]; break; } }
    if (contentEl === section && cands.length && visible(cands[0])) contentEl = cands[0];
    var chain = [], cur = contentEl;
    while (cur && cur !== D.body && chain.length < 12) {
      var c2 = cs(cur), r = cur.getBoundingClientRect();
      chain.unshift({ sel: shortSel(cur), paddingLeft: c2.paddingLeft, paddingRight: c2.paddingRight, marginLeft: c2.marginLeft, marginRight: c2.marginRight, maxWidth: c2.maxWidth, width: Math.round(r.width), left: Math.round(r.left), boxSizing: c2.boxSizing, display: c2.display });
      if (cur === section) break;
      cur = cur.parentElement;
    }
    var cr = contentEl.getBoundingClientRect(), cc = cs(contentEl);
    var contentLeft = cr.left + parseFloat(cc.paddingLeft) + parseFloat(cc.borderLeftWidth);
    var contentRight = cr.right - parseFloat(cc.paddingRight) - parseFloat(cc.borderRightWidth);
    var strategy = 'unknown';
    if (cc.maxWidth !== 'none' && Math.abs(parseFloat(cc.marginLeft) - parseFloat(cc.marginRight)) < 3) strategy = 'max-width-centered';
    else if (cr.width > W.innerWidth * 0.98 && parseFloat(cc.paddingLeft) > 10) strategy = 'full-bleed-with-padding';
    else if (cc.display === 'grid') strategy = 'css-grid';
    else if (cc.display === 'flex') strategy = 'flexbox';
    return { contentSel: shortSel(contentEl), contentStartLeft: Math.round(contentLeft), contentStartRight: Math.round(contentRight), contentWidth: Math.round(contentRight - contentLeft), strategy: strategy, chain: chain };
  }
  function textCensus(section) {
    var out = [];
    var nodes = section.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,li,span,label,blockquote,figcaption,small,strong,em,code,td,th,dt,dd,summary,input,textarea');
    for (var i = 0; i < nodes.length && out.length < 400; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;
      var own = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }).map(function (n) { return n.textContent.replace(/\s+/g, ' ').trim(); }).join(' ');
      var t = own || ((el.tagName === 'A' || el.tagName === 'BUTTON') && el.children.length <= 2 ? text(el, 200) : '');
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') t = el.placeholder || '';
      if (!t) continue;
      var c = cs(el), r = rect(el);
      out.push({ tag: el.tagName.toLowerCase(), text: t.slice(0, 300), rect: r, font: c.fontFamily.split(',')[0].replace(/["']/g, '').trim(), size: c.fontSize, weight: c.fontWeight, lineHeight: c.lineHeight, color: c.color, letterSpacing: c.letterSpacing, transform: c.textTransform, href: el.tagName === 'A' ? el.getAttribute('href') : undefined });
    }
    return out;
  }
  function imagesIn(section) {
    var out = [];
    Array.prototype.forEach.call(section.querySelectorAll('img, picture, video, svg:not(svg svg), [style*="background"]'), function (el) {
      if (!visible(el) && el.tagName !== 'VIDEO') return;
      var c = cs(el), r = rect(el), rec = { tag: el.tagName.toLowerCase(), sel: robustSelector(el), rect: r, position: c.position, zIndex: c.zIndex, objectFit: c.objectFit, borderRadius: c.borderRadius };
      if (el.tagName === 'IMG') { rec.src = el.currentSrc || el.src; rec.alt = el.alt; rec.natural = [el.naturalWidth, el.naturalHeight]; }
      if (el.tagName === 'VIDEO') { rec.src = el.currentSrc || el.src || (el.querySelector('source') || {}).src || null; rec.poster = el.poster || null; rec.autoplay = el.autoplay; rec.loop = el.loop; rec.muted = el.muted; }
      if (el.tagName === 'svg') rec.svg = { viewBox: el.getAttribute('viewBox'), bytes: el.outerHTML.length, role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label') };
      if (c.backgroundImage && c.backgroundImage !== 'none') rec.backgroundImage = c.backgroundImage.slice(0, 300);
      if (rec.src || rec.svg || rec.backgroundImage) out.push(rec);
    });
    // background images on any element in section (computed)
    Array.prototype.forEach.call(section.querySelectorAll('*'), function (el) {
      if (out.length > 200) return;
      var c = cs(el); if (!c) return;
      var bg = c.backgroundImage;
      if (bg && bg !== 'none' && bg.indexOf('url(') >= 0 && el.tagName !== 'IMG') {
        var already = out.some(function (o) { return o.sel === robustSelector(el); });
        if (!already && visible(el)) out.push({ tag: el.tagName.toLowerCase(), sel: robustSelector(el), rect: rect(el), backgroundImage: bg.slice(0, 300), backgroundSize: c.backgroundSize, backgroundPosition: c.backgroundPosition, backgroundRepeat: c.backgroundRepeat, position: c.position, zIndex: c.zIndex });
      }
    });
    // layered compositions: containers with 2+ positioned images
    var layered = [];
    var byParent = {};
    out.forEach(function (o) { if (o.tag === 'img' || o.backgroundImage) { var p = o.sel.replace(/ > [^>]+$/, ''); (byParent[p] = byParent[p] || []).push(o.sel); } });
    Object.keys(byParent).forEach(function (p) { if (byParent[p].length >= 2) layered.push({ container: p, layers: byParent[p] }); });
    return { assets: out, layered: layered };
  }
  function interactiveIn(section, cap) {
    var out = [], seen = {};
    var nodes = section.querySelectorAll('a, button, input, textarea, select, summary, [role="button"], [role="tab"], [tabindex], [class*="btn" i], [class*="card" i]');
    for (var i = 0; i < nodes.length && out.length < (cap || 40); i++) {
      var el = nodes[i]; if (!visible(el)) continue;
      var sel = robustSelector(el); if (seen[sel]) continue; seen[sel] = 1;
      var c = cs(el);
      out.push({ selector: sel, unique: countMatches(sel) === 1, tag: el.tagName.toLowerCase(), text: text(el, 40), rect: rect(el),
        transition: { property: c.transitionProperty, duration: c.transitionDuration, timing: c.transitionTimingFunction, delay: c.transitionDelay },
        defaultState: { backgroundColor: c.backgroundColor, color: c.color, transform: c.transform, opacity: c.opacity, boxShadow: c.boxShadow, borderColor: c.borderColor, outline: c.outline, textDecorationLine: c.textDecorationLine, filter: c.filter },
        pseudo: pseudoStyles(el) });
    }
    return out;
  }
  function dnaProbe(selectors, opts) {
    opts = opts || {};
    var maxDepth = opts.maxDepth || 6, maxChildren = opts.maxChildren || 24;
    return selectors.map(function (sel, i) {
      var el = null; try { el = D.querySelector(sel); } catch (_) {}
      if (!el) return { index: i, selector: sel, error: 'not found' };
      var imgs = imagesIn(el);
      return {
        index: i, selector: sel, rect: rect(el),
        tree: nodeInfo(el, 0, maxDepth, maxChildren),
        alignment: alignmentChain(el),
        text: textCensus(el),
        assets: imgs.assets, layered: imgs.layered,
        interactive: interactiveIn(el, opts.maxInteractive || 40),
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Authored CSS — the rules getComputedStyle cannot show                 */
  /* ------------------------------------------------------------------ */
  // Inject CSS text (e.g. a CORS-blocked stylesheet we fetched) so the CSSOM can parse it without applying it.
  function addShadowSheet(cssText, href) {
    var st = D.createElement('style'); st.setAttribute('media', 'not all'); st.setAttribute('data-clone-shadow', href || 'inline'); st.textContent = cssText; D.head.appendChild(st); return true;
  }
  function baseSelector(sel) { return sel.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '').replace(/\s+$/, '').trim(); }
  function cssRulesForSection(sectionSel, opts) {
    opts = opts || {};
    var maxChars = opts.maxChars || 60000;
    var section = D.querySelector(sectionSel); if (!section) return { error: 'section not found' };
    var base = [], media = {}, kf = {}, fontFaces = [], varsUsed = {}, rootVars = {}, blocked = [], count = 0;
    function applies(sel) {
      var b = baseSelector(sel); if (!b) return false;
      if (/^(html|body|:root|\*)$/.test(b)) return false;
      try { if (section.matches(b) || section.querySelector(b)) return true; } catch (_) {
        // unsupported selector → conservative token test
        var toks = b.match(/[.#][A-Za-z_][\w-]*/g) || [];
        if (!toks.length) return false;
        return toks.every(function (t) { try { return t[0] === '.' ? section.querySelector(t) || section.classList.contains(t.slice(1)) : section.querySelector(t) || section.id === t.slice(1); } catch (_) { return false; } });
      }
      return false;
    }
    function walk(rules, cond, sheetHref) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        try {
          if (r.type === 1) { // style
            var sels = r.selectorText.split(',').map(function (s) { return s.trim(); });
            if (/^(:root|html)$/.test(r.selectorText.trim())) { for (var k = 0; k < r.style.length; k++) { var p = r.style[k]; if (p.indexOf('--') === 0) rootVars[p] = r.style.getPropertyValue(p).trim(); } continue; }
            var kept = sels.filter(applies);
            if (!kept.length) continue;
            var txt = kept.join(', ') + ' { ' + r.style.cssText + ' }';
            count++;
            if (cond) (media[cond] = media[cond] || []).push(txt); else base.push(txt);
            var m = r.style.cssText.match(/var\(\s*(--[\w-]+)/g) || [];
            m.forEach(function (v) { varsUsed[v.replace(/var\(\s*/, '')] = 1; });
            var an = r.style.animationName || r.style.getPropertyValue('animation-name');
            if (an && an !== 'none') an.split(',').forEach(function (n) { kf[n.trim()] = kf[n.trim()] || null; });
          } else if (r.type === 4 || r.type === 12) { // media / supports
            var c2 = (cond ? cond + ' and ' : '') + (r.conditionText || (r.media && r.media.mediaText) || '');
            walk(r.cssRules, r.type === 4 ? c2 : cond, sheetHref);
          } else if (r.type === 7) { // keyframes
            if (kf[r.name] !== undefined || opts.allKeyframes) kf[r.name] = r.cssText;
            else kf['__pending__' + r.name] = r.cssText;
          } else if (r.type === 5) { // font-face
            fontFaces.push(r.cssText);
          } else if (r.cssRules && r.cssRules.length) walk(r.cssRules, cond, sheetHref);
        } catch (_) {}
      }
    }
    for (var s = 0; s < D.styleSheets.length; s++) {
      var ss = D.styleSheets[s], rules;
      try { rules = ss.cssRules; } catch (_) { blocked.push(ss.href || 'inline'); continue; }
      if (!rules) continue;
      walk(rules, null, ss.href);
    }
    // resolve keyframes referenced but seen before the reference
    Object.keys(kf).forEach(function (k) { if (k.indexOf('__pending__') === 0) { var name = k.slice(11); if (kf[name] === null) kf[name] = kf[k]; delete kf[k]; } });
    // resolve var chains
    var resolved = {}, stack = Object.keys(varsUsed), guard = 0;
    while (stack.length && guard++ < 500) { var v = stack.pop(); if (resolved[v] !== undefined || rootVars[v] === undefined) continue; resolved[v] = rootVars[v]; (rootVars[v].match(/var\(\s*(--[\w-]+)/g) || []).forEach(function (x) { stack.push(x.replace(/var\(\s*/, '')); }); }
    var parts = [];
    var rv = Object.keys(resolved); if (rv.length) parts.push(':root { ' + rv.map(function (k) { return k + ': ' + resolved[k] + ';'; }).join(' ') + ' }');
    if (fontFaces.length) parts.push(uniq(fontFaces).join('\n'));
    if (base.length) parts.push(base.join('\n'));
    var kfText = Object.keys(kf).filter(function (k) { return kf[k]; }).map(function (k) { return kf[k]; });
    if (kfText.length) parts.push(kfText.join('\n'));
    Object.keys(media).forEach(function (cond) { parts.push('@media ' + cond + ' {\n' + media[cond].join('\n') + '\n}'); });
    var css = parts.join('\n\n');
    var truncated = false;
    if (css.length > maxChars) { css = css.slice(0, maxChars); truncated = true; }
    return { css: css, ruleCount: count, mediaConditions: Object.keys(media), keyframes: Object.keys(kf).filter(function (k) { return kf[k]; }), varsUsed: rv, blockedSheets: blocked, truncated: truncated };
  }
  function stylesheetList() {
    var out = [];
    for (var s = 0; s < D.styleSheets.length; s++) {
      var ss = D.styleSheets[s], readable = true, n = 0;
      try { n = ss.cssRules.length; } catch (_) { readable = false; }
      out.push({ index: s, href: ss.href || null, inline: !ss.href, readable: readable, rules: n, media: ss.media && ss.media.mediaText || '', disabled: ss.disabled, ownerTag: ss.ownerNode && ss.ownerNode.tagName ? ss.ownerNode.tagName.toLowerCase() : null,
        inlineText: !ss.href && ss.ownerNode && ss.ownerNode.tagName === 'STYLE' && !ss.ownerNode.hasAttribute('data-clone-shadow') ? ss.ownerNode.textContent : undefined });
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Tokens probe (frequency-ranked design system)                        */
  /* ------------------------------------------------------------------ */
  function tokensProbe(opts) {
    var o = Object.assign({ maxElements: 6000, minCount: 2 }, opts || {});
    var out = { url: location.href, viewport: { w: W.innerWidth, h: W.innerHeight, dpr: W.devicePixelRatio }, colors: {}, fonts: {}, fontFaces: [], typeScale: {}, lineHeights: {}, letterSpacing: {}, spacing: {}, radii: {}, shadows: {}, zIndex: {}, gradients: {}, filters: {}, blendModes: {}, maxWidths: {}, breakpoints: [], customProps: {}, body: {}, headings: {}, buttons: [], links: {}, notes: [] };
    var bump = function (map, key, meta) { if (!key || key === 'none' || key === 'normal' || key === 'auto' || key === 'rgba(0, 0, 0, 0)') return; if (!map[key]) map[key] = { count: 0, where: [] }; map[key].count++; if (meta && map[key].where.length < 3 && map[key].where.indexOf(meta) < 0) map[key].where.push(meta); };
    var finalize = function (map) { return Object.keys(map).map(function (v) { return { value: v, count: map[v].count, where: map[v].where }; }).filter(function (x) { return x.count >= o.minCount; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 40); };
    var all = Array.prototype.filter.call(D.body.querySelectorAll('*'), function (el) { if (/^(SCRIPT|STYLE|META|LINK|NOSCRIPT|TEMPLATE|svg|path|g|defs|use)$/i.test(el.tagName)) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (all.length > o.maxElements) out.notes.push('sampled ' + o.maxElements + ' of ' + all.length + ' visible elements');
    var els = all.slice(0, o.maxElements), textTags = /^(H1|H2|H3|H4|H5|H6|P|A|SPAN|LI|BUTTON|LABEL|SMALL|STRONG|EM|BLOCKQUOTE|FIGCAPTION|TD|TH|DT|DD|SUMMARY)$/;
    els.forEach(function (el) {
      var c = cs(el); if (!c) return; var s = shortSel(el);
      var hasText = textTags.test(el.tagName) && el.textContent.trim().length > 0;
      if (hasText) bump(out.colors, c.color, 'text ' + s);
      bump(out.colors, c.backgroundColor, 'bg ' + s);
      if (c.borderTopWidth !== '0px') bump(out.colors, c.borderTopColor, 'border ' + s);
      if (c.backgroundImage && c.backgroundImage.indexOf('gradient') >= 0) bump(out.gradients, c.backgroundImage, s);
      if (hasText) { bump(out.fonts, c.fontFamily + ' / ' + c.fontWeight, s); bump(out.typeScale, c.fontSize + ' / ' + c.lineHeight + ' / ' + c.fontWeight, s); bump(out.lineHeights, c.lineHeight, s); bump(out.letterSpacing, c.letterSpacing, s); if (c.textTransform !== 'none') bump(out.letterSpacing, 'transform:' + c.textTransform, s); }
      ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'rowGap', 'columnGap'].forEach(function (p) { var v = c[p]; if (v && v !== '0px' && v !== 'normal' && v.indexOf('-') < 0) bump(out.spacing, v, p.replace(/(Top|Bottom|Left|Right)$/, '') + ' ' + s); });
      if (c.borderTopLeftRadius !== '0px') bump(out.radii, c.borderTopLeftRadius, s);
      if (c.boxShadow !== 'none') bump(out.shadows, c.boxShadow, s);
      if (c.filter !== 'none') bump(out.filters, c.filter, s);
      if (c.backdropFilter && c.backdropFilter !== 'none') bump(out.filters, 'backdrop:' + c.backdropFilter, s);
      if (c.mixBlendMode !== 'normal') bump(out.blendModes, c.mixBlendMode, s);
      if (c.zIndex !== 'auto' && /^(fixed|sticky|absolute|relative)$/.test(c.position)) bump(out.zIndex, c.zIndex + ' (' + c.position + ')', s);
      if (c.maxWidth !== 'none' && /px$/.test(c.maxWidth)) bump(out.maxWidths, c.maxWidth, s);
    });
    try {
      var b = cs(D.body);
      out.body = { fontFamily: b.fontFamily, fontSize: b.fontSize, lineHeight: b.lineHeight, color: b.color, background: b.backgroundColor, letterSpacing: b.letterSpacing };
      ['h1', 'h2', 'h3', 'h4', 'p'].forEach(function (tag) { var el = D.querySelector(tag); if (!el) return; var c = cs(el); out.headings[tag] = { fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, textTransform: c.textTransform, color: c.color, marginBottom: c.marginBottom }; });
      var seenBtn = {};
      Array.prototype.slice.call(D.querySelectorAll('button, a[class*=btn], a[class*=button], [role=button], input[type=submit]'), 0, 60).forEach(function (el) {
        if (out.buttons.length >= 8 || !visible(el)) return; var c = cs(el);
        var key = [c.backgroundColor, c.color, c.borderRadius, c.padding, c.fontSize, c.fontWeight, c.borderTopColor].join('|'); if (seenBtn[key]) return; seenBtn[key] = 1;
        out.buttons.push({ example: shortSel(el), text: text(el, 30), background: c.backgroundColor, color: c.color, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, radius: c.borderRadius, padding: c.padding, fontSize: c.fontSize, fontWeight: c.fontWeight, letterSpacing: c.letterSpacing, textTransform: c.textTransform, shadow: c.boxShadow, transition: c.transitionProperty + ' ' + c.transitionDuration + ' ' + c.transitionTimingFunction });
      });
      var a = D.querySelector('p a, li a, nav a'); if (a) { var ca = cs(a); out.links = { color: ca.color, decoration: ca.textDecorationLine, weight: ca.fontWeight }; }
    } catch (_) {}
    try {
      for (var s = 0; s < D.styleSheets.length; s++) {
        var ss = D.styleSheets[s], rules; try { rules = ss.cssRules; } catch (_) { out.notes.push('cross-origin stylesheet (no @font-face read): ' + ss.href); continue; }
        var walk = function (list) {
          for (var i = 0; i < list.length; i++) { var r = list[i];
            if (r.type === 5) { var st = r.style; out.fontFaces.push({ family: st.getPropertyValue('font-family').replace(/["']/g, ''), weight: st.getPropertyValue('font-weight'), style: st.getPropertyValue('font-style'), display: st.getPropertyValue('font-display'), src: st.getPropertyValue('src').slice(0, 400), sheet: ss.href || 'inline' }); }
            else if (r.cssRules && (r.type === 4 || r.type === 12)) walk(r.cssRules);
            if (r.type === 4) { var mt = r.conditionText || r.media.mediaText; if (/width/.test(mt)) { var m = mt.match(/(\d+(?:\.\d+)?)(px|em|rem)/g); if (m) out.breakpoints.push.apply(out.breakpoints, m); } }
            if (r.type === 1 && /^(:root|html|body)$/.test(r.selectorText)) { var rc = cs(D.documentElement); for (var k = 0; k < r.style.length; k++) { var p = r.style[k]; if (p.indexOf('--') === 0) out.customProps[p] = rc.getPropertyValue(p).trim(); } }
          }
        };
        walk(rules);
      }
      out.breakpoints = uniq(out.breakpoints).sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
      if (D.fonts) { var lf = []; D.fonts.forEach(function (f) { if (f.status === 'loaded') lf.push(f.family.replace(/["']/g, '') + ' ' + f.weight + ' ' + f.style); }); out.loadedFonts = uniq(lf); }
      out.fontLinks = Array.prototype.map.call(D.querySelectorAll('link[href*="fonts.googleapis"], link[href*="typekit"], link[href*="fonts.bunny"], link[as=font]'), function (l) { return l.href; });
    } catch (e) { out.notes.push('font probe error: ' + e.message); }
    try {
      out.page = { scrollHeight: D.documentElement.scrollHeight,
        fixed: Array.prototype.filter.call(D.querySelectorAll('*'), function (e) { var p = cs(e).position; return p === 'fixed' || p === 'sticky'; }).slice(0, 20).map(function (e) { var r = e.getBoundingClientRect(); return { selector: shortSel(e), position: cs(e).position, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], z: cs(e).zIndex }; }) };
    } catch (_) {}
    ['colors', 'fonts', 'typeScale', 'lineHeights', 'letterSpacing', 'spacing', 'radii', 'shadows', 'zIndex', 'gradients', 'filters', 'blendModes', 'maxWidths'].forEach(function (k) { out[k] = finalize(out[k]); });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Surface map — DOM vs GPU vs video routing                            */
  /* ------------------------------------------------------------------ */
  function surfaceMap() {
    var vw = W.innerWidth, vh = W.innerHeight;
    var globals = { three: !!W.THREE, babylon: !!W.BABYLON, regl: !!W.regl, pixi: !!W.PIXI, ogl: !!W.OGL || !!W.ogl, p5: !!W.p5, gsap: !!W.gsap || !!W.TweenMax,
      unicornStudio: !!W.UnicornStudio || !!D.querySelector('[data-us-project],[data-us-project-src],script[src*="unicorn" i]'), spline: !!D.querySelector('spline-viewer,script[src*="spline" i]'), rive: !!W.rive || !!D.querySelector('canvas[data-rive],script[src*="rive" i]'), lottie: !!W.lottie || !!W.bodymovin || !!D.querySelector('lottie-player, [data-lottie], dotlottie-player') };
    var html = D.documentElement;
    var sample = Array.prototype.slice.call(D.querySelectorAll('*'), 0, 600);
    var scroll = { lenis: !!W.Lenis || html.classList.contains('lenis') || !!D.querySelector('[data-lenis],[data-lenis-prevent]'), locomotive: !!D.querySelector('[data-scroll],[data-scroll-container],[data-scroll-section]'),
      scrollTimelineCSS: sample.some(function (el) { var c = cs(el); return c && ((c.animationTimeline && c.animationTimeline !== 'auto') || (c.scrollTimelineName && c.scrollTimelineName !== 'none') || (c.viewTimelineName && c.viewTimelineName !== 'none')); }),
      scrollSnap: sample.some(function (el) { var t = cs(el).scrollSnapType; return t && t !== 'none'; }),
      smoothBehavior: cs(html).scrollBehavior === 'smooth' };
    function coverage(r) { var w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)); return Math.round(((w * h) / (vw * vh)) * 100); }
    function classify(c) {
      var t = c.__requestedContextType;
      if (t === 'webgpu') return 'WEBGPU'; if (t === 'webgl2') return 'WEBGL2'; if (t === 'webgl' || t === 'experimental-webgl') return 'WEBGL1'; if (t === '2d') return 'CANVAS2D';
      var win = (c.ownerDocument && c.ownerDocument.defaultView) || W;
      var isType = function (ctx, name) { if (!ctx) return false; var C = win[name]; if (C && ctx instanceof C) return true; var p = Object.getPrototypeOf(ctx); return !!(p && p.constructor && p.constructor.name === name); };
      try { if (isType(c.getContext('webgl2'), 'WebGL2RenderingContext')) return 'WEBGL2'; } catch (_) {}
      try { if (isType(c.getContext('webgl') || c.getContext('experimental-webgl'), 'WebGLRenderingContext')) return 'WEBGL1'; } catch (_) {}
      try { if (c.getContext('webgpu')) return 'WEBGPU'; } catch (_) {}
      try { if (c.getContext('2d')) return 'CANVAS2D'; } catch (_) {}
      return 'CANVAS_UNKNOWN';
    }
    function driver(c) { var s = (classStr(c) + ' ' + (c.id || '')).toLowerCase(); if (globals.unicornStudio || /unicorn|us-/.test(s)) return 'unicorn-studio'; if (globals.spline || c.closest('spline-viewer')) return 'spline'; if (globals.rive || c.hasAttribute('data-rive')) return 'rive'; if (globals.three || W.__THREE__ || W.__THREE_DEVTOOLS__) return 'three.js'; if (globals.babylon) return 'babylon'; if (globals.pixi) return 'pixi'; if (globals.p5) return 'p5'; if (Array.prototype.some.call(D.querySelectorAll('script[src]'), function (sc) { return /three(\.module)?(\.min)?\.js|three@|\/three\//i.test(sc.src); })) return 'three.js?'; return 'unknown'; }
    var surfaces = [];
    Array.prototype.forEach.call(D.querySelectorAll('canvas'), function (c, i) { var r = c.getBoundingClientRect(), kind = classify(c), st = cs(c); surfaces.push({ id: 'canvas-' + i, surface: kind, route: kind === 'CANVAS2D' || kind === 'CANVAS_UNKNOWN' ? 'gpu?' : 'gpu', selector: robustSelector(c), rect: rect(c), coveragePct: coverage(r), fullscreenHero: coverage(r) > 70 && r.top < vh * 0.5, zIndex: st.zIndex, position: st.position, pointerEvents: st.pointerEvents, offscreen: !!c.__offscreen, requestedType: c.__requestedContextType || null, driver: driver(c) }); });
    Array.prototype.forEach.call(D.querySelectorAll('video'), function (v, i) { var r = v.getBoundingClientRect(); surfaces.push({ id: 'video-' + i, surface: 'VIDEO', route: 'dom', selector: robustSelector(v), rect: rect(v), coveragePct: coverage(r), src: v.currentSrc || v.src || (v.querySelector('source') || {}).src || null, autoplay: v.autoplay, loop: v.loop, muted: v.muted, poster: v.poster || null }); });
    Array.prototype.forEach.call(D.querySelectorAll('iframe'), function (f, i) { var r = f.getBoundingClientRect(), doc = null; try { doc = f.contentDocument; } catch (_) {} if (!doc) surfaces.push({ id: 'iframe-' + i, surface: 'IFRAME_OPAQUE', route: 'embed', selector: robustSelector(f), rect: rect(f), coveragePct: coverage(r), src: f.src || null }); });
    Array.prototype.forEach.call(D.querySelectorAll('svg'), function (s, i) { if (!s.querySelector('animate,animateTransform,animateMotion,set')) return; surfaces.push({ id: 'svg-anim-' + i, surface: 'SVG_ANIMATED', route: 'dom', selector: robustSelector(s), rect: rect(s) }); });
    Array.prototype.forEach.call(D.querySelectorAll('lottie-player, dotlottie-player, [data-lottie], [class*="lottie" i]'), function (l, i) { if (!visible(l)) return; surfaces.push({ id: 'lottie-' + i, surface: 'LOTTIE', route: 'embed', selector: robustSelector(l), rect: rect(l), src: l.getAttribute('src') || l.getAttribute('data-src') || null }); });
    var gpu = surfaces.filter(function (s) { return /WEBG/.test(s.surface); });
    var platformGlobals = ['unicornStudio', 'spline', 'rive', 'three', 'babylon', 'pixi', 'p5', 'lottie'].filter(function (k) { return globals[k]; });
    return { url: location.href, viewport: { w: vw, h: vh, dpr: W.devicePixelRatio || 1 }, globals: globals, scroll: scroll, counts: { canvas: D.querySelectorAll('canvas').length, gpuCanvas: gpu.length, video: D.querySelectorAll('video').length, iframe: D.querySelectorAll('iframe').length }, surfaces: surfaces,
      routingSummary: { hasGpuSurfaces: gpu.length > 0, gpuHeroPresent: gpu.some(function (s) { return s.fullscreenHero; }), maskSelectors: gpu.map(function (s) { return s.selector; }).concat(surfaces.filter(function (s) { return s.surface === 'VIDEO' || s.surface === 'LOTTIE' || s.surface === 'IFRAME_OPAQUE'; }).map(function (s) { return s.selector; })), platformGlobalsDetected: platformGlobals, lazyGpuLikely: gpu.length === 0 && platformGlobals.length > 0 } };
  }

  /* ------------------------------------------------------------------ */
  /* Motion probe — ask the runtime for its real parameters               */
  /* ------------------------------------------------------------------ */
  function motionProbe() {
    var out = { url: location.href, viewport: { w: W.innerWidth, h: W.innerHeight }, instrumented: !!W.__cloneMotion, libraries: {}, gsap: null, scrollTrigger: [], waapi: [], keyframes: [], scrollTimelines: [], transitions: [], lenis: null, sliders: [], splitText: null,
      intersectionObservers: W.__cloneMotion ? W.__cloneMotion.io : undefined, listeners: W.__cloneMotion ? W.__cloneMotion.listeners : undefined, rafCalls: W.__cloneMotion ? W.__cloneMotion.raf : undefined, notes: [] };
    var safe = function (v, depth) { depth = depth || 0; if (v == null) return v; if (typeof v === 'function') return '[fn]'; if (v === W) return '[window]'; if (v === D) return '[document]'; if (v instanceof Element) return shortSel(v); if (typeof Node !== 'undefined' && v instanceof Node) return '[' + v.nodeName + ']'; if (typeof EventTarget !== 'undefined' && v instanceof EventTarget) return '[EventTarget]'; if (Array.isArray(v)) return depth > 3 ? '[…]' : v.slice(0, 20).map(function (x) { return safe(x, depth + 1); }); if (typeof v === 'object') { if (depth > 3) return '[obj]'; var o = {}, n = 0; for (var k in v) { if (!Object.prototype.hasOwnProperty.call(v, k)) continue; if (k.charAt(0) === '_' || k === 'parent' || (k === 'vars' && depth > 0)) continue; if (++n > 40) { o['…'] = 'truncated'; break; } try { o[k] = safe(v[k], depth + 1); } catch (_) {} } return o; } return v; };
    var libs = { gsap: 'gsap', ScrollTrigger: 'ScrollTrigger', SplitText: 'SplitText', Flip: 'Flip', ScrollSmoother: 'ScrollSmoother', Lenis: 'Lenis', lenis: 'lenis', LocomotiveScroll: 'LocomotiveScroll', Swiper: 'Swiper', Splide: 'Splide', Flickity: 'Flickity', barba: 'barba', Swup: 'Swup', anime: 'anime', Motion: 'Motion', THREE: 'THREE', PIXI: 'PIXI', lottie: 'lottie', AOS: 'AOS', ScrollReveal: 'ScrollReveal', Alpine: 'Alpine', jQuery: 'jQuery', __NEXT_DATA__: '__NEXT_DATA__', __NUXT__: '__NUXT__', Webflow: 'Webflow', Shopify: 'Shopify', wp: 'wp', ___gatsby: '___gatsby', __remixContext: '__remixContext', __sveltekit: '__sveltekit', __astro: '__astro', htmx: 'htmx' };
    Object.keys(libs).forEach(function (k) { try { var v = W[libs[k]]; if (v !== undefined) out.libraries[k] = (v && (v.version || v.VERSION || (v.core && v.core.version))) || true; } catch (_) {} });
    try {
      if (D.querySelector('[data-reactroot], #__next, #root') || Object.keys(D.body).some(function (k) { return k.indexOf('__react') === 0; })) out.libraries.react = true;
      if (D.querySelector('[data-v-app], #__nuxt, [data-server-rendered]')) out.libraries.vue = true;
      if (D.querySelector('.w-nav, .w-slider, [data-wf-page]')) out.libraries.webflow = true;
      if (D.querySelector('[data-framer-name], #__framer-badge-container, [data-framer-component-type]')) out.libraries.framer = true;
      if (D.querySelector('link[href*="wp-content"], script[src*="wp-includes"]')) out.libraries.wordpress = true;
      if (D.querySelector('astro-island, [data-astro-cid], style[data-astro]') || D.querySelector('meta[name="generator"][content*="Astro"]')) out.libraries.astro = true;
      if (D.querySelector('[data-svelte-h], [class*="svelte-"]')) out.libraries.svelte = true;
      if (D.querySelector('meta[name="generator"]')) out.libraries.generator = D.querySelector('meta[name="generator"]').content;
      if (D.querySelector('[data-v-\\w+]') || /data-v-[0-9a-f]{6,}/.test(D.body.innerHTML.slice(0, 200000))) out.libraries.vueScoped = true;
      if (/class="[^"]*\b[a-zA-Z_]+__[a-zA-Z_]+__[a-zA-Z0-9]{5,}\b/.test(D.body.innerHTML.slice(0, 200000))) out.libraries.cssModules = true;
      if (D.querySelector('[class*="sc-"]') || D.querySelector('style[data-styled]')) out.libraries.styledComponents = true;
      if (D.querySelector('[class*="css-"][class*="-"]') && D.querySelector('style[data-emotion]')) out.libraries.emotion = true;
      if (/class="[^"]*\b(flex|grid|items-center|justify-between|px-\d|py-\d|text-\w+|bg-\w+)\b/.test(D.body.innerHTML.slice(0, 200000))) out.libraries.tailwind = true;
    } catch (_) {}
    try {
      var g = W.gsap;
      if (!g && Array.isArray(W.gsapVersions)) { out.libraries.gsap = W.gsapVersions.join(',') + ' (bundled, no global)'; var stamped = Array.prototype.filter.call(D.querySelectorAll('*'), function (el) { return el._gsap; }).slice(0, 200); out.gsap = { version: W.gsapVersions[0], bundled: true, tweens: [], stampedTargets: stamped.map(function (el) { return { target: shortSel(el), x: el._gsap.x, y: el._gsap.y, scaleX: el._gsap.scaleX, rotation: el._gsap.rotation }; }) }; if (D.querySelector('.pin-spacer')) out.gsap.pinSpacers = Array.prototype.slice.call(D.querySelectorAll('.pin-spacer'), 0, 20).map(function (p) { return { spacer: shortSel(p), pinned: p.firstElementChild ? shortSel(p.firstElementChild) : null, height: Math.round(p.getBoundingClientRect().height) }; }); out.notes.push('gsap is bundled (no window.gsap): ScrollTrigger params not readable live; grep the bundle near target selectors.'); }
      if (g) { out.gsap = { version: g.version, tweens: [], defaults: safe(g.defaults && g.defaults()) }; var children = g.globalTimeline && g.globalTimeline.getChildren ? g.globalTimeline.getChildren(true, true, true) : []; children.slice(0, 400).forEach(function (t) { try { out.gsap.tweens.push({ kind: t.getChildren ? 'timeline' : 'tween', targets: t.targets ? t.targets().slice(0, 5).map(shortSel) : undefined, duration: t.duration && t.duration(), delay: t.delay && t.delay(), repeat: t.repeat && t.repeat(), yoyo: t.yoyo && t.yoyo(), paused: t.paused && t.paused(), vars: safe(t.vars), hasScrollTrigger: !!(t.scrollTrigger || (t.vars && t.vars.scrollTrigger)) }); } catch (_) {} }); if (children.length > 400) out.notes.push('gsap: ' + children.length + ' tweens, truncated to 400'); }
      var ST = W.ScrollTrigger || (g && g.plugins && g.plugins.ScrollTrigger);
      if (ST && ST.getAll) ST.getAll().forEach(function (s) { try { out.scrollTrigger.push({ trigger: shortSel(s.trigger), pin: s.pin ? shortSel(s.pin) : false, start: s.start, end: s.end, scrub: s.vars.scrub, snap: safe(s.vars.snap), toggleActions: s.vars.toggleActions, toggleClass: safe(s.vars.toggleClass), once: !!s.vars.once, pinSpacing: s.vars.pinSpacing, animationTargets: s.animation && s.animation.targets ? s.animation.targets().slice(0, 5).map(shortSel) : undefined, animationVars: s.animation ? safe(s.animation.vars) : undefined }); } catch (_) {} });
    } catch (e) { out.notes.push('gsap probe error: ' + e.message); }
    try {
      var anims = D.getAnimations ? D.getAnimations() : [];
      anims.slice(0, 300).forEach(function (a) { try { var eff = a.effect, timing = eff && eff.getTiming ? eff.getTiming() : {}; out.waapi.push({ type: a.constructor.name, name: a.animationName || a.transitionProperty || a.id || undefined, target: eff && eff.target ? shortSel(eff.target) : undefined, pseudo: eff && eff.pseudoElement || undefined, playState: a.playState, timeline: a.timeline ? a.timeline.constructor.name : undefined, duration: timing.duration, delay: timing.delay, iterations: timing.iterations, direction: timing.direction, easing: timing.easing, fill: timing.fill, keyframes: eff && eff.getKeyframes ? eff.getKeyframes().slice(0, 12) : undefined }); } catch (_) {} });
      if (anims.length > 300) out.notes.push('waapi: ' + anims.length + ' animations, truncated to 300');
    } catch (e) { out.notes.push('waapi probe error: ' + e.message); }
    try {
      var seenKf = {};
      for (var s = 0; s < D.styleSheets.length; s++) { var ss = D.styleSheets[s], rules; try { rules = ss.cssRules; } catch (_) { out.notes.push('cross-origin stylesheet (no CSSOM): ' + ss.href); continue; }
        var walk = function (list) { for (var i = 0; i < list.length; i++) { var r = list[i]; if (r.type === 7) { if (!seenKf[r.name]) { seenKf[r.name] = 1; out.keyframes.push({ name: r.name, css: r.cssText.slice(0, 2000) }); } } else if (r.type === 4 || r.type === 12) walk(r.cssRules); else if (r.style) { var st = r.style; if ((st.animationTimeline && st.animationTimeline !== 'auto') || st.scrollTimelineName || st.viewTimelineName) out.scrollTimelines.push({ selector: r.selectorText, css: r.cssText.slice(0, 600) }); } } };
        walk(rules); }
    } catch (e) { out.notes.push('cssom probe error: ' + e.message); }
    try {
      var seenT = {};
      Array.prototype.slice.call(D.querySelectorAll('a,button,[class*=card],[class*=btn],[class*=link],[class*=item],[class*=nav],img,li,h1,h2,h3,p,span,div'), 0, 3000).forEach(function (el) { var c = cs(el); var dur = c.transitionDuration; if (dur && dur !== '0s' && (c.transitionProperty !== 'all' || parseFloat(dur) >= 0.15)) { var key = c.transitionProperty + '|' + dur + '|' + c.transitionTimingFunction; if (!seenT[key]) seenT[key] = { property: c.transitionProperty, duration: dur, easing: c.transitionTimingFunction, delay: c.transitionDelay, example: shortSel(el), count: 0 }; seenT[key].count++; } });
      out.transitions = Object.keys(seenT).map(function (k) { return seenT[k]; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 40);
    } catch (_) {}
    try {
      var l = W.lenis || (W.Lenis && W.Lenis.instance) || W.__lenis || (W.locomotive && W.locomotive.lenisInstance);
      if (l) out.lenis = { options: safe(l.options), isSmooth: l.isSmooth, htmlClasses: Array.prototype.filter.call(D.documentElement.classList, function (c) { return /lenis|locomotive|smooth/i.test(c); }) };
      else if (D.documentElement.classList.contains('lenis') || D.querySelector('[data-lenis-prevent],[data-scroll-container]')) out.lenis = { detected: 'by-markup', options: 'not exposed on window — default lerp 0.1 / duration 1.2' };
      if (W.ScrollSmoother && W.ScrollSmoother.get) { var sm = W.ScrollSmoother.get(); if (sm) out.lenis = Object.assign(out.lenis || {}, { scrollSmoother: safe(sm.vars) }); }
    } catch (_) {}
    try {
      Array.prototype.slice.call(D.querySelectorAll('.swiper, .splide, .flickity-enabled, .embla, .slick-slider, [data-slider], [class*=carousel i], [class*=marquee i], [data-carousel]'), 0, 30).forEach(function (el) { var rec = { selector: robustSelector(el), lib: null, params: null }; if (el.swiper) { rec.lib = 'swiper'; rec.params = safe(el.swiper.params); } else if (el.splide) { rec.lib = 'splide'; rec.params = safe(el.splide.options); } else if (W.Flickity && W.Flickity.data && W.Flickity.data(el)) { rec.lib = 'flickity'; rec.params = safe(W.Flickity.data(el).options); } else { var a = (D.getAnimations ? D.getAnimations({ subtree: true }) : []).filter(function (x) { return x.effect && x.effect.target && el.contains(x.effect.target); })[0]; rec.lib = a ? 'css-animation:' + (a.animationName || 'waapi') : 'unknown'; } out.sliders.push(rec); });
    } catch (_) {}
    try { var hits = D.querySelectorAll('.char, .word, .line, [class*=split-char], [class*=split-word], [class*=split-line], [data-split]'); if (hits.length) out.splitText = { wrapperCount: hits.length }; } catch (_) {}
    out.summary = { animationStack: [out.gsap && 'gsap@' + out.gsap.version + (out.gsap.bundled ? '(bundled)' : ''), out.scrollTrigger.length && 'ScrollTrigger(' + out.scrollTrigger.length + ')', out.scrollTrigger.some(function (s) { return s.pin; }) && 'pinned-sections', out.scrollTrigger.some(function (s) { return s.scrub; }) && 'scrub', out.lenis && 'lenis', out.scrollTimelines.length && 'css-scroll-timeline', out.waapi.some(function (a) { return a.type === 'CSSAnimation'; }) && 'css-keyframes', out.splitText && 'split-text-reveal', out.sliders.length && 'sliders(' + out.sliders.length + ')', out.libraries.THREE && 'three.js', out.libraries.lottie && 'lottie', out.libraries.AOS && 'aos'].filter(Boolean),
      inputDrivers: out.listeners ? uniq(out.listeners.map(function (l) { return l.type; })) : 'unknown (not instrumented)', ioCount: out.intersectionObservers ? out.intersectionObservers.length : 'unknown (not instrumented)',
      platform: Object.keys(out.libraries).filter(function (k) { return /next|nuxt|webflow|framer|wordpress|gatsby|remix|svelte|astro|shopify|react|vue|generator|tailwind|cssModules|styled|emotion|vueScoped/i.test(k); }) };
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Interaction contracts — controls whose activation changes a surface  */
  /* ------------------------------------------------------------------ */
  function interactionContracts(cap) {
    var out = [], n = 0;
    function add(kind, control, controlled, extra) { if (out.length >= (cap || 40)) return; var id = kind + '-' + (n++); out.push(Object.assign({ id: id, kind: kind, control: robustSelector(control), controlText: text(control, 40), controlled: controlled ? robustSelector(controlled) : null, controlRect: rect(control) }, extra || {})); }
    Array.prototype.forEach.call(D.querySelectorAll('[role="tablist"]'), function (tl) { var tabs = tl.querySelectorAll('[role="tab"]'); if (tabs.length < 2) return; Array.prototype.forEach.call(tabs, function (t) { if (!visible(t)) return; var panel = t.getAttribute('aria-controls') ? D.getElementById(t.getAttribute('aria-controls')) : null; add('tabs', t, panel, { group: robustSelector(tl), selected: t.getAttribute('aria-selected') === 'true' }); }); });
    Array.prototype.forEach.call(D.querySelectorAll('details > summary'), function (s) { if (visible(s)) add('accordion', s, s.parentElement, { open: s.parentElement.open }); });
    Array.prototype.forEach.call(D.querySelectorAll('[aria-expanded]'), function (b) { if (!visible(b) || b.getAttribute('role') === 'tab') return; var panel = b.getAttribute('aria-controls') ? D.getElementById(b.getAttribute('aria-controls')) : null; var kind = /menu|nav|burger|hamburger|toggle/i.test(classStr(b) + ' ' + (b.getAttribute('aria-label') || '')) || b.closest('nav, header') ? 'menu' : 'accordion'; add(kind, b, panel, { expanded: b.getAttribute('aria-expanded') === 'true' }); });
    Array.prototype.forEach.call(D.querySelectorAll('.swiper, .splide, .slick-slider, .embla, [class*="carousel" i], [data-carousel]'), function (c) { if (!visible(c)) return; var next = c.querySelector('[class*="next" i], [aria-label*="next" i]'), prev = c.querySelector('[class*="prev" i], [aria-label*="prev" i]'); if (next && visible(next)) add('carousel', next, c, { direction: 'next', prev: prev ? robustSelector(prev) : null }); });
    Array.prototype.forEach.call(D.querySelectorAll('button[aria-haspopup], [role="button"][aria-haspopup]'), function (b) { if (visible(b) && !b.hasAttribute('aria-expanded')) add('menu', b, null, {}); });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Scroll-state tracker (used by the driver across scroll positions)     */
  /* ------------------------------------------------------------------ */
  function scrollTrackInit() {
    W.__cloneScrollTracked = {};
    var els = D.querySelectorAll('[data-aos], [data-scroll], [class*="animate" i], [class*="reveal" i], [class*="fade" i], [class*="slide" i], [class*="parallax" i], [class*="sticky" i], [style*="transform"], [style*="opacity"], header, nav, [class*="hero" i], section > *, main > * > *');
    var n = 0;
    Array.prototype.forEach.call(els, function (el, i) { if (n > 400 || !visible(el)) return; var id = 'st-' + i; el.setAttribute('data-clone-track', id); var c = cs(el); W.__cloneScrollTracked[id] = { selector: robustSelector(el), transform: c.transform, opacity: c.opacity, position: c.position, top: c.top, backgroundColor: c.backgroundColor, boxShadow: c.boxShadow, height: Math.round(el.getBoundingClientRect().height), classList: classStr(el).slice(0, 200) }; n++; });
    return n;
  }
  function scrollTrackSnapshot(y) {
    var changed = {};
    Array.prototype.forEach.call(D.querySelectorAll('[data-clone-track]'), function (el) { var id = el.getAttribute('data-clone-track'), init = W.__cloneScrollTracked[id]; if (!init) return; var c = cs(el); var now = { transform: c.transform, opacity: c.opacity, position: c.position, top: c.top, backgroundColor: c.backgroundColor, boxShadow: c.boxShadow, height: Math.round(el.getBoundingClientRect().height), classList: classStr(el).slice(0, 200) }; var diff = {}; Object.keys(now).forEach(function (k) { if (now[k] !== init[k]) diff[k] = { from: init[k], to: now[k] }; }); if (Object.keys(diff).length) changed[id] = { selector: init.selector, diff: diff }; });
    return { scrollY: y, changed: changed };
  }
  function scrollTrackCleanup() { Array.prototype.forEach.call(D.querySelectorAll('[data-clone-track]'), function (el) { el.removeAttribute('data-clone-track'); }); }

  /* ------------------------------------------------------------------ */
  /* Asset discovery (DOM side)                                           */
  /* ------------------------------------------------------------------ */
  function assetDiscovery() {
    var abs = function (u) { try { return new URL(u, location.href).href; } catch (_) { return null; } };
    var urls = { images: [], backgrounds: [], fonts: [], favicons: [], meta: [], media: [], stylesheets: [], scripts: [] };
    Array.prototype.forEach.call(D.querySelectorAll('img'), function (img) { [img.currentSrc, img.src].forEach(function (u) { if (u && u.indexOf('data:') !== 0) urls.images.push(abs(u)); }); (img.srcset || '').split(',').forEach(function (e) { var u = e.trim().split(/\s+/)[0]; if (u && u.indexOf('data:') !== 0) urls.images.push(abs(u)); }); });
    Array.prototype.forEach.call(D.querySelectorAll('picture source[srcset], video source[src], video[src], video[poster], audio source[src], source[src]'), function (s) { if (s.srcset) s.srcset.split(',').forEach(function (e) { var u = e.trim().split(/\s+/)[0]; if (u) urls.images.push(abs(u)); }); if (s.src) urls.media.push(abs(s.src)); if (s.poster) urls.images.push(abs(s.poster)); });
    Array.prototype.forEach.call(D.querySelectorAll('*'), function (el) { var c = cs(el); if (!c) return; var bg = c.backgroundImage; if (bg && bg !== 'none') { var m, re = /url\(["']?([^"')]+)["']?\)/g; while ((m = re.exec(bg))) { if (m[1].indexOf('data:') !== 0) urls.backgrounds.push(abs(m[1])); } } });
    Array.prototype.forEach.call(D.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]'), function (l) { if (l.href) urls.favicons.push(l.href); });
    Array.prototype.forEach.call(D.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]'), function (m) { var c = m.getAttribute('content'); if (c) urls.meta.push(abs(c)); });
    Array.prototype.forEach.call(D.querySelectorAll('link[rel="stylesheet"]'), function (l) { if (l.href) urls.stylesheets.push(l.href); });
    Array.prototype.forEach.call(D.querySelectorAll('script[src]'), function (s) { urls.scripts.push(s.src); });
    try { for (var s = 0; s < D.styleSheets.length; s++) { var ss = D.styleSheets[s], rules; try { rules = ss.cssRules; } catch (_) { continue; } for (var i = 0; i < rules.length; i++) { if (rules[i].type === 5) { var src = rules[i].style.getPropertyValue('src'); var m2, re2 = /url\(["']?([^"')]+)["']?\)/g; while ((m2 = re2.exec(src))) urls.fonts.push(abs(new URL(m2[1], ss.href || location.href).href)); } } } } catch (_) {}
    try { urls.performance = W.performance.getEntriesByType('resource').map(function (e) { return { name: e.name, type: e.initiatorType }; }).slice(0, 800); } catch (_) {}
    Object.keys(urls).forEach(function (k) { if (Array.isArray(urls[k]) && k !== 'performance') urls[k] = uniq(urls[k].filter(Boolean)); });
    return urls;
  }
  function inlineSvgs() {
    var out = [];
    Array.prototype.forEach.call(D.querySelectorAll('svg'), function (svg, index) {
      if (svg.closest('svg') !== svg) return;
      var r = svg.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return;
      var clone = svg.cloneNode(true); if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      // resolve <use href="#id"> sprite references
      Array.prototype.forEach.call(clone.querySelectorAll('use'), function (u) { var href = u.getAttribute('href') || u.getAttribute('xlink:href'); if (href && href.charAt(0) === '#') { var sym = D.getElementById(href.slice(1)); if (sym) { var g = D.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = sym.innerHTML; if (sym.getAttribute('viewBox') && !clone.getAttribute('viewBox')) clone.setAttribute('viewBox', sym.getAttribute('viewBox')); u.parentNode.replaceChild(g, u); } } });
      var els = [svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))), usesCurrent = false, hard = {};
      els.forEach(function (el) { var f = el.getAttribute('fill'), s = el.getAttribute('stroke'); if (f === 'currentColor' || s === 'currentColor') usesCurrent = true; if (f && f !== 'none' && f !== 'currentColor') hard[f] = 1; if (s && s !== 'none' && s !== 'currentColor') hard[s] = 1; });
      var hardList = Object.keys(hard), fillStrategy = usesCurrent && !hardList.length ? 'currentColor' : hardList.length && !usesCurrent ? 'hardcoded' : usesCurrent ? 'mixed' : 'none';
      var inHeader = !!svg.closest('header, nav'), inButton = !!svg.closest('button, a'), pathCount = svg.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse').length, area = r.width * r.height, cls = classStr(svg);
      var score = { logo: (inHeader ? 5 : 0) + (r.width >= 80 && r.width <= 300 && r.height >= 15 && r.height <= 100 ? 4 : 0) + (/logo/i.test(cls + (svg.getAttribute('aria-label') || '')) ? 5 : 0), icon: (r.width <= 32 && r.height <= 32 ? 5 : 0) + (inButton ? 3 : 0) + (/icon|lucide|heroicon|feather/i.test(cls) ? 5 : 0) + (svg.getAttribute('aria-hidden') === 'true' ? 2 : 0) + (pathCount <= 5 ? 2 : 0), decorative: (area > 50000 ? 3 : 0) + (/wave|divider|blob|bg|shape|pattern/i.test(cls) ? 5 : 0) + (pathCount <= 3 && area > 10000 ? 3 : 0), illustration: (pathCount > 20 ? 3 : 0) + (els.length > 30 ? 3 : 0) + (/illustration|hero/i.test(cls) ? 5 : 0) };
      var classification = Object.keys(score).sort(function (a, b) { return score[b] - score[a]; })[0];
      var section = svg.closest('section, header, footer, nav, main, article');
      out.push({ index: index, selector: robustSelector(svg), outerHTML: clone.outerHTML, viewBox: svg.getAttribute('viewBox'), width: Math.round(r.width), height: Math.round(r.height), fillStrategy: fillStrategy, hardcodedColors: hardList, classification: classification, section: section ? shortSel(section) : null, pathCount: pathCount, ariaLabel: svg.getAttribute('aria-label') || null, currentColor: cs(svg).color });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Clone-side helpers (used by compare/check on the built page)         */
  /* ------------------------------------------------------------------ */
  function sectionsByOrder(count) { return sectionCensus({ maxSections: count || 40 }); }
  function hotlinkAudit(originHost) {
    var bad = [];
    Array.prototype.forEach.call(D.querySelectorAll('img[src], source[src], source[srcset], video[src], video[poster], link[rel="stylesheet"][href], script[src], iframe[src]'), function (el) { ['src', 'srcset', 'poster', 'href'].forEach(function (a) { var v = el.getAttribute(a); if (v && v.indexOf(originHost) >= 0) bad.push({ tag: el.tagName.toLowerCase(), attr: a, value: v.slice(0, 200) }); }); });
    Array.prototype.forEach.call(D.querySelectorAll('*'), function (el) { if (bad.length > 200) return; var bg = cs(el).backgroundImage; if (bg && bg.indexOf(originHost) >= 0) bad.push({ tag: el.tagName.toLowerCase(), attr: 'background-image', value: bg.slice(0, 200) }); });
    return bad;
  }
  function fingerprintAudit() {
    var html = D.documentElement.outerHTML.slice(0, 2000000), hits = {};
    [['vue-scoped', /data-v-[0-9a-f]{6,}/], ['next', /id="__next"|__NEXT_DATA__/], ['nuxt', /id="__nuxt"|__NUXT__/], ['framer', /data-framer-(name|component-type)/], ['webflow', /data-wf-page|class="w-nav/], ['wordpress', /wp-content|wp-includes/], ['gatsby', /___gatsby/], ['astro', /astro-island|data-astro-cid/], ['svelte', /class="[^"]*svelte-[0-9a-z]{4,}/], ['shopify', /cdn\.shopify\.com/], ['wayback', /web\.archive\.org|wm-ipp/]].forEach(function (p) { var m = html.match(p[1]); if (m) hits[p[0]] = (html.match(new RegExp(p[1].source, 'g')) || []).length; });
    return hits;
  }

  var api = { instrumentAll: instrumentAll, sectionCensus: sectionCensus, dnaProbe: dnaProbe, cssRulesForSection: cssRulesForSection, addShadowSheet: addShadowSheet, stylesheetList: stylesheetList, tokensProbe: tokensProbe, surfaceMap: surfaceMap, motionProbe: motionProbe, interactionContracts: interactionContracts, scrollTrackInit: scrollTrackInit, scrollTrackSnapshot: scrollTrackSnapshot, scrollTrackCleanup: scrollTrackCleanup, assetDiscovery: assetDiscovery, inlineSvgs: inlineSvgs, robustSelector: robustSelector, textCensus: textCensus, sectionsByOrder: sectionsByOrder, hotlinkAudit: hotlinkAudit, fingerprintAudit: fingerprintAudit, pseudoStyles: pseudoStyles, styles: styles };
  root.__clone = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);

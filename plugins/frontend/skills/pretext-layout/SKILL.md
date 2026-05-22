# /pretext-layout — Text-aware frontend design and verification

Use when building, reviewing, or testing ANY web frontend. Applies text measurement principles from [@chenglou/pretext](https://github.com/chenglou/pretext) to prevent text overflow, verify layout fit, and design container-aware typography. Text that doesn't fit its container is a bug.

## Core Principle

**Measure text before rendering, not after.** DOM measurement (`getBoundingClientRect`, `scrollWidth`) forces synchronous layout reflow. Canvas `measureText()` gives the same answer with zero reflow, and can predict layout before elements exist.

Two-phase pattern (from pretext):
1. **Prepare**: measure text segments via `canvas.measureText()`, cache by font
2. **Layout**: greedy line-breaking arithmetic over cached widths — pure math, zero DOM

## When This Skill Applies

- Building any HTML/CSS/React/Vue/Svelte component with text
- Reviewing frontend code for overflow issues
- Designing responsive layouts where text must fit at multiple widths
- Creating dashboards, landing pages, forms, nav bars, cards
- Working with dynamic content (CMS, API data, i18n) where text length varies

## Design Rules

### 1. Every text container must handle overflow

No text element should render without an overflow strategy. Choose one:

| Strategy | CSS | When to use |
|---|---|---|
| **Ellipsis** | `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` | Single-line: buttons, labels, nav, badges, table cells |
| **Line clamp** | `display:-webkit-box; -webkit-line-clamp:N; -webkit-box-orient:vertical; overflow:hidden` | Multi-line: card titles (2), descriptions (3), messages (5-8) |
| **Wrap** | `word-wrap:break-word; overflow-wrap:anywhere` | Long-form: paragraphs, chat messages, code blocks |
| **Scroll** | `overflow-y:auto` | Bounded containers: panels, modals, sidebars |
| **Responsive resize** | `font-size:clamp(min, preferred, max)` | Headlines, hero text |

**Never**: leave text to overflow its container silently. If text overflows, it's either truncated visibly or the container grows.

### 2. Interactive elements: single line, never wrap

Buttons, links, nav items, badges, tabs, pills, chips, breadcrumbs — all must fit on one line:
```css
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

If the label can't fit, the container is too narrow — fix the container, not the label.

### 3. CSS truncation over JS `.slice()`

JS `.slice(N)` cuts at a fixed character count regardless of font or container width. A 150-char string in 12px monospace is very different from 150 chars in 24px serif.

Use CSS for visual truncation (adapts to actual rendered width). Use JS `.slice()` only to cap DOM size for performance (and set it generously — 2-3x what's visible).

### 4. Pre-measure before committing to container sizes

When designing a component with fixed or constrained width, verify text fits:

```javascript
// In browser console or injected script
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.font = '16px Inter';
const width = ctx.measureText('Submit Application Form').width;
console.log(`Text needs ${Math.ceil(width)}px, button is 120px → ${width <= 120 ? 'fits' : 'OVERFLOW'}`);
```

For line-count prediction:
```javascript
function predictLines(text, font, containerWidth) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  const words = text.split(/\s+/);
  const spaceW = ctx.measureText(' ').width;
  let lineW = 0, lines = 1;
  for (const word of words) {
    const ww = ctx.measureText(word).width;
    if (lineW > 0 && lineW + spaceW + ww > containerWidth) { lines++; lineW = ww; }
    else { lineW += (lineW > 0 ? spaceW : 0) + ww; }
  }
  return lines;
}
```

### 5. Shrinkwrap: find the tightest container

Binary search over `predictLines()` to find the narrowest width that keeps the same line count:
```javascript
function shrinkwrap(text, font, maxWidth) {
  const lines = predictLines(text, font, maxWidth);
  let lo = 0, hi = maxWidth;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (predictLines(text, font, mid) <= lines) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}
```

Use for: chat bubbles, tooltips, auto-width cards, badge sizing.

### 6. Canvas chart text: pre-measure, then render

When rendering text on `<canvas>` (charts, legends, labels):
1. Measure ALL text widths first via `ctx.measureText()`
2. Calculate total width needed
3. If total exceeds available space, compress gaps or truncate labels
4. Then render — positions are pre-computed, no measurement during draw

### 7. Responsive text: verify at breakpoints, not just visually

"It looks fine on my screen" is not verification. Check text at:
- **375px** (iPhone SE — smallest common)
- **768px** (iPad portrait)
- **1024px** (iPad landscape / small laptop)
- **1440px** (desktop)

At each width, verify: buttons still single-line, headings don't clip, cards don't overflow.

### 8. Dynamic content: design for the longest string

When text comes from an API, CMS, or i18n bundle, design for the worst case:
- German translations are ~30% longer than English
- User-generated titles have no length guarantee
- API data may return unexpected lengths

Pre-measure the longest expected string at the narrowest expected width. If it doesn't fit, add truncation.

## CSS Patterns

### Single-line ellipsis (most common)
```css
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Multi-line clamp
```css
.card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Responsive clamp (tighter on mobile)
```css
.description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 600px) {
  .description { -webkit-line-clamp: 2; }
}
```

### Fluid heading (responsive font size)
```css
.hero-title {
  font-size: clamp(1.5rem, 4vw, 3.5rem);
  overflow-wrap: break-word;
}
```

### Flex item that truncates (critical: min-width: 0)
```css
.flex-container { display: flex; gap: 8px; }
.flex-item {
  flex: 1;
  min-width: 0; /* REQUIRED — without this, flex items won't shrink below content width */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Table cell truncation
```css
table { table-layout: fixed; width: 100%; }
td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Expand on click (line-clamp + toggle)
```css
.text { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; cursor: pointer; }
.text.expanded { -webkit-line-clamp: unset; display: block; }
```
```javascript
element.addEventListener('click', () => element.classList.toggle('expanded'));
```

## Verification Checklist

Before shipping any frontend:

- [ ] **Buttons/links**: single line, text doesn't wrap or overflow
- [ ] **Card titles**: fit within 2-3 lines, overflow is clamped
- [ ] **Navigation**: all items fit without horizontal scroll at 375px
- [ ] **Form labels**: single line, don't wrap next to inputs
- [ ] **Headings**: visible at mobile widths without clipping
- [ ] **Table cells**: truncate with ellipsis, not overflow
- [ ] **Badges/pills**: content doesn't overflow border-radius
- [ ] **Tooltips/toasts**: text fits, doesn't wrap to unreadable widths
- [ ] **Dynamic content**: tested with 2x expected text length
- [ ] **i18n**: tested with German/Japanese string lengths if applicable

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| `JS .slice(80)` for visual truncation | Ignores font, container width, viewport | CSS `text-overflow: ellipsis` or `-webkit-line-clamp` |
| No overflow handling on flex items | Text pushes flex container wider than parent | Add `min-width: 0` + `overflow: hidden` |
| `word-break: break-all` on titles | Breaks mid-word, ugly | Use `overflow-wrap: break-word` (breaks at word boundaries first) |
| Fixed-width containers for variable text | Text clips or overflows | Use `min-width`/`max-width` + truncation |
| Measuring DOM to size containers | Causes layout thrashing (reflow) | Use canvas `measureText()` or CSS intrinsic sizing |
| Testing at one viewport width | "Works on desktop" hides mobile overflow | Test at 375px, 768px, 1024px, 1440px |
| Hardcoded padding that eats text space | Button text clips at narrow widths | Use `padding-inline` with responsive values |

## Reference

- **Pretext library**: [@chenglou/pretext](https://github.com/chenglou/pretext) — full text measurement engine with i18n, CJK, RTL, emoji support
- **Core insight**: "80% of CSS spec could be avoided if userland had better text measurement" — pretext README
- **Key API**: `prepare(text, font)` → `layout(prepared, maxWidth, lineHeight)` → `{ height, lineCount }`
- **Performance**: prepare ~19ms for 500 texts, layout ~0.09ms for 500 texts (zero DOM)

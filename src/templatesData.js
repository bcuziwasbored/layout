// Template DATA — the 117 template definitions (issue #63/#83 waves included).
//
// This module is loaded ONLY through dynamic import(), from the template browser,
// the home-screen shelf and the in-editor Templates panel (issue #87). Keep it
// data-only: the shared helpers (instantiateTemplate, templatePageBg, RATIOS, …)
// live in ./templates.js so the store and the app shell can use them without
// dragging these definitions into the initial chunk.
//
// Each template defines cells as {x, y, w, h} in normalized units.
// For single-page templates (pageSpan omitted / 1): x/w are 0–1 relative to one page width.
// For multi-page templates (pageSpan: N): x goes 0–N, where x=1 is the left edge of page 2, etc.
// w is always relative to ONE page width regardless of pageSpan.

// Helper: generate a uniform cols×rows grid across `pageSpan` pages
function grid(cols, rows, pageSpan = 1) {
  const cells = []
  const cw = pageSpan / cols  // cell width in page units
  const ch = 1 / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: +(c * cw).toFixed(6), y: +(r * ch).toFixed(6),
                   w: +cw.toFixed(6),        h: +ch.toFixed(6) })
    }
  }
  return cells
}

// Bare photo-grid templates (the original 50+). Styled content templates
// (STYLED_TEMPLATES, defined below) are appended to the exported TEMPLATES list.
const GRID_TEMPLATES = [
  // ── internal / utility ───────────────────────────────────────────────────────
  { id: 'blank',  label: 'Blank', cells: [] },
  { id: 'single', label: 'Single', cells: [{ x: 0, y: 0, w: 1, h: 1 }] },

  // ── 2-cell ───────────────────────────────────────────────────────────────────
  {
    id: 'split-h', label: '2 Col',
    cells: [
      { x: 0,   y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: 'split-v', label: '2 Row',
    cells: [
      { x: 0, y: 0,   w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: 'wide-left', label: 'Wide L',
    cells: [
      { x: 0,     y: 0, w: 0.667, h: 1 },
      { x: 0.667, y: 0, w: 0.333, h: 1 },
    ],
  },
  {
    id: 'wide-right', label: 'Wide R',
    cells: [
      { x: 0,     y: 0, w: 0.333, h: 1 },
      { x: 0.333, y: 0, w: 0.667, h: 1 },
    ],
  },

  // ── 3-cell ───────────────────────────────────────────────────────────────────
  {
    id: 'three-col', label: '3 Col',
    cells: [
      { x: 0,     y: 0, w: 0.333, h: 1 },
      { x: 0.333, y: 0, w: 0.334, h: 1 },
      { x: 0.667, y: 0, w: 0.333, h: 1 },
    ],
  },
  {
    id: 'three-row', label: '3 Row',
    cells: [
      { x: 0, y: 0,     w: 1, h: 0.333 },
      { x: 0, y: 0.333, w: 1, h: 0.334 },
      { x: 0, y: 0.667, w: 1, h: 0.333 },
    ],
  },
  {
    id: 'big-left', label: 'Big L',
    cells: [
      { x: 0,    y: 0,   w: 0.65, h: 1 },
      { x: 0.65, y: 0,   w: 0.35, h: 0.5 },
      { x: 0.65, y: 0.5, w: 0.35, h: 0.5 },
    ],
  },
  {
    id: 'big-right', label: 'Big R',
    cells: [
      { x: 0,    y: 0,   w: 0.35, h: 0.5 },
      { x: 0,    y: 0.5, w: 0.35, h: 0.5 },
      { x: 0.35, y: 0,   w: 0.65, h: 1 },
    ],
  },
  {
    id: 'top-big', label: 'Big T',
    cells: [
      { x: 0,   y: 0,    w: 1,   h: 0.65 },
      { x: 0,   y: 0.65, w: 0.5, h: 0.35 },
      { x: 0.5, y: 0.65, w: 0.5, h: 0.35 },
    ],
  },
  {
    id: 'bottom-big', label: 'Big B',
    cells: [
      { x: 0,   y: 0,    w: 0.5, h: 0.35 },
      { x: 0.5, y: 0,    w: 0.5, h: 0.35 },
      { x: 0,   y: 0.35, w: 1,   h: 0.65 },
    ],
  },

  // ── 4-cell ───────────────────────────────────────────────────────────────────
  {
    id: 'grid-4', label: '2×2',
    cells: grid(2, 2),
  },
  {
    id: '4-top-3', label: 'T + 3',
    cells: [
      { x: 0,     y: 0,   w: 1,     h: 0.5 },
      { x: 0,     y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0.5, w: 0.334, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
  },
  {
    id: '4-bottom-3', label: '3 + B',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 0.5 },
      { x: 0.333, y: 0,   w: 0.334, h: 0.5 },
      { x: 0.667, y: 0,   w: 0.333, h: 0.5 },
      { x: 0,     y: 0.5, w: 1,     h: 0.5 },
    ],
  },
  {
    id: '4-left-3', label: 'L + 3',
    cells: [
      { x: 0,   y: 0,     w: 0.5, h: 1 },
      { x: 0.5, y: 0,     w: 0.5, h: 0.333 },
      { x: 0.5, y: 0.333, w: 0.5, h: 0.334 },
      { x: 0.5, y: 0.667, w: 0.5, h: 0.333 },
    ],
  },
  {
    id: '4-right-3', label: '3 + R',
    cells: [
      { x: 0,   y: 0,     w: 0.5, h: 0.333 },
      { x: 0,   y: 0.333, w: 0.5, h: 0.334 },
      { x: 0,   y: 0.667, w: 0.5, h: 0.333 },
      { x: 0.5, y: 0,     w: 0.5, h: 1 },
    ],
  },
  {
    id: '4-tl', label: 'Big TL',
    cells: [
      { x: 0,     y: 0,     w: 0.667, h: 0.667 },
      { x: 0.667, y: 0,     w: 0.333, h: 0.667 },
      { x: 0,     y: 0.667, w: 0.333, h: 0.333 },
      { x: 0.333, y: 0.667, w: 0.667, h: 0.333 },
    ],
  },
  {
    id: '4-tr', label: 'Big TR',
    cells: [
      { x: 0,     y: 0,     w: 0.333, h: 0.667 },
      { x: 0.333, y: 0,     w: 0.667, h: 0.667 },
      { x: 0,     y: 0.667, w: 0.667, h: 0.333 },
      { x: 0.667, y: 0.667, w: 0.333, h: 0.333 },
    ],
  },
  {
    id: '4-bl', label: 'Big BL',
    cells: [
      { x: 0,     y: 0,     w: 0.333, h: 0.333 },
      { x: 0.333, y: 0,     w: 0.667, h: 0.333 },
      { x: 0,     y: 0.333, w: 0.667, h: 0.667 },
      { x: 0.667, y: 0.333, w: 0.333, h: 0.667 },
    ],
  },
  {
    id: '4-br', label: 'Big BR',
    cells: [
      { x: 0,     y: 0,     w: 0.667, h: 0.333 },
      { x: 0.667, y: 0,     w: 0.333, h: 0.333 },
      { x: 0,     y: 0.333, w: 0.333, h: 0.667 },
      { x: 0.333, y: 0.333, w: 0.667, h: 0.667 },
    ],
  },
  // Editorial: TL big hero, TR split, full-width bottom
  {
    id: 'editorial', label: 'Editorial',
    cells: [
      { x: 0,     y: 0,     w: 0.667, h: 0.667 },
      { x: 0.667, y: 0,     w: 0.333, h: 0.334 },
      { x: 0.667, y: 0.334, w: 0.333, h: 0.333 },
      { x: 0,     y: 0.667, w: 1,     h: 0.333 },
    ],
  },
  // Spread: tall left + 3 stacked right
  {
    id: 'spread', label: 'Spread',
    cells: [
      { x: 0,   y: 0,    w: 0.6, h: 1 },
      { x: 0.6, y: 0,    w: 0.4, h: 0.4 },
      { x: 0.6, y: 0.4,  w: 0.4, h: 0.35 },
      { x: 0.6, y: 0.75, w: 0.4, h: 0.25 },
    ],
  },
  // Wedge: diagonal asymmetric
  {
    id: 'wedge', label: 'Wedge',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 0.5 },
      { x: 0.333, y: 0,   w: 0.667, h: 0.5 },
      { x: 0,     y: 0.5, w: 0.667, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
  },
  // Tribune: hero top + 3 unequal bottom
  {
    id: 'tribune', label: 'Tribune',
    cells: [
      { x: 0,   y: 0,   w: 1,   h: 0.6 },
      { x: 0,   y: 0.6, w: 0.2, h: 0.4 },
      { x: 0.2, y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.7, y: 0.6, w: 0.3, h: 0.4 },
    ],
  },
  // Inset: tall left + 3 staggered right
  {
    id: 'inset', label: 'Inset',
    cells: [
      { x: 0,   y: 0,    w: 0.7, h: 1 },
      { x: 0.7, y: 0,    w: 0.3, h: 0.25 },
      { x: 0.7, y: 0.25, w: 0.3, h: 0.5 },
      { x: 0.7, y: 0.75, w: 0.3, h: 0.25 },
    ],
  },
  // Parallax: alternating 2×2 with offset heights
  {
    id: 'parallax', label: 'Parallax',
    cells: [
      { x: 0,   y: 0,   w: 0.5, h: 0.6 },
      { x: 0,   y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.5, y: 0,   w: 0.5, h: 0.4 },
      { x: 0.5, y: 0.4, w: 0.5, h: 0.6 },
    ],
  },

  // ── 5-cell ───────────────────────────────────────────────────────────────────
  {
    id: '5-left-grid', label: 'L + 2×2',
    cells: [
      { x: 0,    y: 0,   w: 0.5,  h: 1 },
      { x: 0.5,  y: 0,   w: 0.25, h: 0.5 },
      { x: 0.75, y: 0,   w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ],
  },
  {
    id: '5-right-grid', label: '2×2 + R',
    cells: [
      { x: 0,    y: 0,   w: 0.25, h: 0.5 },
      { x: 0.25, y: 0,   w: 0.25, h: 0.5 },
      { x: 0,    y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0,   w: 0.5,  h: 1 },
    ],
  },
  {
    id: '5-top-grid', label: 'T + 4',
    cells: [
      { x: 0,    y: 0,   w: 1,    h: 0.5 },
      { x: 0,    y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ],
  },
  {
    id: '5-bottom-grid', label: '4 + B',
    cells: [
      { x: 0,    y: 0,   w: 0.25, h: 0.5 },
      { x: 0.25, y: 0,   w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0,   w: 0.25, h: 0.5 },
      { x: 0.75, y: 0,   w: 0.25, h: 0.5 },
      { x: 0,    y: 0.5, w: 1,    h: 0.5 },
    ],
  },
  {
    id: '5-big-tl', label: 'Big TL+',
    cells: [
      { x: 0,     y: 0,   w: 0.667, h: 0.5 },
      { x: 0.667, y: 0,   w: 0.333, h: 0.5 },
      { x: 0,     y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
  },
  {
    id: '5-big-br', label: 'Big BR+',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 0.5 },
      { x: 0.333, y: 0,   w: 0.333, h: 0.5 },
      { x: 0.667, y: 0,   w: 0.333, h: 0.5 },
      { x: 0,     y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0.5, w: 0.667, h: 0.5 },
    ],
  },
  // 3-column with left full, mid+right split (Example 1 style)
  {
    id: 'col-full-l-split', label: 'L+Split',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 1 },
      { x: 0.333, y: 0,   w: 0.333, h: 0.4 },
      { x: 0.333, y: 0.4, w: 0.333, h: 0.6 },
      { x: 0.667, y: 0,   w: 0.333, h: 0.6 },
      { x: 0.667, y: 0.6, w: 0.333, h: 0.4 },
    ],
  },
  // 3-column with right full, left+mid split
  {
    id: 'col-full-r-split', label: 'Split+R',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 0.6 },
      { x: 0,     y: 0.6, w: 0.333, h: 0.4 },
      { x: 0.333, y: 0,   w: 0.333, h: 0.4 },
      { x: 0.333, y: 0.4, w: 0.333, h: 0.6 },
      { x: 0.667, y: 0,   w: 0.333, h: 1 },
    ],
  },
  // 3-column with left full, mid+right halves (Example 2 style)
  {
    id: 'col-full-l-halves', label: 'L+Halves',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 1 },
      { x: 0.333, y: 0,   w: 0.333, h: 0.5 },
      { x: 0.333, y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.667, y: 0,   w: 0.333, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
  },
  // 3-column with middle full, sides split
  {
    id: 'col-mid-full', label: 'Mid Full',
    cells: [
      { x: 0,     y: 0,   w: 0.333, h: 0.5 },
      { x: 0,     y: 0.5, w: 0.333, h: 0.5 },
      { x: 0.333, y: 0,   w: 0.334, h: 1 },
      { x: 0.667, y: 0,   w: 0.333, h: 0.5 },
      { x: 0.667, y: 0.5, w: 0.333, h: 0.5 },
    ],
  },
  // Window: narrow sides flanking a wide center
  {
    id: 'window', label: 'Window',
    cells: [
      { x: 0,    y: 0,   w: 0.25, h: 0.5 },
      { x: 0,    y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0,   w: 0.5,  h: 1 },
      { x: 0.75, y: 0,   w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ],
  },
  // Portico: thin banners top and bottom, 3 columns in middle
  {
    id: 'portico', label: 'Portico',
    cells: [
      { x: 0,     y: 0,   w: 1,     h: 0.2 },
      { x: 0,     y: 0.2, w: 0.333, h: 0.6 },
      { x: 0.333, y: 0.2, w: 0.334, h: 0.6 },
      { x: 0.667, y: 0.2, w: 0.333, h: 0.6 },
      { x: 0,     y: 0.8, w: 1,     h: 0.2 },
    ],
  },

  // ── 6-cell ───────────────────────────────────────────────────────────────────
  {
    id: 'grid-3x2', label: '3×2',
    cells: grid(3, 2),
  },
  {
    id: 'grid-2x3', label: '2×3',
    cells: grid(2, 3),
  },
  {
    id: '6-big-left', label: 'Big L+',
    cells: [
      { x: 0,    y: 0,     w: 0.5,  h: 1 },
      { x: 0.5,  y: 0,     w: 0.5,  h: 0.333 },
      { x: 0.5,  y: 0.333, w: 0.25, h: 0.334 },
      { x: 0.75, y: 0.333, w: 0.25, h: 0.334 },
      { x: 0.5,  y: 0.667, w: 0.25, h: 0.333 },
      { x: 0.75, y: 0.667, w: 0.25, h: 0.333 },
    ],
  },
  {
    id: '6-big-top', label: 'Big T+',
    cells: [
      { x: 0,     y: 0,    w: 1,     h: 0.5 },
      { x: 0,     y: 0.5,  w: 0.333, h: 0.25 },
      { x: 0.333, y: 0.5,  w: 0.334, h: 0.25 },
      { x: 0.667, y: 0.5,  w: 0.333, h: 0.25 },
      { x: 0,     y: 0.75, w: 0.5,   h: 0.25 },
      { x: 0.5,   y: 0.75, w: 0.5,   h: 0.25 },
    ],
  },
  // Masthead: thin banner top, hero+side middle, 3 cols bottom
  {
    id: 'masthead', label: 'Masthead',
    cells: [
      { x: 0,     y: 0,    w: 1,     h: 0.15 },
      { x: 0,     y: 0.15, w: 0.65,  h: 0.55 },
      { x: 0.65,  y: 0.15, w: 0.35,  h: 0.55 },
      { x: 0,     y: 0.7,  w: 0.333, h: 0.3 },
      { x: 0.333, y: 0.7,  w: 0.334, h: 0.3 },
      { x: 0.667, y: 0.7,  w: 0.333, h: 0.3 },
    ],
  },
  // Cascade: top-left big + 2 stacked top-right, 2 small + 1 big bottom
  {
    id: 'cascade', label: 'Cascade',
    cells: [
      { x: 0,    y: 0,    w: 0.5,  h: 0.5 },
      { x: 0.5,  y: 0,    w: 0.5,  h: 0.25 },
      { x: 0.5,  y: 0.25, w: 0.5,  h: 0.25 },
      { x: 0,    y: 0.5,  w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.5,  w: 0.25, h: 0.5 },
      { x: 0.5,  y: 0.5,  w: 0.5,  h: 0.5 },
    ],
  },
  // Tabloid: hero TL + split TR, 3 cols bottom with wide center
  {
    id: 'tabloid', label: 'Tabloid',
    cells: [
      { x: 0,    y: 0,     w: 0.6,  h: 0.55 },
      { x: 0.6,  y: 0,     w: 0.4,  h: 0.275 },
      { x: 0.6,  y: 0.275, w: 0.4,  h: 0.275 },
      { x: 0,    y: 0.55,  w: 0.25, h: 0.45 },
      { x: 0.25, y: 0.55,  w: 0.5,  h: 0.45 },
      { x: 0.75, y: 0.55,  w: 0.25, h: 0.45 },
    ],
  },

  // ── 7-cell ───────────────────────────────────────────────────────────────────
  // Stagger: 3 rows with alternating widths
  {
    id: 'stagger', label: 'Stagger',
    cells: [
      { x: 0,     y: 0,   w: 0.4,   h: 0.3 },
      { x: 0.4,   y: 0,   w: 0.6,   h: 0.3 },
      { x: 0,     y: 0.3, w: 0.333, h: 0.4 },
      { x: 0.333, y: 0.3, w: 0.334, h: 0.4 },
      { x: 0.667, y: 0.3, w: 0.333, h: 0.4 },
      { x: 0,     y: 0.7, w: 0.6,   h: 0.3 },
      { x: 0.6,   y: 0.7, w: 0.4,   h: 0.3 },
    ],
  },
  // Mosaic: 2-3-2 layout with varying heights
  {
    id: 'mosaic', label: 'Mosaic',
    cells: [
      { x: 0,     y: 0,    w: 0.5,   h: 0.35 },
      { x: 0.5,   y: 0,    w: 0.5,   h: 0.35 },
      { x: 0,     y: 0.35, w: 0.333, h: 0.3 },
      { x: 0.333, y: 0.35, w: 0.334, h: 0.3 },
      { x: 0.667, y: 0.35, w: 0.333, h: 0.3 },
      { x: 0,     y: 0.65, w: 0.6,   h: 0.35 },
      { x: 0.6,   y: 0.65, w: 0.4,   h: 0.35 },
    ],
  },
  // Periodical: editorial 3-row with varying column widths
  {
    id: 'periodical', label: 'Periodical',
    cells: [
      { x: 0,    y: 0,   w: 0.4,  h: 0.3 },
      { x: 0.4,  y: 0,   w: 0.6,  h: 0.3 },
      { x: 0,    y: 0.3, w: 0.25, h: 0.4 },
      { x: 0.25, y: 0.3, w: 0.5,  h: 0.4 },
      { x: 0.75, y: 0.3, w: 0.25, h: 0.4 },
      { x: 0,    y: 0.7, w: 0.65, h: 0.3 },
      { x: 0.65, y: 0.7, w: 0.35, h: 0.3 },
    ],
  },

  // ── 8-cell ───────────────────────────────────────────────────────────────────
  {
    id: 'grid-4x2', label: '4×2',
    cells: grid(4, 2),
  },
  {
    id: 'grid-2x4', label: '2×4',
    cells: grid(2, 4),
  },

  // ── 9-cell ───────────────────────────────────────────────────────────────────
  {
    id: 'grid-3x3', label: '3×3',
    cells: grid(3, 3),
  },

  // ── 12-cell ──────────────────────────────────────────────────────────────────
  {
    id: 'grid-4x3', label: '4×3',
    cells: grid(4, 3),
  },
  {
    id: 'grid-3x4', label: '3×4',
    cells: grid(3, 4),
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ── Multi-page templates (pageSpan: 2) ──────────────────────────────────────
  // x=0 is left edge of starting page; x=1 is left edge of the next page, etc.
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 2-cell multi-page ────────────────────────────────────────────────────────
  {
    id: '2p-pair', label: 'Pair', pageSpan: 2,
    cells: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
    ],
  },

  // ── 3-cell multi-page ────────────────────────────────────────────────────────
  // Triptych: narrow sides, wide center spanning the page divide
  {
    id: '2p-triptych', label: 'Triptych', pageSpan: 2,
    cells: [
      { x: 0,   y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 1,   h: 1 },  // spans page boundary
      { x: 1.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  // Panorama: full-width banner top + half-page each below
  {
    id: 'panorama', label: 'Panorama', pageSpan: 2,
    cells: [
      { x: 0, y: 0,   w: 2, h: 0.6 },
      { x: 0, y: 0.6, w: 1, h: 0.4 },
      { x: 1, y: 0.6, w: 1, h: 0.4 },
    ],
  },
  // Bleed: narrow sides + tall center spanning the divide
  {
    id: 'bleed', label: 'Bleed', pageSpan: 2,
    cells: [
      { x: 0,   y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 1,   h: 1 },
      { x: 1.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  // Crossfade: wide outer panels + narrower center spanning the divide
  {
    id: 'crossfade', label: 'Crossfade', pageSpan: 2,
    cells: [
      { x: 0,    y: 0, w: 0.75, h: 1 },
      { x: 0.75, y: 0, w: 0.5,  h: 1 },
      { x: 1.25, y: 0, w: 0.75, h: 1 },
    ],
  },

  // ── 4-cell multi-page ────────────────────────────────────────────────────────
  // 4 equal vertical columns across 2 pages (2 per page)
  {
    id: '2p-4-cols', label: '2P 4 Col', pageSpan: 2,
    cells: grid(4, 1, 2),
  },
  // 2×2 across 2 pages
  {
    id: '2p-grid-2x2', label: '2P 2×2', pageSpan: 2,
    cells: grid(2, 2, 2),
  },
  // Marquee: tall outer columns + 2 stacked centers spanning the divide
  {
    id: 'marquee', label: 'Marquee', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 0.5, h: 1 },
      { x: 0.5, y: 0,   w: 1,   h: 0.5 },
      { x: 0.5, y: 0.5, w: 1,   h: 0.5 },
      { x: 1.5, y: 0,   w: 0.5, h: 1 },
    ],
  },

  // ── 5-cell multi-page ────────────────────────────────────────────────────────
  // Left full page + right 2×2
  {
    id: '2p-left-full', label: 'Pg + 2×2', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 1,   h: 1 },
      { x: 1,   y: 0,   w: 0.5, h: 0.5 },
      { x: 1.5, y: 0,   w: 0.5, h: 0.5 },
      { x: 1,   y: 0.5, w: 0.5, h: 0.5 },
      { x: 1.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  // 2×2 + right full page
  {
    id: '2p-right-full', label: '2×2 + Pg', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 0.5, h: 0.5 },
      { x: 0.5, y: 0,   w: 0.5, h: 0.5 },
      { x: 0,   y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      { x: 1,   y: 0,   w: 1,   h: 1 },
    ],
  },
  // Full-width banner (spans both pages) + 4 bottom cells
  {
    id: '2p-banner-grid', label: 'Banner+4', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 2,   h: 0.5 },   // spans both pages
      { x: 0,   y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      { x: 1,   y: 0.5, w: 0.5, h: 0.5 },
      { x: 1.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  // Horizon: full-width banner, middle row with center spanning divide, full-width bottom
  {
    id: 'horizon', label: 'Horizon', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 2,   h: 0.4 },
      { x: 0,   y: 0.4, w: 0.5, h: 0.3 },
      { x: 0.5, y: 0.4, w: 1,   h: 0.3 },
      { x: 1.5, y: 0.4, w: 0.5, h: 0.3 },
      { x: 0,   y: 0.7, w: 2,   h: 0.3 },
    ],
  },
  // Continuum: 4 corners + full-width banner across the middle
  {
    id: 'continuum', label: 'Continuum', pageSpan: 2,
    cells: [
      { x: 0, y: 0,   w: 1, h: 0.4 },
      { x: 1, y: 0,   w: 1, h: 0.4 },
      { x: 0, y: 0.4, w: 2, h: 0.3 },
      { x: 0, y: 0.7, w: 1, h: 0.3 },
      { x: 1, y: 0.7, w: 1, h: 0.3 },
    ],
  },
  // Reel: filmstrip with center band spanning the divide
  {
    id: 'reel', label: 'Reel', pageSpan: 2,
    cells: [
      { x: 0, y: 0,     w: 1, h: 0.333 },
      { x: 1, y: 0,     w: 1, h: 0.333 },
      { x: 0, y: 0.333, w: 2, h: 0.334 },
      { x: 0, y: 0.667, w: 1, h: 0.333 },
      { x: 1, y: 0.667, w: 1, h: 0.333 },
    ],
  },
  // Vista: panoramic banner top + 4 equal cells below
  {
    id: 'vista', label: 'Vista', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 2,   h: 0.5 },
      { x: 0,   y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      { x: 1,   y: 0.5, w: 0.5, h: 0.5 },
      { x: 1.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  // Serial: 4 narrow top + big banner bottom
  {
    id: 'serial', label: 'Serial', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 0.5, h: 0.4 },
      { x: 0.5, y: 0,   w: 0.5, h: 0.4 },
      { x: 1,   y: 0,   w: 0.5, h: 0.4 },
      { x: 1.5, y: 0,   w: 0.5, h: 0.4 },
      { x: 0,   y: 0.4, w: 2,   h: 0.6 },
    ],
  },

  // ── 6-cell multi-page ────────────────────────────────────────────────────────
  // 6 equal vertical columns
  {
    id: '2p-6-cols', label: '2P 6 Col', pageSpan: 2,
    cells: grid(6, 1, 2),
  },
  // 3×2 across 2 pages (3 rows, 2 cols per page)
  {
    id: '2p-grid-2x3', label: '2P 2×3', pageSpan: 2,
    cells: grid(2, 3, 2),
  },
  // Left full page + right 3 rows
  {
    id: '2p-left-full-3row', label: 'Pg + 3', pageSpan: 2,
    cells: [
      { x: 0, y: 0,     w: 1, h: 1 },
      { x: 1, y: 0,     w: 1, h: 0.333 },
      { x: 1, y: 0.333, w: 1, h: 0.334 },
      { x: 1, y: 0.667, w: 1, h: 0.333 },
    ],
  },
  // Tide: narrow top, wide middle band spanning the divide, full-width bottom
  {
    id: 'tide', label: 'Tide', pageSpan: 2,
    cells: [
      { x: 0,    y: 0,   w: 1,    h: 0.3 },
      { x: 1,    y: 0,   w: 1,    h: 0.3 },
      { x: 0,    y: 0.3, w: 0.25, h: 0.4 },
      { x: 0.25, y: 0.3, w: 1.5,  h: 0.4 },
      { x: 1.75, y: 0.3, w: 0.25, h: 0.4 },
      { x: 0,    y: 0.7, w: 2,    h: 0.3 },
    ],
  },
  // Saga: hero left, split center, hero right, full-width bottom
  {
    id: 'saga', label: 'Saga', pageSpan: 2,
    cells: [
      { x: 0,   y: 0,   w: 0.7, h: 0.6 },
      { x: 0.7, y: 0,   w: 0.3, h: 0.3 },
      { x: 0.7, y: 0.3, w: 0.3, h: 0.3 },
      { x: 1,   y: 0,   w: 0.3, h: 0.6 },
      { x: 1.3, y: 0,   w: 0.7, h: 0.6 },
      { x: 0,   y: 0.6, w: 2,   h: 0.4 },
    ],
  },

  // ── 8-cell multi-page ────────────────────────────────────────────────────────
  // 4 cols × 2 rows across 2 pages
  {
    id: '2p-grid-4x2', label: '2P 4×2', pageSpan: 2,
    cells: grid(4, 2, 2),
  },
  // 2 cols × 4 rows across 2 pages
  {
    id: '2p-grid-2x4', label: '2P 2×4', pageSpan: 2,
    cells: grid(2, 4, 2),
  },

  // ── 10-cell multi-page ───────────────────────────────────────────────────────
  // 5 cols × 2 rows across 2 pages (col 3 straddles page divide)
  {
    id: '2p-grid-5x2', label: '2P 5×2', pageSpan: 2,
    cells: grid(5, 2, 2),
  },

  // ── 12-cell multi-page ───────────────────────────────────────────────────────
  // 4 cols × 3 rows across 2 pages
  {
    id: '2p-grid-4x3', label: '2P 4×3', pageSpan: 2,
    cells: grid(4, 3, 2),
  },
  // 6 cols × 2 rows across 2 pages
  {
    id: '2p-grid-6x2', label: '2P 6×2', pageSpan: 2,
    cells: grid(6, 2, 2),
  },
  // 3 cols × 4 rows across 2 pages
  {
    id: '2p-grid-3x4', label: '2P 3×4', pageSpan: 2,
    cells: grid(3, 4, 2),
  },

  // ── 15-cell multi-page ───────────────────────────────────────────────────────
  // 5 cols × 3 rows across 2 pages — Example 3 (middle col straddles divide)
  {
    id: '2p-grid-5x3', label: '2P 5×3', pageSpan: 2,
    cells: grid(5, 3, 2),
  },

  // ── 16-cell multi-page ───────────────────────────────────────────────────────
  {
    id: '2p-grid-4x4', label: '2P 4×4', pageSpan: 2,
    cells: grid(4, 4, 2),
  },

  // ── 18-cell multi-page ───────────────────────────────────────────────────────
  {
    id: '2p-grid-6x3', label: '2P 6×3', pageSpan: 2,
    cells: grid(6, 3, 2),
  },

  // ── 24-cell multi-page ───────────────────────────────────────────────────────
  {
    id: '2p-grid-6x4', label: '2P 6×4', pageSpan: 2,
    cells: grid(6, 4, 2),
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ── 3-page templates (pageSpan: 3) ──────────────────────────────────────────
  // x goes 0–3 across the three pages
  // ═══════════════════════════════════════════════════════════════════════════════

  // Pano 3: full-width banner spanning 3 pages + 3 cells below (one per page)
  // Label is "Pano 3" to avoid colliding with the existing 2-page "Triptych"
  {
    id: 'triptych-pano', label: 'Pano 3', pageSpan: 3,
    cells: [
      { x: 0, y: 0,   w: 3, h: 0.6 },
      { x: 0, y: 0.6, w: 1, h: 0.4 },
      { x: 1, y: 0.6, w: 1, h: 0.4 },
      { x: 2, y: 0.6, w: 1, h: 0.4 },
    ],
  },
  // Story: 2-cell intro page + full middle page + 2-cell closer
  {
    id: 'story-arc', label: 'Story', pageSpan: 3,
    cells: [
      { x: 0, y: 0,   w: 1, h: 0.4 },
      { x: 0, y: 0.4, w: 1, h: 0.6 },
      { x: 1, y: 0,   w: 1, h: 1 },
      { x: 2, y: 0,   w: 1, h: 0.6 },
      { x: 2, y: 0.6, w: 1, h: 0.4 },
    ],
  },
  // Strip: two full-width banners + 3-up bottom row (one cell per page)
  {
    id: 'pano-strip', label: 'Strip', pageSpan: 3,
    cells: [
      { x: 0, y: 0,   w: 3, h: 0.4 },
      { x: 0, y: 0.4, w: 3, h: 0.3 },
      { x: 0, y: 0.7, w: 1, h: 0.3 },
      { x: 1, y: 0.7, w: 1, h: 0.3 },
      { x: 2, y: 0.7, w: 1, h: 0.3 },
    ],
  },
  // Filmstrip: 2-cell sides + full center page
  {
    id: 'filmstrip', label: 'Filmstrip', pageSpan: 3,
    cells: [
      { x: 0, y: 0,   w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
      { x: 1, y: 0,   w: 1, h: 1 },
      { x: 2, y: 0,   w: 1, h: 0.5 },
      { x: 2, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  // Cascade 3: banner + half-page pair + 3-up bottom row
  {
    id: 'cascade-3', label: 'Cascade 3', pageSpan: 3,
    cells: [
      { x: 0,   y: 0,     w: 3,   h: 0.333 },
      { x: 0,   y: 0.333, w: 1.5, h: 0.334 },
      { x: 1.5, y: 0.333, w: 1.5, h: 0.334 },
      { x: 0,   y: 0.667, w: 1,   h: 0.333 },
      { x: 1,   y: 0.667, w: 1,   h: 0.333 },
      { x: 2,   y: 0.667, w: 1,   h: 0.333 },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// ── Styled content templates (issue #63) ────────────────────────────────────────
// Beyond bare grids: designed posts with placeholder text, accent shapes, and
// backgrounds, organized by niche. They reuse the SAME fractional coordinate
// convention as grid cells (x spans 0..pageSpan, y/h span 0..1; w is one page
// wide regardless of pageSpan), so multi-page styled templates compose across
// pages exactly like multi-page grids.
//
// Extra optional fields a styled template may carry (all instantiated in
// instantiateTemplate below, all backward compatible — a template without them
// behaves like a plain grid):
//   category    — niche id for the browser's category tabs (see TEMPLATE_CATEGORIES)
//   bg          — page background. A single { color } / { gradient } applies to
//                 every page; an array applies per-page (index = page number).
//   textLayers  — [{ x,y,w,h, text, font, size, color, align, valign, bold,
//                    italic, lineHeight, tracking, opacity, textBg, textBgOpacity }]
//                 size/tracking are fractions of the slide HEIGHT (resolution
//                 independent). text is placeholder copy the user edits in place.
//   shapeLayers — [{ shapeType, x,y,w,h, fill, stroke, strokeWidth, cornerRadius,
//                    opacity }] strokeWidth/cornerRadius are fractions of height.
// ═══════════════════════════════════════════════════════════════════════════════

const STYLED_TEMPLATES = [
  // ── Quotes ────────────────────────────────────────────────────────────────────
  {
    id: 'quote-serif', label: 'Serif Quote', category: 'quotes',
    bg: { color: '#F4EFE6' },
    shapeLayers: [
      { shapeType: 'rect', x: 0.44, y: 0.70, w: 0.12, h: 0.006, fill: '#C0A062' },
    ],
    textLayers: [
      { x: 0.12, y: 0.13, w: 0.76, h: 0.14, text: '“', font: 'Playfair Display',
        size: 0.20, color: '#C0A062', align: 'center', valign: 'top', italic: true },
      { x: 0.12, y: 0.30, w: 0.76, h: 0.36, text: 'The quote that stops the scroll goes right here.',
        font: 'Playfair Display', size: 0.072, color: '#2B2B2B', align: 'center',
        valign: 'middle', italic: true, lineHeight: 1.32 },
      { x: 0.20, y: 0.74, w: 0.60, h: 0.06, text: 'YOUR NAME', font: 'Montserrat',
        size: 0.026, color: '#8A7A5C', align: 'center', valign: 'middle', bold: true, tracking: 0.006 },
    ],
  },
  {
    id: 'quote-bold', label: 'Bold Statement', category: 'quotes',
    bg: { color: '#111111' },
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.24, w: 0.16, h: 0.012, fill: '#FACC15' },
    ],
    textLayers: [
      { x: 0.07, y: 0.30, w: 0.86, h: 0.42, text: 'SAY IT LOUD\nAND CLEAR.', font: 'Anton',
        size: 0.115, color: '#FFFFFF', align: 'left', valign: 'top', lineHeight: 1.02 },
      { x: 0.08, y: 0.80, w: 0.60, h: 0.06, text: '@yourhandle', font: 'Space Grotesk',
        size: 0.03, color: '#FACC15', align: 'left', valign: 'middle', bold: true, tracking: 0.002 },
    ],
  },
  {
    id: 'quote-gradient', label: 'Soft Quote', category: 'quotes',
    bg: { gradient: { angle: 135, stops: ['#FDE8C9', '#F7A7C4'] } },
    textLayers: [
      { x: 0.14, y: 0.28, w: 0.72, h: 0.40, text: 'Something soft, something true — say it beautifully.',
        font: 'Cormorant Garamond', size: 0.082, color: '#5B2A4E', align: 'center',
        valign: 'middle', italic: true, lineHeight: 1.28 },
      { x: 0.20, y: 0.74, w: 0.60, h: 0.06, text: 'YOUR NAME', font: 'Josefin Sans',
        size: 0.026, color: '#8A4A6B', align: 'center', valign: 'middle', tracking: 0.008 },
    ],
  },
  {
    id: 'quote-duo', label: 'Quote Duo', category: 'quotes', pageSpan: 2,
    bg: [{ color: '#0F172A' }, { color: '#FACC15' }],
    shapeLayers: [
      { shapeType: 'rect', x: 0.10, y: 0.66, w: 0.14, h: 0.008, fill: '#FACC15' },
      { shapeType: 'rect', x: 1.10, y: 0.66, w: 0.14, h: 0.008, fill: '#0F172A' },
    ],
    textLayers: [
      { x: 0.10, y: 0.26, w: 0.80, h: 0.36, text: 'A big idea deserves its own slide.',
        font: 'Playfair Display', size: 0.078, color: '#F8FAFC', align: 'left',
        valign: 'middle', italic: true, lineHeight: 1.24 },
      { x: 0.10, y: 0.72, w: 0.70, h: 0.06, text: 'Swipe for the why →', font: 'Oswald',
        size: 0.032, color: '#94A3B8', align: 'left', valign: 'middle', tracking: 0.003 },
      { x: 1.10, y: 0.24, w: 0.80, h: 0.44, text: 'Because the story behind it is what people remember.',
        font: 'Oswald', size: 0.05, color: '#0F172A', align: 'left', valign: 'middle', lineHeight: 1.2 },
      { x: 1.10, y: 0.74, w: 0.70, h: 0.06, text: '@yourhandle', font: 'Space Grotesk',
        size: 0.028, color: '#0F172A', align: 'left', valign: 'middle', bold: true },
    ],
  },

  // ── Tips ──────────────────────────────────────────────────────────────────────
  {
    id: 'tips-checklist', label: 'Checklist', category: 'tips',
    bg: { color: '#FFFFFF' },
    shapeLayers: [
      { shapeType: 'rect', x: 0.10, y: 0.20, w: 0.24, h: 0.010, fill: '#0EA5E9' },
      { shapeType: 'circle', x: 0.10, y: 0.335, w: 0.05, h: 0.05, fill: '#0EA5E9' },
      { shapeType: 'circle', x: 0.10, y: 0.475, w: 0.05, h: 0.05, fill: '#0EA5E9' },
      { shapeType: 'circle', x: 0.10, y: 0.615, w: 0.05, h: 0.05, fill: '#0EA5E9' },
      { shapeType: 'circle', x: 0.10, y: 0.755, w: 0.05, h: 0.05, fill: '#0EA5E9' },
    ],
    textLayers: [
      { x: 0.10, y: 0.10, w: 0.80, h: 0.09, text: 'DAILY CHECKLIST', font: 'Oswald',
        size: 0.058, color: '#0F172A', align: 'left', valign: 'middle', tracking: 0.002 },
      { x: 0.20, y: 0.325, w: 0.70, h: 0.07, text: 'First thing to get done', font: 'Work Sans',
        size: 0.038, color: '#1E293B', align: 'left', valign: 'middle' },
      { x: 0.20, y: 0.465, w: 0.70, h: 0.07, text: 'Second thing that matters', font: 'Work Sans',
        size: 0.038, color: '#1E293B', align: 'left', valign: 'middle' },
      { x: 0.20, y: 0.605, w: 0.70, h: 0.07, text: 'Third habit to build', font: 'Work Sans',
        size: 0.038, color: '#1E293B', align: 'left', valign: 'middle' },
      { x: 0.20, y: 0.745, w: 0.70, h: 0.07, text: 'Fourth win of the day', font: 'Work Sans',
        size: 0.038, color: '#1E293B', align: 'left', valign: 'middle' },
    ],
  },
  {
    id: 'tips-number', label: 'Big Number', category: 'tips',
    bg: { gradient: { angle: 160, stops: ['#0F766E', '#14B8A6'] } },
    textLayers: [
      { x: 0.08, y: 0.10, w: 0.60, h: 0.30, text: '01', font: 'Anton',
        size: 0.26, color: '#FFFFFF', align: 'left', valign: 'top', opacity: 0.9 },
      { x: 0.09, y: 0.46, w: 0.82, h: 0.14, text: 'The tip headline', font: 'Poppins',
        size: 0.062, color: '#FFFFFF', align: 'left', valign: 'middle', bold: true, lineHeight: 1.1 },
      { x: 0.09, y: 0.62, w: 0.82, h: 0.24, text: 'A sentence or two explaining the tip so it actually lands.',
        font: 'Work Sans', size: 0.036, color: '#CCFBF1', align: 'left', valign: 'top', lineHeight: 1.4 },
    ],
  },
  {
    id: 'tips-carousel', label: '5 Tips', category: 'tips', pageSpan: 3,
    bg: [{ color: '#1E293B' }, { color: '#F8FAFC' }, { color: '#F8FAFC' }],
    shapeLayers: [
      { shapeType: 'rect', x: 0.10, y: 0.60, w: 0.20, h: 0.012, fill: '#38BDF8' },
      { shapeType: 'rect', x: 1.09, y: 0.10, w: 0.14, h: 0.30, fill: '#38BDF8', cornerRadius: 0.02 },
      { shapeType: 'rect', x: 2.09, y: 0.10, w: 0.14, h: 0.30, fill: '#38BDF8', cornerRadius: 0.02 },
    ],
    textLayers: [
      { x: 0.09, y: 0.24, w: 0.82, h: 0.34, text: '5 TIPS TO\nLEVEL UP', font: 'Bebas Neue',
        size: 0.14, color: '#F8FAFC', align: 'left', valign: 'top', lineHeight: 0.98 },
      { x: 0.10, y: 0.82, w: 0.60, h: 0.06, text: 'SWIPE →', font: 'Space Grotesk',
        size: 0.03, color: '#38BDF8', align: 'left', valign: 'middle', bold: true, tracking: 0.006 },
      { x: 1.11, y: 0.135, w: 0.10, h: 0.24, text: '1', font: 'Anton',
        size: 0.16, color: '#0F172A', align: 'center', valign: 'middle' },
      { x: 1.28, y: 0.14, w: 0.62, h: 0.14, text: 'First tip title', font: 'Poppins',
        size: 0.05, color: '#0F172A', align: 'left', valign: 'middle', bold: true },
      { x: 1.11, y: 0.46, w: 0.80, h: 0.40, text: 'Explain the first tip here in a couple of clear sentences the reader can act on.',
        font: 'Work Sans', size: 0.038, color: '#334155', align: 'left', valign: 'top', lineHeight: 1.45 },
      { x: 2.11, y: 0.135, w: 0.10, h: 0.24, text: '2', font: 'Anton',
        size: 0.16, color: '#0F172A', align: 'center', valign: 'middle' },
      { x: 2.28, y: 0.14, w: 0.62, h: 0.14, text: 'Second tip title', font: 'Poppins',
        size: 0.05, color: '#0F172A', align: 'left', valign: 'middle', bold: true },
      { x: 2.11, y: 0.46, w: 0.80, h: 0.40, text: 'Explain the second tip here so the whole carousel feels complete and useful.',
        font: 'Work Sans', size: 0.038, color: '#334155', align: 'left', valign: 'top', lineHeight: 1.45 },
    ],
  },

  // ── Promo ─────────────────────────────────────────────────────────────────────
  {
    id: 'promo-product', label: 'Product Drop', category: 'promo',
    bg: { color: '#111111' },
    cells: [
      { x: 0, y: 0, w: 1, h: 0.60 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.655, w: 0.18, h: 0.05, fill: '#FACC15', cornerRadius: 0.025 },
    ],
    textLayers: [
      { x: 0.09, y: 0.655, w: 0.18, h: 0.05, text: 'NEW', font: 'Space Grotesk',
        size: 0.026, color: '#111111', align: 'center', valign: 'middle', bold: true, tracking: 0.004 },
      { x: 0.08, y: 0.73, w: 0.84, h: 0.10, text: 'Product name here', font: 'Poppins',
        size: 0.06, color: '#FFFFFF', align: 'left', valign: 'middle', bold: true },
      { x: 0.08, y: 0.84, w: 0.60, h: 0.08, text: '$00', font: 'Poppins',
        size: 0.05, color: '#FACC15', align: 'left', valign: 'middle', bold: true },
      { x: 0.55, y: 0.85, w: 0.37, h: 0.06, text: 'Link in bio →', font: 'Work Sans',
        size: 0.03, color: '#A1A1AA', align: 'right', valign: 'middle' },
    ],
  },
  {
    id: 'promo-sale', label: 'Big Sale', category: 'promo',
    bg: { color: '#DC2626' },
    shapeLayers: [
      { shapeType: 'star', x: 0.60, y: 0.10, w: 0.30, h: 0.30, fill: '#FDE047', opacity: 0.95 },
    ],
    textLayers: [
      { x: 0.60, y: 0.10, w: 0.30, h: 0.30, text: 'SALE', font: 'Anton',
        size: 0.05, color: '#DC2626', align: 'center', valign: 'middle' },
      { x: 0.08, y: 0.40, w: 0.84, h: 0.24, text: '50% OFF', font: 'Anton',
        size: 0.17, color: '#FFFFFF', align: 'left', valign: 'middle', lineHeight: 1.0 },
      { x: 0.08, y: 0.66, w: 0.84, h: 0.08, text: 'EVERYTHING MUST GO', font: 'Oswald',
        size: 0.04, color: '#FEE2E2', align: 'left', valign: 'middle', tracking: 0.004 },
      { x: 0.08, y: 0.84, w: 0.84, h: 0.07, text: 'Shop now — @yourhandle', font: 'Work Sans',
        size: 0.032, color: '#FFFFFF', align: 'left', valign: 'middle' },
    ],
  },
  {
    id: 'promo-story', label: 'Product Story', category: 'promo', pageSpan: 2,
    bg: [null, { color: '#FAFAF9' }],
    cells: [
      { x: 0, y: 0, w: 1, h: 1 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0, y: 0.62, w: 1, h: 0.38, fill: '#000000', opacity: 0.42 },
      { shapeType: 'rect', x: 1.08, y: 0.20, w: 0.20, h: 0.010, fill: '#111111' },
    ],
    textLayers: [
      { x: 0.08, y: 0.70, w: 0.84, h: 0.12, text: 'The hero product', font: 'Playfair Display',
        size: 0.072, color: '#FFFFFF', align: 'left', valign: 'middle', italic: true },
      { x: 0.08, y: 0.84, w: 0.84, h: 0.06, text: 'SWIPE FOR DETAILS →', font: 'Montserrat',
        size: 0.026, color: '#E7E5E4', align: 'left', valign: 'middle', bold: true, tracking: 0.005 },
      { x: 1.08, y: 0.24, w: 0.82, h: 0.12, text: 'Why you’ll love it', font: 'Poppins',
        size: 0.055, color: '#111111', align: 'left', valign: 'middle', bold: true },
      { x: 1.08, y: 0.40, w: 0.82, h: 0.34, text: '• Feature one that sells it\n• Feature two they need\n• Feature three to close',
        font: 'Work Sans', size: 0.04, color: '#3F3F46', align: 'left', valign: 'top', lineHeight: 1.7 },
      { x: 1.08, y: 0.82, w: 0.82, h: 0.07, text: 'Shop the link in bio', font: 'Work Sans',
        size: 0.034, color: '#DC2626', align: 'left', valign: 'middle', bold: true },
    ],
  },

  // ── Photo dump ──────────────────────────────────────────────────────────────────
  {
    id: 'photo-postcard', label: 'Postcard', category: 'photo',
    bg: { color: '#FBF7F0' },
    cells: [
      { x: 0.08, y: 0.08, w: 0.84, h: 0.66 },
    ],
    textLayers: [
      { x: 0.08, y: 0.77, w: 0.84, h: 0.11, text: 'wish you were here', font: 'Satisfy',
        size: 0.075, color: '#3A342C', align: 'center', valign: 'middle' },
      { x: 0.08, y: 0.89, w: 0.84, h: 0.05, text: 'A LITTLE CAPTION', font: 'Josefin Sans',
        size: 0.024, color: '#A79B86', align: 'center', valign: 'middle', tracking: 0.008 },
    ],
  },
  {
    id: 'photo-trio', label: 'Trio', category: 'photo',
    bg: { color: '#EFE7DA' },
    cells: [
      { x: 0.06, y: 0.16, w: 0.88, h: 0.42 },
      { x: 0.06, y: 0.60, w: 0.43, h: 0.26 },
      { x: 0.51, y: 0.60, w: 0.43, h: 0.26 },
    ],
    textLayers: [
      { x: 0.06, y: 0.055, w: 0.88, h: 0.09, text: 'little moments', font: 'Dancing Script',
        size: 0.062, color: '#4A4235', align: 'center', valign: 'middle' },
      { x: 0.06, y: 0.885, w: 0.88, h: 0.05, text: 'A WEEKEND IN PICTURES', font: 'Josefin Sans',
        size: 0.024, color: '#A79B86', align: 'center', valign: 'middle', tracking: 0.008 },
    ],
  },
  {
    id: 'photo-dump-collage', label: 'Photo Dump', category: 'photo', pageSpan: 2,
    bg: { color: '#F1EBE1' },
    cells: [
      { x: 0.06, y: 0.20, w: 0.88, h: 0.44 },
      { x: 0.06, y: 0.66, w: 0.43, h: 0.28 },
      { x: 0.51, y: 0.66, w: 0.43, h: 0.28 },
      { x: 1.06, y: 0.06, w: 0.43, h: 0.44 },
      { x: 1.51, y: 0.06, w: 0.43, h: 0.44 },
      { x: 1.06, y: 0.52, w: 0.88, h: 0.42 },
    ],
    textLayers: [
      { x: 0.06, y: 0.07, w: 0.70, h: 0.10, text: 'photo dump', font: 'Playfair Display',
        size: 0.066, color: '#3A342C', align: 'left', valign: 'middle', italic: true },
      { x: 0.66, y: 0.09, w: 0.28, h: 0.06, text: 'OCT ’24', font: 'Josefin Sans',
        size: 0.028, color: '#A79B86', align: 'right', valign: 'middle', tracking: 0.006 },
    ],
  },

  // ── Before / After ──────────────────────────────────────────────────────────────
  {
    id: 'before-after', label: 'Before / After', category: 'beforeafter',
    bg: { color: '#0F172A' },
    cells: [
      { x: 0.04, y: 0.20, w: 0.44, h: 0.66 },
      { x: 0.52, y: 0.20, w: 0.44, h: 0.66 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.40, y: 0.10, w: 0.20, h: 0.006, fill: '#38BDF8' },
    ],
    textLayers: [
      { x: 0.04, y: 0.115, w: 0.92, h: 0.06, text: 'THE TRANSFORMATION', font: 'Oswald',
        size: 0.036, color: '#F8FAFC', align: 'center', valign: 'middle', tracking: 0.004 },
      { x: 0.04, y: 0.885, w: 0.44, h: 0.06, text: 'BEFORE', font: 'Oswald',
        size: 0.032, color: '#94A3B8', align: 'center', valign: 'middle', tracking: 0.006 },
      { x: 0.52, y: 0.885, w: 0.44, h: 0.06, text: 'AFTER', font: 'Oswald',
        size: 0.032, color: '#38BDF8', align: 'center', valign: 'middle', tracking: 0.006 },
    ],
  },
  {
    id: 'before-after-reveal', label: 'Reveal', category: 'beforeafter', pageSpan: 2,
    bg: { color: '#0B0B0B' },
    cells: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.06, y: 0.06, w: 0.26, h: 0.075, fill: '#000000', opacity: 0.55, cornerRadius: 0.012 },
      { shapeType: 'rect', x: 1.06, y: 0.06, w: 0.26, h: 0.075, fill: '#38BDF8', cornerRadius: 0.012 },
    ],
    textLayers: [
      { x: 0.06, y: 0.06, w: 0.26, h: 0.075, text: 'BEFORE', font: 'Oswald',
        size: 0.032, color: '#FFFFFF', align: 'center', valign: 'middle', tracking: 0.005 },
      { x: 1.06, y: 0.06, w: 0.26, h: 0.075, text: 'AFTER', font: 'Oswald',
        size: 0.032, color: '#0B0B0B', align: 'center', valign: 'middle', tracking: 0.005 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ── Designer templates from Claude Design (issue #63) ────────────────────────────
  // Converted from user-provided design specs. Source schema: page-relative x
  // (x_repo = page + x_src), fontSize→size (height fraction, direct), tracking =
  // letterSpacing_src × fontSize_src, background solid/gradient → bg. photoCells →
  // cells carrying an optional crop `shape` (circle/blob) and width-fraction
  // `cornerRadius` (see instantiateTemplate). Text uses valign 'top' since the
  // source anchors each box by its top-left corner.
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'serif-quiet-quote', label: 'Serif Quiet Quote', category: 'quotes',
    bg: { color: '#F4EEE4' },
    shapeLayers: [
      { shapeType: 'rect', x: 0.46, y: 0.275, w: 0.08, h: 0.005, fill: '#B5654A' },
    ],
    textLayers: [
      { x: 0.15, y: 0.2, w: 0.7, h: 0.04, text: 'A NOTE ON CRAFT', font: 'Work Sans', size: 0.018, color: '#B5654A', align: 'center', valign: 'top', bold: true, tracking: 0.00576 },
      { x: 0.12, y: 0.37, w: 0.76, h: 0.28, text: 'Good design is as little design as possible.', font: 'Playfair Display', size: 0.056, color: '#2B2823', align: 'center', valign: 'top', italic: true, lineHeight: 1.28 },
      { x: 0.15, y: 0.7, w: 0.7, h: 0.04, text: 'DIETER RAMS', font: 'Work Sans', size: 0.017, color: '#2B2823', align: 'center', valign: 'top', bold: true, tracking: 0.00408 },
      { x: 0.15, y: 0.745, w: 0.7, h: 0.03, text: 'Industrial Designer', font: 'Lora', size: 0.018, color: '#8A7E6C', align: 'center', valign: 'top', italic: true },
    ],
  },
  {
    id: 'bold-statement-quote', label: 'Bold Statement Quote', category: 'quotes',
    bg: { gradient: { angle: 155, stops: ['#1B1613', '#2C221A'] } },
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.195, w: 0.1, h: 0.006, fill: '#C6A052' },
    ],
    textLayers: [
      { x: 0.08, y: 0.14, w: 0.6, h: 0.04, text: 'STUDIO MANTRA', font: 'Oswald', size: 0.02, color: '#C6A052', align: 'left', valign: 'top', bold: true, tracking: 0.0056 },
      { x: 0.08, y: 0.3, w: 0.86, h: 0.4, text: "Buy once.\nCry once.", font: 'Anton', size: 0.115, color: '#F2ECE1', align: 'left', valign: 'top', lineHeight: 0.98, tracking: 0.000575 },
      { x: 0.08, y: 0.8, w: 0.8, h: 0.08, text: 'On the true cost of doing it right the first time.', font: 'DM Sans', size: 0.024, color: '#B4A895', align: 'left', valign: 'top', italic: true, lineHeight: 1.35 },
    ],
  },
  {
    id: 'bold-hook-tips', label: 'Bold Hook Tips', category: 'tips', pageSpan: 3,
    bg: { gradient: { angle: 135, stops: ['#1A1A2E', '#16213E'] } },
    cells: [
      { x: 1.08, y: 0.66, w: 0.84, h: 0.27, cornerRadius: 0.03 },
      { x: 2.08, y: 0.66, w: 0.84, h: 0.27, cornerRadius: 0.03 },
    ],
    shapeLayers: [
      { shapeType: 'circle', x: 0.6, y: -0.12, w: 0.52, h: 0.416, fill: '#E94560' },
      { shapeType: 'rect', x: 1.08, y: 0.33, w: 0.14, h: 0.006, fill: '#E94560' },
      { shapeType: 'rect', x: 2.08, y: 0.33, w: 0.14, h: 0.006, fill: '#E94560' },
    ],
    textLayers: [
      { x: 0.08, y: 0.13, w: 0.6, h: 0.04, text: 'GROWTH PLAYBOOK', font: 'Space Grotesk', size: 0.019, color: '#E94560', align: 'left', valign: 'top', bold: true, tracking: 0.00418 },
      { x: 0.08, y: 0.26, w: 0.82, h: 0.4, text: '5 mistakes killing your engagement', font: 'Anton', size: 0.082, color: '#FFFFFF', align: 'left', valign: 'top', lineHeight: 1.02 },
      { x: 0.08, y: 0.7, w: 0.74, h: 0.06, text: 'Save this before you post again.', font: 'DM Sans', size: 0.026, color: '#C9C9DB', align: 'left', valign: 'top', lineHeight: 1.3 },
      { x: 0.08, y: 0.87, w: 0.5, h: 0.035, text: 'SWIPE →', font: 'Space Grotesk', size: 0.018, color: '#E94560', align: 'left', valign: 'top', bold: true, tracking: 0.0036 },
      { x: 1.08, y: 0.12, w: 0.4, h: 0.18, text: '01', font: 'Anton', size: 0.15, color: '#E94560', align: 'left', valign: 'top', lineHeight: 1 },
      { x: 1.08, y: 0.37, w: 0.84, h: 0.1, text: 'A weak first line', font: 'Space Grotesk', size: 0.046, color: '#FFFFFF', align: 'left', valign: 'top', bold: true, lineHeight: 1.1 },
      { x: 1.08, y: 0.5, w: 0.84, h: 0.14, text: 'Your hook does 90% of the work. Lead with the payoff — never a slow warm-up.', font: 'DM Sans', size: 0.028, color: '#C9C9DB', align: 'left', valign: 'top', lineHeight: 1.45 },
      { x: 2.08, y: 0.12, w: 0.4, h: 0.18, text: '02', font: 'Anton', size: 0.15, color: '#E94560', align: 'left', valign: 'top', lineHeight: 1 },
      { x: 2.08, y: 0.37, w: 0.84, h: 0.1, text: 'No clear next step', font: 'Space Grotesk', size: 0.046, color: '#FFFFFF', align: 'left', valign: 'top', bold: true, lineHeight: 1.1 },
      { x: 2.08, y: 0.5, w: 0.84, h: 0.14, text: 'Tell people exactly what to do next. One clear ask beats five polite hints.', font: 'DM Sans', size: 0.028, color: '#C9C9DB', align: 'left', valign: 'top', lineHeight: 1.45 },
    ],
  },
  {
    id: 'editorial-field-guide', label: 'Editorial Field Guide', category: 'tips', pageSpan: 3,
    bg: { color: '#F5F1E8' },
    cells: [
      { x: 1.08, y: 0.55, w: 0.84, h: 0.37, cornerRadius: 0.015 },
      { x: 2.08, y: 0.55, w: 0.84, h: 0.37, cornerRadius: 0.015 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.16, w: 0.86, h: 0.003, fill: '#D8CFBE' },
    ],
    textLayers: [
      { x: 0.08, y: 0.1, w: 0.5, h: 0.035, text: 'THE FIELD GUIDE', font: 'Work Sans', size: 0.017, color: '#BC4B2B', align: 'left', valign: 'top', bold: true, tracking: 0.00442 },
      { x: 0.84, y: 0.1, w: 0.1, h: 0.035, text: '01', font: 'Space Grotesk', size: 0.02, color: '#8C8579', align: 'right', valign: 'top', tracking: 0.001 },
      { x: 0.08, y: 0.3, w: 0.82, h: 0.34, text: 'Three habits of wildly consistent creators', font: 'Playfair Display', size: 0.062, color: '#23211C', align: 'left', valign: 'top', bold: true, lineHeight: 1.12 },
      { x: 0.08, y: 0.68, w: 0.78, h: 0.08, text: "A short guide to showing up when the motivation doesn't.", font: 'Lora', size: 0.026, color: '#6E675A', align: 'left', valign: 'top', italic: true, lineHeight: 1.4 },
      { x: 0.08, y: 0.89, w: 0.6, h: 0.03, text: 'SWIPE TO READ →', font: 'Work Sans', size: 0.015, color: '#BC4B2B', align: 'left', valign: 'top', bold: true, tracking: 0.003 },
      { x: 1.08, y: 0.11, w: 0.3, h: 0.1, text: '01', font: 'Playfair Display', size: 0.075, color: '#BC4B2B', align: 'left', valign: 'top', italic: true, lineHeight: 1 },
      { x: 1.08, y: 0.24, w: 0.84, h: 0.1, text: 'Systems over streaks', font: 'Playfair Display', size: 0.05, color: '#23211C', align: 'left', valign: 'top', bold: true, lineHeight: 1.1 },
      { x: 1.08, y: 0.36, w: 0.84, h: 0.15, text: "Don't chase a perfect run. Build a weekly cadence you can hit even on your worst day.", font: 'Work Sans', size: 0.026, color: '#4A453B', align: 'left', valign: 'top', lineHeight: 1.5 },
      { x: 2.08, y: 0.11, w: 0.3, h: 0.1, text: '02', font: 'Playfair Display', size: 0.075, color: '#BC4B2B', align: 'left', valign: 'top', italic: true, lineHeight: 1 },
      { x: 2.08, y: 0.24, w: 0.84, h: 0.1, text: 'Batch, then breathe', font: 'Playfair Display', size: 0.05, color: '#23211C', align: 'left', valign: 'top', bold: true, lineHeight: 1.1 },
      { x: 2.08, y: 0.36, w: 0.84, h: 0.15, text: 'Film a month in a single day. Future-you gets calm mornings and a full shelf of content.', font: 'Work Sans', size: 0.026, color: '#4A453B', align: 'left', valign: 'top', lineHeight: 1.5 },
    ],
  },
  {
    id: 'punchy-toolkit-tips', label: 'Punchy Toolkit Tips', category: 'tips', pageSpan: 2,
    bg: { color: '#FFD23F' },
    cells: [
      { x: 1.08, y: 0.64, w: 0.84, h: 0.28, cornerRadius: 0.02 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0, y: 0, w: 1, h: 0.22, fill: '#17150F' },
      { shapeType: 'circle', x: 1.08, y: 0.1, w: 0.18, h: 0.144, fill: '#17150F' },
    ],
    textLayers: [
      { x: 0.08, y: 0.08, w: 0.84, h: 0.06, text: 'THE TOOLKIT', font: 'Space Grotesk', size: 0.03, color: '#FFD23F', align: 'left', valign: 'top', bold: true, tracking: 0.006 },
      { x: 0.08, y: 0.3, w: 0.84, h: 0.42, text: '4 tools that saved me 10 hours a week', font: 'Anton', size: 0.078, color: '#17150F', align: 'left', valign: 'top', lineHeight: 1.02 },
      { x: 0.08, y: 0.82, w: 0.72, h: 0.06, text: 'Free, fast, and boring in the best way.', font: 'Space Grotesk', size: 0.026, color: '#17150F', align: 'left', valign: 'top', lineHeight: 1.3 },
      { x: 1.08, y: 0.138, w: 0.18, h: 0.08, text: '1', font: 'Space Grotesk', size: 0.05, color: '#FFD23F', align: 'center', valign: 'top', bold: true, lineHeight: 1 },
      { x: 1.08, y: 0.3, w: 0.84, h: 0.12, text: 'Batch your captions', font: 'Space Grotesk', size: 0.05, color: '#17150F', align: 'left', valign: 'top', bold: true, lineHeight: 1.05 },
      { x: 1.08, y: 0.44, w: 0.84, h: 0.16, text: "Write ten at once in a plain doc. You'll sound sharper and post faster all week long.", font: 'Outfit', size: 0.03, color: '#2A2820', align: 'left', valign: 'top', lineHeight: 1.45 },
    ],
  },
  {
    id: 'minimal-product-drop', label: 'Minimal Product Drop', category: 'promo',
    bg: { color: '#FAF7F2' },
    cells: [
      { x: 0.14, y: 0.18, w: 0.72, h: 0.46, cornerRadius: 0.02 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.87, w: 0.42, h: 0.07, fill: '#1A1714', cornerRadius: 0.032 },
    ],
    textLayers: [
      { x: 0.08, y: 0.09, w: 0.6, h: 0.035, text: 'NEW THIS WEEK', font: 'Outfit', size: 0.017, color: '#A9803E', align: 'left', valign: 'top', bold: true, tracking: 0.00408 },
      { x: 0.08, y: 0.67, w: 0.6, h: 0.13, text: 'The Everyday Carryall', font: 'Playfair Display', size: 0.046, color: '#1A1714', align: 'left', valign: 'top', lineHeight: 1.1 },
      { x: 0.66, y: 0.67, w: 0.28, h: 0.06, text: '$248', font: 'Outfit', size: 0.032, color: '#1A1714', align: 'right', valign: 'top', bold: true, lineHeight: 1.1 },
      { x: 0.08, y: 0.8, w: 0.72, h: 0.05, text: 'Full-grain leather. Made to age well.', font: 'Outfit', size: 0.022, color: '#6E675C', align: 'left', valign: 'top', lineHeight: 1.35 },
      { x: 0.08, y: 0.888, w: 0.42, h: 0.04, text: 'SHOP NOW', font: 'Outfit', size: 0.02, color: '#FAF7F2', align: 'center', valign: 'top', bold: true, tracking: 0.0036 },
    ],
  },
  {
    id: 'flash-sale-promo', label: 'Flash Sale Promo', category: 'promo',
    bg: { gradient: { angle: 150, stops: ['#FF3D68', '#B5177E'] } },
    cells: [
      { x: 0.62, y: 0.46, w: 0.3, h: 0.24, shape: 'circle' },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.46, w: 0.5, h: 0.12, fill: '#FFD23F', cornerRadius: 0.016 },
      { shapeType: 'rect', x: 0.08, y: 0.85, w: 0.55, h: 0.075, fill: '#17150F', cornerRadius: 0.036 },
    ],
    textLayers: [
      { x: 0.08, y: 0.1, w: 0.7, h: 0.04, text: '48 HOURS ONLY', font: 'Space Grotesk', size: 0.02, color: '#FFFFFF', align: 'left', valign: 'top', bold: true, tracking: 0.0048 },
      { x: 0.08, y: 0.17, w: 0.84, h: 0.26, text: "FLASH\nSALE", font: 'Anton', size: 0.12, color: '#FFFFFF', align: 'left', valign: 'top', lineHeight: 0.92 },
      { x: 0.08, y: 0.485, w: 0.5, h: 0.09, text: '50% OFF', font: 'Anton', size: 0.06, color: '#B5177E', align: 'center', valign: 'top', lineHeight: 1 },
      { x: 0.08, y: 0.63, w: 0.5, h: 0.08, text: 'Everything in store. Code: FLASH50.', font: 'Space Grotesk', size: 0.022, color: '#FFE1EC', align: 'left', valign: 'top', lineHeight: 1.4 },
      { x: 0.08, y: 0.87, w: 0.55, h: 0.04, text: 'SHOP THE SALE →', font: 'Space Grotesk', size: 0.02, color: '#FFFFFF', align: 'center', valign: 'top', bold: true, tracking: 0.0024 },
    ],
  },
  {
    id: 'grid-moodboard', label: 'Grid Moodboard', category: 'photo',
    bg: { color: '#E7DFD3' },
    cells: [
      { x: 0.06, y: 0.24, w: 0.43, h: 0.34, cornerRadius: 0.015 },
      { x: 0.51, y: 0.24, w: 0.43, h: 0.34, cornerRadius: 0.015 },
      { x: 0.06, y: 0.6, w: 0.43, h: 0.34, cornerRadius: 0.015 },
      { x: 0.51, y: 0.6, w: 0.43, h: 0.34, cornerRadius: 0.015 },
    ],
    textLayers: [
      { x: 0.06, y: 0.07, w: 0.5, h: 0.03, text: 'CURATED', font: 'Work Sans', size: 0.015, color: '#A2795A', align: 'left', valign: 'top', bold: true, tracking: 0.0045 },
      { x: 0.06, y: 0.1, w: 0.6, h: 0.09, text: 'Autumn moodboard', font: 'Cormorant Garamond', size: 0.052, color: '#33291F', align: 'left', valign: 'top', bold: true, lineHeight: 1 },
      { x: 0.7, y: 0.115, w: 0.24, h: 0.04, text: "NOV '26", font: 'Work Sans', size: 0.016, color: '#7A6A57', align: 'right', valign: 'top', tracking: 0.0024 },
    ],
  },
  {
    id: 'scrapbook-dump', label: 'Scrapbook Dump', category: 'photo',
    bg: { color: '#EFE6D6' },
    cells: [
      { x: 0.06, y: 0.23, w: 0.52, h: 0.44, cornerRadius: 0.02 },
      { x: 0.62, y: 0.23, w: 0.32, h: 0.256, shape: 'circle' },
      { x: 0.62, y: 0.52, w: 0.32, h: 0.28, shape: 'blob' },
      { x: 0.06, y: 0.71, w: 0.52, h: 0.23, cornerRadius: 0.02 },
    ],
    textLayers: [
      { x: 0.06, y: 0.06, w: 0.6, h: 0.03, text: 'PHOTO DUMP', font: 'Work Sans', size: 0.015, color: '#9A8B72', align: 'left', valign: 'top', bold: true, tracking: 0.0045 },
      { x: 0.06, y: 0.085, w: 0.8, h: 0.11, text: 'this week, mostly', font: 'Dancing Script', size: 0.058, color: '#3A2F22', align: 'left', valign: 'top', bold: true, lineHeight: 1 },
      { x: 0.62, y: 0.85, w: 0.32, h: 0.05, text: '07 / 26', font: 'Space Grotesk', size: 0.02, color: '#7A6A57', align: 'right', valign: 'top', tracking: 0.002 },
    ],
  },
  {
    id: 'before-and-after', label: 'Before & After', category: 'beforeafter',
    bg: { color: '#EEEAE1' },
    cells: [
      { x: 0.06, y: 0.24, w: 0.42, h: 0.58, cornerRadius: 0.02 },
      { x: 0.52, y: 0.24, w: 0.42, h: 0.58, cornerRadius: 0.02 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.06, y: 0.24, w: 0.22, h: 0.055, fill: '#23211C', opacity: 0.9, cornerRadius: 0.008 },
      { shapeType: 'rect', x: 0.72, y: 0.24, w: 0.22, h: 0.055, fill: '#2E7D6B', cornerRadius: 0.008 },
      { shapeType: 'circle', x: 0.435, y: 0.475, w: 0.13, h: 0.104, fill: '#EEEAE1' },
      { shapeType: 'arrow', x: 0.45, y: 0.495, w: 0.1, h: 0.065, fill: '#2E7D6B' },
    ],
    textLayers: [
      { x: 0.06, y: 0.08, w: 0.88, h: 0.06, text: 'The 30-day transformation', font: 'Poppins', size: 0.034, color: '#23211C', align: 'center', valign: 'top', bold: true, lineHeight: 1.1 },
      { x: 0.1, y: 0.145, w: 0.8, h: 0.035, text: 'Same room, one weekend of work', font: 'Poppins', size: 0.02, color: '#7A756A', align: 'center', valign: 'top' },
      { x: 0.06, y: 0.252, w: 0.22, h: 0.035, text: 'BEFORE', font: 'Poppins', size: 0.018, color: '#FFFFFF', align: 'center', valign: 'top', bold: true, tracking: 0.0027 },
      { x: 0.72, y: 0.252, w: 0.22, h: 0.035, text: 'AFTER', font: 'Poppins', size: 0.018, color: '#FFFFFF', align: 'center', valign: 'top', bold: true, tracking: 0.0027 },
      { x: 0.1, y: 0.86, w: 0.8, h: 0.05, text: 'Swipe to see how we did it →', font: 'Poppins', size: 0.02, color: '#2E7D6B', align: 'center', valign: 'top', bold: true, tracking: 0.002 },
    ],
  },
  {
    id: 'launch-announcement', label: 'Launch Announcement', category: 'announce',
    bg: { gradient: { angle: 140, stops: ['#2A1A5E', '#0E1E5B'] } },
    shapeLayers: [
      { shapeType: 'circle', x: 0.62, y: -0.08, w: 0.4, h: 0.32, fill: '#FF7A59' },
      { shapeType: 'rect', x: 0.08, y: 0.74, w: 0.86, h: 0.003, fill: '#3A3A7A' },
    ],
    textLayers: [
      { x: 0.08, y: 0.12, w: 0.7, h: 0.04, text: 'INTRODUCING', font: 'Montserrat', size: 0.02, color: '#FFC24B', align: 'left', valign: 'top', bold: true, tracking: 0.006 },
      { x: 0.08, y: 0.24, w: 0.86, h: 0.34, text: "The studio is\nnow open", font: 'Anton', size: 0.088, color: '#FFFFFF', align: 'left', valign: 'top', lineHeight: 1 },
      { x: 0.08, y: 0.6, w: 0.72, h: 0.08, text: 'Bookings for automotive and brand films are officially live.', font: 'Montserrat', size: 0.024, color: '#C9CBE8', align: 'left', valign: 'top', lineHeight: 1.4 },
      { x: 0.08, y: 0.78, w: 0.4, h: 0.03, text: 'OPENS', font: 'Space Grotesk', size: 0.015, color: '#8A8CC0', align: 'left', valign: 'top', bold: true, tracking: 0.003 },
      { x: 0.08, y: 0.81, w: 0.5, h: 0.06, text: '09 JUL 2026', font: 'Space Grotesk', size: 0.03, color: '#FFFFFF', align: 'left', valign: 'top', bold: true },
      { x: 0.6, y: 0.815, w: 0.34, h: 0.06, text: 'vantagestudios.co', font: 'Space Grotesk', size: 0.02, color: '#FFC24B', align: 'right', valign: 'top' },
    ],
  },
  {
    id: 'coming-soon-teaser', label: 'Coming Soon Teaser', category: 'announce',
    bg: { gradient: { angle: 160, stops: ['#101012', '#1D1B17'] } },
    shapeLayers: [
      { shapeType: 'rect', x: 0.44, y: 0.365, w: 0.12, h: 0.004, fill: '#C6A052', opacity: 0.8 },
    ],
    textLayers: [
      { x: 0.1, y: 0.3, w: 0.8, h: 0.04, text: 'VANTAGE STUDIOS', font: 'Oswald', size: 0.018, color: '#C6A052', align: 'center', valign: 'top', tracking: 0.0072 },
      { x: 0.06, y: 0.42, w: 0.88, h: 0.14, text: 'COMING SOON', font: 'Bebas Neue', size: 0.1, color: '#F2ECE1', align: 'center', valign: 'top', lineHeight: 0.95, tracking: 0.002 },
      { x: 0.15, y: 0.56, w: 0.7, h: 0.05, text: 'A new chapter of cinematic work.', font: 'Cormorant Garamond', size: 0.028, color: '#B8AE9E', align: 'center', valign: 'top', italic: true, lineHeight: 1.3 },
      { x: 0.2, y: 0.66, w: 0.6, h: 0.04, text: 'AUTUMN 2026', font: 'Space Grotesk', size: 0.018, color: '#C6A052', align: 'center', valign: 'top', bold: true, tracking: 0.0054 },
    ],
  },

  // ===============================================================================
  // -- Photo templates from Claude Design (batch 2, follows PR #79) ---------------
  // 15 niche "photo" designs, converted with the batch-1 conventions (page-relative
  // x -> x_repo = page + x_src; fontSize -> size; tracking = letterSpacing x
  // fontSize; width-fraction cell cornerRadius; text valign 'top'). New in this
  // batch: optional `rotation` (deg) on cells/shapes/text -> freeRotation, and
  // `behind: true` polaroid frames that render under their photo cell. "Seamless
  // Panorama" collapses its two full-page cells into one cross-slide spanning cell
  // (x:0, w:2), matching its "ONE PHOTO . TWO SLIDES" intent.
  // ===============================================================================
  {
    id: 'full-frame-story', label: 'Full Frame Story', category: 'photo', pageSpan: 3,
    bg: { color: '#100F0D' },
    cells: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
      { x: 2, y: 0, w: 1, h: 1 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0, y: 0.6, w: 1, h: 0.4, fill: '#0B0A08', opacity: 0.5 },
    ],
    textLayers: [
      { x: 0.07, y: 0.79, w: 0.6, h: 0.03, text: 'PHOTO STORY', font: 'Work Sans', size: 0.015, color: '#C6A052', align: 'left', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0039 },
      { x: 0.07, y: 0.825, w: 0.8, h: 0.09, text: 'A weekend north', font: 'Playfair Display', size: 0.05, color: '#FFFFFF', align: 'left', valign: 'top', bold: true, lineHeight: 1.05 },
      { x: 1.82, y: 0.9, w: 0.12, h: 0.04, text: '02', font: 'Space Grotesk', size: 0.018, color: '#FFFFFF', align: 'right', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0009 },
      { x: 2.82, y: 0.9, w: 0.12, h: 0.04, text: '03', font: 'Space Grotesk', size: 0.018, color: '#FFFFFF', align: 'right', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0009 },
    ],
  },
  {
    id: 'polaroid-spread', label: 'Polaroid Spread', category: 'photo', pageSpan: 2,
    bg: { color: '#ECE4D6' },
    cells: [
      { x: 0.085, y: 0.225, w: 0.37, h: 0.42 },
      { x: 0.545, y: 0.325, w: 0.37, h: 0.42 },
      { x: 1.085, y: 0.325, w: 0.37, h: 0.42 },
      { x: 1.545, y: 0.185, w: 0.37, h: 0.42 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.06, y: 0.2, w: 0.42, h: 0.54, fill: '#FBF8F2', cornerRadius: 0.006, behind: true },
      { shapeType: 'rect', x: 0.52, y: 0.3, w: 0.42, h: 0.54, fill: '#FBF8F2', cornerRadius: 0.006, behind: true },
      { shapeType: 'rect', x: 1.06, y: 0.3, w: 0.42, h: 0.54, fill: '#FBF8F2', cornerRadius: 0.006, behind: true },
      { shapeType: 'rect', x: 1.52, y: 0.16, w: 0.42, h: 0.54, fill: '#FBF8F2', cornerRadius: 0.006, behind: true },
    ],
    textLayers: [
      { x: 0.08, y: 0.06, w: 0.7, h: 0.08, text: 'the film roll', font: 'Dancing Script', size: 0.045, color: '#4A3B2A', align: 'left', valign: 'top', bold: true, lineHeight: 1 },
    ],
  },
  {
    id: 'collage-mix', label: 'Collage Mix', category: 'photo', pageSpan: 3,
    bg: { color: '#F1EEE7' },
    cells: [
      { x: 0.06, y: 0.08, w: 0.88, h: 0.82, cornerRadius: 0.02 },
      { x: 1.06, y: 0.09, w: 0.43, h: 0.4, cornerRadius: 0.02 },
      { x: 1.51, y: 0.09, w: 0.43, h: 0.4, cornerRadius: 0.02 },
      { x: 1.06, y: 0.51, w: 0.43, h: 0.4, cornerRadius: 0.02 },
      { x: 1.51, y: 0.51, w: 0.43, h: 0.4, cornerRadius: 0.02 },
      { x: 2.06, y: 0.09, w: 0.88, h: 0.48, cornerRadius: 0.02 },
      { x: 2.06, y: 0.61, w: 0.43, h: 0.3, cornerRadius: 0.02 },
      { x: 2.51, y: 0.61, w: 0.43, h: 0.3, cornerRadius: 0.02 },
    ],
    textLayers: [
      { x: 0.06, y: 0.925, w: 0.88, h: 0.03, text: 'SWIPE FOR MORE →', font: 'Space Grotesk', size: 0.014, color: '#A9A295', align: 'center', valign: 'top', lineHeight: 1.2, tracking: 0.00196 },
    ],
  },
  {
    id: 'scattered-film', label: 'Scattered Film', category: 'photo', pageSpan: 2,
    bg: { color: '#E6DECF' },
    cells: [
      { x: 0.1, y: 0.19, w: 0.36, h: 0.4, rotation: -7 },
      { x: 0.54, y: 0.36, w: 0.36, h: 0.4, rotation: 6 },
      { x: 1.32, y: 0.11, w: 0.36, h: 0.36, rotation: 4 },
      { x: 1.08, y: 0.52, w: 0.34, h: 0.34, rotation: -5 },
      { x: 1.58, y: 0.54, w: 0.34, h: 0.34, rotation: 7 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.08, y: 0.17, w: 0.4, h: 0.5, fill: '#FCFAF4', cornerRadius: 0.006, rotation: -7, behind: true },
      { shapeType: 'rect', x: 0.52, y: 0.34, w: 0.4, h: 0.5, fill: '#FCFAF4', cornerRadius: 0.006, rotation: 6, behind: true },
      { shapeType: 'rect', x: 1.3, y: 0.09, w: 0.4, h: 0.46, fill: '#FCFAF4', cornerRadius: 0.006, rotation: 4, behind: true },
      { shapeType: 'rect', x: 1.06, y: 0.5, w: 0.38, h: 0.44, fill: '#FCFAF4', cornerRadius: 0.006, rotation: -5, behind: true },
      { shapeType: 'rect', x: 1.56, y: 0.52, w: 0.38, h: 0.44, fill: '#FCFAF4', cornerRadius: 0.006, rotation: 7, behind: true },
    ],
    textLayers: [
      { x: 0.08, y: 0.055, w: 0.76, h: 0.08, text: 'summer, unfiltered', font: 'Dancing Script', size: 0.042, color: '#4A3B2A', align: 'left', valign: 'top', bold: true, lineHeight: 1, rotation: -2 },
    ],
  },
  {
    id: 'taped-snapshots', label: 'Taped Snapshots', category: 'photo',
    bg: { color: '#EDE9E0' },
    cells: [
      { x: 0.08, y: 0.13, w: 0.42, h: 0.32, cornerRadius: 0.004, rotation: -4 },
      { x: 0.52, y: 0.3, w: 0.42, h: 0.32, cornerRadius: 0.004, rotation: 5 },
      { x: 0.08, y: 0.6, w: 0.4, h: 0.32, cornerRadius: 0.004, rotation: 3 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.24, y: 0.105, w: 0.1, h: 0.035, fill: '#D9CDAF', opacity: 0.85, cornerRadius: 0.002, rotation: -4 },
      { shapeType: 'rect', x: 0.66, y: 0.275, w: 0.1, h: 0.035, fill: '#D9CDAF', opacity: 0.85, cornerRadius: 0.002, rotation: 5 },
      { shapeType: 'rect', x: 0.22, y: 0.575, w: 0.1, h: 0.035, fill: '#D9CDAF', opacity: 0.85, cornerRadius: 0.002, rotation: 3 },
    ],
    textLayers: [
      { x: 0.08, y: 0.055, w: 0.8, h: 0.03, text: '// the week in frames', font: 'Space Grotesk', size: 0.016, color: '#8A7F6B', align: 'left', valign: 'top', lineHeight: 1.2, tracking: 0.00096 },
    ],
  },
  {
    id: 'editorial-spread', label: 'Editorial Spread', category: 'photo', pageSpan: 2,
    bg: { color: '#F2EFE8' },
    cells: [
      { x: 0.08, y: 0.12, w: 0.84, h: 0.64, cornerRadius: 0.008 },
      { x: 1.08, y: 0.1, w: 0.4, h: 0.58, cornerRadius: 0.008 },
      { x: 1.52, y: 0.1, w: 0.4, h: 0.58, cornerRadius: 0.008 },
    ],
    textLayers: [
      { x: 0.08, y: 0.065, w: 0.4, h: 0.03, text: 'N° 12', font: 'Space Grotesk', size: 0.015, color: '#A79B84', align: 'left', valign: 'top', lineHeight: 1.2, tracking: 0.0015 },
      { x: 0.52, y: 0.065, w: 0.4, h: 0.03, text: 'SHOT ON 35MM', font: 'Space Grotesk', size: 0.015, color: '#A79B84', align: 'right', valign: 'top', lineHeight: 1.2, tracking: 0.0018 },
      { x: 0.08, y: 0.8, w: 0.84, h: 0.12, text: 'Golden hour, somewhere off the coast.', font: 'Cormorant Garamond', size: 0.038, color: '#33302A', align: 'left', valign: 'top', italic: true, lineHeight: 1.2 },
      { x: 1.08, y: 0.73, w: 0.84, h: 0.1, text: 'Two frames, one long afternoon.', font: 'Cormorant Garamond', size: 0.034, color: '#33302A', align: 'center', valign: 'top', italic: true, lineHeight: 1.25 },
    ],
  },
  {
    id: 'seamless-panorama', label: 'Seamless Panorama', category: 'photo', pageSpan: 2,
    bg: { color: '#0E0D0C' },
    cells: [
      { x: 0, y: 0, w: 2, h: 1 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0, y: 0.82, w: 1, h: 0.18, fill: '#0B0A08', opacity: 0.42 },
    ],
    textLayers: [
      { x: 0.06, y: 0.905, w: 0.7, h: 0.03, text: 'ONE PHOTO · TWO SLIDES →', font: 'Space Grotesk', size: 0.014, color: '#C6A052', align: 'left', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.00252 },
    ],
  },
  {
    id: 'nine-up', label: 'Nine Up', category: 'photo',
    bg: { color: '#141310' },
    cells: [
      { x: 0.05, y: 0.12, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.357, y: 0.12, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.664, y: 0.12, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.05, y: 0.38, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.357, y: 0.38, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.664, y: 0.38, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.05, y: 0.64, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.357, y: 0.64, w: 0.286, h: 0.24, cornerRadius: 0.006 },
      { x: 0.664, y: 0.64, w: 0.286, h: 0.24, cornerRadius: 0.006 },
    ],
    textLayers: [
      { x: 0.05, y: 0.055, w: 0.6, h: 0.03, text: 'NINE UP', font: 'Space Grotesk', size: 0.018, color: '#C6A052', align: 'left', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0036 },
      { x: 0.45, y: 0.06, w: 0.5, h: 0.03, text: 'ROLL 07', font: 'Space Grotesk', size: 0.015, color: '#7A756A', align: 'right', valign: 'top', lineHeight: 1.2, tracking: 0.0012 },
    ],
  },
  {
    id: 'filmstrip-stack', label: 'Filmstrip Stack', category: 'photo',
    bg: { color: '#16150F' },
    cells: [
      { x: 0.06, y: 0.13, w: 0.88, h: 0.24, cornerRadius: 0.006 },
      { x: 0.06, y: 0.39, w: 0.88, h: 0.24, cornerRadius: 0.006 },
      { x: 0.06, y: 0.65, w: 0.88, h: 0.24, cornerRadius: 0.006 },
    ],
    textLayers: [
      { x: 0.06, y: 0.055, w: 0.8, h: 0.03, text: '// contact strip', font: 'Space Grotesk', size: 0.016, color: '#C6A052', align: 'left', valign: 'top', lineHeight: 1.2, tracking: 0.00096 },
    ],
  },
  {
    id: 'portrait-duo', label: 'Portrait Duo', category: 'photo',
    bg: { color: '#E8E0D2' },
    cells: [
      { x: 0.06, y: 0.08, w: 0.43, h: 0.72, cornerRadius: 0.01 },
      { x: 0.51, y: 0.18, w: 0.43, h: 0.72, cornerRadius: 0.01 },
    ],
    textLayers: [
      { x: 0.06, y: 0.845, w: 0.42, h: 0.07, text: 'a slow week', font: 'Dancing Script', size: 0.036, color: '#4A3B2A', align: 'left', valign: 'top', bold: true, lineHeight: 1, rotation: -2 },
    ],
  },
  {
    id: 'feature-note', label: 'Feature Note', category: 'photo', pageSpan: 2,
    bg: { color: '#ECE4D6' },
    cells: [
      { x: 0.06, y: 0.08, w: 0.88, h: 0.46, cornerRadius: 0.012 },
      { x: 0.185, y: 0.59, w: 0.41, h: 0.27, rotation: -4 },
      { x: 1.06, y: 0.08, w: 0.6, h: 0.42, cornerRadius: 0.01, rotation: -3 },
      { x: 1.4, y: 0.52, w: 0.54, h: 0.4, cornerRadius: 0.01, rotation: 4 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.16, y: 0.57, w: 0.46, h: 0.37, fill: '#FCFAF4', cornerRadius: 0.006, rotation: -4, behind: true },
    ],
    textLayers: [
      { x: 0.62, y: 0.68, w: 0.34, h: 0.08, text: 'the good ones', font: 'Dancing Script', size: 0.038, color: '#4A3B2A', align: 'left', valign: 'top', bold: true, lineHeight: 1.05, rotation: 4 },
    ],
  },
  {
    id: 'polaroid-moment', label: 'Polaroid Moment', category: 'photo',
    bg: { color: '#E9E1D3' },
    cells: [
      { x: 0.215, y: 0.19, w: 0.57, h: 0.505, cornerRadius: 0.004 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.18, y: 0.155, w: 0.64, h: 0.665, fill: '#FBF8F2', cornerRadius: 0.008, behind: true },
    ],
    textLayers: [
      { x: 0.1, y: 0.075, w: 0.5, h: 0.03, text: 'PHOTO DUMP', font: 'Work Sans', size: 0.015, color: '#A0895F', align: 'left', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0045 },
      { x: 0.44, y: 0.075, w: 0.5, h: 0.03, text: '07 · 26', font: 'Space Grotesk', size: 0.016, color: '#A0895F', align: 'right', valign: 'top', lineHeight: 1.2, tracking: 0.0016 },
      { x: 0.18, y: 0.715, w: 0.64, h: 0.09, text: 'sunday, unedited', font: 'Dancing Script', size: 0.045, color: '#3A2F22', align: 'center', valign: 'top', bold: true, lineHeight: 1 },
    ],
  },
  {
    id: 'the-weekend-edit', label: 'The Weekend Edit', category: 'photo',
    bg: { color: '#ECE7DD' },
    cells: [
      { x: 0.06, y: 0.27, w: 0.88, h: 0.4, cornerRadius: 0.012 },
      { x: 0.06, y: 0.695, w: 0.43, h: 0.235, cornerRadius: 0.012 },
      { x: 0.51, y: 0.695, w: 0.43, h: 0.235, cornerRadius: 0.012 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.06, y: 0.235, w: 0.88, h: 0.003, fill: '#CDBFA6' },
    ],
    textLayers: [
      { x: 0.06, y: 0.075, w: 0.88, h: 0.03, text: 'VOL. 07 — AUTUMN NOTES', font: 'Work Sans', size: 0.015, color: '#9C7B4E', align: 'center', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0039 },
      { x: 0.06, y: 0.11, w: 0.88, h: 0.11, text: 'The Weekend Edit', font: 'Cormorant Garamond', size: 0.066, color: '#24211C', align: 'center', valign: 'top', bold: true, lineHeight: 1 },
    ],
  },
  {
    id: 'contact-sheet', label: 'Contact Sheet', category: 'photo',
    bg: { color: '#131211' },
    cells: [
      { x: 0.06, y: 0.15, w: 0.43, h: 0.24, cornerRadius: 0.006 },
      { x: 0.51, y: 0.15, w: 0.43, h: 0.24, cornerRadius: 0.006 },
      { x: 0.06, y: 0.41, w: 0.43, h: 0.24, cornerRadius: 0.006 },
      { x: 0.51, y: 0.41, w: 0.43, h: 0.24, cornerRadius: 0.006 },
      { x: 0.06, y: 0.67, w: 0.43, h: 0.24, cornerRadius: 0.006 },
      { x: 0.51, y: 0.67, w: 0.43, h: 0.24, cornerRadius: 0.006 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.06, y: 0.115, w: 0.88, h: 0.003, fill: '#2E2B26' },
    ],
    textLayers: [
      { x: 0.06, y: 0.06, w: 0.6, h: 0.03, text: 'CONTACT SHEET', font: 'Space Grotesk', size: 0.02, color: '#C6A052', align: 'left', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.0036 },
      { x: 0.44, y: 0.065, w: 0.5, h: 0.03, text: 'ROLL 04 · 36 EXP', font: 'Space Grotesk', size: 0.016, color: '#7A756A', align: 'right', valign: 'top', lineHeight: 1.2, tracking: 0.00128 },
      { x: 0.06, y: 0.925, w: 0.88, h: 0.03, text: '// selects — keep six, cut the rest', font: 'Space Grotesk', size: 0.015, color: '#67635B', align: 'left', valign: 'top', lineHeight: 1.2, tracking: 0.0006 },
    ],
  },
  {
    id: 'in-frames-triptych', label: 'In Frames Triptych', category: 'photo',
    bg: { color: '#1A1815' },
    cells: [
      { x: 0.068, y: 0.238, w: 0.247, h: 0.47 },
      { x: 0.376, y: 0.238, w: 0.247, h: 0.47 },
      { x: 0.685, y: 0.238, w: 0.247, h: 0.47 },
    ],
    shapeLayers: [
      { shapeType: 'rect', x: 0.05, y: 0.22, w: 0.283, h: 0.56, fill: '#F3EEE4', cornerRadius: 0.004, behind: true },
      { shapeType: 'rect', x: 0.358, y: 0.22, w: 0.283, h: 0.56, fill: '#F3EEE4', cornerRadius: 0.004, behind: true },
      { shapeType: 'rect', x: 0.667, y: 0.22, w: 0.283, h: 0.56, fill: '#F3EEE4', cornerRadius: 0.004, behind: true },
    ],
    textLayers: [
      { x: 0.05, y: 0.11, w: 0.6, h: 0.03, text: 'IN FRAMES', font: 'Work Sans', size: 0.017, color: '#C6A052', align: 'left', valign: 'top', bold: true, lineHeight: 1.2, tracking: 0.00476 },
      { x: 0.55, y: 0.115, w: 0.4, h: 0.03, text: 'NO. 03', font: 'Space Grotesk', size: 0.015, color: '#7C766A', align: 'right', valign: 'top', lineHeight: 1.2, tracking: 0.0015 },
      { x: 0.08, y: 0.83, w: 0.84, h: 0.08, text: 'three ways to slow down', font: 'Cormorant Garamond', size: 0.042, color: '#EDE6D8', align: 'center', valign: 'top', italic: true, lineHeight: 1.15 },
    ],
  },
]

export const TEMPLATES = [...GRID_TEMPLATES, ...STYLED_TEMPLATES]

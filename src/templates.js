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
]

export const TEMPLATES = [...GRID_TEMPLATES, ...STYLED_TEMPLATES]

// Category tabs for the template browser. 'all' shows everything; 'grids' is the
// bare photo grids (templates with no explicit category); the rest map to the
// styled-template niches above.
export const TEMPLATE_CATEGORIES = [
  { id: 'all',         label: 'All' },
  { id: 'grids',       label: 'Grids' },
  { id: 'quotes',      label: 'Quotes' },
  { id: 'tips',        label: 'Tips' },
  { id: 'promo',       label: 'Promo' },
  { id: 'photo',       label: 'Photo' },
  { id: 'beforeafter', label: 'Before/After' },
]

// A template's niche. Bare grids carry no `category`, so they fall under 'grids'.
export function templateCategory(t) {
  return t.category ?? 'grids'
}

// True when a template carries designed content (text/shapes/background) beyond a
// bare photo grid. Drives whether the browser renders a live canvas preview
// (styled) or the cheap div-grid thumbnail (bare grid).
export function isStyledTemplate(t) {
  return !!(t.category || t.textLayers?.length || t.shapeLayers?.length || t.bg)
}

// Resolve a template's background for page `pageIdx` (0-based within the template)
// into a { bgColor } or { bgGradient } patch for that slide, or null if the
// template sets no background for that page. A single `bg` applies to all pages;
// an array indexes per page.
export function templatePageBg(template, pageIdx) {
  const bg = template.bg
  if (!bg) return null
  const entry = Array.isArray(bg) ? bg[pageIdx] : bg
  if (!entry) return null
  if (entry.gradient) return { bgGradient: entry.gradient, bgColor: undefined }
  if (entry.color) return { bgColor: entry.color, bgGradient: undefined }
  return null
}

// Convert a template's fractional definition into concrete global-space layers,
// mirroring the coordinate math applyTemplate/startProject use for grid cells:
// x is offset by `offsetX` (the starting slide's left edge) and scaled by page
// width; y/h by page height; text size/tracking and shape stroke/radius (stored
// as height fractions) by page height. Image cells share one `groupId` so photo
// fill spans every page of a multi-page template; text and shapes are free,
// individually-editable layers. Layer order (back→front): image cells, shapes,
// text. `mkId` mints ids (the store passes its own uid); `placeholderFill`, when
// set, emits image cells as filled gray rects instead of empty image cells (used
// by the browser preview, where renderSlide can't draw a src-less cell).
export function instantiateTemplate(template, ratio, offsetX, mkId, placeholderFill = null) {
  const layers = []
  const gx = f => Math.round(offsetX + f * ratio.w)
  const gy = f => Math.round(f * ratio.h)
  const gw = f => Math.round(f * ratio.w)
  const gh = f => Math.round(f * ratio.h)

  const groupId = mkId()
  for (const cell of template.cells ?? []) {
    if (placeholderFill) {
      layers.push({
        id: mkId(), type: 'shape', shapeType: 'rect',
        x: gx(cell.x), y: gy(cell.y), w: gw(cell.w), h: gh(cell.h),
        fill: placeholderFill, stroke: null, strokeWidth: 0, cornerRadius: 0, opacity: 1,
      })
    } else {
      layers.push({
        id: mkId(), type: 'image', locked: true, groupId, src: null,
        x: gx(cell.x), y: gy(cell.y), w: gw(cell.w), h: gh(cell.h),
        imgX: 0, imgY: 0, imgScale: 1, opacity: 1, naturalW: null, naturalH: null, cellGap: 0,
      })
    }
  }

  for (const sh of template.shapeLayers ?? []) {
    layers.push({
      id: mkId(), type: 'shape', shapeType: sh.shapeType ?? 'rect',
      x: gx(sh.x), y: gy(sh.y), w: gw(sh.w), h: gh(sh.h),
      fill: sh.fill ?? '#000000',
      stroke: sh.stroke ?? null,
      strokeWidth: sh.strokeWidth ? Math.round(sh.strokeWidth * ratio.h) : 0,
      cornerRadius: sh.cornerRadius ? Math.round(sh.cornerRadius * ratio.h) : 0,
      opacity: sh.opacity ?? 1,
    })
  }

  for (const t of template.textLayers ?? []) {
    layers.push({
      id: mkId(), type: 'text',
      x: gx(t.x), y: gy(t.y), w: gw(t.w), h: gh(t.h),
      text: t.text ?? '',
      fontFamily: t.font ?? 'Inter',
      fontSize: Math.max(1, Math.round((t.size ?? 0.06) * ratio.h)),
      bold: t.bold ?? false,
      italic: t.italic ?? false,
      color: t.color ?? '#000000',
      align: t.align ?? 'center',
      verticalAlign: t.valign ?? 'middle',
      lineHeight: t.lineHeight ?? 1.2,
      letterSpacing: t.tracking ? Math.round(t.tracking * ratio.h) : 0,
      opacity: t.opacity ?? 1,
      ...(t.textBg ? { textBg: t.textBg, textBgOpacity: t.textBgOpacity ?? 1 } : {}),
    })
  }

  return { layers, groupId }
}

// Distinct font families a template's text layers reference — for preloading the
// web fonts on apply so the styled text renders in its real face immediately.
export function templateFontFamilies(template) {
  const fams = new Set()
  for (const t of template.textLayers ?? []) if (t.font) fams.add(t.font)
  return [...fams]
}

export const RATIOS = [
  { label: 'Portrait', value: '4:5',    w: 1080, h: 1350 },
  { label: 'Portrait', value: '3:4',    w: 1080, h: 1440 },
  { label: 'Square',   value: '1:1',    w: 1080, h: 1080 },
  { label: 'Story',    value: '9:16',   w: 1080, h: 1920 },
  { label: 'Landscape',value: '1.91:1', w: 1080, h: 566  },
]

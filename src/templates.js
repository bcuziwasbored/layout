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

export const TEMPLATES = [
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

export const RATIOS = [
  { label: 'Portrait', value: '4:5',    w: 1080, h: 1350 },
  { label: 'Portrait', value: '3:4',    w: 1080, h: 1440 },
  { label: 'Square',   value: '1:1',    w: 1080, h: 1080 },
  { label: 'Story',    value: '9:16',   w: 1080, h: 1920 },
  { label: 'Landscape',value: '1.91:1', w: 1080, h: 566  },
]

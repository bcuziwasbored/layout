// Torture-test project for the editor↔export parity suite (issue #93).
//
// Plain ESM with no DOM dependency: imported BOTH by the browser harness
// (test/parity/harness.jsx) and by the Node runner (test/parity/run.mjs), so the
// cases and their tolerances are declared exactly once.
//
// Each case is a miniature project — slides + layers + background — rendered
// twice at scale 1:
//   • through the REAL editor components (TextCell / ShapeCell / FilledCell from
//     src/components/Canvas.jsx) inside a Konva Stage, and
//   • through src/renderSlide.js, the canvas2d exporter,
// then diffed pixel-for-pixel. See harness.jsx for the metric definitions.

import { fitInCell } from '../../src/ratioMigrate.js'

// Slide box for every case. Deliberately smaller than the app's 1080×1350 so a
// full pass stays fast; all geometry below is sized to fill it, which keeps the
// per-case diff sensitive (content covers most of the frame).
export const RATIO = { w: 600, h: 750 }

// ─── Fonts ─────────────────────────────────────────────────────────────────────
// One family for the whole suite: 'Inter', the app's own default, loaded through
// the app's real loader (fonts.js → Google Fonts) before ANY rendering happens.
// Rationale for CI stability:
//   • A generic keyword ('sans-serif') is NOT usable here: renderSlide quotes the
//     family ("sans-serif") while Konva does not, and a quoted generic is a family
//     name, not the generic — the two renderers would pick different fonts.
//   • A concrete family is safe either way: if Google Fonts is reachable both
//     renderers get Inter, and if it is not, both fall back to the same default.
//     The harness preloads + settles fonts and does a discarded warm-up pass
//     before measuring, so a font can never arrive between the two renders.
export const PARITY_FONT = 'Inter'

// ─── Test image ────────────────────────────────────────────────────────────────
// Layers reference PHOTO_SRC; the harness swaps in a procedurally generated data
// URL of exactly PHOTO_W×PHOTO_H (no network, byte-identical every run).
export const PHOTO_SRC = 'parity://photo'
export const PHOTO_W = 800
export const PHOTO_H = 600

// Cover-fit helper using the app's own fitInCell, so image layers are positioned
// the way the editor positions them.
function photo(id, x, y, w, h, extra = {}) {
  const gap = extra.cellGap ?? 0
  const fit = fitInCell(PHOTO_W, PHOTO_H, w - gap, h - gap)
  return {
    id, type: 'image', x, y, w, h,
    src: PHOTO_SRC, naturalW: PHOTO_W, naturalH: PHOTO_H,
    ...fit, ...extra,
  }
}

function text(id, extra = {}) {
  return {
    id, type: 'text',
    x: 40, y: 60, w: 520, h: 630,
    fontFamily: PARITY_FONT, fontSize: 52, color: '#111111',
    align: 'center', verticalAlign: 'middle', lineHeight: 1.25,
    ...extra,
  }
}

const ONE_SLIDE = [{ id: 's0' }]

// ─── Tolerances ────────────────────────────────────────────────────────────────
// Two assertions per case (both must hold):
//   meanTol  — mean per-channel |diff| over the whole frame, counting only
//              differences above NOISE_FLOOR (see harness.jsx). The floor exists
//              because the editor draws a 1%-alpha hit rectangle over every layer
//              that the exporter (correctly) does not — a uniform ~2.5/255 offset
//              that would otherwise swamp the metric.
//   pctTol   — % of pixels where any channel differs by more than VISIBLE_DIFF
//              (24/255). This is the assertion that catches geometry shifts.
// Values are calibrated against main with ≳4× headroom; a 2px text-baseline
// offset in renderSlide moves the text cases 1-2 orders of magnitude past them
// (see `npm run test:parity:regression`).
export const CASES = [
  {
    id: 'text-wrapped',
    name: 'Wrapped multi-line text',
    meanTol: 0.20, pctTol: 0.10,
    text: true,
    bgColor: '#f4f1ea',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-wrap', {
      text: 'Wrapped multi-line text that has to break at exactly the same words in the editor and in the export, every single time.',
    })],
  },
  {
    id: 'text-letterspaced',
    name: 'Letter-spaced text',
    meanTol: 0.20, pctTol: 0.10,
    text: true,
    bgColor: '#ffffff',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-ls', {
      text: 'TRACKED OUT\nLETTER SPACING',
      letterSpacing: 9, bold: true, fontSize: 46,
      align: 'left', verticalAlign: 'top',
    })],
  },
  {
    id: 'text-shadow',
    name: 'Text with drop shadow',
    meanTol: 0.20, pctTol: 0.10,
    text: true,
    bgColor: '#e8eef7',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-sh', {
      text: 'Shadowed\nheadline',
      fontSize: 76, bold: true, color: '#ffffff',
      shadowColor: '#1b2a4a', shadowBlur: 14,
      shadowOffsetX: 8, shadowOffsetY: 10, shadowOpacity: 0.65,
    })],
  },
  {
    id: 'text-outline',
    name: 'Text with outline',
    meanTol: 0.20, pctTol: 0.10,
    text: true,
    bgColor: '#101014',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-out', {
      text: 'OUTLINED\nTYPE',
      fontSize: 84, bold: true, color: '#ffffff',
      textStroke: '#e11d48', textStrokeWidth: 5,
    })],
  },
  {
    id: 'text-shadow-outline',
    name: 'Text with outline + shadow (buffer-canvas path)',
    meanTol: 0.20, pctTol: 0.10,
    text: true,
    bgColor: '#fdf6e3',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-so', {
      text: 'BOTH\nEFFECTS',
      fontSize: 84, bold: true, color: '#facc15',
      textStroke: '#111827', textStrokeWidth: 6,
      shadowColor: '#111827', shadowBlur: 18,
      shadowOffsetX: 10, shadowOffsetY: 12, shadowOpacity: 0.55,
    })],
  },
  {
    id: 'text-curved',
    name: 'Curved text (120° arc, letter-spaced)',
    // Curved text is drawn glyph-by-glyph under a per-glyph rotation in BOTH
    // renderers — the same call sequence on both sides, so despite the rotated
    // antialiasing it measures 0.000/0.000 like the straight text cases and holds
    // their tolerance. A 2px shift of the export-side arc origin takes it to
    // mean 1.76 / pct>24 1.27 (`--inject curved-text-origin`), so a one-glyph
    // placement error — wrong radius, dropped letterSpacing, flipped sign —
    // blows through this by an order of magnitude.
    meanTol: 0.20, pctTol: 0.10,
    curvedText: true,
    bgColor: '#f4f1ea',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-arc', {
      text: 'CURVED HEADLINE',
      textArc: 120, letterSpacing: 8, bold: true, fontSize: 54,
    })],
  },
  {
    id: 'text-curved-effects',
    name: 'Curved text with outline + shadow (buffer-canvas path)',
    // Negative arc (∪) plus the fill+stroke+shadow combination that sends BOTH
    // renderers through their buffer canvas: Konva's Shape._useBufferCanvas on
    // the editor side, renderTextLayer's own buffer on the export side. Proves
    // the shadow is cast once from the whole curved word in both. Measures
    // 0.000/0.000; the origin injection takes it to mean 2.10 / pct>24 2.17.
    meanTol: 0.20, pctTol: 0.10,
    curvedText: true,
    bgColor: '#fdf6e3',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [text('t-arc-fx', {
      text: 'BENT & BOLD',
      textArc: -150, fontSize: 72, bold: true, color: '#facc15',
      letterSpacing: 3,
      textStroke: '#111827', textStrokeWidth: 6,
      shadowColor: '#111827', shadowBlur: 18,
      shadowOffsetX: 10, shadowOffsetY: 12, shadowOpacity: 0.55,
    })],
  },
  {
    id: 'image-star-border',
    name: 'Star-shaped image with border',
    meanTol: 0.15, pctTol: 0.10,
    bgColor: '#0f172a',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [photo('i-star', 60, 135, 480, 480, {
      shape: 'star', borderWidth: 10, borderColor: '#f8fafc',
    })],
  },
  {
    id: 'image-rotated',
    name: 'Rotated image (rounded corners)',
    meanTol: 0.25, pctTol: 0.50,
    bgColor: '#f8fafc',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [photo('i-rot', 90, 135, 420, 480, {
      freeRotation: 17, cornerRadius: 24, cellGap: 16,
    })],
  },
  {
    id: 'image-adjusted',
    name: 'Adjusted image (temperature + vignette)',
    meanTol: 0.15, pctTol: 0.10,
    bgColor: '#ffffff',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [photo('i-adj', 50, 135, 500, 480, {
      temperature: 45, vignette: 55,
    })],
  },
  {
    id: 'shapes-fill-stroke',
    name: 'Star + heart shapes with fill and stroke',
    meanTol: 0.35, pctTol: 0.10,
    bgColor: '#fef3c7',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [
      {
        id: 's-star', type: 'shape', shapeType: 'star',
        x: 40, y: 80, w: 300, h: 300,
        fill: '#2563eb', stroke: '#0f172a', strokeWidth: 12,
      },
      {
        id: 's-heart', type: 'shape', shapeType: 'heart',
        x: 250, y: 380, w: 320, h: 320,
        fill: '#f43f5e', stroke: '#111827', strokeWidth: 14, opacity: 0.9,
      },
    ],
  },
  {
    id: 'shape-shadow',
    name: 'Shape with drop shadow',
    meanTol: 0.15, pctTol: 0.1,
    bgColor: '#ecfeff',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [{
      id: 's-shadow', type: 'shape', shapeType: 'blob',
      x: 90, y: 175, w: 400, h: 400,
      fill: '#10b981', strokeWidth: 0,
      shadowEnabled: true, shadowColor: '#0f172a', shadowOpacity: 0.5,
      shadowBlur: 26, shadowOffsetX: 12, shadowOffsetY: 16,
    }],
  },
  {
    id: 'shape-shadow-stroked',
    name: 'Stroked shape with drop shadow (buffer-canvas path)',
    // Konva renders a fill+stroke+shadow shape through a buffer canvas and casts
    // ONE shadow from the COMPOSITE (fill ∪ stroke) silhouette. renderShapeLayer
    // used to cast the shadow from the FILL only and stroke on top afterwards,
    // making the exported shadow half a stroke-width small (mean 0.569, peaks at
    // 18/255 — issue #100). Now that the exporter mirrors Konva's buffer, this
    // case holds the SAME tight tolerance as its unstroked twin `shape-shadow`,
    // so any regression back to the fill-only silhouette fails the suite.
    meanTol: 0.15, pctTol: 0.1,
    bgColor: '#ecfeff',
    slides: ONE_SLIDE, slideIdx: 0,
    layers: [{
      id: 's-shadow-str', type: 'shape', shapeType: 'blob',
      x: 90, y: 175, w: 400, h: 400,
      fill: '#10b981', stroke: '#064e3b', strokeWidth: 8,
      shadowEnabled: true, shadowColor: '#0f172a', shadowOpacity: 0.5,
      shadowBlur: 26, shadowOffsetX: 12, shadowOffsetY: 16,
    }],
  },
  {
    id: 'gradient-background',
    name: 'Gradient background + text',
    // NOTE: the app has no gradient TEXT fill (text takes a solid colour only —
    // see TextCell in Canvas.jsx), so the gradient case covers the slide
    // background, which is the only gradient either renderer draws.
    meanTol: 0.20, pctTol: 0.10,
    text: true,
    bgColor: '#000000',
    slides: [{ id: 's0', bgGradient: { angle: 35, stops: ['#ff9a3c', '#1e3a8a'] } }],
    slideIdx: 0,
    layers: [text('t-grad', {
      text: 'Gradient\nbackdrop',
      fontSize: 78, bold: true, color: '#ffffff',
    })],
  },
  {
    id: 'seam-span',
    name: 'Cross-slide image sliced at the seam',
    meanTol: 0.15, pctTol: 0.10,
    bgColor: '#111827',
    slides: [{ id: 's0' }, { id: 's1' }],
    // Rendered as slide 1: the layer starts inside slide 0 and is cut by the
    // seam, so this exercises renderSlide's slice/cellGap-inset handling.
    slideIdx: 1,
    layers: [photo('i-seam', 380, 165, 520, 420, {
      cellGap: 24, cornerRadius: 18, borderWidth: 6, borderColor: '#f9fafb',
    })],
  },
]

// Cases whose pixels depend on STRAIGHT text layout — the ones a baseline/metrics
// regression in renderSlide's straight path must break. Used by the
// negative-control run (`npm run test:parity:regression`).
//
// Curved cases are deliberately NOT in this list: they never execute the straight
// path's baseline expression, so the straight-text injection cannot move them.
// They have their own negative control — see CURVED_TEXT_CASE_IDS below and the
// `curved-text-origin` injection in run.mjs.
export const TEXT_CASE_IDS = CASES.filter(c => c.text).map(c => c.id)

// Cases that exercise the curved (arc) text path in both renderers.
export const CURVED_TEXT_CASE_IDS = CASES.filter(c => c.curvedText).map(c => c.id)

// Shared image-adjustment pipeline (issue #61).
//
// Single source of truth for BOTH the editor (Canvas.jsx / useAdjustedImage +
// FilledCell) and the export path (renderSlide.js). Keeping the filter-string
// builder and the overlay drawing here — imported by both — guarantees an
// adjustment applied in the editor exports pixel-identically (the #3 fidelity
// standard).
//
// Two mechanisms:
//   1. CSS filter string (buildFilterString) — brightness / contrast /
//      saturation (pre-existing) plus temperature / tint (new). Applied via
//      ctx.filter in both paths.
//   2. Canvas overlays (drawAdjustmentOverlays) — vignette (radial-gradient
//      darkening) and grain (a tiled, pre-generated deterministic noise canvas).
//      These can't be expressed as CSS filters, so both paths draw them the same
//      way over the same cell rectangle.
//
// This module has NO top-level browser dependency (the noise tile is generated
// lazily on first use) so it is safe to import from Node test runners via useStore.

// The full set of per-image adjustment props. Used for reset, preset apply, and
// the "apply to all slides" store action. Every one defaults to 0.
export const ADJUSTMENT_PROPS = [
  'brightness', 'contrast', 'saturation', 'temperature', 'tint', 'vignette', 'grain',
]

const round = (n) => {
  // Trim to 4 decimals and drop trailing zeros so filter strings stay compact
  // and — crucially — deterministic (identical input → identical string) across
  // the editor and export call sites.
  return parseFloat(n.toFixed(4)).toString()
}

// ─── Temperature / tint → CSS filter approximation ──────────────────────────────
//
// True white-balance is a per-channel matrix op; CSS filters can't do that, so we
// approximate with sepia / saturate / hue-rotate (the approach called out in the
// issue). Documented formulas (t normalized to u = t/100 ∈ [-1, 1]):
//
//   TEMPERATURE (blue↔yellow axis):
//     warm (u > 0):  sepia(0.5·u) saturate(1 + 0.3·u) hue-rotate(-12·u deg)
//        sepia lays a warm/orange cast over neutrals; the small negative
//        hue-rotate biases it toward golden-red; saturate keeps colour lively.
//     cool (u < 0, a = -u):  saturate(1 + 0.2·a) hue-rotate(18·a deg)
//        No sepia (sepia can only warm). A small positive hue-rotate slides
//        existing hues toward cyan/blue and saturate stops them graying out.
//        This is a hue-rotate approximation — it cools existing colour rather
//        than adding blue to a pure neutral (CSS filters can't do the latter
//        cheaply). Continuous at u = 0 (both sides → identity).
//
//   TINT (green↔magenta axis), positive = magenta, negative = green:
//     hue-rotate(-20·u deg) saturate(1 + 0.15·|u|)
//        Positive rotates reds toward magenta; negative toward green. saturate
//        keeps the shift visible. Continuous at u = 0 (→ identity).
//
// Because everything is expressed as multiplicative filter functions that reduce
// to identity at 0, buildFilterString can concatenate them with the existing
// brightness/contrast/saturation without changing the zero-adjustment output.

function tempFilterParts(t) {
  const u = (t ?? 0) / 100
  if (!u) return []
  if (u > 0) {
    return [
      `sepia(${round(0.5 * u)})`,
      `saturate(${round(1 + 0.3 * u)})`,
      `hue-rotate(${round(-12 * u)}deg)`,
    ]
  }
  const a = -u
  return [
    `saturate(${round(1 + 0.2 * a)})`,
    `hue-rotate(${round(18 * a)}deg)`,
  ]
}

function tintFilterParts(t) {
  const u = (t ?? 0) / 100
  if (!u) return []
  return [
    `hue-rotate(${round(-20 * u)}deg)`,
    `saturate(${round(1 + 0.15 * Math.abs(u))})`,
  ]
}

// Build the full ctx.filter string for a layer's adjustment values. Returns ''
// when nothing is set (caller treats that as "draw the image untouched"). The
// brightness/contrast/saturation prefix is byte-identical to the pre-#61 string
// when temperature/tint are 0, so existing exports are unaffected.
export function buildFilterString(layer) {
  const b = layer.brightness ?? 0
  const c = layer.contrast ?? 0
  const s = layer.saturation ?? 0
  const parts = []
  if (b) parts.push(`brightness(${round(1 + b / 100)})`)
  if (c) parts.push(`contrast(${round(1 + c / 100)})`)
  if (s) parts.push(`saturate(${round(1 + s / 100)})`)
  parts.push(...tempFilterParts(layer.temperature))
  parts.push(...tintFilterParts(layer.tint))
  return parts.join(' ')
}

// True when any CSS-filter adjustment is non-default (so the image itself must be
// re-rasterized through a filter). Vignette/grain are NOT included here — they are
// overlays drawn on top of an unfiltered image.
export function hasCssFilter(layer) {
  return !!(layer.brightness || layer.contrast || layer.saturation ||
    layer.temperature || layer.tint)
}

// True when a vignette or grain overlay must be drawn over the cell.
export function hasOverlay(layer) {
  return !!(layer.vignette || layer.grain)
}

// True when the layer has any adjustment at all (filter or overlay).
export function hasAnyAdjustment(layer) {
  return hasCssFilter(layer) || hasOverlay(layer)
}

// ─── Deterministic grain tile ───────────────────────────────────────────────────
// A single small grayscale-noise canvas, generated ONCE with a seeded PRNG (never
// Math.random per frame — see issue #16 memory discipline). Tiled via createPattern
// wherever grain is drawn. Generated lazily so this module stays Node-safe.

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOISE_TILE_SIZE = 96
let _noiseTile = null

export function getNoiseTile() {
  if (_noiseTile) return _noiseTile
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = NOISE_TILE_SIZE
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(NOISE_TILE_SIZE, NOISE_TILE_SIZE)
  const rand = mulberry32(0x9e3779b9) // fixed seed → identical tile every run
  for (let i = 0; i < NOISE_TILE_SIZE * NOISE_TILE_SIZE; i++) {
    const v = (rand() * 256) | 0
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  _noiseTile = c
  return c
}

// Draw vignette + grain over the rectangle (x, y, w, h) on a 2D context. Shared by
// the editor (via a Konva Shape sceneFunc, passing the underlying native context)
// and export (renderSlide). Fully self-contained (save/restore); multiplies its
// own alpha by the incoming ctx.globalAlpha so layer opacity is respected.
export function drawAdjustmentOverlays(ctx, x, y, w, h, layer) {
  const vig = layer.vignette ?? 0
  const grain = layer.grain ?? 0
  const base = ctx.globalAlpha ?? 1

  if (vig > 0) {
    ctx.save()
    const cx = x + w / 2
    const cy = y + h / 2
    const outer = Math.hypot(w, h) / 2
    const inner = outer * 0.55
    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${round((vig / 100) * 0.85)})`)
    ctx.globalAlpha = base
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }

  if (grain > 0) {
    const tile = getNoiseTile()
    if (tile) {
      const pat = ctx.createPattern(tile, 'repeat')
      if (pat) {
        ctx.save()
        ctx.globalAlpha = base * (grain / 100) * 0.5
        // 'overlay' keeps mid-gray (128) a no-op, so grain adds contrast texture
        // without washing the image toward gray.
        ctx.globalCompositeOperation = 'overlay'
        ctx.fillStyle = pat
        ctx.fillRect(x, y, w, h)
        ctx.restore()
      }
    }
  }
}

// ─── One-tap filter presets ─────────────────────────────────────────────────────
// Each preset is a NAMED, complete adjustment set — tapping it overwrites every
// prop in ADJUSTMENT_PROPS (missing keys read as 0 via presetAdjust). Defining the
// full set keeps preset thumbnails, applied looks, and "apply to all" consistent.

export const FILTER_PRESETS = [
  { id: 'original', name: 'Original', adjust: {} },
  { id: 'warmfilm', name: 'Warm Film', adjust: { temperature: 35, contrast: 10, saturation: 8, vignette: 20, grain: 25 } },
  { id: 'coolfade', name: 'Cool Fade', adjust: { temperature: -30, contrast: -12, brightness: 8, saturation: -10, vignette: 10 } },
  { id: 'bw', name: 'B&W', adjust: { saturation: -100, contrast: 25 } },
  { id: 'noir', name: 'Noir', adjust: { saturation: -100, contrast: 40, brightness: -5, vignette: 40, grain: 20 } },
  { id: 'vivid', name: 'Vivid', adjust: { saturation: 35, contrast: 15 } },
  { id: 'golden', name: 'Golden', adjust: { temperature: 45, saturation: 12, brightness: 5 } },
  { id: 'matte', name: 'Matte', adjust: { contrast: -18, brightness: 6, saturation: -8 } },
  { id: 'moody', name: 'Moody', adjust: { brightness: -8, contrast: 20, saturation: -12, vignette: 35 } },
  { id: 'vintage', name: 'Vintage', adjust: { temperature: 25, tint: 15, saturation: -15, contrast: -8, vignette: 25, grain: 30 } },
  { id: 'fresh', name: 'Fresh', adjust: { brightness: 10, saturation: 18, temperature: -8 } },
  { id: 'portrait', name: 'Portrait', adjust: { contrast: 8, saturation: 6, temperature: 12, vignette: 15 } },
  { id: 'cinematic', name: 'Cinematic', adjust: { temperature: -12, tint: -8, contrast: 18, saturation: -6, vignette: 30 } },
]

// A preset's adjustment set expanded to the full prop list (missing keys = 0).
export function presetAdjust(preset) {
  const out = {}
  for (const k of ADJUSTMENT_PROPS) out[k] = preset.adjust[k] ?? 0
  return out
}

// True when the layer's current adjustment values equal this preset's — used to
// highlight the active preset chip.
export function presetMatches(layer, preset) {
  const a = presetAdjust(preset)
  return ADJUSTMENT_PROPS.every(k => (layer[k] ?? 0) === a[k])
}

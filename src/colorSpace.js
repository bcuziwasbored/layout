// Wide-gamut (Display-P3) canvas plumbing — issue #109.
//
// Every 2D canvas in the app used to be created with the default sRGB colour
// space, so a Display-P3 source (i.e. every photo an iPhone takes) was
// gamut-clipped the first time it touched a canvas: at import, again in the
// editor, and again at export. Saturated reds/greens flattened out and there was
// no way to get them back.
//
// The fix is one shared accessor. Every canvas that touches PHOTO pixels asks
// for its context through `get2dContext`, which hands back a `display-p3`
// context where the browser supports one (Safari 15.4+, Chrome 94+) and a
// plain sRGB context everywhere else. Support is probed once and cached.
//
// Non-photo canvases (hit-testing, UI swatches, the Konva scene graph) are
// deliberately left alone — see the Konva note at the bottom of this file.

// ─── Support detection ─────────────────────────────────────────────────────────
// A browser that doesn't know the `colorSpace` attribute silently ignores it and
// returns an sRGB context, so asking for one is not enough: the answer has to be
// read back off the context itself.

let _p3Supported = null

export function supportsDisplayP3() {
  if (_p3Supported !== null) return _p3Supported
  _p3Supported = false
  if (typeof document === 'undefined') return false
  try {
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    const ctx = probe.getContext('2d', { colorSpace: 'display-p3' })
    _p3Supported = !!ctx && ctx.getContextAttributes?.().colorSpace === 'display-p3'
  } catch {
    _p3Supported = false
  }
  return _p3Supported
}

// ─── sRGB escape hatch ─────────────────────────────────────────────────────────
// The editor↔export parity suite (test/parity) diffs a Konva-rendered bitmap
// against a renderSlide-rendered one. Konva has no colour-space knob (see below),
// so its layer canvas is always sRGB; if the exporter went P3 the two sides would
// be compared across colour spaces and every diff would be meaningless.
//
// `setForceSRGB(true)` pins the whole pipeline back to sRGB so both sides of the
// comparison live in the same space. It is also how test/colorspace.test.mjs
// measures the OLD behaviour — the forced-sRGB run is the control that the P3 run
// is scored against, which doubles as proof that the fallback path is unchanged.
//
// Not wired to any UI: tests and the app's own boot code are the only callers.

let _forceSRGB = false

export function setForceSRGB(force) {
  _forceSRGB = !!force
}

export function isForceSRGB() {
  return _forceSRGB
}

// The colour space photo canvases are currently being created in — 'display-p3'
// or 'srgb'. Exported so callers can log/inspect it without duplicating the
// support+override precedence.
export function photoColorSpace() {
  return (!_forceSRGB && supportsDisplayP3()) ? 'display-p3' : 'srgb'
}

/**
 * Get a 2D context for a canvas that carries photo pixels.
 *
 * Behaves exactly like `canvas.getContext('2d', opts)` except that it requests
 * `colorSpace: 'display-p3'` when the browser supports it and forceSRGB is off.
 * A canvas only ever has ONE context, so calling this twice on the same canvas
 * returns the same context (with the attributes from the first call) — same as
 * the native API.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {CanvasRenderingContext2DSettings} [opts] - forwarded verbatim
 * @returns {CanvasRenderingContext2D}
 */
export function get2dContext(canvas, opts) {
  if (photoColorSpace() === 'display-p3') {
    try {
      const ctx = canvas.getContext('2d', { ...(opts ?? {}), colorSpace: 'display-p3' })
      if (ctx) return ctx
    } catch {
      // A browser that throws on unknown context attributes falls through to sRGB.
    }
  }
  return opts ? canvas.getContext('2d', opts) : canvas.getContext('2d')
}

// ─── Konva (editor preview) ────────────────────────────────────────────────────
// Konva 10.3 gives no way in: Layer builds its scene canvas as `new SceneCanvas()`
// with no config (konva/lib/Layer.js), SceneCanvas forwards only `willReadFrequently`
// to SceneContext, and SceneContext hardcodes
//     canvas._canvas.getContext('2d', { willReadFrequently })
// (konva/lib/Context.js). There is no colorSpace pass-through at any level, so the
// only way to force one would be to monkey-patch Konva internals — not something
// worth carrying across Konva upgrades for a preview surface.
//
// The editor preview therefore stays sRGB and the EXPORT carries P3, which is the
// tradeoff issue #109 calls acceptable: the exported file is the product. Photos
// still LOOK right while editing (Chrome/Safari colour-manage the P3 source down
// to the preview's sRGB canvas the same way they always did) — the wide-gamut
// values are simply not preserved in the on-screen copy.

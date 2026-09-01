// Qualification + seam-arithmetic tests for the HDR export path (issue #110).
// Run with: npx vite-node test/hdrslice.test.mjs
// Executes as a plain script — any failed assertion throws and exits non-zero.
//
// Two things are pinned here.
//
// 1. QUALIFICATION is a safety gate, not an optimisation. A slide that takes the
//    byte-crop path but shouldn't would export something that doesn't match what
//    the editor shows, so every rejection case below is a correctness test.
//
// 2. SEAM ARITHMETIC is what makes a split panorama look like one photo. Adjacent
//    slides must share the *same integer* edge, not two roundings that happen to
//    land together, and every slide must come out the same size or Instagram
//    drops HDR for the whole carousel.
import assert from 'node:assert/strict'
import { qualifyingHdrLayer, hdrSliceRect } from '../src/hdrSlice.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

const RATIO = { w: 1080, h: 1350 }
const SLIDES = [{ id: 's0' }, { id: 's1' }, { id: 's2' }]

// A three-slide seamless panorama: one photo spanning the whole canvas, sized to
// cover it exactly, with nothing else on any slide.
const panoLayer = (over = {}) => ({
  id: 'L0', imgId: 'IMG0', type: 'image',
  src: 'data:image/jpeg;base64,AAAA',
  hasGainMap: true, gainMapVariant: 'iso',
  x: 0, y: 0, w: RATIO.w * 3, h: RATIO.h,
  imgX: 0, imgY: 0, imgScale: 1,
  naturalW: RATIO.w * 3, naturalH: RATIO.h,
  ...over,
})

const ctx = (layers, over = {}) => ({
  slides: SLIDES, layers, ratio: RATIO, format: 'jpeg', ...over,
})

// ── Qualification: the happy path ─────────────────────────────────────────────

test('a full-bleed gain-map panorama qualifies on every slide', () => {
  const layers = [panoLayer()]
  for (let i = 0; i < SLIDES.length; i++) {
    assert.ok(qualifyingHdrLayer(i, ctx(layers)), `slide ${i} should qualify`)
  }
})

// ── Qualification: everything that must disqualify ────────────────────────────

const REJECT = {
  'a photo with no gain map': { hasGainMap: false },
  'a cell gap': { cellGap: 8 },
  'rounded corners': { cornerRadius: 12 },
  'a border': { borderWidth: 2, borderColor: '#fff' },
  'a non-rect shape': { shape: 'circle' },
  'a drop shadow': { shadowEnabled: true, shadowBlur: 10, shadowColor: '#000' },
  'cell rotation': { rotation: 90 },
  'free rotation': { freeRotation: 3 },
  'a horizontal flip': { flipH: true },
  'a vertical flip': { flipV: true },
  'reduced opacity': { opacity: 0.5 },
  'a brightness adjustment': { brightness: 0.2 },
  'a saturation adjustment': { saturation: 1.4 },
  'a vignette overlay': { vignette: 0.5 },
  'a grain overlay': { grain: 0.4 },
}
for (const [what, patch] of Object.entries(REJECT)) {
  test(`${what} disqualifies the slide`, () => {
    assert.equal(qualifyingHdrLayer(0, ctx([panoLayer(patch)])), null)
  })
}

test('a second layer anywhere on the slide disqualifies it', () => {
  const text = {
    id: 'T0', type: 'text', text: 'hello',
    x: 100, y: 100, w: 300, h: 80,
  }
  assert.equal(qualifyingHdrLayer(0, ctx([panoLayer(), text])), null)
  // ...but only for the slide it actually sits on.
  assert.ok(qualifyingHdrLayer(2, ctx([panoLayer(), text])))
})

test('a cell that does not cover the slide disqualifies it', () => {
  // Inset by a pixel on the left: the composited path would show background.
  assert.equal(qualifyingHdrLayer(0, ctx([panoLayer({ x: 1 })])), null)
  // Too short vertically.
  assert.equal(qualifyingHdrLayer(0, ctx([panoLayer({ h: RATIO.h - 1 })])), null)
})

test('an image panned off the slide disqualifies it', () => {
  // The cell covers the slide but the photo inside it does not.
  assert.equal(qualifyingHdrLayer(0, ctx([panoLayer({ imgX: 10 })])), null)
  assert.equal(qualifyingHdrLayer(2, ctx([panoLayer({ imgX: -10 })])), null)
  assert.equal(qualifyingHdrLayer(0, ctx([panoLayer({ imgY: 5 })])), null)
})

test('PNG output disqualifies every slide — a gain map needs a JPEG', () => {
  assert.equal(qualifyingHdrLayer(0, ctx([panoLayer()], { format: 'png' })), null)
})

test('a brand-kit logo stamp disqualifies every slide', () => {
  const withLogo = ctx([panoLayer()], { stampLogo: { src: 'x', naturalW: 10, naturalH: 10 } })
  assert.equal(qualifyingHdrLayer(0, withLogo), null)
})

test('a zoomed-in photo still qualifies as long as it covers the slide', () => {
  // Pan/zoom is fine — it changes WHERE we cut, not whether we can.
  const zoomed = panoLayer({ imgScale: 1.5, imgX: -200, imgY: -100 })
  assert.ok(qualifyingHdrLayer(1, ctx([zoomed])))
})

// ── Seam arithmetic ───────────────────────────────────────────────────────────

test('adjacent slices share one integer edge and are all the same size', () => {
  // A source whose width is NOT a clean multiple of the slide count — the case
  // where independent per-slide rounding would drift.
  const origW = 9997
  const origH = 1350
  const layer = panoLayer({ naturalW: 3240, naturalH: 1350 })
  const rects = SLIDES.map((_, i) => hdrSliceRect(layer, i, RATIO, origW, origH))
  for (const r of rects) assert.ok(r, 'every slide produces a rect')

  for (let i = 1; i < rects.length; i++) {
    assert.equal(
      rects[i - 1].x + rects[i - 1].w, rects[i].x,
      `slice ${i - 1} must end exactly where slice ${i} begins`,
    )
  }
  const widths = new Set(rects.map(r => r.w))
  const heights = new Set(rects.map(r => r.h))
  assert.equal(widths.size, 1, 'all slices must have identical width')
  assert.equal(heights.size, 1, 'all slices must have identical height')
})

test('the slice grid is anchored to the canvas, not to the slide', () => {
  // Slide i's rect must equal slide 0's rect shifted by i widths. This is the
  // property that makes the edges shared by construction.
  const layer = panoLayer({ naturalW: 3240, naturalH: 1350 })
  const r0 = hdrSliceRect(layer, 0, RATIO, 7777, 1350)
  for (let i = 1; i < 3; i++) {
    const r = hdrSliceRect(layer, i, RATIO, 7777, 1350)
    assert.equal(r.x, r0.x + i * r0.w)
    assert.equal(r.y, r0.y)
    assert.equal(r.w, r0.w)
    assert.equal(r.h, r0.h)
  }
})

test('slices map back onto the source at full resolution', () => {
  // naturalW is the downscaled preview size; the crop must address the ORIGINAL
  // pixels, so a 3x larger original means 3x larger slices.
  const layer = panoLayer({ naturalW: 3240, naturalH: 1350 })
  const small = hdrSliceRect(layer, 0, RATIO, 3240, 1350)
  const large = hdrSliceRect(layer, 0, RATIO, 9720, 4050)
  assert.equal(small.w, 1080)
  assert.equal(large.w, 3240, 'slice width scales with the original')
  assert.equal(large.h, 4050)
})

test('pan and zoom move the cut, and the whole grid moves with it', () => {
  const base = panoLayer({ naturalW: 3240, naturalH: 1350 })
  const panned = panoLayer({ naturalW: 3240, naturalH: 1350, imgX: -324 })
  const a = hdrSliceRect(base, 0, RATIO, 3240, 1350)
  const b = hdrSliceRect(panned, 0, RATIO, 3240, 1350)
  assert.equal(b.x - a.x, 324, 'panning left moves the crop right by the same amount')
  const zoomed = panoLayer({ naturalW: 3240, naturalH: 1350, imgScale: 2 })
  const z = hdrSliceRect(zoomed, 0, RATIO, 3240, 1350)
  assert.equal(z.w, 540, 'zooming in halves the source region a slide covers')
})

test('a slice that would fall outside the source is refused', () => {
  const layer = panoLayer({ naturalW: 3240, naturalH: 1350 })
  // The photo spans three slides exactly; a fourth runs off the end. Belt and
  // braces — qualification rejects this first — but the rect must never point
  // outside the bytes we are about to crop.
  assert.ok(hdrSliceRect(layer, 2, RATIO, 3240, 1350))
  assert.equal(hdrSliceRect(layer, 3, RATIO, 3240, 1350), null)
  // A photo panned so the grid starts left of the source's first column.
  assert.equal(hdrSliceRect(panoLayer({ naturalW: 3240, imgX: 100 }), 0, RATIO, 3240, 1350), null)
  // Degenerate inputs are refused rather than producing a nonsense rect.
  assert.equal(hdrSliceRect(layer, 0, RATIO, 0, 1350), null)
  assert.equal(hdrSliceRect(panoLayer({ imgScale: 0 }), 0, RATIO, 3240, 1350), null)
})

test('slices tile the source exactly, with no gap or overlap', () => {
  const layer = panoLayer({ naturalW: 3240, naturalH: 1350 })
  const origW = 3240
  const rects = SLIDES.map((_, i) => hdrSliceRect(layer, i, RATIO, origW, 1350))
  const covered = rects.reduce((a, r) => a + r.w, 0)
  assert.equal(rects[0].x, 0)
  assert.equal(covered, origW, 'the slices account for every source column')
  assert.equal(rects[rects.length - 1].x + rects[rects.length - 1].w, origW)
})

console.log(`\n${passed} HDR slice tests passed`)

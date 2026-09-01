// Deciding which export slides can keep their HDR, and where to cut them
// (issue #110).
//
// The composited export path draws everything through a canvas, which is where
// HDR dies: Safari has no HDR canvas, so a gain map cannot survive being drawn.
// The one case that doesn't need compositing is a slide that is nothing but a
// full-bleed slice of a single photo — the Seamless Panorama template's whole
// premise. For those we crop the photo's original bytes instead (hdrCrop.js) and
// the gain map comes through intact.
//
// Everything here is pure and synchronous so the export screen can ask "which
// slides qualify?" without touching bytes, and so the seam arithmetic can be
// tested directly rather than inferred from rendered output.

import { buildFilterString, hasOverlay } from './adjustments'
import { hasShadow } from './shadow'

/** Layers that intersect slide `slideIdx`, matching renderSlide's own filter. */
function layersOnSlide(slideIdx, layers, ratio) {
  const sliceStart = slideIdx * ratio.w
  const sliceEnd = (slideIdx + 1) * ratio.w
  return layers.filter((l) => {
    if (!l.src && l.type !== 'text' && l.type !== 'shape') return false
    const fr = l.freeRotation ?? 0
    if (!fr) return l.x < sliceEnd && l.x + l.w > sliceStart
    const t = Math.abs(fr) * Math.PI / 180
    const cx = l.x + l.w / 2
    const extHalfW = (Math.abs(l.w * Math.cos(t)) + Math.abs(l.h * Math.sin(t))) / 2
    return cx - extHalfW < sliceEnd && cx + extHalfW > sliceStart
  })
}

/**
 * Can slide `slideIdx` be produced by cropping one photo's original bytes?
 *
 * Every condition here exists because violating it would make the byte crop
 * differ from what the editor shows. The rule is deliberately strict: anything
 * we are not certain reproduces exactly falls back to the composited SDR path,
 * which is always correct.
 *
 * @returns {Object|null} the qualifying image layer, or null
 */
export function qualifyingHdrLayer(slideIdx, { layers, ratio, stampLogo, format }) {
  // The output has to be a JPEG — a gain map has nowhere to live in a PNG.
  if (format && format !== 'jpeg') return null
  // A brand-kit logo is compositing by definition.
  if (stampLogo) return null

  const onSlide = layersOnSlide(slideIdx, layers, ratio)
  // Exactly one layer, and it must be a photo. Anything else on the slide —
  // text, a sticker, a second cell — means real compositing.
  if (onSlide.length !== 1) return null
  const layer = onSlide[0]
  if (!layer.src || layer.type === 'text' || layer.type === 'shape') return null

  // The photo must be one we know carries a gain map (flagged at import).
  if (!layer.hasGainMap) return null

  const sliceStart = slideIdx * ratio.w
  const sliceEnd = (slideIdx + 1) * ratio.w

  // The cell must cover the whole slide, edge to edge, with nothing behind it.
  if (!(layer.x <= sliceStart && layer.x + layer.w >= sliceEnd)) return null
  if (!(layer.y <= 0 && layer.y + layer.h >= ratio.h)) return null

  // Cell decoration would all have to be composited.
  if ((layer.cellGap ?? 0) !== 0) return null
  if ((layer.cornerRadius ?? 0) !== 0) return null
  if ((layer.borderWidth ?? 0) !== 0) return null
  if ((layer.shape ?? 'rect') !== 'rect') return null
  if (hasShadow(layer)) return null

  // Any geometric transform would need resampling, and resampling is exactly
  // what the seam guarantee forbids.
  if ((layer.rotation ?? 0) !== 0) return null
  if ((layer.freeRotation ?? 0) !== 0) return null
  if (layer.flipH || layer.flipV) return null

  // Adjustments and opacity change pixels.
  if ((layer.opacity ?? 1) !== 1) return null
  if (buildFilterString(layer)) return null
  if (hasOverlay(layer)) return null

  // The image itself must cover the slide, or we'd be cropping past its edge and
  // exposing background the composited path would have drawn.
  const imgScale = layer.imgScale ?? 1
  const logW = layer.naturalW
  const logH = layer.naturalH
  if (!(imgScale > 0) || !(logW > 0) || !(logH > 0)) return null
  const absX = layer.x + (layer.imgX ?? 0)
  const absY = layer.y + (layer.imgY ?? 0)
  if (absX > sliceStart || absX + logW * imgScale < sliceEnd) return null
  if (absY > 0 || absY + logH * imgScale < ratio.h) return null

  return layer
}

/**
 * The crop rectangle, in the ORIGINAL file's pixels, for one slide.
 *
 * Two properties matter and both come from the same construction:
 *
 *  - **Seam-exact.** Slice starts are `x0 + i * sliceW` off a single anchor
 *    derived from the canvas origin, so slide i's right edge IS slide i+1's left
 *    edge — the same integer, not two roundings that happen to agree.
 *  - **Uniform size.** Every slide gets identical dimensions. Rounding each
 *    slide's edges independently would let widths differ by a pixel, and
 *    Instagram drops HDR for a whole carousel whose images aren't all the same
 *    size. The cost is that the cut can sit up to a pixel from the mathematically
 *    ideal edge, which is invisible and, unlike a gap at a seam, harmless.
 *
 * `naturalW/H` are the layer's logical (possibly downscaled-for-preview) size;
 * `origW/H` are the real dimensions of the original bytes we're cropping, so the
 * ratio between them is the scale back onto the full-resolution grid.
 *
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function hdrSliceRect(layer, slideIdx, ratio, origW, origH) {
  const imgScale = layer.imgScale ?? 1
  const logW = layer.naturalW
  const logH = layer.naturalH
  if (!(imgScale > 0) || !(logW > 0) || !(logH > 0)) return null
  if (!(origW > 0) || !(origH > 0)) return null

  // Canvas units -> original pixels, along each axis independently (a
  // non-uniform preview downscale would otherwise skew the crop).
  const kx = origW / logW / imgScale
  const ky = origH / logH / imgScale
  const absX = layer.x + (layer.imgX ?? 0)
  const absY = layer.y + (layer.imgY ?? 0)

  // Anchor on the canvas origin, not on this slide, so every slide of this photo
  // lands on one shared grid.
  const x0 = Math.round((0 - absX) * kx)
  const y0 = Math.round((0 - absY) * ky)
  const sliceW = Math.max(1, Math.round(ratio.w * kx))
  const sliceH = Math.max(1, Math.round(ratio.h * ky))

  const x = x0 + slideIdx * sliceW
  const y = y0
  if (x < 0 || y < 0 || x + sliceW > origW || y + sliceH > origH) return null
  return { x, y, w: sliceW, h: sliceH }
}

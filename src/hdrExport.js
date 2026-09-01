// Export-time orchestration for the HDR byte-crop path (issue #110).
//
// Sits between the export screen and hdrCrop.js: works out whether a slide can
// keep its HDR, fetches the photo's original bytes, and hands back a data URL
// the export screen can treat exactly like a composited one.
//
// Every failure here is silent by design. HDR is a bonus on top of an export
// that must always succeed, so anything unexpected — missing bytes, a photo
// whose gain map didn't survive storage, a browser that won't decode the
// sub-JPEG — returns null and the caller falls back to the composited SDR
// render. The user gets their carousel either way; the only difference is
// whether the badge appears.

import { qualifyingHdrLayer, hdrSliceRect } from './hdrSlice'
import { resolveLayerSrc } from './renderSlide'
import { detectGainMap } from './gainMap'

async function bytesFromURL(url) {
  if (!url) return null
  const res = await fetch(url)
  return new Uint8Array(await res.arrayBuffer())
}

function bytesToDataURL(bytes) {
  let binary = ''
  const CHUNK = 0x8000 // chunked so a multi-megabyte slice can't blow the stack
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return 'data:image/jpeg;base64,' + btoa(binary)
}

/**
 * Per-export cache of decoded source bytes, keyed by layer id. A panorama's
 * slides all share one photo, so without this every slide would re-fetch and
 * re-base64-decode the same multi-megabyte original.
 */
export function createHdrSourceCache() {
  return new Map()
}

/**
 * Produce one slide as a cropped gain-map JPEG, or null if it can't be done.
 *
 * @param {number} slideIdx
 * @param {Object} args  slides, layers, ratio, format, stampLogo, quality, cache
 * @returns {Promise<{dataURL:string, variant:string, width:number, height:number}|null>}
 */
export async function renderHdrSlide(slideIdx, args) {
  const { slides, layers, ratio, format, stampLogo, quality, cache } = args
  const layer = qualifyingHdrLayer(slideIdx, { slides, layers, ratio, stampLogo, format })
  if (!layer) return null

  try {
    let source = cache?.get(layer.id)
    if (source === undefined) {
      const url = await resolveLayerSrc(layer, true)
      const bytes = await bytesFromURL(url)
      // Re-verify rather than trusting the import-time flag: the bytes we just
      // loaded may be a re-encoded preview if the original was evicted, dropped
      // by a quota failure, or capped by an older version of this app.
      const info = bytes ? detectGainMap(bytes) : null
      source = info?.hasGainMap ? { bytes, info } : null
      cache?.set(layer.id, source)
    }
    if (!source) return null

    const rect = hdrSliceRect(
      layer, slideIdx, ratio, source.info.primary.width, source.info.primary.height,
    )
    if (!rect) return null

    // Lazy: the container machinery only loads once a slide has actually earned it.
    const { cropGainMapJpeg } = await import('./hdrCrop')
    const out = await cropGainMapJpeg(source.bytes, rect, {
      baseQuality: quality ?? 0.95,
    })

    // Final gate: never hand back something that isn't a gain map any more.
    const check = detectGainMap(out.bytes)
    if (!check.hasGainMap) return null

    return {
      dataURL: bytesToDataURL(out.bytes),
      variant: out.variant,
      width: out.baseRect.w,
      height: out.baseRect.h,
    }
  } catch (err) {
    console.warn('HDR slice failed, falling back to composited export:', err)
    return null
  }
}

/**
 * Which slides could keep their HDR, judged from layer state alone.
 * Cheap and synchronous — no bytes are read — so the export screen can decide
 * whether to mention HDR at all before any rendering starts.
 */
export function hdrCandidateSlides({ slides, layers, ratio, stampLogo, format }) {
  const out = new Set()
  for (let i = 0; i < slides.length; i++) {
    if (qualifyingHdrLayer(i, { slides, layers, ratio, stampLogo, format })) out.add(i)
  }
  return out
}

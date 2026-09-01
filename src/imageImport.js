// Image import + downscale.
//
// Extracted from components/Canvas.jsx: none of this is React, and Canvas.jsx is
// the editor's hot-reload centrepiece — a non-component export there costs the
// whole file its fast refresh. It also lets the wide-gamut probe
// (test/colorspace.test.mjs, issue #109) drive the REAL import path instead of a
// reconstruction of it.

import { blobCache } from './blobCache'
import { get2dContext } from './colorSpace'
import { detectGainMapInBlob } from './gainMap'

// ─── Image downscaling ─────────────────────────────────────────────────────────
// Phone cameras produce 12–50MP images. Drawing a 4032×3024 image in Konva every
// animation frame will overheat mobile GPUs. We cap at 2048px on the longest side,
// which is more than enough for any display — this is done once at pick-time.

const MAX_DIM = 2048

// Source types that can carry an alpha channel. When we downscale one of these we
// MUST re-encode as PNG — re-encoding to JPEG bakes an opaque (black/white)
// background in and destroys transparency (issue #67). JPEG stays JPEG so photo
// imports keep their size discipline.
const ALPHA_SOURCE_TYPES = new Set(['image/png', 'image/webp', 'image/svg+xml', 'image/gif'])

export async function processImageFile(file) {
  // Stable content id for this imported image. Travels with the image onto the
  // layer (as layer.imgId) so undo/redo can restore the exact image a snapshot
  // saw, even after the layer's image is later replaced. See useStore.js.
  const imgId = Math.random().toString(36).slice(2)

  // Does this photo carry an HDR gain map (issue #110)? Costs well under a
  // millisecond — it walks JPEG marker segments and never touches pixel data —
  // so it runs on every import. The flag rides on the layer so the export screen
  // can tell, without re-reading bytes, which slides could keep their HDR. The
  // preview path below is untouched: previews stay SDR exactly as before, since
  // no canvas can carry a gain map anyway.
  const gain = await detectGainMapInBlob(file)
  const hdr = gain.hasGainMap
    ? { hasGainMap: true, gainMapVariant: gain.variant }
    : {}

  return new Promise((resolve, reject) => {
    const rawUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const { naturalWidth: nW, naturalHeight: nH } = img
      if (nW <= MAX_DIM && nH <= MAX_DIM) {
        // Already small enough — use same URL for both display and export
        blobCache.set(rawUrl, null)  // sentinel: fetch from rawUrl directly
        resolve({ src: rawUrl, srcOriginal: rawUrl, naturalW: nW, naturalH: nH, imgId, ...hdr })
        return
      }
      // Downscale for display — keep rawUrl alive as srcOriginal for export
      const scale = MAX_DIM / Math.max(nW, nH)
      const w = Math.round(nW * scale)
      const h = Math.round(nH * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      // Display-P3 where supported (issue #109): this downscale is the FIRST canvas
      // an imported photo touches, and an sRGB one here would clip a wide-gamut
      // iPhone shot before anything else in the pipeline ever saw it.
      get2dContext(canvas).drawImage(img, 0, 0, w, h)
      // NOTE: rawUrl is intentionally NOT revoked — it's kept as srcOriginal for export
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('toBlob failed')); return }
          const url = URL.createObjectURL(blob)
          blobCache.set(url, blob)  // cache so serializeLayers never needs fetch(url)
          // Cache the original File too (a Blob) so serializeLayers can persist the
          // full-res original without fetch(blob:), unreliable on iOS Safari PWA.
          blobCache.set(rawUrl, file)
          resolve({ src: url, srcOriginal: rawUrl, naturalW: w, naturalH: h, imgId, ...hdr })
        },
        // Keep PNG for alpha-capable sources so transparency survives the downscale;
        // everything else re-encodes as JPEG q0.92 for size (issue #67).
        ALPHA_SOURCE_TYPES.has(file.type) ? 'image/png' : 'image/jpeg', 0.92,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(rawUrl); reject(new Error('load failed')) }
    img.src = rawUrl
  })
}

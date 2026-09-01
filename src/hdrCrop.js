// Cropping a gain-map JPEG without destroying the gain map (issue #110).
//
// Loaded lazily — nothing here is touched unless an export actually has a slide
// that qualifies for the HDR path. See gainMap.js for detection and for what the
// three container variants look like.
//
// The trick is that a gain map has no fixed relationship to the base image's
// pixel grid. Android's Ultra HDR spec states the map's resolution "is
// implementation-defined and can be different from the resolution from the
// primary image", resampled "bilinear or better" when applied; the only
// geometric constraint is that its orientation match. And the ISO 21496-1
// metadata block carries no spatial extent at all — it is versions, flags, and
// rational scalars (headrooms, per-channel min/max/gamma/offsets). The map's
// geometry lives solely in its own JPEG SOF.
//
// So cropping both images to the same RELATIVE rect is the only thing a crop can
// mean, and the metadata carries over untouched. We only have to rewrite the MPF
// index (and Item:Length for the Ultra HDR v1 variant), because those describe
// byte layout rather than image content.
//
// Both images are re-encoded with colour management switched OFF
// (`colorSpaceConversion: 'none'` + a plain sRGB context) and their original ICC
// profiles carried through verbatim. That is deliberate and differs from the
// composited export path, which re-manages into Display-P3 (issue #109): here we
// are *preserving* a file rather than compositing one, so any colour conversion
// would be a loss. It also matters for correctness — the gain map's stored values
// are raw code values, and colour-converting them on the way through a canvas
// would silently corrupt the map.

import {
  walkSegments, appIdentifier, findAppPayload, findXmpText, detectGainMap, GAIN_MAP_IDS,
} from './gainMap'

const { ISO_ID, XMP_ID, MPF_ID } = GAIN_MAP_IDS

// "MPF\0" (4) + TIFF header (8) + IFD with 3 entries (2 + 36 + 4) + MP Entries
// for 2 images (32) = 86. The segment length field therefore reads 88. Fixed
// size is what lets us compute the final byte layout before filling in offsets.
const MPF_PAYLOAD_LEN = 86
const MP_ENTRIES_OFFSET = 50 // from the TIFF header

function concatBytes(parts) {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

function latin1Bytes(str) {
  const out = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff
  return out
}

/** Wrap a payload (identifier included) in an APPn segment. */
function makeAppSegment(marker, payload) {
  const seg = new Uint8Array(4 + payload.length)
  seg[0] = 0xff
  seg[1] = marker
  const len = 2 + payload.length
  seg[2] = (len >> 8) & 0xff
  seg[3] = len & 0xff
  seg.set(payload, 4)
  return seg
}

function buildMpfSegment(primarySize, secondarySize, secondaryOffsetFromTiff) {
  const p = new Uint8Array(MPF_PAYLOAD_LEN)
  const dv = new DataView(p.buffer)
  p.set(latin1Bytes('MPF\0'), 0)
  const t = 4                        // TIFF header == MP Endian field
  p.set(latin1Bytes('MM'), t)        // big-endian, as every shipping encoder writes
  dv.setUint16(t + 2, 0x002a)
  dv.setUint32(t + 4, 8)             // IFD0 sits 8 bytes into the TIFF block
  const ifd = t + 8
  dv.setUint16(ifd, 3)               // three tags
  // 0xB000 MPFVersion — UNDEFINED(7), count 4, value inline
  dv.setUint16(ifd + 2, 0xb000); dv.setUint16(ifd + 4, 7); dv.setUint32(ifd + 6, 4)
  p.set(latin1Bytes('0100'), ifd + 10)
  // 0xB001 NumberOfImages — LONG(4), count 1, value inline
  dv.setUint16(ifd + 14, 0xb001); dv.setUint16(ifd + 16, 4); dv.setUint32(ifd + 18, 1)
  dv.setUint32(ifd + 22, 2)
  // 0xB002 MPEntry — UNDEFINED(7), 32 bytes, stored at an offset
  dv.setUint16(ifd + 26, 0xb002); dv.setUint16(ifd + 28, 7); dv.setUint32(ifd + 30, 32)
  dv.setUint32(ifd + 34, MP_ENTRIES_OFFSET)
  dv.setUint32(ifd + 38, 0)          // no next IFD
  const e = t + MP_ENTRIES_OFFSET
  dv.setUint32(e, 0x00030000)        // primary: baseline MP primary image
  dv.setUint32(e + 4, primarySize)
  dv.setUint32(e + 8, 0)             // the primary's offset is always written as 0
  dv.setUint32(e + 12, 0)
  dv.setUint32(e + 16, 0x00000000)   // secondary: undefined type, as encoders write
  dv.setUint32(e + 20, secondarySize)
  dv.setUint32(e + 24, secondaryOffsetFromTiff)
  dv.setUint32(e + 28, 0)
  return makeAppSegment(0xe2, p)
}

/**
 * Strip the segments we are about to replace from a freshly encoded JPEG, and
 * report where new APPn segments should be inserted (after SOI and any leading
 * APP0/JFIF, which must stay first).
 */
function prepareBase(jpeg, alsoDropIds = []) {
  const segs = walkSegments(jpeg, 0)
  const drop = []
  const extra = new Set(alsoDropIds)
  for (const s of segs) {
    if (s.marker < 0xe0 || s.marker > 0xef) continue
    const id = appIdentifier(jpeg, s)
    if (id === MPF_ID || id === ISO_ID || extra.has(id)) drop.push(s)
    else if (id === XMP_ID) drop.push(s)
  }
  let insertAt = 2
  for (const s of segs) {
    if (s.offset !== insertAt || s.marker !== 0xe0) break
    insertAt = s.offset + 2 + s.length
  }
  const cuts = drop
    .map((s) => [s.offset, s.offset + 2 + s.length])
    .sort((a, b) => a[0] - b[0])
  const keep = []
  let p = 0
  let adjustedInsert = insertAt
  for (const [a, b] of cuts) {
    keep.push(jpeg.subarray(p, a))
    if (a < insertAt) adjustedInsert -= (b - a)
    p = b
  }
  keep.push(jpeg.subarray(p))
  return { clean: concatBytes(keep), insertAt: adjustedInsert }
}

/**
 * Assemble a gain-map JPEG from a re-encoded base and a re-encoded gain map,
 * carrying the source's gain-map metadata through verbatim.
 */
export function assembleGainMapJpeg(primaryJpeg, gainMapJpeg, meta = {}) {
  // The gain map image first — the primary's MPF has to know its final size.
  const gm = prepareBase(gainMapJpeg, meta.gainMapIcc ? ['ICC_PROFILE'] : [])
  const gmInject = []
  if (meta.gainMapIcc) gmInject.push(makeAppSegment(0xe2, meta.gainMapIcc))
  if (meta.isoGainMap) gmInject.push(makeAppSegment(0xe2, meta.isoGainMap))
  if (meta.gainMapXmp) {
    gmInject.push(makeAppSegment(0xe1, concatBytes([
      latin1Bytes(XMP_ID + '\0'), new TextEncoder().encode(meta.gainMapXmp),
    ])))
  }
  const gmFinal = concatBytes([
    gm.clean.subarray(0, gm.insertAt), ...gmInject, gm.clean.subarray(gm.insertAt),
  ])

  const pr = prepareBase(primaryJpeg, meta.icc ? ['Exif', 'ICC_PROFILE'] : ['Exif'])
  const prInject = []
  // EXIF is load-bearing for Apple gain maps: the HDR headroom lives in the
  // Apple MakerNote here, not in the gain map's own metadata. Drop it and the
  // map survives the crop but renders with headroom 1.0 — i.e. flat.
  if (meta.exif) prInject.push(makeAppSegment(0xe1, meta.exif))
  if (meta.icc) prInject.push(makeAppSegment(0xe2, meta.icc))
  if (meta.isoPrimary) prInject.push(makeAppSegment(0xe2, meta.isoPrimary))

  let primaryXmpSeg = null
  if (meta.primaryXmp) {
    // Only Item:Length changes — every hdrgm value is a global scalar.
    const text = meta.primaryXmp.replace(/Item:Length="\d+"/, `Item:Length="${gmFinal.length}"`)
    primaryXmpSeg = makeAppSegment(0xe1, concatBytes([
      latin1Bytes(XMP_ID + '\0'), new TextEncoder().encode(text),
    ]))
  }

  let injectedLen = (4 + MPF_PAYLOAD_LEN) + (primaryXmpSeg ? primaryXmpSeg.length : 0)
  for (const s of prInject) injectedLen += s.length
  const primarySize = pr.clean.length + injectedLen

  let mpfSegStart = pr.insertAt
  for (const s of prInject) mpfSegStart += s.length
  // MPF offsets are measured from the MP Endian field: segment start + 4 (marker
  // and length) + 4 ("MPF\0").
  const tiffBase = mpfSegStart + 8
  const mpfSeg = buildMpfSegment(primarySize, gmFinal.length, primarySize - tiffBase)

  return concatBytes([
    pr.clean.subarray(0, pr.insertAt),
    ...prInject,
    mpfSeg,
    ...(primaryXmpSeg ? [primaryXmpSeg] : []),
    pr.clean.subarray(pr.insertAt),
    gmFinal,
  ])
}

/** Split a gain-map JPEG into its two standalone JPEGs plus detection info. */
export function splitGainMapJpeg(bytes) {
  const info = detectGainMap(bytes)
  if (!info.hasGainMap) return null
  return {
    info,
    primaryJpeg: bytes.subarray(0, info.primary.end),
    gainMapJpeg: bytes.subarray(info.gainMap.start, info.gainMap.end),
  }
}

/**
 * Map a boundary from the base image's pixel grid onto the gain map's.
 *
 * This is a pure function of the ABSOLUTE coordinate, which is the whole seam
 * guarantee: two adjacent slices computing their shared edge independently get
 * the identical integer, so slices tile with no gap, no overlap and no drift.
 */
export const mapEdge = (v, srcDim, dstDim) => Math.round((v * dstDim) / srcDim)

async function recodeCrop(jpegBytes, rect, quality) {
  const blob = new Blob([jpegBytes], { type: 'image/jpeg' })
  // Colour management off: we are preserving pixels, not re-rendering them.
  let bitmap
  try {
    bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' })
  } catch {
    bitmap = await createImageBitmap(blob)
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = rect.w
    canvas.height = rect.h
    const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' })
    ctx.imageSmoothingEnabled = false
    // Integer source rect drawn 1:1 into an equally sized canvas — no resampling.
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)), reject)
          : reject(new Error('toBlob failed'))),
        'image/jpeg', quality,
      )
    })
  } finally {
    bitmap.close?.()
  }
}

/**
 * Crop a gain-map JPEG to `rect` (in base-image pixels), producing a valid
 * gain-map JPEG of the cropped region.
 *
 * @param {Uint8Array} sourceBytes original gain-map JPEG
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{baseQuality?:number, gainMapQuality?:number}} [opts]
 */
export async function cropGainMapJpeg(sourceBytes, rect, opts = {}) {
  const split = splitGainMapJpeg(sourceBytes)
  if (!split) throw new Error('not a gain-map JPEG')
  const { info, primaryJpeg, gainMapJpeg } = split
  const W = info.primary.width
  const H = info.primary.height
  const gw = info.gainMap.width
  const gh = info.gainMap.height

  const x0 = Math.max(0, Math.min(W, Math.round(rect.x)))
  const y0 = Math.max(0, Math.min(H, Math.round(rect.y)))
  const x1 = Math.max(x0 + 1, Math.min(W, Math.round(rect.x + rect.w)))
  const y1 = Math.max(y0 + 1, Math.min(H, Math.round(rect.y + rect.h)))
  const baseRect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }

  const gx0 = mapEdge(x0, W, gw)
  const gy0 = mapEdge(y0, H, gh)
  const gainRect = {
    x: gx0, y: gy0,
    w: Math.max(1, mapEdge(x1, W, gw) - gx0),
    h: Math.max(1, mapEdge(y1, H, gh) - gy0),
  }

  const primarySegs = walkSegments(primaryJpeg, 0)
  const gainSegs = walkSegments(gainMapJpeg, 0)
  const primaryXmp = findXmpText(primaryJpeg, primarySegs)
  const meta = {
    exif: findAppPayload(primaryJpeg, 'Exif', primarySegs),
    icc: findAppPayload(primaryJpeg, 'ICC_PROFILE', primarySegs),
    isoPrimary: findAppPayload(primaryJpeg, ISO_ID, primarySegs),
    isoGainMap: findAppPayload(gainMapJpeg, ISO_ID, gainSegs),
    gainMapIcc: findAppPayload(gainMapJpeg, 'ICC_PROFILE', gainSegs),
    gainMapXmp: findXmpText(gainMapJpeg, gainSegs),
    primaryXmp: primaryXmp && primaryXmp.includes('hdr-gain-map/1.0') ? primaryXmp : null,
  }

  const [newPrimary, newGainMap] = [
    await recodeCrop(primaryJpeg, baseRect, opts.baseQuality ?? 0.95),
    await recodeCrop(gainMapJpeg, gainRect, opts.gainMapQuality ?? 0.92),
  ]

  return {
    bytes: assembleGainMapJpeg(newPrimary, newGainMap, meta),
    baseRect, gainRect, variant: info.variant,
  }
}

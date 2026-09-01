// Gain-map JPEG detection (issue #110).
//
// An HDR photo from a modern phone is an ordinary SDR JPEG with a second,
// smaller JPEG — the *gain map* — hidden inside it, plus metadata saying how to
// combine them. A display with headroom applies the map and shows HDR; anything
// else just decodes the SDR base and is none the wiser.
//
// Anything drawn through a canvas loses this: Safari has no HDR canvas, so the
// gain map never survives a re-encode. But a panorama slide that's nothing but a
// full-bleed slice of one photo doesn't need compositing — we can crop the
// original bytes and keep the map. This module answers the first question that
// makes that possible: does this file have a gain map at all?
//
// The scan only walks JPEG marker segments — it never touches entropy-coded
// image data — so it costs ~0.3ms on a 400KB file and is safe to run on every
// import. The cropping half lives in hdrCrop.js, loaded lazily and only when an
// export actually qualifies.
//
// Three variants ship in the wild and we detect all three:
//   'iso'    ISO 21496-1 APP2 (`urn:iso:std:iso:ts:21496:-1`). Current Android /
//            libultrahdr >= 1.2. Note these carry NO XMP at all — a detector
//            keyed on `hdrgm:Version` (the widely-blogged approach) misses them.
//   'hdrgm'  Ultra HDR v1: XMP with the Adobe hdrgm namespace + a Google
//            GContainer directory naming the GainMap item. Older Android.
//   'apple'  iPhone: the gain map is an auxiliary image tagged
//            `urn:com:apple:photo:2020:aux:hdrgainmap` in ITS OWN XMP. The HDR
//            headroom is NOT there — it lives in the Apple MakerNote inside the
//            primary's EXIF, which is why hdrCrop.js carries EXIF through
//            verbatim (drop it and the map survives but renders flat).
//
// In all three the second image is indexed by a CIPA DC-x 007-2009 Multi-Picture
// Format (MPF) APP2 segment, whose entry offsets are measured from the start of
// the MP Endian field rather than the file.

const ISO_ID = 'urn:iso:std:iso:ts:21496:-1'
const XMP_ID = 'http://ns.adobe.com/xap/1.0/'
const MPF_ID = 'MPF'

// Start-of-frame markers carrying image dimensions. SOF4 (0xc4) is DHT and
// SOF12 (0xcc) is DAC — both deliberately absent.
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

function asciiAt(bytes, start, end) {
  let s = ''
  for (let i = start; i < end && i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

/**
 * Walk the marker segments of the JPEG starting at `base`.
 * Stops once the entropy-coded scan data has been skipped to EOI, so this is
 * O(segments) plus one linear scan of the scan data to find its end.
 */
export function walkSegments(bytes, base = 0) {
  const segs = []
  if (bytes[base] !== 0xff || bytes[base + 1] !== 0xd8) return segs
  let p = base + 2
  while (p < bytes.length - 1) {
    if (bytes[p] !== 0xff) { p++; continue }
    let marker = bytes[p + 1]
    // Fill bytes: any number of 0xff may pad before the marker itself.
    while (marker === 0xff) { p++; marker = bytes[p + 1] }
    if (marker === 0x00) { p += 2; continue }              // stuffed byte, not a marker
    if (marker >= 0xd0 && marker <= 0xd7) { p += 2; continue } // RSTn: no payload
    if (marker === 0xd9) { segs.push({ marker, name: 'EOI', offset: p, length: 0 }); break }
    const length = (bytes[p + 2] << 8) | bytes[p + 3]
    if (length < 2) break
    const seg = {
      marker, offset: p, length,
      dataStart: p + 4, dataEnd: p + 2 + length,
    }
    if (SOF_MARKERS.has(marker)) {
      seg.height = (bytes[p + 5] << 8) | bytes[p + 6]
      seg.width = (bytes[p + 7] << 8) | bytes[p + 8]
      seg.components = bytes[p + 9]
    }
    segs.push(seg)
    if (marker === 0xda) {
      // Skip the entropy-coded data: scan for the next marker that isn't a
      // stuffed 0x00 or a restart marker.
      let q = p + 2 + length
      while (q < bytes.length - 1) {
        if (bytes[q] === 0xff && bytes[q + 1] !== 0x00 &&
            !(bytes[q + 1] >= 0xd0 && bytes[q + 1] <= 0xd7)) break
        q++
      }
      p = q
      continue
    }
    p = p + 2 + length
  }
  return segs
}

/** The NUL-terminated identifier string at the start of an APPn payload. */
export function appIdentifier(bytes, seg) {
  let e = seg.dataStart
  const cap = Math.min(seg.dataEnd, seg.dataStart + 64)
  while (e < cap && bytes[e] !== 0x00) e++
  return asciiAt(bytes, seg.dataStart, e)
}

/** Payload of an APPn segment after its NUL-terminated identifier, or null. */
export function findAppPayload(bytes, wantId, segs) {
  for (const s of segs ?? walkSegments(bytes, 0)) {
    if (s.marker < 0xe0 || s.marker > 0xef) continue
    if (appIdentifier(bytes, s) !== wantId) continue
    return bytes.subarray(s.dataStart, s.dataEnd)
  }
  return null
}

/** Text of the standard XMP APP1 segment, or null. */
export function findXmpText(bytes, segs) {
  for (const s of segs ?? walkSegments(bytes, 0)) {
    if (s.marker !== 0xe1 || appIdentifier(bytes, s) !== XMP_ID) continue
    return asciiAt(bytes, s.dataStart + XMP_ID.length + 1, s.dataEnd)
  }
  return null
}

/**
 * Parse an MPF APP2 segment into its image index.
 * Per CIPA DC-x 007-2009 the per-image offsets are relative to the start of the
 * MP Endian field (the TIFF header), NOT the file — and the first (primary)
 * image's offset is always written as 0.
 */
function parseMPF(bytes, seg) {
  if (asciiAt(bytes, seg.dataStart, seg.dataStart + 3) !== MPF_ID) return null
  const tiff = seg.dataStart + 4
  const bom = asciiAt(bytes, tiff, tiff + 2)
  if (bom !== 'II' && bom !== 'MM') return null
  const le = bom === 'II'
  const u16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1])
  const u32 = (o) => (le
    ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0)
  if (u16(tiff + 2) !== 0x002a) return null

  const ifd0 = tiff + u32(tiff + 4)
  if (ifd0 + 2 > seg.dataEnd) return null
  const count = u16(ifd0)
  const TYPE_BYTES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 }
  let entriesOff = -1
  let entriesCount = 0
  for (let i = 0; i < count; i++) {
    const e = ifd0 + 2 + i * 12
    if (e + 12 > seg.dataEnd) return null
    const tag = u16(e)
    const type = u16(e + 2)
    const n = u32(e + 4)
    const byteLen = (TYPE_BYTES[type] ?? 1) * n
    // Values up to 4 bytes are stored inline in the entry; larger ones are at
    // an offset from the TIFF header.
    const valOff = byteLen <= 4 ? e + 8 : tiff + u32(e + 8)
    if (tag === 0xb002) { entriesOff = valOff; entriesCount = Math.floor(byteLen / 16) }
  }
  if (entriesOff < 0) return null

  const images = []
  for (let i = 0; i < entriesCount; i++) {
    const e = entriesOff + i * 16
    if (e + 16 > seg.dataEnd) break
    const size = u32(e + 4)
    const off = u32(e + 8)
    images.push({ size, offset: off, absolute: off === 0 ? 0 : tiff + off })
  }
  return { images }
}

/** Describe a secondary (gain map) image found at `start`. */
function describeSecondary(bytes, start, size) {
  const sub = bytes.subarray(start, start + size)
  const segs = walkSegments(sub, 0)
  const sof = segs.find((s) => s.width)
  const out = {
    start, end: start + size, size,
    width: sof ? sof.width : 0,
    height: sof ? sof.height : 0,
    components: sof ? sof.components : 0,
    hasIso: false, isApple: false, hasHdrgm: false,
  }
  for (const s of segs) {
    if (s.marker < 0xe0 || s.marker > 0xef) continue
    const id = appIdentifier(sub, s)
    if (id === ISO_ID) out.hasIso = true
    else if (id === XMP_ID) {
      const t = asciiAt(sub, s.dataStart + XMP_ID.length + 1, s.dataEnd)
      if (t.includes('urn:com:apple:photo:2020:aux:hdrgainmap')) out.isApple = true
      if (t.includes('hdr-gain-map/1.0')) out.hasHdrgm = true
    }
  }
  return out
}

/**
 * Detect a gain map in JPEG bytes.
 *
 * Deliberately conservative: a file is only reported as having a gain map when
 * the secondary image's bytes are actually PRESENT and self-identify as one.
 * An MPF file whose second image is an ordinary thumbnail (iPhone Portrait,
 * burst shots, Samsung dual-shot) is the obvious false positive and is rejected,
 * as is a file whose MPF index promises bytes that were truncated away.
 *
 * @param {Uint8Array} bytes
 * @returns {{hasGainMap:boolean, variant:'iso'|'hdrgm'|'apple'|null,
 *            primary:{width:number,height:number,end:number}|null,
 *            gainMap:{start:number,end:number,width:number,height:number,components:number}|null}}
 */
export function detectGainMap(bytes) {
  const res = { hasGainMap: false, variant: null, primary: null, gainMap: null }
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return res

  const segs = walkSegments(bytes, 0)
  const sof = segs.find((s) => s.width)
  const eoi = segs.find((s) => s.name === 'EOI')
  const primaryEnd = eoi ? eoi.offset + 2 : bytes.length
  if (sof) res.primary = { width: sof.width, height: sof.height, end: primaryEnd }

  let mpfSeg = null
  let primaryHasHdrgmXmp = false
  for (const s of segs) {
    if (s.marker < 0xe0 || s.marker > 0xef) continue
    const id = appIdentifier(bytes, s)
    if (id === MPF_ID) mpfSeg = s
    else if (id === XMP_ID) {
      const t = asciiAt(bytes, s.dataStart + XMP_ID.length + 1, s.dataEnd)
      if (t.includes('hdr-gain-map/1.0')) primaryHasHdrgmXmp = true
    }
  }

  let secondary = null
  if (mpfSeg) {
    const mpf = parseMPF(bytes, mpfSeg)
    const entry = mpf?.images?.[1]
    if (entry && entry.absolute > 0 && entry.absolute + entry.size <= bytes.length &&
        bytes[entry.absolute] === 0xff && bytes[entry.absolute + 1] === 0xd8) {
      secondary = describeSecondary(bytes, entry.absolute, entry.size)
    }
  } else if (primaryHasHdrgmXmp) {
    // Ultra HDR v1 without MPF is out of spec but occurs: the GContainer
    // directory locates the trailing image by Item:Length from the end.
    const xmp = findXmpText(bytes, segs) ?? ''
    const m = /Item:Length="(\d+)"/.exec(xmp)
    const len = m ? Number(m[1]) : 0
    const start = bytes.length - len
    if (len > 0 && start > primaryEnd &&
        bytes[start] === 0xff && bytes[start + 1] === 0xd8) {
      secondary = describeSecondary(bytes, start, len)
    }
  }
  if (!secondary || !secondary.width) return res

  // Classify. The gain map must say what it is — presence alone is not enough.
  if (secondary.hasIso) res.variant = 'iso'
  else if (secondary.isApple) res.variant = 'apple'
  else if (secondary.hasHdrgm || primaryHasHdrgmXmp) res.variant = 'hdrgm'
  else return res

  res.hasGainMap = true
  res.gainMap = secondary
  return res
}

/** Read a Blob/File as bytes and detect a gain map. Never throws. */
export async function detectGainMapInBlob(blob) {
  try {
    if (!blob || (blob.type && blob.type !== 'image/jpeg' && blob.type !== 'image/jpg')) {
      return { hasGainMap: false, variant: null, primary: null, gainMap: null }
    }
    return detectGainMap(new Uint8Array(await blob.arrayBuffer()))
  } catch {
    return { hasGainMap: false, variant: null, primary: null, gainMap: null }
  }
}

export const GAIN_MAP_IDS = { ISO_ID, XMP_ID, MPF_ID }

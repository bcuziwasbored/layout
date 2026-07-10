// Brand kit (issue #64): a single GLOBAL record — saved palette, default heading/
// body font pair, and an uploaded logo — persisted in the 'brandkit' IDB store
// (db v4). Read once at app start into the zustand store; every editor mutation
// persists the whole record back. Deliberately local-first (no accounts/sync).

import { dbGet, dbPut } from './db'

// One record, fixed key. A brand kit is per-device, not per-project.
const BRANDKIT_KEY = 'default'

// The empty/default shape. `logo` is null until the user uploads one; when set it
// holds a self-contained data URL plus the natural dimensions so callers can size
// placements by aspect ratio without decoding the image first.
export const EMPTY_BRAND = { colors: [], headingFont: null, bodyFont: null, logo: null }

// Alpha-capable source types (issue #67 pipeline) — the brand kit editor accepts
// exactly these for the logo upload so transparency always survives, plus JPEG
// (no alpha to lose). Everything downscaled here re-encodes as PNG (see below).
export const LOGO_ACCEPT_TYPES = new Set([
  'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/jpeg',
])

// Cap the stored logo's long edge so the data URL stays modest but a 2× export
// still looks crisp for a logo drawn at ~18% of slide width.
const MAX_LOGO_DIM = 1024

const uid = () => Math.random().toString(36).slice(2)

// Load the brand kit from IDB, normalized to the full shape (missing fields
// filled from EMPTY_BRAND, every color guaranteed an id for stable list editing).
// Returns EMPTY_BRAND on a fresh install or any error — a broken brand kit must
// never block app start.
export async function loadBrandKit() {
  try {
    const rec = await dbGet('brandkit', BRANDKIT_KEY)
    if (!rec) return { ...EMPTY_BRAND }
    return {
      colors: (Array.isArray(rec.colors) ? rec.colors : [])
        .map(c => (c.id ? c : { ...c, id: uid() })),
      headingFont: rec.headingFont ?? null,
      bodyFont: rec.bodyFont ?? null,
      logo: rec.logo ?? null,
    }
  } catch {
    return { ...EMPTY_BRAND }
  }
}

// Persist the whole brand kit record. Fire-and-forget from the store; a queued IDB
// write survives page teardown just like the project autosave.
export async function saveBrandKit(brand) {
  return dbPut('brandkit', { id: BRANDKIT_KEY, ...brand })
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

// Turn an uploaded logo File into a { src, naturalW, naturalH } record: a
// self-contained data URL (alpha-preserving), downscaled to MAX_LOGO_DIM when
// larger. SVGs are kept as-is (vector, no meaningful natural cap) but still get
// real pixel dimensions from the decoded image for aspect-ratio placement.
export async function processLogoFile(file) {
  const dataURL = await readFileAsDataURL(file)
  const img = await loadImageEl(dataURL)
  const nW = img.naturalWidth || 1
  const nH = img.naturalHeight || 1
  const long = Math.max(nW, nH)
  const isSvg = file.type === 'image/svg+xml'
  if (isSvg || long <= MAX_LOGO_DIM) {
    return { src: dataURL, naturalW: nW, naturalH: nH }
  }
  const scale = MAX_LOGO_DIM / long
  const w = Math.round(nW * scale)
  const h = Math.round(nH * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  // Always re-encode as PNG: alpha sources (per #67's ALPHA_SOURCE_TYPES) keep
  // their transparency through the downscale, and a stray JPEG logo just stays
  // lossless — logos are small, so JPEG's size discipline doesn't matter here.
  return { src: canvas.toDataURL('image/png'), naturalW: w, naturalH: h }
}

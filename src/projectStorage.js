import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbPutBlob, dbDeleteBlob } from './db'
import { blobCache } from './blobCache'
import { renderSlide } from './renderSlide'

const THUMB_W = 240

// Full-resolution originals are persisted in the 'blobs' IDB store (as data-URL
// strings, per the iOS-Safari reliability note in db.js), keyed per project+layer.
// The preview `src` stays inline in the project record for fast loads; the layer's
// `srcOriginal` is rewritten to a `blob-ref://` pointer at this key so exports can
// lazily fetch the original after a reload.
const ORIG_REF_PREFIX = 'blob-ref://'
// Cap stored originals at 4096px on the long edge (re-encode JPEG q0.92 when
// larger) to respect iOS storage quotas.
const MAX_ORIGINAL_DIM = 4096

const originalKey = (projectId, layerId) => `orig:${projectId}:${layerId}`

// Collect the IDB blob keys a set of persisted layers references as originals.
function collectOriginalKeys(layers) {
  const keys = new Set()
  for (const l of layers ?? []) {
    if (typeof l?.srcOriginal === 'string' && l.srcOriginal.startsWith(ORIG_REF_PREFIX)) {
      keys.add(l.srcOriginal.slice(ORIG_REF_PREFIX.length))
    }
  }
  return keys
}

// A previously-persisted original ref survives a load→save round-trip unchanged;
// anything else (in-session blob:/data: URL, or absent) is not a stored ref.
function persistedOriginalRef(layer) {
  const so = layer?.srcOriginal
  return (typeof so === 'string' && so.startsWith(ORIG_REF_PREFIX)) ? so : undefined
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

// Get a Blob from a blob: URL — from blobCache first (avoids fetch on iOS PWA),
// then fetch as fallback, then img+canvas re-export as last resort.
async function blobFromURL(url) {
  const cached = blobCache.get(url)
  if (cached) return cached
  try {
    return await fetch(url).then(r => r.blob())
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/jpeg', 0.92)
      }
      img.onerror = () => reject(new Error('img load failed'))
      img.src = url
    })
  }
}

// ─── Serialization ─────────────────────────────────────────────────────────────
// Convert blob: URLs to data URL strings stored inline in layer.src.
// Data URL strings work reliably in IDB on every platform including iOS.
// The full-res `srcOriginal` is persisted separately in the 'blobs' store and the
// layer keeps only a lightweight `blob-ref://` pointer, so exports still have the
// original after a reload while the project record stays small.

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

// Data URL for a full-resolution original, capped at MAX_ORIGINAL_DIM on the long
// edge (re-encoded JPEG q0.92 when larger).
async function prepareOriginalDataURL(srcUrl) {
  const blob = await blobFromURL(srcUrl)
  const dataURL = await blobToDataURL(blob)
  const img = await loadImageEl(dataURL)
  const long = Math.max(img.naturalWidth, img.naturalHeight)
  if (long <= MAX_ORIGINAL_DIM) return dataURL
  const scale = MAX_ORIGINAL_DIM / long
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.92)
}

async function serializeLayers(layers, projectId) {
  return Promise.all(
    layers.map(async (layer) => {
      // Resolve what the persisted `srcOriginal` should be.
      let srcOriginalRef = persistedOriginalRef(layer)
      if (!srcOriginalRef) {
        const so = layer.srcOriginal
        // A distinct in-session full-res original (large imports keep the raw
        // blob: URL here; small imports reuse `src`, so there's nothing to store).
        const hasDistinctOriginal =
          typeof so === 'string' && so !== layer.src &&
          (so.startsWith('blob:') || so.startsWith('data:'))
        if (hasDistinctOriginal) {
          try {
            const key = originalKey(projectId, layer.id)
            await dbPutBlob(key, await prepareOriginalDataURL(so))
            srcOriginalRef = ORIG_REF_PREFIX + key
          } catch (e) {
            console.warn('Failed to persist original for layer', layer.id, e)
            srcOriginalRef = undefined  // export falls back to preview src
          }
        }
      }

      if (layer.src?.startsWith('blob:')) {
        try {
          const blob = await blobFromURL(layer.src)
          const dataURL = await blobToDataURL(blob)
          return { ...layer, src: dataURL, srcOriginal: srcOriginalRef }
        } catch (e) {
          console.warn('Failed to serialize layer', layer.id, e)
          return { ...layer, srcOriginal: srcOriginalRef }
        }
      }
      // Already a data URL or null — keep as-is
      return { ...layer, srcOriginal: srcOriginalRef }
    })
  )
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────

// Render the project's first slide to a thumbnail data URL. Delegates to the
// canonical slide renderer so thumbnails include everything the editor shows —
// text, shapes, gradient backgrounds, crop shapes, rotation and flips — instead
// of the old image-only pass that left text/gradient projects looking blank.
// Uses the lightweight preview `src` (preferOriginal:false); full-res originals
// aren't worth fetching at thumbnail scale.
async function renderThumbnail(layers, slides, ratio, bgColor, bgGradient) {
  return renderSlide(0, {
    slides, layers, ratio, bgColor, bgGradient,
    scale: THUMB_W / ratio.w,
    quality: 0.75,
    preferOriginal: false,
  })
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function saveProject(id, name, storeState) {
  const { ratio, bgColor, bgGradient, slides, layers } = storeState
  const prev = await dbGet('projects', id)
  const serialized = await serializeLayers(layers, id)

  // Garbage-collect originals no longer referenced by this project (layer deleted,
  // or its image replaced by one without a distinct original). Keys are scoped by
  // project id, so this never touches another project's stored originals.
  const newKeys = collectOriginalKeys(serialized)
  for (const key of collectOriginalKeys(prev?.state?.layers)) {
    if (!newKeys.has(key)) {
      try { await dbDeleteBlob(key) } catch (e) { console.warn('original GC failed', key, e) }
    }
  }

  const thumbnail = await renderThumbnail(serialized, slides, ratio, bgColor, bgGradient)
  await dbPut('projects', {
    id, name, updatedAt: Date.now(), thumbnail, slideCount: slides.length,
    state: { ratio, bgColor, bgGradient, slides, layers: serialized },
  })
}

export async function loadProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  const layers = await Promise.all(
    record.state.layers.map(async (layer) => {
      // Preserve any persisted full-res original pointer so exports can lazily
      // fetch it from the blobs store; renderSlide resolves it at render time.
      const srcOriginal = persistedOriginalRef(layer)

      // Current format: data URL inline — use directly
      if (layer.src?.startsWith('data:')) return { ...layer, srcOriginal }

      // Legacy format: ref:// with inline Blob (iOS may have corrupted these)
      if (layer.src?.startsWith('ref://')) {
        const blob = record.blobs?.[layer.src.slice(6)]
        if (blob && blob.size > 0) {
          try {
            return { ...layer, src: await blobToDataURL(blob), srcOriginal }
          } catch {}
        }
        return { ...layer, src: null, srcOriginal }
      }

      // blob-ref:// from intermediate version — keep as-is, useBlobSrc will resolve
      // (only matters if user has projects saved with the blob store approach)
      return { ...layer, srcOriginal }
    })
  )

  return { ...record.state, layers, projectId: record.id, projectName: record.name }
}

export async function listProjects() {
  const all = await dbGetAll('projects')
  return all
    .map(projectSummary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// The lightweight shape the home screen list works with.
function projectSummary(r) {
  return {
    id: r.id, name: r.name, updatedAt: r.updatedAt,
    thumbnail: r.thumbnail,
    slideCount: r.slideCount ?? r.state?.slides?.length ?? 0,
    ratio: r.state?.ratio,
  }
}

// Rename a project in place. The name is the only thing that changes — the
// thumbnail, layers and updatedAt are left untouched so the card keeps its
// position in the Recent list.
export async function renameProject(id, name) {
  const record = await dbGet('projects', id)
  if (!record) return null
  const updated = { ...record, name }
  await dbPut('projects', updated)
  return projectSummary(updated)
}

// Deep-copy a project under a fresh id. Persisted originals (PR #30) are stored
// in the 'blobs' store under keys scoped to the OLD project id
// (`orig:<oldId>:<layerId>`), so a naive copy of the record would leave the
// duplicate's layers pointing at the original's blobs — a later GC or delete of
// the original would then strip the copy's originals too. We instead copy each
// referenced blob to a key scoped to the NEW project id and rewrite the layer's
// `blob-ref://` pointer, so the duplicate owns an independent set of originals.
export async function duplicateProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  const newId = Math.random().toString(36).slice(2)

  const layers = await Promise.all(
    (record.state?.layers ?? []).map(async (layer) => {
      const ref = persistedOriginalRef(layer)
      if (!ref) return { ...layer }
      const oldKey = ref.slice(ORIG_REF_PREFIX.length)
      const newKey = originalKey(newId, layer.id)
      try {
        const data = await dbGetBlob(oldKey)
        if (data) {
          await dbPutBlob(newKey, data)
          return { ...layer, srcOriginal: ORIG_REF_PREFIX + newKey }
        }
      } catch (e) {
        console.warn('Failed to copy original for duplicated layer', layer.id, e)
      }
      // Original missing/unreadable — drop the ref so exports fall back to the
      // inline preview src rather than pointing at the source project's blob.
      return { ...layer, srcOriginal: undefined }
    })
  )

  const duplicate = {
    ...record,
    id: newId,
    name: `${record.name} copy`,
    updatedAt: Date.now(),
    state: { ...record.state, layers },
  }
  await dbPut('projects', duplicate)
  return projectSummary(duplicate)
}

export async function deleteProject(id) {
  const record = await dbGet('projects', id)
  for (const key of collectOriginalKeys(record?.state?.layers)) {
    try { await dbDeleteBlob(key) } catch (e) { console.warn('original cleanup failed', key, e) }
  }
  await dbDelete('projects', id)
}

import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbPutBlob, dbDeleteBlob } from './db'
import { blobCache } from './blobCache'

const THUMB_W = 240

// ─── Blob ↔ data URL helpers ───────────────────────────────────────────────────

// FileReader-based blob→dataURL: works on every iOS version (iOS 6+).
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

// Synchronous data URL → Blob. Used when loading so we can immediately create
// a blob: URL from a persisted data URL without an async round-trip.
function dataURLToBlob(dataURL) {
  const [header, b64] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Convert a data URL to a blob: URL and register the Blob in the cache so
// serializeLayers can retrieve it without fetch().
function dataURLToBlobURL(dataURL) {
  try {
    const blob = dataURLToBlob(dataURL)
    const url = URL.createObjectURL(blob)
    blobCache.set(url, blob)
    return url
  } catch {
    return null
  }
}

// Get a Blob from a blob: URL — from cache first, then fetch() as fallback,
// then img+canvas re-export as last resort.
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
// blob: URL → data URL string in blob store, blob-ref://layerId in project record.
// Project records stay small so dbGetAll (home screen listing) is fast.

async function serializeLayers(layers) {
  return Promise.all(
    layers.map(async (layer) => {
      if (layer.src?.startsWith('blob:')) {
        try {
          const blob = await blobFromURL(layer.src)
          const dataURL = await blobToDataURL(blob)
          await dbPutBlob(layer.id, dataURL)
          return { ...layer, src: 'blob-ref://' + layer.id, srcOriginal: undefined }
        } catch (e) {
          console.warn('Failed to serialize layer', layer.id, e)
          return { ...layer, srcOriginal: undefined }
        }
      }
      // blob-ref:// already in blob store; data: URL (transitional) — migrate to blob store
      if (layer.src?.startsWith('data:')) {
        try {
          await dbPutBlob(layer.id, layer.src)
          return { ...layer, src: 'blob-ref://' + layer.id, srcOriginal: undefined }
        } catch {
          return { ...layer, srcOriginal: undefined }
        }
      }
      if (layer.src?.startsWith('blob-ref://')) {
        return { ...layer, srcOriginal: undefined }
      }
      return { ...layer, srcOriginal: undefined }
    })
  )
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────

async function renderThumbnail(layers, slides, ratio, bgColor) {
  const thumbH = Math.round(THUMB_W * ratio.h / ratio.w)
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W; canvas.height = thumbH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = slides[0]?.bgColor ?? bgColor
  ctx.fillRect(0, 0, THUMB_W, thumbH)

  const scale = THUMB_W / ratio.w
  const sliceEnd = ratio.w
  const slide0Layers = layers.filter(l => l.src && l.x < sliceEnd && l.x + l.w > 0)

  for (const layer of slide0Layers) {
    let src = layer.src
    if (src?.startsWith('blob-ref://')) {
      src = await dbGetBlob(src.slice(10)).catch(() => null)
      if (!src) continue
    }
    await new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const gap = (layer.cellGap ?? 0) * scale
        const inset = gap / 2
        const clipX = Math.max(layer.x, 0) * scale + inset
        const clipW = (Math.min(layer.x + layer.w, sliceEnd) - Math.max(layer.x, 0)) * scale - gap
        const clipY = layer.y * scale + inset
        const clipH = layer.h * scale - gap
        ctx.save()
        ctx.beginPath(); ctx.rect(clipX, clipY, clipW, clipH); ctx.clip()
        ctx.globalAlpha = layer.opacity ?? 1
        const logW = layer.naturalW ?? img.naturalWidth
        const logH = layer.naturalH ?? img.naturalHeight
        const drawX = layer.x * scale + (layer.imgX ?? 0) * scale + inset
        const drawY = layer.y * scale + (layer.imgY ?? 0) * scale + inset
        const drawW = logW * (layer.imgScale ?? 1) * scale
        const drawH = logH * (layer.imgScale ?? 1) * scale
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, drawX, drawY, drawW, drawH)
        ctx.restore(); resolve()
      }
      img.onerror = resolve
      img.src = src
    })
  }
  return canvas.toDataURL('image/jpeg', 0.75)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function saveProject(id, name, storeState) {
  const { ratio, bgColor, bgGradient, slides, layers } = storeState
  const serialized = await serializeLayers(layers)
  const thumbnail = await renderThumbnail(serialized, slides, ratio, bgColor)
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
      // Current format: blob-ref:// → read data URL → convert to blob: URL in memory
      if (layer.src?.startsWith('blob-ref://')) {
        const dataURL = await dbGetBlob(layer.src.slice(10)).catch(() => null)
        if (dataURL) {
          const url = dataURLToBlobURL(dataURL)
          return { ...layer, src: url ?? null }
        }
        return { ...layer, src: null }
      }

      // Transitional: inline data URL → convert to blob: URL
      if (layer.src?.startsWith('data:')) {
        const url = dataURLToBlobURL(layer.src)
        // Async: migrate to blob store so project record shrinks
        if (url) dbPutBlob(layer.id, layer.src).catch(() => {})
        return { ...layer, src: url ?? null }
      }

      // Legacy: ref:// with inline Blob (iOS may have corrupted these)
      if (layer.src?.startsWith('ref://')) {
        const blob = record.blobs?.[layer.src.slice(6)]
        if (blob && blob.size > 0) {
          try {
            const dataURL = await blobToDataURL(blob)
            dbPutBlob(layer.id, dataURL).catch(() => {})
            const url = dataURLToBlobURL(dataURL)
            return { ...layer, src: url ?? null }
          } catch {}
        }
        return { ...layer, src: null }
      }

      return { ...layer }
    })
  )

  // Async: re-save legacy/transitional projects in the new format
  const needsMigration = record.state.layers.some(
    l => l.src?.startsWith('ref://') || l.src?.startsWith('data:')
  )
  if (needsMigration) {
    const migratedLayers = layers.map(l => ({
      ...l,
      src: l.src?.startsWith('blob:') ? 'blob-ref://' + l.id : (l.src ?? null),
      srcOriginal: undefined,
    }))
    dbPut('projects', {
      ...record, blobs: undefined,
      state: { ...record.state, layers: migratedLayers },
    }).catch(() => {})
  }

  return { ...record.state, layers, projectId: record.id, projectName: record.name }
}

export async function listProjects() {
  const all = await dbGetAll('projects')
  return all
    .map(r => ({
      id: r.id, name: r.name, updatedAt: r.updatedAt,
      thumbnail: r.thumbnail,
      slideCount: r.slideCount ?? r.state?.slides?.length ?? 0,
      ratio: r.state?.ratio,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProject(id) {
  const record = await dbGet('projects', id)
  if (record) {
    const blobIds = record.state.layers
      .filter(l => l.src?.startsWith('blob-ref://'))
      .map(l => l.src.slice(10))
    await Promise.all(blobIds.map(bid => dbDeleteBlob(bid).catch(() => {})))
  }
  await dbDelete('projects', id)
}

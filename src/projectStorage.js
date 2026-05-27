import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbDeleteBlob } from './db'
import { blobCache } from './blobCache'

const THUMB_W = 240

// ─── Helpers ───────────────────────────────────────────────────────────────────

// FileReader-based blob→dataURL: works on every iOS version (since iOS 6).
// Avoids blob.arrayBuffer() which only exists on iOS 14.5+.
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

// ─── Serialization ─────────────────────────────────────────────────────────────
// Convert blob: URLs to data URL strings stored directly in layer.src.
// We use the blobCache (populated at pick-time) to get the Blob without fetch(),
// which can fail on iOS Safari PWA when a service worker is active.
// Data URL strings survive IDB perfectly on all platforms.

async function blobToDataURLSafe(blobUrl) {
  // 1. Try cached Blob first (avoids fetch entirely)
  const cached = blobCache.get(blobUrl)
  if (cached) return blobToDataURL(cached)

  // 2. Fallback: fetch (works on desktop, may fail on iOS PWA)
  try {
    const blob = await fetch(blobUrl).then(r => r.blob())
    return blobToDataURL(blob)
  } catch {
    // 3. Last resort: load via img + re-export (always works, re-encodes image)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        c.toBlob(b => b ? resolve(blobToDataURL(b)) : reject(new Error('toBlob')), 'image/jpeg', 0.92)
      }
      img.onerror = () => reject(new Error('img load failed'))
      img.src = blobUrl
    })
  }
}

async function serializeLayers(layers) {
  return Promise.all(
    layers.map(async (layer) => {
      if (layer.src?.startsWith('blob:')) {
        try {
          const dataURL = await blobToDataURLSafe(layer.src)
          // Store data URL inline as layer.src — no blob store needed, works on all platforms
          return { ...layer, src: dataURL, srcOriginal: undefined }
        } catch (e) {
          console.warn('Failed to serialize layer', layer.id, e)
          return { ...layer, srcOriginal: undefined }
        }
      }
      // blob-ref:// (transitional from previous saves) — keep as-is, handled in loadProject
      // data: URL — already serialized, keep as-is
      return { ...layer, srcOriginal: undefined }
    })
  )
}

// ─── Thumbnail ─────────────────────────────────────────────────────────────────

async function renderThumbnail(layers, slides, ratio, bgColor) {
  const thumbH = Math.round(THUMB_W * ratio.h / ratio.w)
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = thumbH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = slides[0]?.bgColor ?? bgColor
  ctx.fillRect(0, 0, THUMB_W, thumbH)

  const scale = THUMB_W / ratio.w
  const sliceEnd = ratio.w
  const slide0Layers = layers.filter(l => l.src && l.x < sliceEnd && l.x + l.w > 0)

  for (const layer of slide0Layers) {
    let src = layer.src
    if (!src) continue

    // Resolve blob-ref:// to data URL
    if (src.startsWith('blob-ref://')) {
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
        ctx.beginPath()
        ctx.rect(clipX, clipY, clipW, clipH)
        ctx.clip()
        ctx.globalAlpha = layer.opacity ?? 1
        const logW = layer.naturalW ?? img.naturalWidth
        const logH = layer.naturalH ?? img.naturalHeight
        const drawX = layer.x * scale + (layer.imgX ?? 0) * scale + inset
        const drawY = layer.y * scale + (layer.imgY ?? 0) * scale + inset
        const drawW = logW * (layer.imgScale ?? 1) * scale
        const drawH = logH * (layer.imgScale ?? 1) * scale
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, drawX, drawY, drawW, drawH)
        ctx.restore()
        resolve()
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
    id, name,
    updatedAt: Date.now(),
    thumbnail,
    slideCount: slides.length,
    state: { ratio, bgColor, bgGradient, slides, layers: serialized },
  })
}

export async function loadProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  const layers = await Promise.all(
    record.state.layers.map(async (layer) => {
      // Current format: data URL inline — use directly, no lookup needed
      if (layer.src?.startsWith('data:')) return { ...layer }

      // Transitional format: blob-ref:// pointing to data URL in blob store
      if (layer.src?.startsWith('blob-ref://')) {
        const dataURL = await dbGetBlob(layer.src.slice(10)).catch(() => null)
        if (dataURL) return { ...layer, src: dataURL }
        return { ...layer, src: null }
      }

      // Legacy format: ref:// with inline Blob in record.blobs.
      // iOS Safari may have corrupted these — check size > 0 before using.
      if (layer.src?.startsWith('ref://')) {
        const blob = record.blobs?.[layer.src.slice(6)]
        if (blob && blob.size > 0) {
          try { return { ...layer, src: await blobToDataURL(blob) } } catch {}
        }
        return { ...layer, src: null }
      }

      return { ...layer }
    })
  )

  // Async: re-save legacy projects with the new inline data URL format
  if (record.state.layers.some(l => l.src?.startsWith('ref://'))) {
    dbPut('projects', {
      ...record, blobs: undefined,
      state: { ...record.state, layers: layers.map(l => ({ ...l, srcOriginal: undefined })) },
    }).catch(() => {})
  }

  return {
    ...record.state,
    layers,
    projectId: record.id,
    projectName: record.name,
  }
}

export async function listProjects() {
  const all = await dbGetAll('projects')
  return all
    .map(r => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt,
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

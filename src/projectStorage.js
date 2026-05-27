import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbPutBlob, dbDeleteBlob } from './db'

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
// blob: URLs → data URL strings stored in the separate 'blobs' IDB store.
// The project record stays small (just layer metadata + blob-ref:// IDs).
// Data URL strings survive IDB on all platforms; Blob/ArrayBuffer objects don't on iOS.

async function serializeLayers(layers) {
  return Promise.all(
    layers.map(async (layer) => {
      if (layer.src?.startsWith('blob:')) {
        try {
          const blob = await fetch(layer.src).then(r => r.blob())
          const dataURL = await blobToDataURL(blob)
          await dbPutBlob(layer.id, dataURL)
          return { ...layer, src: 'blob-ref://' + layer.id, srcOriginal: undefined }
        } catch (e) {
          console.warn('Failed to serialize layer', layer.id, e)
          return { ...layer, srcOriginal: undefined }
        }
      }
      if (layer.src?.startsWith('blob-ref://')) {
        // Already serialized — data URL is already in blob store
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
      // Current format: blob-ref:// pointing to data URL in blob store
      if (layer.src?.startsWith('blob-ref://')) {
        const dataURL = await dbGetBlob(layer.src.slice(10)).catch(() => null)
        if (dataURL) return { ...layer, src: dataURL }
        // Blob store miss — layer will show as empty cell
        return { ...layer, src: null }
      }

      // Legacy format: ref:// with inline Blob objects in record.blobs.
      // iOS Safari may have stored these as empty Blobs — check size before use.
      if (layer.src?.startsWith('ref://')) {
        const legacyId = layer.src.slice(6)
        const blob = record.blobs?.[legacyId]
        if (blob && blob.size > 0) {
          try {
            // Convert to data URL and migrate to blob store for next load
            const dataURL = await blobToDataURL(blob)
            dbPutBlob(layer.id, dataURL).catch(() => {})
            return { ...layer, src: dataURL }
          } catch {
            return { ...layer, src: null }
          }
        }
        return { ...layer, src: null }
      }

      // data: URL (transitional format) — use directly
      return { ...layer }
    })
  )

  // If legacy format, re-save with blob-ref:// srcs and no inline blobs
  if (record.state.layers.some(l => l.src?.startsWith('ref://'))) {
    const migratedLayers = layers.map(l => ({
      ...l,
      src: l.src?.startsWith('data:') ? 'blob-ref://' + l.id : l.src,
      srcOriginal: undefined,
    }))
    dbPut('projects', {
      ...record, blobs: undefined,
      state: { ...record.state, layers: migratedLayers },
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

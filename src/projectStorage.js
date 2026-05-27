import { dbGet, dbPut, dbDelete, dbGetAll, dbGetBlob, dbPutBlob, dbDeleteBlob } from './db'

const THUMB_W = 240

// ─── Serialization ─────────────────────────────────────────────────────────────
// Convert blob: URLs → blob-ref://layerId and store the blob separately.
// The project record itself stores no blob data, so dbGet is near-instant.

async function serializeLayers(layers) {
  return Promise.all(
    layers.map(async (layer) => {
      if (layer.src?.startsWith('blob:')) {
        const blob = await fetch(layer.src).then(r => r.blob())
        await dbPutBlob(layer.id, blob)
        // srcOriginal is session-only — don't persist it (reopened projects
        // use the stored blob for both display and export, which is fine for
        // Instagram's 1080px output since we cap display at 2048px)
        return { ...layer, src: 'blob-ref://' + layer.id, srcOriginal: undefined }
      }
      if (layer.src?.startsWith('blob-ref://')) {
        // Already serialized from a previous save — blob is already in blob store
        return { ...layer, srcOriginal: undefined }
      }
      return { ...layer }
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

  const slideBg = (slides[0]?.bgColor) ?? bgColor
  ctx.fillStyle = slideBg
  ctx.fillRect(0, 0, THUMB_W, thumbH)

  const scale = THUMB_W / ratio.w
  const sliceStart = 0
  const sliceEnd = ratio.w
  const slide0Layers = layers.filter(l => l.src && l.x < sliceEnd && l.x + l.w > sliceStart)
  const tempURLs = []

  for (const layer of slide0Layers) {
    let src = layer.src
    if (!src) continue

    if (src.startsWith('blob-ref://')) {
      const blob = await dbGetBlob(src.slice(10))
      if (!blob) continue
      src = URL.createObjectURL(blob)
      tempURLs.push(src)
    }

    await new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const gap = (layer.cellGap ?? 0) * scale
        const inset = gap / 2
        const clipX = (Math.max(layer.x, sliceStart) - sliceStart) * scale + inset
        const clipW = (Math.min(layer.x + layer.w, sliceEnd) - Math.max(layer.x, sliceStart)) * scale - gap
        const clipY = layer.y * scale + inset
        const clipH = layer.h * scale - gap
        ctx.save()
        ctx.beginPath()
        ctx.rect(clipX, clipY, clipW, clipH)
        ctx.clip()
        ctx.globalAlpha = layer.opacity ?? 1
        const logW = layer.naturalW ?? img.naturalWidth
        const logH = layer.naturalH ?? img.naturalHeight
        const drawX = (layer.x - sliceStart) * scale + (layer.imgX ?? 0) * scale + inset
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

  tempURLs.forEach(u => URL.revokeObjectURL(u))
  return canvas.toDataURL('image/jpeg', 0.75)
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function saveProject(id, name, storeState) {
  const { ratio, bgColor, bgGradient, slides, layers } = storeState
  const serialized = await serializeLayers(layers)
  const thumbnail = await renderThumbnail(serialized, slides, ratio, bgColor)

  await dbPut('projects', {
    id,
    name,
    updatedAt: Date.now(),
    thumbnail,
    slideCount: slides.length,
    state: { ratio, bgColor, bgGradient, slides, layers: serialized },
  })
}

export async function loadProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  // Migrate legacy records that had inline blobs (old ref:// scheme)
  const layers = await Promise.all(
    record.state.layers.map(async (layer) => {
      if (layer.src?.startsWith('ref://')) {
        // Legacy inline blob — migrate to blob store
        const legacyId = layer.src.slice(6)
        const blob = record.blobs?.[legacyId]
        if (blob) {
          await dbPutBlob(layer.id, blob).catch(() => {})
          return { ...layer, src: 'blob-ref://' + layer.id, srcOriginal: undefined }
        }
      }
      return { ...layer }
    })
  )

  // If this was a legacy record, re-save without the inline blobs
  if (record.blobs) {
    const cleaned = { ...record, blobs: undefined }
    delete cleaned.blobs
    dbPut('projects', { ...record, blobs: undefined }).catch(() => {})
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
    await Promise.all(blobIds.map(id => dbDeleteBlob(id).catch(() => {})))
  }
  await dbDelete('projects', id)
}

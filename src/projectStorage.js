import { dbGet, dbPut, dbDelete, dbGetAll } from './db'

const THUMB_W = 240

// Convert blob: URLs to ref:// refs, collect blobs
async function serializeLayers(layers) {
  const blobs = {}
  const serialized = await Promise.all(
    layers.map(async (layer) => {
      if (layer.src && layer.src.startsWith('blob:')) {
        const blob = await fetch(layer.src).then(r => r.blob())
        blobs[layer.id] = blob
        return { ...layer, src: 'ref://' + layer.id }
      }
      return { ...layer }
    })
  )
  return { serialized, blobs }
}

// Render slide 0 to a small canvas for thumbnail
async function renderThumbnail(state, blobsDict, ratio) {
  const { slides, layers, bgColor } = state
  const thumbH = Math.round(THUMB_W * ratio.h / ratio.w)

  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = thumbH
  const ctx = canvas.getContext('2d')

  const slideBg = (slides[0] && slides[0].bgColor) ? slides[0].bgColor : bgColor
  ctx.fillStyle = slideBg
  ctx.fillRect(0, 0, THUMB_W, thumbH)

  const scale = THUMB_W / ratio.w
  const sliceStart = 0
  const sliceEnd = ratio.w

  // Layers in slide 0, in z-order
  const slide0Layers = layers.filter(l =>
    l.src && l.x < sliceEnd && l.x + l.w > sliceStart
  )

  const createdURLs = []

  for (const layer of slide0Layers) {
    let src = layer.src
    if (!src) continue

    let blobURL = null
    if (src.startsWith('ref://')) {
      const layerId = src.slice(6)
      const blob = blobsDict[layerId]
      if (!blob) continue
      blobURL = URL.createObjectURL(blob)
      src = blobURL
      createdURLs.push(blobURL)
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

        const drawX = (layer.x - sliceStart) * scale + (layer.imgX ?? 0) * scale + inset
        const drawY = layer.y * scale + (layer.imgY ?? 0) * scale + inset
        const drawW = img.naturalWidth * (layer.imgScale ?? 1) * scale
        const drawH = img.naturalHeight * (layer.imgScale ?? 1) * scale

        ctx.drawImage(img, drawX, drawY, drawW, drawH)
        ctx.restore()
        resolve()
      }
      img.onerror = resolve
      img.src = src
    })
  }

  // Revoke temp URLs
  createdURLs.forEach(u => URL.revokeObjectURL(u))

  return canvas.toDataURL('image/jpeg', 0.75)
}

export async function saveProject(id, name, storeState) {
  const { ratio, bgColor, slides, layers } = storeState

  const { serialized, blobs } = await serializeLayers(layers)

  const thumbnail = await renderThumbnail(
    { slides, layers: serialized, bgColor },
    blobs,
    ratio
  )

  const record = {
    id,
    name,
    updatedAt: Date.now(),
    thumbnail,
    state: { ratio, bgColor, slides, layers: serialized },
    blobs,
    slideCount: slides.length,
  }

  await dbPut('projects', record)
}

export async function loadProject(id) {
  const record = await dbGet('projects', id)
  if (!record) return null

  // Remap ref:// back to blob: URLs
  const layers = record.state.layers.map(layer => {
    if (layer.src && layer.src.startsWith('ref://')) {
      const layerId = layer.src.slice(6)
      const blob = record.blobs && record.blobs[layerId]
      if (blob) {
        return { ...layer, src: URL.createObjectURL(blob) }
      }
    }
    return { ...layer }
  })

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
  await dbDelete('projects', id)
}

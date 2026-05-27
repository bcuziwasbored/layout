// Canvas-based slide renderer. Single source of truth for any place that needs
// to draw a slide to a bitmap — export, slides panel thumbnails, project
// thumbnails (eventually). Renders text, shapes, images with crop/rotation/
// filters, gradient backgrounds, and free-rotation, identical to what the
// editor's Konva canvas shows.

import { dbGetBlob } from './db'
import { drawShapePath } from './shapes'

function linearGradientPoints(angleDeg, w, h) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const len = Math.abs(w * sin) + Math.abs(h * cos)
  const cx = w / 2, cy = h / 2
  return {
    x1: cx - sin * len / 2, y1: cy - cos * len / 2,
    x2: cx + sin * len / 2, y2: cy + cos * len / 2,
  }
}

function renderTextLayer(ctx, layer, sliceStart, sliceEnd) {
  if (layer.x >= sliceEnd || layer.x + layer.w <= sliceStart) return

  const x = layer.x - sliceStart
  const y = layer.y
  const w = layer.w
  const h = layer.h

  if (layer.textBg) {
    ctx.save()
    ctx.globalAlpha = (layer.textBgOpacity ?? 1) * (layer.opacity ?? 1)
    ctx.fillStyle = layer.textBg
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.globalAlpha = layer.opacity ?? 1

  const bold = layer.bold ? 'bold' : ''
  const italic = layer.italic ? 'italic' : ''
  const fontStyle = [italic, bold].filter(Boolean).join(' ') || 'normal'
  const fontSize = layer.fontSize ?? 72
  const fontFamily = layer.fontFamily ?? 'Inter'

  ctx.font = `${fontStyle} ${fontSize}px "${fontFamily}"`
  ctx.fillStyle = layer.color ?? '#000000'
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = `${layer.letterSpacing ?? 0}px`

  const align = layer.align ?? 'center'
  ctx.textAlign = align

  const lineHeightPx = (layer.lineHeight ?? 1.2) * fontSize

  const raw = layer.text ?? ''
  const paragraphs = raw.split('\n')
  const lines = []
  for (const para of paragraphs) {
    if (para === '') { lines.push(''); continue }
    const words = para.split(' ')
    let cur = ''
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word
      if (ctx.measureText(test).width > w && cur) { lines.push(cur); cur = word }
      else cur = test
    }
    if (cur) lines.push(cur)
  }

  const totalH = lines.length * lineHeightPx
  const va = layer.verticalAlign ?? 'middle'
  let baseY
  if (va === 'top')        baseY = y + fontSize
  else if (va === 'bottom') baseY = y + h - totalH + fontSize
  else                      baseY = y + (h - totalH) / 2 + fontSize

  const textX = align === 'left' ? x : align === 'right' ? x + w : x + w / 2

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, baseY + i * lineHeightPx)
  }
  ctx.restore()
}

function renderShapeLayer(ctx, layer, sliceStart) {
  const x = layer.x - sliceStart, y = layer.y, w = layer.w, h = layer.h
  ctx.save()
  ctx.globalAlpha = layer.opacity ?? 1
  if (layer.fill) {
    ctx.fillStyle = layer.fill
    ctx.beginPath()
    if (layer.shapeType === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    } else {
      drawShapePath(ctx, x, y, w, h, 'rect', layer.cornerRadius ?? 0)
    }
    ctx.fill()
  }
  const sw = layer.strokeWidth ?? 0
  if (sw > 0 && layer.stroke) {
    ctx.strokeStyle = layer.stroke
    ctx.lineWidth = sw
    ctx.beginPath()
    if (layer.shapeType === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    } else {
      drawShapePath(ctx, x, y, w, h, 'rect', layer.cornerRadius ?? 0)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// Resolve a layer's source URL to something usable by an Image element.
// Handles blob-ref:// (looks up data URL from IDB). preferOriginal uses the
// session-only full-res blob if available.
async function resolveLayerSrc(layer, preferOriginal) {
  let src = preferOriginal ? (layer.srcOriginal ?? layer.src) : layer.src
  if (src?.startsWith('blob-ref://')) {
    return await dbGetBlob(src.slice(10)).catch(() => null)
  }
  return src ?? null
}

// Load an image, with optional cache. Cache key is the resolved URL.
function loadImage(src, imgCache) {
  if (imgCache && imgCache.has(src)) {
    const cached = imgCache.get(src)
    // cached may be the Image or a pending promise
    return Promise.resolve(cached)
  }
  const promise = new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const p = img.decode ? img.decode() : Promise.resolve()
      p.catch(() => {}).then(() => resolve(img))
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
  if (imgCache) {
    promise.then(img => { if (img) imgCache.set(src, img) })
  }
  return promise
}

/**
 * Render a single slide to a JPEG data URL.
 * @param {number} slideIdx
 * @param {Object} args
 * @param {Array} args.slides
 * @param {Array} args.layers
 * @param {{w:number,h:number}} args.ratio
 * @param {string} args.bgColor
 * @param {Object} [args.bgGradient]
 * @param {number} [args.scale=1] - output pixel scale (e.g. 0.25 for thumbnails)
 * @param {number} [args.quality=0.95] - JPEG quality (0..1)
 * @param {boolean} [args.preferOriginal=true] - use srcOriginal when available
 * @param {Map} [args.imgCache] - shared cache to reuse images across calls
 * @returns {Promise<string>} data URL
 */
export async function renderSlide(slideIdx, args) {
  const {
    slides, layers, ratio, bgColor, bgGradient,
    scale = 1, quality = 0.95, preferOriginal = true, imgCache,
  } = args

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(ratio.w * scale))
  canvas.height = Math.max(1, Math.round(ratio.h * scale))
  const ctx = canvas.getContext('2d')
  // All subsequent drawing uses logical (ratio.w × ratio.h) coordinates.
  if (scale !== 1) ctx.scale(scale, scale)

  const grad = slides[slideIdx]?.bgGradient ?? bgGradient
  if (grad) {
    const { x1, y1, x2, y2 } = linearGradientPoints(grad.angle, ratio.w, ratio.h)
    const g = ctx.createLinearGradient(x1, y1, x2, y2)
    g.addColorStop(0, grad.stops[0])
    g.addColorStop(1, grad.stops[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = slides[slideIdx]?.bgColor ?? bgColor
  }
  ctx.fillRect(0, 0, ratio.w, ratio.h)

  const sliceStart = slideIdx * ratio.w
  const sliceEnd = (slideIdx + 1) * ratio.w

  const relevant = layers.filter(l => {
    if (!l.src && l.type !== 'text' && l.type !== 'shape') return false
    const fr = l.freeRotation ?? 0
    if (!fr) return l.x < sliceEnd && l.x + l.w > sliceStart
    const θ = Math.abs(fr) * Math.PI / 180
    const cx = l.x + l.w / 2
    const extHalfW = (Math.abs(l.w * Math.cos(θ)) + Math.abs(l.h * Math.sin(θ))) / 2
    return cx - extHalfW < sliceEnd && cx + extHalfW > sliceStart
  })

  // Resolve and load all image layers in parallel, sharing imgCache if given
  const imgByLayer = new Map()
  await Promise.all(
    relevant.filter(l => l.src).map(async layer => {
      const src = await resolveLayerSrc(layer, preferOriginal)
      if (!src) return
      const img = await loadImage(src, imgCache)
      if (img) imgByLayer.set(layer.id, img)
    })
  )

  await document.fonts.ready

  for (const layer of relevant) {
    const freeRot = layer.freeRotation ?? 0
    if (freeRot) {
      ctx.save()
      const cx = (layer.x - sliceStart) + layer.w / 2
      const cy = layer.y + layer.h / 2
      ctx.translate(cx, cy)
      ctx.rotate(freeRot * Math.PI / 180)
      ctx.translate(-cx, -cy)
    }

    if (layer.src) {
      const img = imgByLayer.get(layer.id)
      if (!img) {
        if (freeRot) ctx.restore()
        continue
      }

      const gap = layer.cellGap ?? 0
      const inset = gap / 2
      const cr  = layer.cornerRadius ?? 0
      const bw  = layer.borderWidth ?? 0
      const bc  = layer.borderColor ?? '#000000'
      const shape = layer.shape ?? 'rect'

      const clipX = freeRot
        ? (layer.x - sliceStart) + inset
        : Math.max(layer.x, sliceStart) - sliceStart + inset
      const clipW = freeRot
        ? layer.w - gap
        : Math.min(layer.x + layer.w, sliceEnd) - Math.max(layer.x, sliceStart) - gap
      const clipY = layer.y + inset
      const clipH = layer.h - gap

      ctx.save()
      ctx.beginPath()
      drawShapePath(ctx, clipX, clipY, clipW, clipH, shape, cr)
      ctx.clip()
      ctx.globalAlpha = layer.opacity ?? 1

      const b = layer.brightness ?? 0, c = layer.contrast ?? 0, s = layer.saturation ?? 0
      if (b || c || s) {
        ctx.filter = `brightness(${1 + b / 100}) contrast(${1 + c / 100}) saturate(${1 + s / 100})`
      }

      const drawX = (layer.x - sliceStart) + (layer.imgX ?? 0) + inset
      const drawY = layer.y + (layer.imgY ?? 0) + inset
      const logW = layer.naturalW ?? img.naturalWidth
      const logH = layer.naturalH ?? img.naturalHeight
      const drawW = logW * (layer.imgScale ?? 1)
      const drawH = logH * (layer.imgScale ?? 1)
      const rotation = layer.rotation ?? 0
      const flipH = layer.flipH ?? false
      const flipV = layer.flipV ?? false
      if (rotation || flipH || flipV) {
        const frameCX = (layer.x - sliceStart) + layer.w / 2
        const frameCY = layer.y + layer.h / 2
        ctx.translate(frameCX, frameCY)
        if (flipH) ctx.scale(-1, 1)
        if (flipV) ctx.scale(1, -1)
        if (rotation) ctx.rotate(rotation * Math.PI / 180)
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
          drawX - frameCX, drawY - frameCY, drawW, drawH)
      } else {
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
          drawX, drawY, drawW, drawH)
      }
      ctx.filter = 'none'
      ctx.restore()

      if (bw > 0) {
        ctx.save()
        ctx.strokeStyle = bc
        ctx.lineWidth = bw
        ctx.globalAlpha = layer.opacity ?? 1
        ctx.beginPath()
        drawShapePath(ctx, clipX, clipY, clipW, clipH, shape, cr)
        ctx.stroke()
        ctx.restore()
      }
    } else if (layer.type === 'text') {
      renderTextLayer(ctx, layer, sliceStart, sliceEnd)
    } else if (layer.type === 'shape') {
      renderShapeLayer(ctx, layer, sliceStart)
    }

    if (freeRot) ctx.restore()
  }

  return canvas.toDataURL('image/jpeg', quality)
}

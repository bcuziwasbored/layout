import { useEffect, useState } from 'react'
import { useStore } from '../useStore'

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

// ─── Text rendering helper ─────────────────────────────────────────────────────

function renderTextLayer(ctx, layer, sliceStart, sliceEnd) {
  if (layer.x >= sliceEnd || layer.x + layer.w <= sliceStart) return

  const x = layer.x - sliceStart
  const y = layer.y
  const w = layer.w
  const h = layer.h

  // Text background
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

  const bold     = layer.bold   ? 'bold'   : ''
  const italic   = layer.italic ? 'italic' : ''
  const fontStyle = [italic, bold].filter(Boolean).join(' ') || 'normal'
  const fontSize  = layer.fontSize ?? 72
  const fontFamily = layer.fontFamily ?? 'Inter'

  ctx.font = `${fontStyle} ${fontSize}px "${fontFamily}"`
  ctx.fillStyle  = layer.color ?? '#000000'
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = `${layer.letterSpacing ?? 0}px`

  const align = layer.align ?? 'center'
  ctx.textAlign = align

  const lineHeightPx = (layer.lineHeight ?? 1.2) * fontSize

  // Word-wrap
  const raw = layer.text ?? ''
  const paragraphs = raw.split('\n')
  const lines = []
  for (const para of paragraphs) {
    if (para === '') { lines.push(''); continue }
    const words = para.split(' ')
    let cur = ''
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word
      if (ctx.measureText(test).width > w && cur) {
        lines.push(cur)
        cur = word
      } else {
        cur = test
      }
    }
    if (cur) lines.push(cur)
  }

  const totalH = lines.length * lineHeightPx
  const va = layer.verticalAlign ?? 'middle'
  let baseY
  if (va === 'top')        baseY = y + fontSize
  else if (va === 'bottom') baseY = y + h - totalH + fontSize
  else                      baseY = y + (h - totalH) / 2 + fontSize // middle

  const textX = align === 'left' ? x : align === 'right' ? x + w : x + w / 2

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, baseY + i * lineHeightPx)
  }

  ctx.restore()
}

// ─── Shape rendering helper ────────────────────────────────────────────────────

function roundRectPath(ctx, x, y, w, h, r) {
  const cr = Math.min(r, w / 2, h / 2)
  if (cr <= 0) { ctx.rect(x, y, w, h); return }
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, cr); return }
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y); ctx.arcTo(x + w, y, x + w, y + cr, cr)
  ctx.lineTo(x + w, y + h - cr); ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr)
  ctx.lineTo(x + cr, y + h); ctx.arcTo(x, y + h, x, y + h - cr, cr)
  ctx.lineTo(x, y + cr); ctx.arcTo(x, y, x + cr, y, cr)
  ctx.closePath()
}

function renderShapeLayer(ctx, layer, sliceStart) {
  const x = layer.x - sliceStart, y = layer.y, w = layer.w, h = layer.h
  ctx.save()
  ctx.globalAlpha = layer.opacity ?? 1
  if (layer.fill) {
    ctx.fillStyle = layer.fill
    ctx.beginPath()
    if (layer.shapeType === 'circle') {
      ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2)
    } else {
      roundRectPath(ctx, x, y, w, h, layer.cornerRadius ?? 0)
    }
    ctx.fill()
  }
  const sw = layer.strokeWidth ?? 0
  if (sw > 0 && layer.stroke) {
    ctx.strokeStyle = layer.stroke
    ctx.lineWidth = sw
    ctx.beginPath()
    if (layer.shapeType === 'circle') {
      ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2)
    } else {
      roundRectPath(ctx, x, y, w, h, layer.cornerRadius ?? 0)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ─── Slide renderer ────────────────────────────────────────────────────────────

async function renderSlide(slideIdx, slides, layers, ratio, bgColor, globalBgGradient) {
  const canvas = document.createElement('canvas')
  canvas.width = ratio.w
  canvas.height = ratio.h
  const ctx = canvas.getContext('2d')

  const grad = slides[slideIdx]?.bgGradient ?? globalBgGradient
  if (grad) {
    const { x1, y1, x2, y2 } = linearGradientPoints(grad.angle, ratio.w, ratio.h)
    const g = ctx.createLinearGradient(x1, y1, x2, y2)
    g.addColorStop(0, grad.stops[0])
    g.addColorStop(1, grad.stops[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = bgColor
  }
  ctx.fillRect(0, 0, ratio.w, ratio.h)

  const sliceStart = slideIdx * ratio.w
  const sliceEnd = (slideIdx + 1) * ratio.w

  // All relevant layers (images, text, shapes) in z-order
  const relevant = layers.filter(l =>
    (l.src || l.type === 'text' || l.type === 'shape') &&
    l.x < sliceEnd && l.x + l.w > sliceStart
  )

  // Pre-load all image layers into a Map
  const imgMap = new Map()
  await Promise.all(
    relevant.filter(l => l.src).map(layer => new Promise(resolve => {
      const img = new Image()
      img.onload = () => { imgMap.set(layer.id, img); resolve() }
      img.onerror = resolve
      img.src = layer.src
    }))
  )

  await document.fonts.ready

  // Render ALL relevant layers in z-order
  for (const layer of relevant) {
    if (layer.src) {
      const img = imgMap.get(layer.id)
      if (!img) continue

      const gap = layer.cellGap ?? 0
      const inset = gap / 2
      const cr  = layer.cornerRadius ?? 0
      const bw  = layer.borderWidth ?? 0
      const bc  = layer.borderColor ?? '#000000'

      const clipX = Math.max(layer.x, sliceStart) - sliceStart + inset
      const clipW = Math.min(layer.x + layer.w, sliceEnd) - Math.max(layer.x, sliceStart) - gap
      const clipY = layer.y + inset
      const clipH = layer.h - gap

      ctx.save()
      ctx.beginPath()
      roundRectPath(ctx, clipX, clipY, clipW, clipH, cr)
      ctx.clip()
      ctx.globalAlpha = layer.opacity ?? 1

      // Apply image adjustments
      const b = layer.brightness ?? 0, c = layer.contrast ?? 0, s = layer.saturation ?? 0
      if (b || c || s) {
        ctx.filter = `brightness(${1 + b/100}) contrast(${1 + c/100}) saturate(${1 + s/100})`
      }

      const drawX = (layer.x - sliceStart) + (layer.imgX ?? 0) + inset
      const drawY = layer.y + (layer.imgY ?? 0) + inset
      const drawW = img.naturalWidth  * (layer.imgScale ?? 1)
      const drawH = img.naturalHeight * (layer.imgScale ?? 1)
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
        ctx.drawImage(img, drawX - frameCX, drawY - frameCY, drawW, drawH)
      } else {
        ctx.drawImage(img, drawX, drawY, drawW, drawH)
      }
      ctx.filter = 'none'
      ctx.restore()

      // Border drawn on top, outside the clip
      if (bw > 0) {
        ctx.save()
        ctx.strokeStyle = bc
        ctx.lineWidth = bw
        ctx.globalAlpha = layer.opacity ?? 1
        ctx.beginPath()
        roundRectPath(ctx, clipX, clipY, clipW, clipH, cr)
        ctx.stroke()
        ctx.restore()
      }
    } else if (layer.type === 'text') {
      renderTextLayer(ctx, layer, sliceStart, sliceEnd)
    } else if (layer.type === 'shape') {
      renderShapeLayer(ctx, layer, sliceStart)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.95)
}

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(data)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

async function downloadAll(rendered) {
  const files = rendered.map((src, i) => {
    const blob = dataURLtoBlob(src)
    return new File([blob], `slide-${i + 1}.jpg`, { type: 'image/jpeg' })
  })

  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files })
    } catch (err) {
      // User cancelled or share failed — silently ignore
    }
    return
  }

  // Fallback: download links — sequential, waiting for each save dialog to close
  // before triggering the next one. Works for both auto-download browsers (no dialog
  // → short timeout) and "ask where to save" browsers (waits for focus to return).
  const triggerDownload = (src, filename) => {
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const waitForDialogClose = () => new Promise(resolve => {
    let blurred = false
    const onBlur  = () => { blurred = true }
    const onFocus = () => {
      if (!blurred) return
      cleanup()
      setTimeout(resolve, 150) // small buffer after dialog closes
    }
    const cleanup = () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      clearTimeout(autoTimer)
    }
    // If the window never loses focus (auto-download, no dialog), proceed after 400ms
    const autoTimer = setTimeout(() => { cleanup(); resolve() }, 400)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
  });

  (async () => {
    for (let i = 0; i < rendered.length; i++) {
      triggerDownload(rendered[i], `slide-${i + 1}.jpg`)
      if (i < rendered.length - 1) await waitForDialogClose()
    }
  })()
}

function canUseWebShare(rendered) {
  if (!rendered.length) return false
  if (!navigator.canShare) return false
  try {
    const testFile = new File([new Blob([''])], 'test.jpg', { type: 'image/jpeg' })
    return navigator.canShare({ files: [testFile] })
  } catch {
    return false
  }
}

export default function ExportScreen({ onClose }) {
  const slides      = useStore(s => s.slides)
  const layers      = useStore(s => s.layers)
  const ratio       = useStore(s => s.ratio)
  const bgColor     = useStore(s => s.bgColor)
  const bgGradient  = useStore(s => s.bgGradient)

  const [rendered, setRendered] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    Promise.all(slides.map((slide, i) => renderSlide(i, slides, layers, ratio, slide.bgColor ?? bgColor, bgGradient)))
      .then(setRendered)
  }, [])

  // Preview size: fit within screen on both axes, maintain aspect ratio
  const maxW = window.innerWidth - 48
  const maxH = Math.min(460, window.innerHeight * 0.55)
  const scale = Math.min(maxW / ratio.w, maxH / ratio.h)
  const PREVIEW_W = Math.round(ratio.w * scale)
  const PREVIEW_H = Math.round(ratio.h * scale)

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 pb-4 shrink-0"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button onClick={onClose} className="text-white/60 text-sm active:text-white">Cancel</button>
        <span className="font-semibold text-base">Export</span>
        <div className="w-14" />
      </div>

      {/* Horizontal scroll carousel preview */}
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div
          className="overflow-x-auto overflow-y-hidden"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          onScroll={e => {
            const el = e.currentTarget
            const idx = Math.round(el.scrollLeft / (PREVIEW_W + 12))
            setActiveIdx(idx)
          }}
        >
          <div className="flex gap-3 px-6" style={{ width: 'max-content' }}>
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className="shrink-0 rounded-xl overflow-hidden shadow-2xl"
                style={{
                  width: PREVIEW_W,
                  height: PREVIEW_H,
                  background: slide.bgColor ?? bgColor,
                  scrollSnapAlign: 'center',
                }}
              >
                {rendered[i] ? (
                  <img src={rendered[i]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-black/30 text-sm">Rendering…</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIdx ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails + download button */}
      <div className="shrink-0 px-5" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {/* Thumbnail strip */}
        <div className="flex gap-2 overflow-x-auto pb-3">
          {rendered.map((src, i) => (
            <a
              key={i}
              href={src}
              download={`slide-${i + 1}.jpg`}
              className="relative shrink-0 active:opacity-60"
            >
              <img
                src={src}
                className="rounded-lg object-cover"
                style={{ height: 72, width: Math.round(72 * ratio.w / ratio.h) }}
                alt={`Slide ${i + 1}`}
              />
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                {i + 1}
              </div>
            </a>
          ))}
          {!rendered.length && (
            <div className="text-white/30 text-xs py-4">Rendering…</div>
          )}
        </div>

        {/* Download/Share all button */}
        <button
          onClick={() => downloadAll(rendered)}
          disabled={rendered.length === 0}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-70 disabled:opacity-30"
          style={{ background: 'white', color: 'black' }}
        >
          {rendered.length === 0
            ? 'Rendering…'
            : canUseWebShare(rendered)
              ? 'Share'
              : `Download ${rendered.length === 1 ? 'Image' : `All ${rendered.length} Images`}`}
        </button>
      </div>
    </div>
  )
}

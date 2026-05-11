import { useEffect, useState } from 'react'
import { useStore } from '../useStore'

// ─── Text rendering helper ─────────────────────────────────────────────────────

function renderTextLayer(ctx, layer, sliceStart, sliceEnd) {
  if (layer.x >= sliceEnd || layer.x + layer.w <= sliceStart) return

  const x = layer.x - sliceStart
  const y = layer.y
  const w = layer.w
  const h = layer.h

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

// ─── Slide renderer ────────────────────────────────────────────────────────────

async function renderSlide(slideIdx, slides, layers, ratio, bgColor) {
  const canvas = document.createElement('canvas')
  canvas.width = ratio.w
  canvas.height = ratio.h
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, ratio.w, ratio.h)

  // Layers whose x range intersects this slide
  const sliceStart = slideIdx * ratio.w
  const sliceEnd = (slideIdx + 1) * ratio.w
  const relevant = layers.filter(l => (l.src || l.type === 'text') && l.x < sliceEnd && l.x + l.w > sliceStart)

  // Helper: draw a rounded-rect path on a 2D canvas context
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

  // Render image layers
  await Promise.all(relevant.filter(l => l.src).map(layer => new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const gap = layer.cellGap ?? 0
      const inset = gap / 2
      const cr  = layer.cornerRadius ?? 0
      const bw  = layer.borderWidth ?? 0
      const bc  = layer.borderColor ?? '#000000'

      // Clip rect accounts for inset, constrained to this slide's x range
      const clipX = Math.max(layer.x, sliceStart) - sliceStart + inset
      const clipW = Math.min(layer.x + layer.w, sliceEnd) - Math.max(layer.x, sliceStart) - gap
      const clipY = layer.y + inset
      const clipH = layer.h - gap

      ctx.save()
      ctx.beginPath()
      roundRectPath(ctx, clipX, clipY, clipW, clipH, cr)
      ctx.clip()
      ctx.globalAlpha = layer.opacity ?? 1

      // Image position: imgX/imgY are relative to the inner (inset) frame
      const drawX = (layer.x - sliceStart) + (layer.imgX ?? 0) + inset
      const drawY = layer.y + (layer.imgY ?? 0) + inset
      const drawW = img.naturalWidth  * (layer.imgScale ?? 1)
      const drawH = img.naturalHeight * (layer.imgScale ?? 1)
      const rotation = layer.rotation ?? 0
      const flipH = layer.flipH ?? false
      const flipV = layer.flipV ?? false
      if (rotation || flipH || flipV) {
        // Transforms around inner-frame center
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

      resolve()
    }
    img.onerror = resolve
    img.src = layer.src
  })))

  // Render text layers (in z-order, after images)
  await document.fonts.ready
  for (const layer of relevant.filter(l => l.type === 'text')) {
    renderTextLayer(ctx, layer, sliceStart, sliceEnd)
  }

  return canvas.toDataURL('image/jpeg', 0.95)
}

export default function ExportScreen({ onClose }) {
  const slides = useStore(s => s.slides)
  const layers = useStore(s => s.layers)
  const ratio = useStore(s => s.ratio)
  const bgColor = useStore(s => s.bgColor)

  const [rendered, setRendered] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    Promise.all(slides.map((_, i) => renderSlide(i, slides, layers, ratio, bgColor)))
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
                  background: bgColor,
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

      {/* Instructions + thumbnails to long-press save */}
      <div className="shrink-0 px-5 pb-8">
        <p className="text-center text-white/40 text-xs mb-3">Long-press an image to save to Photos</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rendered.map((src, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={src}
                className="rounded-lg object-cover"
                style={{ height: 72, width: Math.round(72 * ratio.w / ratio.h) }}
                alt={`Slide ${i + 1}`}
              />
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                {i + 1}
              </div>
            </div>
          ))}
          {!rendered.length && (
            <div className="text-white/30 text-xs py-4">Rendering…</div>
          )}
        </div>
      </div>
    </div>
  )
}

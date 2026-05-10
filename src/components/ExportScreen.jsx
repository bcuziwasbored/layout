import { useEffect, useRef, useState } from 'react'
import { useStore } from '../useStore'

function renderSlide(slide, ratio, bgColor) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    canvas.width = ratio.w
    canvas.height = ratio.h
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, ratio.w, ratio.h)

    const layers = slide.layers.filter(l => l.src)
    if (!layers.length) { resolve(canvas.toDataURL('image/jpeg', 0.95)); return }

    let loaded = 0
    layers.forEach(layer => {
      const img = new Image()
      img.onload = () => {
        ctx.save()
        ctx.globalAlpha = layer.opacity ?? 1

        // Clip to cell bounds
        ctx.beginPath()
        ctx.rect(layer.x, layer.y, layer.w, layer.h)
        ctx.clip()

        // Draw image with pan/zoom offset
        const imgW = img.naturalWidth * (layer.imgScale ?? 1)
        const imgH = img.naturalHeight * (layer.imgScale ?? 1)
        ctx.drawImage(img, layer.x + (layer.imgX ?? 0), layer.y + (layer.imgY ?? 0), imgW, imgH)

        ctx.restore()
        loaded++
        if (loaded === layers.length) {
          resolve(canvas.toDataURL('image/jpeg', 0.95))
        }
      }
      img.src = layer.src
    })
  })
}

export default function ExportScreen({ onClose }) {
  const slides = useStore(s => s.slides)
  const ratio = useStore(s => s.ratio)
  const bgColor = useStore(s => s.bgColor)

  const [rendered, setRendered] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    Promise.all(slides.map(s => renderSlide(s, ratio, bgColor))).then(setRendered)
  }, [slides, ratio, bgColor])

  const PREVIEW_H = Math.min(420, window.innerHeight * 0.55)
  const PREVIEW_W = Math.round(PREVIEW_H * (ratio.w / ratio.h))

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pb-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="text-white/60 text-sm active:text-white">Cancel</button>
        <span className="font-semibold text-base">Export</span>
        <div className="w-16" />
      </div>

      {/* Preview */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 overflow-hidden">
        <div
          className="rounded-xl overflow-hidden bg-white shadow-2xl"
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
        >
          {rendered[activeIdx] ? (
            <img src={rendered[activeIdx]} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center">
              <span className="text-white/40 text-sm">Rendering…</span>
            </div>
          )}
        </div>

        {/* Slide dots */}
        {slides.length > 1 && (
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === activeIdx ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center text-white/40 text-xs px-6 mb-2">
        Long-press each image below to save to Photos
      </div>

      {/* Exportable images - long-press to save */}
      <div className="px-4 pb-6">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {rendered.map((src, i) => (
            <div key={i} className="relative shrink-0">
              <img
                src={src}
                className="rounded-xl object-cover"
                style={{ height: 80, width: Math.round(80 * ratio.w / ratio.h) }}
                alt={`Slide ${i + 1}`}
              />
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
                {i + 1}
              </div>
            </div>
          ))}
          {rendered.length === 0 && (
            <div className="text-white/30 text-xs py-6 px-4">Rendering slides…</div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useStore } from '../useStore'
import { renderSlide } from '../renderSlide'



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

  const [renderKey, setRenderKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Share image loads across all slides via imgCache (avoids reloading the
    // same blob for layers that appear on multiple slides).
    const imgCache = new Map()
    Promise.all(
      slides.map((_, i) =>
        renderSlide(i, { slides, layers, ratio, bgColor, bgGradient, imgCache })
      )
    )
      .then(results => { if (!cancelled) setRendered(results) })
      .catch(err => {
        console.error('Export render failed:', err)
        // Leave rendered empty so the user sees "Rendering…" and can retry
      })
    return () => { cancelled = true }
  }, [renderKey])

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
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
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
            <div className="flex items-center gap-3 py-2">
              <div className="text-white/30 text-xs">Rendering…</div>
              <button
                onClick={() => setRenderKey(k => k + 1)}
                className="text-white/50 text-xs bg-white/10 px-3 py-1 rounded-full active:bg-white/20">
                Retry
              </button>
            </div>
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

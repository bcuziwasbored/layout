import { useEffect, useState } from 'react'
import { useStore } from '../useStore'
import { renderSlide } from '../renderSlide'

// Persisted export options. Kept in localStorage (no server-side state) so the
// last-used format/resolution/quality stick across exports and sessions.
const OPTS_KEY = 'export-options-v1'
const QUALITY_PRESETS = { standard: 0.9, high: 0.95 }

function loadOptions() {
  const defaults = { format: 'jpeg', scale: 1, quality: 'high' }
  try {
    const saved = JSON.parse(localStorage.getItem(OPTS_KEY))
    if (!saved || typeof saved !== 'object') return defaults
    return {
      format: saved.format === 'png' ? 'png' : 'jpeg',
      scale: saved.scale === 2 ? 2 : 1,
      quality: saved.quality === 'standard' ? 'standard' : 'high',
    }
  } catch {
    return defaults
  }
}

function saveOptions(opts) {
  try {
    localStorage.setItem(OPTS_KEY, JSON.stringify(opts))
  } catch {
    /* storage full or blocked — options just won't persist */
  }
}

const extFor = (format) => (format === 'png' ? 'png' : 'jpg')

function dataURLtoBlob(dataURL) {
  const [header, data] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(data)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

function fileFromDataURL(dataURL, filename) {
  const blob = dataURLtoBlob(dataURL)
  // Mime is carried in the data-URL header, so File type follows the chosen format.
  return new File([blob], filename, { type: blob.type })
}

function canShareFiles(files) {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files })
}

// Detect the right delivery channel *once* — these don't change during the
// session. `standalone` = installed PWA with no browser chrome / download
// manager (iOS home-screen app). `fileShare` = the Web Share API can share
// actual files (iOS 15+, Android Chrome). We deliberately avoid UA sniffing.
function detectDelivery() {
  const standalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true

  let fileShare = false
  try {
    const testFile = new File([new Blob([''], { type: 'image/jpeg' })], 'test.jpg', {
      type: 'image/jpeg',
    })
    fileShare = canShareFiles([testFile])
  } catch {
    /* canShare unsupported — leave fileShare false */
  }

  // 'share'    → invoke the OS share sheet (Save to Photos, etc.)
  // 'download' → real <a download> links work (desktop / in-browser)
  // 'open'     → no share, no download manager: open the image so the user can
  //              long-press → Save. Rare (a standalone PWA without file share).
  let mode
  if (fileShare) mode = 'share'
  else if (!standalone) mode = 'download'
  else mode = 'open'

  return { standalone, fileShare, mode }
}

// Open an image in a new tab (blob URL). Fallback when neither the share sheet
// nor a real download is available — the user long-presses to save.
function openInNewTab(dataURL) {
  const url = URL.createObjectURL(dataURLtoBlob(dataURL))
  window.open(url, '_blank', 'noopener')
  // Give the new tab time to load before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Trigger a native download via an <a download>. Only used on platforms where
// this actually works (desktop / in-browser), and always synchronously inside
// the originating user gesture so the browser doesn't block it.
function triggerDownload(dataURL, filename) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Per-slide save. Shares the single file via the OS share sheet when possible,
// otherwise opens it in a new tab. (Desktop uses a real <a download> in the
// markup and never reaches here.)
async function saveOne(dataURL, index, ext) {
  const file = fileFromDataURL(dataURL, `slide-${index + 1}.${ext}`)
  if (canShareFiles([file])) {
    try {
      await navigator.share({ files: [file], title: `Slide ${index + 1}` })
    } catch {
      /* user cancelled or share failed — ignore */
    }
    return
  }
  openInNewTab(dataURL)
}

// Save every slide in a single user gesture. With file share we hand the whole
// batch to one share sheet; on desktop we fire all downloads synchronously
// (never behind awaited timeouts, which browsers block as non-gesture).
async function saveAll(rendered, mode, ext) {
  if (mode === 'share') {
    const files = rendered.map((src, i) => fileFromDataURL(src, `slide-${i + 1}.${ext}`))
    if (canShareFiles(files)) {
      try {
        await navigator.share({ files })
      } catch {
        /* user cancelled or share failed — ignore */
      }
      return
    }
  }
  // Desktop / in-browser: synchronous downloads within this gesture.
  rendered.forEach((src, i) => triggerDownload(src, `slide-${i + 1}.${ext}`))
}

export default function ExportScreen({ onClose }) {
  const slides      = useStore(s => s.slides)
  const layers      = useStore(s => s.layers)
  const ratio       = useStore(s => s.ratio)
  const bgColor     = useStore(s => s.bgColor)
  const bgGradient  = useStore(s => s.bgGradient)

  // `rendered` grows one entry at a time, in slide order, as each slide
  // finishes; `renderDone` flips true once every slide is rendered.
  const [rendered, setRendered] = useState([])
  const [renderDone, setRenderDone] = useState(false)
  const [error, setError] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  // Image-load failures surfaced by renderSlide during this run. `failedCount`
  // counts unique photos (by layer id); `failedSlides` marks which slides are
  // affected so we can flag their thumbnails before the user shares/saves.
  const [failedCount, setFailedCount] = useState(0)
  const [failedSlides, setFailedSlides] = useState(() => new Set())

  const [renderKey, setRenderKey] = useState(0)

  // Output options (persisted). `format` → jpeg|png, `scale` → 1|2 (2160px at 2×),
  // `quality` → jpeg-quality preset key (ignored for PNG).
  const [options, setOptions] = useState(loadOptions)
  const { format, scale: outScale, quality: qualityKey } = options
  const ext = extFor(format)

  // Delivery channel is fixed for the session; compute it once.
  const [{ mode }] = useState(detectDelivery)

  // Change an option: persist it and kick off a fresh render (reusing the same
  // renderKey/retry machinery so the serial render restarts cleanly).
  const updateOption = (patch) => {
    setOptions(prev => {
      const next = { ...prev, ...patch }
      saveOptions(next)
      return next
    })
    retry()
  }

  useEffect(() => {
    let cancelled = false
    // One image cache per export run: it dedupes decodes so each unique
    // original is decoded exactly once (a layer shared across slides isn't
    // re-decoded), and it's discarded when the run ends so nothing is pinned in
    // memory across runs. Slides render serially rather than all at once so we
    // never hold many full-res decodes concurrently — the failure mode that
    // crashes iOS Safari on many-slide projects of large photos.
    const imgCache = new Map()
    const failedLayerIds = new Set()
    const affectedSlides = new Set()
    const acc = []

    async function run() {
      for (let i = 0; i < slides.length; i++) {
        if (cancelled) return
        try {
          const url = await renderSlide(i, {
            slides, layers, ratio, bgColor, bgGradient, imgCache,
            scale: outScale,
            format,
            quality: QUALITY_PRESETS[qualityKey],
            onImageError: (layer) => {
              failedLayerIds.add(layer.id)
              affectedSlides.add(i)
            },
          })
          if (cancelled) return
          acc[i] = url
          setRendered(acc.slice())
          if (failedLayerIds.size > 0) {
            setFailedCount(failedLayerIds.size)
            setFailedSlides(new Set(affectedSlides))
          }
        } catch (err) {
          console.error('Export render failed:', err)
          if (!cancelled) setError(true)
          return
        }
      }
      if (!cancelled) setRenderDone(true)
    }
    run()
    return () => { cancelled = true }
  }, [renderKey])

  const retry = () => {
    setError(false)
    setRendered([])
    setRenderDone(false)
    setFailedCount(0)
    setFailedSlides(new Set())
    setRenderKey(k => k + 1)
  }

  const isRendering = !error && !renderDone

  // Preview size: fit within screen on both axes, maintain aspect ratio
  const maxW = window.innerWidth - 48
  const maxH = Math.min(460, window.innerHeight * 0.55)
  const scale = Math.min(maxW / ratio.w, maxH / ratio.h)
  const PREVIEW_W = Math.round(ratio.w * scale)
  const PREVIEW_H = Math.round(ratio.h * scale)

  const saveAllLabel =
    mode === 'share'
      ? rendered.length === 1 ? 'Share Image' : `Share All ${rendered.length} Images`
      : `Download ${rendered.length === 1 ? 'Image' : `All ${rendered.length} Images`}`

  // Slides render serially and `rendered` grows one entry at a time, so its
  // length is how many have finished — show it as a counter on multi-slide runs.
  const progressLabel =
    slides.length > 1 ? `Rendering… ${rendered.length}/${slides.length}` : 'Rendering…'

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

      {/* Main area: error state, or the slide carousel */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-white font-semibold text-base">Couldn’t render your slides</div>
          <div className="text-white/50 text-sm">Something went wrong while exporting. Please try again.</div>
          <button
            onClick={retry}
            className="mt-2 px-6 py-3 rounded-2xl font-semibold text-base active:opacity-70"
            style={{ background: 'white', color: 'black' }}
          >
            Retry
          </button>
        </div>
      ) : (
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
                  <div className="relative w-full h-full">
                    <img src={rendered[i]} className="w-full h-full object-cover" alt="" />
                    {failedSlides.has(i) && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-black text-[11px] font-semibold px-2 py-1 rounded-full shadow">
                        <span aria-hidden>⚠</span> Photo missing
                      </div>
                    )}
                  </div>
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
      )}

      {/* Thumbnails + save controls */}
      {!error && (
      <div className="shrink-0 px-5" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {/* Thumbnail strip — each tile saves its own slide */}
        <div className="flex gap-2 overflow-x-auto pb-3">
          {rendered.map((src, i) => {
            const isFailed = failedSlides.has(i)
            const thumb = (
              <>
                <img
                  src={src}
                  className={`rounded-lg object-cover ${isFailed ? 'ring-2 ring-amber-500' : ''}`}
                  style={{ height: 72, width: Math.round(72 * ratio.w / ratio.h) }}
                  alt={`Slide ${i + 1}${isFailed ? ' (photo missing)' : ''}`}
                />
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                  {i + 1}
                </div>
                {isFailed && (
                  <div className="absolute top-1 right-1 bg-amber-500 text-black text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow">
                    !
                  </div>
                )}
              </>
            )
            // Desktop: real download link (works natively). Elsewhere: a button
            // that opens the share sheet / a new tab inside the tap gesture.
            return mode === 'download' ? (
              <a
                key={i}
                href={src}
                download={`slide-${i + 1}.${ext}`}
                className="relative shrink-0 active:opacity-60"
              >
                {thumb}
              </a>
            ) : (
              <button
                key={i}
                onClick={() => saveOne(src, i, ext)}
                className="relative shrink-0 active:opacity-60"
              >
                {thumb}
              </button>
            )
          })}
          {isRendering && (
            <div className="flex items-center gap-3 py-2">
              <div className="text-white/30 text-xs whitespace-nowrap">{progressLabel}</div>
              <button
                onClick={retry}
                className="text-white/50 text-xs bg-white/10 px-3 py-1 rounded-full active:bg-white/20">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Output options — format / resolution / JPEG quality. Changing any of
            these persists the choice and restarts the serial render. */}
        <div className="flex items-center gap-2 mb-3 text-xs">
          <div className="flex bg-white/10 rounded-full p-0.5">
            {['jpeg', 'png'].map(f => (
              <button
                key={f}
                onClick={() => format !== f && updateOption({ format: f })}
                aria-pressed={format === f}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  format === f ? 'bg-white text-black' : 'text-white/50 active:text-white'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex bg-white/10 rounded-full p-0.5">
            {[1, 2].map(s => (
              <button
                key={s}
                onClick={() => outScale !== s && updateOption({ scale: s })}
                aria-pressed={outScale === s}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  outScale === s ? 'bg-white text-black' : 'text-white/50 active:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          {format === 'jpeg' && (
            <div className="flex bg-white/10 rounded-full p-0.5">
              {[['standard', 'Standard'], ['high', 'High']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => qualityKey !== key && updateOption({ quality: key })}
                  aria-pressed={qualityKey === key}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    qualityKey === key ? 'bg-white text-black' : 'text-white/50 active:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Missing-photo warning — shown before the user shares/saves so an
            incomplete export is never a silent surprise. */}
        {failedCount > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40"
          >
            <span className="text-amber-400 text-base leading-none mt-0.5" aria-hidden>⚠</span>
            <div className="text-amber-200 text-xs leading-snug">
              {failedCount === 1 ? '1 photo couldn’t be loaded' : `${failedCount} photos couldn’t be loaded`}
              {' '}and {failedCount === 1 ? 'is' : 'are'} missing from the marked {failedSlides.size === 1 ? 'slide' : 'slides'}.
              You can still export, or go back and re-add {failedCount === 1 ? 'it' : 'them'}.
            </div>
          </div>
        )}

        {mode === 'open' ? (
          // No share sheet and no download manager: the grid above is the
          // delivery mechanism. Tap a slide to open it, then long-press to save.
          <div className="w-full py-3.5 text-center text-white/50 text-sm">
            {isRendering ? progressLabel : 'Tap a slide to open, then press and hold to save'}
          </div>
        ) : (
          <button
            onClick={() => saveAll(rendered, mode, ext)}
            disabled={isRendering}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-70 disabled:opacity-30"
            style={{ background: 'white', color: 'black' }}
          >
            {isRendering ? progressLabel : saveAllLabel}
          </button>
        )}
      </div>
      )}
    </div>
  )
}

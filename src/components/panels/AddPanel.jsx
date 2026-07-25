import { useState, lazy, Suspense } from 'react'
import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { IconImage, IconGrid, IconBlank, IconText, IconClose, IconShapes } from '../icons'
import { SHAPE_LAYER_TYPES } from '../../shapes'
import ShapePreview from '../ShapePreview'
import { SheetFallback } from '../LazyFallback'

// The three heavy Add-panel views load on demand (issue #87). The root grid of
// buttons — the part every "+" tap shows — stays eager, as do Shapes (a handful
// of inline SVG previews) and the plain actions. Each of these pulls a big
// payload that most sessions never open:
//   Templates → 117 template definitions + the live preview renderer
//   Stickers  → the sticker pack + rasterizer
//   Brand     → the brand-kit editor and font list
const TemplatesView = lazy(() => import('./TemplatesView'))
const StickersView  = lazy(() => import('./StickersView'))
const BrandKitPanel = lazy(() => import('./BrandKitPanel'))

export default function AddPanel() {
  const setPanel       = useStore(s => s.setPanel)
  const applyTemplate  = useStore(s => s.applyTemplate)
  const addSlide       = useStore(s => s.addSlide)
  const addTextLayer   = useStore(s => s.addTextLayer)
  const addShapeLayer  = useStore(s => s.addShapeLayer)
  const addStickerLayer = useStore(s => s.addStickerLayer)
  const addLogoLayer   = useStore(s => s.addLogoLayer)
  const brandLogo      = useStore(s => s.brand.logo)
  const pasteLayer     = useStore(s => s.pasteLayer)
  const hasClipboard   = useStore(s => !!s.clipboard)
  const ratio          = useStore(s => s.ratio)
  const openPickerRef  = useCanvasPicker()
  const [view, setView] = useState('root')

  const openImagePicker = () => {
    openPickerRef?.current?.()
    setPanel(null)
  }

  // Each lazy view keeps its own Suspense boundary so only the sheet — never the
  // editor behind it — is suspended, and the fallback matches the sheet it will
  // become (see LazyFallback: nothing at all for the first 150ms).
  if (view === 'brand') {
    return (
      <Suspense fallback={<SheetFallback title="Brand" rows={2} cols={4} />}>
        <BrandKitPanel onBack={() => setView('root')} onClose={() => setPanel(null)} />
      </Suspense>
    )
  }

  if (view === 'grid') {
    const apply = t => { applyTemplate(t); setPanel(null) }
    return (
      <Suspense fallback={<SheetFallback title="Templates" rows={2} cols={3} />}>
        <TemplatesView
          ratio={ratio}
          onApply={apply}
          onBack={() => setView('root')}
          onClose={() => setPanel(null)}
        />
      </Suspense>
    )
  }

  if (view === 'stickers') {
    const place = (src, naturalW, naturalH) => { addStickerLayer(src, naturalW, naturalH); setPanel(null) }
    return (
      <Suspense fallback={<SheetFallback title="Stickers" rows={2} cols={4} />}>
        <StickersView
          ratio={ratio}
          onPlace={place}
          onBack={() => setView('root')}
          onClose={() => setPanel(null)}
        />
      </Suspense>
    )
  }

  if (view === 'shape') {
    return (
      <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setView('root')} className="text-white/50 text-sm active:text-white">‹ Back</button>
          <span className="font-semibold text-base">Shapes</span>
          <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SHAPE_LAYER_TYPES.map(s => (
            <button key={s.id}
              onClick={() => { addShapeLayer(s.id); setPanel(null) }}
              className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
              <ShapePreview type={s.id} size={40} />
              <span className="text-[12px] text-white/70">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
      <div className="flex items-center justify-between mb-5">
        <span className="font-semibold text-base">Add</span>
        <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <button onClick={openImagePicker}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconImage size={26} />
          <span className="text-[11px] text-white/70">Image</span>
        </button>
        <button onClick={() => { addTextLayer(); setPanel(null) }}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconText size={26} />
          <span className="text-[11px] text-white/70">Text</span>
        </button>
        <button onClick={() => setView('shape')}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconShapes size={26} />
          <span className="text-[11px] text-white/70">Shape</span>
        </button>
        <button onClick={() => setView('stickers')}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-white/85">
            <path d="M12 2l2.4 6.9H21l-5.6 4.1 2.1 6.9L12 15.7 6.5 20l2.1-6.9L3 8.9h6.6z" />
          </svg>
          <span className="text-[11px] text-white/70">Stickers</span>
        </button>
        <button onClick={() => setView('grid')}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconGrid size={26} />
          <span className="text-[11px] text-white/70">Templates</span>
        </button>
        {/* One-tap brand logo stamp (issue #64): only shown once a logo exists in
            the brand kit. Places at the bottom-right corner preset; other corners
            (and the kit editor itself) live in the Brand view below. */}
        {brandLogo && (
          <button onClick={() => { addLogoLayer('br'); setPanel(null) }}
            className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-white/85">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <rect x="13" y="13" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
            </svg>
            <span className="text-[11px] text-white/70">Logo</span>
          </button>
        )}
        <button onClick={() => setView('brand')}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-white/85">
            <circle cx="12" cy="12" r="9" />
            <circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none" />
            <path d="M12 21a2 2 0 0 0 0-4h-1.5a1.5 1.5 0 0 1 0-3H15" />
          </svg>
          <span className="text-[11px] text-white/70">Brand</span>
        </button>
        <button onClick={() => { addSlide(); setPanel(null) }}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconBlank size={26} />
          <span className="text-[11px] text-white/70">Page</span>
        </button>
        {hasClipboard && (
          <button onClick={() => { pasteLayer(); setPanel(null) }}
            className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-white/85">
              <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
            <span className="text-[11px] text-white/70">Paste</span>
          </button>
        )}
      </div>
    </div>
  )
}

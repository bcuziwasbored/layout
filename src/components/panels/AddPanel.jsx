import { useState } from 'react'
import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { TEMPLATES, TEMPLATE_CATEGORIES, templateCategory, isStyledTemplate } from '../../templates'
import { IconImage, IconGrid, IconBlank, IconText, IconClose, IconShapes } from '../icons'
import { SHAPE_LAYER_TYPES } from '../../shapes'
import { STICKERS, STICKER_CATEGORIES, STICKER_COLORS, stickerPreviewURL, rasterizeSticker } from '../../stickers'
import ShapePreview from '../ShapePreview'
import TemplatePreview from '../TemplatePreview'
import BrandKitPanel from './BrandKitPanel'

const TemplateThumb = ({ template, ratio, onClick }) => {
  const ps = template.pageSpan ?? 1
  const styled = isStyledTemplate(template)
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:opacity-60">
      <div
        className="w-full bg-white/10 rounded-xl relative overflow-hidden border border-white/15"
        style={{ aspectRatio: styled ? `${ratio.w * ps} / ${ratio.h}` : '1 / 1' }}
      >
        {styled ? (
          // Live canvas preview (real fonts/colors/shapes) for styled templates.
          <TemplatePreview template={template} ratio={ratio} />
        ) : (
          <>
            {/* Page divider lines for multi-page templates */}
            {ps > 1 && Array.from({ length: ps - 1 }, (_, i) => (
              <div key={`pd${i}`} className="absolute top-0 bottom-0 w-px bg-white/50"
                style={{ left: `${(i + 1) * 100 / ps}%` }} />
            ))}
            {template.cells.map((c, i) => (
              <div key={i} className="absolute bg-white/25 border border-white/20"
                style={{
                  left:   `${c.x * 100 / ps}%`,
                  top:    `${c.y * 100}%`,
                  width:  `${c.w * 100 / ps}%`,
                  height: `${c.h * 100}%`,
                }} />
            ))}
          </>
        )}
        {/* Multi-page badge */}
        {ps > 1 && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded font-medium leading-none">
            ×{ps}
          </div>
        )}
      </div>
      <span className="text-[10px] text-white/45 leading-none">{template.label}</span>
    </button>
  )
}

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
  const [category, setCategory] = useState('all')
  const [stickerColor, setStickerColor] = useState(STICKER_COLORS[0])

  const openImagePicker = () => {
    openPickerRef?.current?.()
    setPanel(null)
  }

  if (view === 'brand') {
    return <BrandKitPanel onBack={() => setView('root')} onClose={() => setPanel(null)} />
  }

  if (view === 'grid') {
    const visible = TEMPLATES.filter(t =>
      t.id !== 'blank' && t.id !== 'single' &&
      (category === 'all' || templateCategory(t) === category))
    const singlePage = visible.filter(t => !t.pageSpan || t.pageSpan === 1)
    const multiPage  = visible.filter(t => t.pageSpan && t.pageSpan > 1)
    const apply = t => { applyTemplate(t); setPanel(null) }
    return (
      <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <button onClick={() => setView('root')} className="text-white/50 text-sm active:text-white">‹ Back</button>
          <span className="font-semibold text-base">Templates</span>
          <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
        </div>
        {/* Category tabs */}
        <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
          {TEMPLATE_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === c.id
                  ? 'bg-white text-black border-white font-semibold'
                  : 'bg-white/8 text-white/60 border-white/10 active:bg-white/15'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto px-5 pb-8 space-y-5">
          {singlePage.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {singlePage.map(t => (
                <TemplateThumb key={t.id} template={t} ratio={ratio} onClick={() => apply(t)} />
              ))}
            </div>
          )}

          {multiPage.length > 0 && (
            <div>
              <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Multi-page</div>
              <div className="grid grid-cols-2 gap-3">
                {multiPage.map(t => (
                  <TemplateThumb key={t.id} template={t} ratio={ratio} onClick={() => apply(t)} />
                ))}
              </div>
            </div>
          )}

          {visible.length === 0 && (
            <div className="text-white/30 text-sm text-center py-10">No templates in this category</div>
          )}
        </div>
      </div>
    )
  }

  if (view === 'stickers') {
    // Rasterize the tapped sticker at export-quality resolution, then place it
    // centered on the active slide as a normal (transparent-PNG) image layer.
    const placeSticker = async (sticker) => {
      const placedW = ratio.w * 0.3
      const placedLong = Math.max(placedW, placedW * (sticker.vb[1] / sticker.vb[0]))
      // 2× headroom so a 2× export stays crisp; capped so data URLs stay modest.
      const longPx = Math.min(1024, Math.max(256, Math.round(placedLong * 2)))
      try {
        const { src, naturalW, naturalH } = await rasterizeSticker(sticker, stickerColor, longPx)
        addStickerLayer(src, naturalW, naturalH)
        setPanel(null)
      } catch (e) {
        console.warn('Failed to place sticker', sticker.id, e)
      }
    }
    return (
      <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <button onClick={() => setView('root')} className="text-white/50 text-sm active:text-white">‹ Back</button>
          <span className="font-semibold text-base">Stickers</span>
          <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
        </div>
        {/* Tint color row */}
        <div className="flex gap-2.5 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
          {STICKER_COLORS.map(c => (
            <button key={c} onClick={() => setStickerColor(c)}
              aria-label={`Tint ${c}`}
              className={`shrink-0 w-7 h-7 rounded-full border-2 transition-transform ${
                stickerColor === c ? 'border-white scale-110' : 'border-white/25'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="overflow-y-auto px-5 pb-8 space-y-5">
          {STICKER_CATEGORIES.map(cat => {
            const items = STICKERS.filter(s => s.category === cat.id)
            if (!items.length) return null
            return (
              <div key={cat.id}>
                <div className="text-xs text-white/30 uppercase tracking-wider mb-3">{cat.label}</div>
                <div className="grid grid-cols-4 gap-3">
                  {items.map(s => (
                    <button key={s.id} onClick={() => placeSticker(s)}
                      className="rounded-xl p-2 flex items-center justify-center active:opacity-60"
                      style={{ background: '#6b7280', aspectRatio: '1 / 1' }}>
                      <img src={stickerPreviewURL(s, stickerColor)} alt={s.label} loading="lazy"
                        className="max-w-full max-h-full" style={{ maxWidth: '80%', maxHeight: '80%' }} />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
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

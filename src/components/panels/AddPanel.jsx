import { useState } from 'react'
import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { TEMPLATES } from '../../templates'
import { IconImage, IconGrid, IconBlank, IconText, IconClose, IconShapes } from '../icons'
import { SHAPE_LAYER_TYPES } from '../../shapes'
import ShapePreview from '../ShapePreview'

const TemplateThumb = ({ template, onClick }) => {
  const ps = template.pageSpan ?? 1
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:opacity-60">
      <div className="w-full aspect-square bg-white/10 rounded-xl relative overflow-hidden border border-white/15">
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
  const openPickerRef  = useCanvasPicker()
  const [view, setView] = useState('root')

  const openImagePicker = () => {
    openPickerRef?.current?.()
    setPanel(null)
  }

  if (view === 'grid') {
    const singlePage = TEMPLATES.filter(t => t.id !== 'blank' && t.id !== 'single' && !t.pageSpan)
    const multiPage  = TEMPLATES.filter(t => t.pageSpan && t.pageSpan > 1)
    return (
      <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <button onClick={() => setView('root')} className="text-white/50 text-sm active:text-white">‹ Back</button>
          <span className="font-semibold text-base">Grids</span>
          <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 space-y-5">
          {/* Single-page grids */}
          <div className="grid grid-cols-4 gap-3">
            {singlePage.map(t => (
              <TemplateThumb key={t.id} template={t} onClick={() => { applyTemplate(t); setPanel(null) }} />
            ))}
          </div>

          {/* Multi-page grids */}
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Multi-page</div>
            <div className="grid grid-cols-4 gap-3">
              {multiPage.map(t => (
                <TemplateThumb key={t.id} template={t} onClick={() => { applyTemplate(t); setPanel(null) }} />
              ))}
            </div>
          </div>
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
      <div className="grid grid-cols-5 gap-3">
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
        <button onClick={() => setView('grid')}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconGrid size={26} />
          <span className="text-[11px] text-white/70">Grid</span>
        </button>
        <button onClick={() => { addSlide(); setPanel(null) }}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconBlank size={26} />
          <span className="text-[11px] text-white/70">Page</span>
        </button>
      </div>
    </div>
  )
}

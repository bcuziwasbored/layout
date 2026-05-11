import { useState } from 'react'
import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { TEMPLATES } from '../../templates'
import { IconImage, IconGrid, IconBlank, IconClose } from '../icons'

const TemplateThumb = ({ template, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:opacity-60">
    <div className="w-full aspect-square bg-white/10 rounded-xl relative overflow-hidden border border-white/15">
      {template.cells.map((c, i) => (
        <div key={i} className="absolute bg-white/25 border border-white/20"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }} />
      ))}
    </div>
    <span className="text-[10px] text-white/45 leading-none">{template.label}</span>
  </button>
)

export default function AddPanel() {
  const setPanel    = useStore(s => s.setPanel)
  const applyTemplate = useStore(s => s.applyTemplate)
  const addSlide    = useStore(s => s.addSlide)
  const openPickerRef = useCanvasPicker()
  const [view, setView] = useState('root')

  const openImagePicker = () => {
    openPickerRef?.current?.()
    setPanel(null)
  }

  if (view === 'grid') {
    const gridTemplates = TEMPLATES.filter(t => t.id !== 'blank' && t.id !== 'single')
    return (
      <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <button onClick={() => setView('root')} className="text-white/50 text-sm active:text-white">‹ Back</button>
          <span className="font-semibold text-base">Grids</span>
          <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-8">
          <div className="grid grid-cols-4 gap-3">
            {gridTemplates.map(t => (
              <TemplateThumb key={t.id} template={t} onClick={() => { applyTemplate(t); setPanel(null) }} />
            ))}
          </div>
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
      <div className="grid grid-cols-3 gap-3">
        <button onClick={openImagePicker}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconImage size={28} />
          <span className="text-xs text-white/70">Image</span>
        </button>
        <button onClick={() => setView('grid')}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconGrid size={28} />
          <span className="text-xs text-white/70">Grid</span>
        </button>
        <button onClick={() => { addSlide(); setPanel(null) }}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15">
          <IconBlank size={28} />
          <span className="text-xs text-white/70">Page</span>
        </button>
      </div>
    </div>
  )
}

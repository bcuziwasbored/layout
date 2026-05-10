import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { TEMPLATES } from '../../templates'

const TemplateThumb = ({ template, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 active:opacity-60 shrink-0"
  >
    <div className="w-16 h-16 bg-white/10 rounded-xl relative overflow-hidden border border-white/20">
      {template.cells.map((c, i) => (
        <div
          key={i}
          className="absolute bg-white/30 border border-white/10"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }}
        />
      ))}
      {template.cells.length === 0 && <div className="absolute inset-0 bg-white/10" />}
    </div>
    <span className="text-[11px] text-white/50">{template.label}</span>
  </button>
)

export default function AddPanel() {
  const setPanel = useStore(s => s.setPanel)
  const applyTemplate = useStore(s => s.applyTemplate)
  const openPickerRef = useCanvasPicker()

  const openImagePicker = () => {
    setPanel(null)
    // Small delay so panel closes and canvas file input is accessible
    setTimeout(() => openPickerRef?.current?.(), 50)
  }

  return (
    <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-base">Add</span>
        <button onClick={() => setPanel(null)} className="text-white/40 text-2xl leading-none">&times;</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={openImagePicker}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15"
        >
          <span className="text-2xl">🖼️</span>
          <span className="text-xs text-white/70">Image</span>
        </button>
        <button
          onClick={() => { applyTemplate(TEMPLATES.find(t => t.id === 'grid-4')); setPanel(null) }}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15"
        >
          <span className="text-2xl">⊞</span>
          <span className="text-xs text-white/70">Grid</span>
        </button>
        <button
          onClick={() => { applyTemplate(TEMPLATES.find(t => t.id === 'blank')); setPanel(null) }}
          className="flex flex-col items-center gap-2 bg-white/8 rounded-xl py-4 active:bg-white/15"
        >
          <span className="text-2xl">⬜</span>
          <span className="text-xs text-white/70">Blank</span>
        </button>
      </div>

      <div className="mb-2 text-xs text-white/40 uppercase tracking-wider">Layouts</div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {TEMPLATES.filter(t => t.id !== 'blank').map(t => (
          <TemplateThumb
            key={t.id}
            template={t}
            onClick={() => { applyTemplate(t); setPanel(null) }}
          />
        ))}
      </div>
    </div>
  )
}

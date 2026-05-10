import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { IconClose } from '../icons'

export default function LayerToolbar() {
  const activeLayerId = useStore(s => s.activeLayerId)
  const layers = useStore(s => s.layers)
  const ratio = useStore(s => s.ratio)
  const deleteLayer = useStore(s => s.deleteLayer)
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const elementPanel = useStore(s => s.elementPanel)
  const setElementPanel = useStore(s => s.setElementPanel)
  const reorderLayer = useStore(s => s.reorderLayer)
  const setCropMode = useStore(s => s.setCropMode)
  const cropMode = useStore(s => s.cropMode)
  const openPickerRef = useCanvasPicker()

  const layer = layers.find(l => l.id === activeLayerId)
  if (!layer || cropMode) return null

  const Btn = ({ label, active, onClick, danger }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-xs transition-colors active:opacity-60 ${danger ? 'text-red-400' : active ? 'text-blue-400' : 'text-white/60'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="bg-black border-t border-white/10">
      <div className="flex items-center justify-between px-1 py-1">
        <Btn label="Replace" onClick={() => openPickerRef?.current?.(activeLayerId)} />
        <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
        <Btn label="Crop" active={false} onClick={() => setCropMode(true)} />
        <Btn label="Style" active={elementPanel === 'style'} onClick={() => setElementPanel('style')} />
        <Btn label="Delete" danger onClick={() => deleteLayer(activeLayerId)} />
        <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2"><IconClose size={18} /></button>
      </div>

      {elementPanel === 'position' && (
        <div className="px-4 pb-5 pt-1 border-t border-white/10">
          <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Arrange</div>
          <div className="flex gap-2 mb-4">
            {['front', 'forward', 'backward', 'back'].map(d => (
              <button key={d} onClick={() => reorderLayer(activeLayerId, d)}
                className="flex-1 py-2 text-xs text-white/70 bg-white/8 rounded-lg active:bg-white/15 capitalize">{d}</button>
            ))}
          </div>
          <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Align to Slide</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Left', fn: () => { const si = Math.floor(layer.x / ratio.w); updateLayerWithHistory(activeLayerId, { x: si * ratio.w }) } },
              { label: 'Center H', fn: () => { const si = Math.floor(layer.x / ratio.w); updateLayerWithHistory(activeLayerId, { x: si * ratio.w + (ratio.w - layer.w) / 2 }) } },
              { label: 'Right', fn: () => { const si = Math.floor(layer.x / ratio.w); updateLayerWithHistory(activeLayerId, { x: (si + 1) * ratio.w - layer.w }) } },
              { label: 'Top', fn: () => updateLayerWithHistory(activeLayerId, { y: 0 }) },
              { label: 'Center V', fn: () => updateLayerWithHistory(activeLayerId, { y: (ratio.h - layer.h) / 2 }) },
              { label: 'Bottom', fn: () => updateLayerWithHistory(activeLayerId, { y: ratio.h - layer.h }) },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn}
                className="py-2 text-xs text-white/70 bg-white/8 rounded-lg active:bg-white/15">{label}</button>
            ))}
          </div>
        </div>
      )}

      {elementPanel === 'style' && (
        <div className="px-4 pb-5 pt-1 border-t border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-16">Opacity</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={layer.opacity ?? 1}
              onChange={e => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
              onMouseUp={() => updateLayerWithHistory(activeLayerId, {})}
              onTouchEnd={() => updateLayerWithHistory(activeLayerId, {})}
              className="flex-1 accent-blue-500"
            />
            <span className="text-xs text-white/40 w-10 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

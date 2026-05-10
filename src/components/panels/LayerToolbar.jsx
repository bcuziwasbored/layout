import { useStore } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'

export default function LayerToolbar() {
  const activeLayerId = useStore(s => s.activeLayerId)
  const activeSlideId = useStore(s => s.activeSlideId)
  const slides = useStore(s => s.slides)
  const deleteLayer = useStore(s => s.deleteLayer)
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const elementPanel = useStore(s => s.elementPanel)
  const setElementPanel = useStore(s => s.setElementPanel)
  const reorderLayer = useStore(s => s.reorderLayer)
  const openPickerRef = useCanvasPicker()

  const slide = slides.find(s => s.id === activeSlideId)
  const layer = slide?.layers.find(l => l.id === activeLayerId)

  if (!layer) return null

  const Btn = ({ label, active, onClick, danger }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-colors active:opacity-60 ${danger ? 'text-red-400' : active ? 'text-white' : 'text-white/60'}`}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="bg-black border-t border-white/10">
        {/* Element action bar */}
        <div className="flex items-center justify-between px-2 py-1">
          <Btn label="Replace" onClick={() => openPickerRef?.current?.(activeLayerId)} />
          <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
          <Btn label="Crop" active={elementPanel === 'crop'} onClick={() => setElementPanel('crop')} />
          <Btn label="Style" active={elementPanel === 'style'} onClick={() => setElementPanel('style')} />
          <Btn label="Delete" danger onClick={() => deleteLayer(activeLayerId)} />
          <button
            onClick={() => useStore.getState().setActiveLayer(null)}
            className="text-white/40 text-xl px-2 pb-1"
          >
            ×
          </button>
        </div>

        {/* Sub-panels */}
        {elementPanel === 'position' && (
          <div className="px-4 pb-5 pt-1 border-t border-white/10">
            <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Arrange</div>
            <div className="flex gap-2 mb-4">
              {['front', 'forward', 'backward', 'back'].map(d => (
                <button key={d} onClick={() => reorderLayer(activeLayerId, d)}
                  className="flex-1 py-2 text-xs text-white/70 bg-white/8 rounded-lg active:bg-white/15 capitalize">{d}</button>
              ))}
            </div>
            <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Align</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Left', action: () => updateLayerWithHistory(activeLayerId, { x: 0 }) },
                { label: 'Center H', action: () => { const r = useStore.getState().ratio; updateLayerWithHistory(activeLayerId, { x: (r.w - layer.w) / 2 }) } },
                { label: 'Right', action: () => { const r = useStore.getState().ratio; updateLayerWithHistory(activeLayerId, { x: r.w - layer.w }) } },
                { label: 'Top', action: () => updateLayerWithHistory(activeLayerId, { y: 0 }) },
                { label: 'Center V', action: () => { const r = useStore.getState().ratio; updateLayerWithHistory(activeLayerId, { y: (r.h - layer.h) / 2 }) } },
                { label: 'Bottom', action: () => { const r = useStore.getState().ratio; updateLayerWithHistory(activeLayerId, { y: r.h - layer.h }) } },
              ].map(({ label, action }) => (
                <button key={label} onClick={action}
                  className="py-2 text-xs text-white/70 bg-white/8 rounded-lg active:bg-white/15">{label}</button>
              ))}
            </div>
          </div>
        )}

        {elementPanel === 'crop' && (
          <div className="px-4 pb-5 pt-1 border-t border-white/10">
            <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Scale image within cell</div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-white/50 w-12">Scale</span>
              <input
                type="range" min="0.1" max="3" step="0.01"
                value={layer.imgScale}
                onChange={e => updateLayer(activeLayerId, { imgScale: parseFloat(e.target.value) })}
                onMouseUp={() => useStore.getState()._pushHistory()}
                onTouchEnd={() => useStore.getState()._pushHistory()}
                className="flex-1 accent-white"
              />
              <span className="text-xs text-white/40 w-10 text-right">{layer.imgScale.toFixed(2)}×</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-white/50 w-12">Pan X</span>
              <input
                type="range" min={-layer.w} max={layer.w} step="1"
                value={layer.imgX}
                onChange={e => updateLayer(activeLayerId, { imgX: parseFloat(e.target.value) })}
                onMouseUp={() => useStore.getState()._pushHistory()}
                onTouchEnd={() => useStore.getState()._pushHistory()}
                className="flex-1 accent-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-12">Pan Y</span>
              <input
                type="range" min={-layer.h} max={layer.h} step="1"
                value={layer.imgY}
                onChange={e => updateLayer(activeLayerId, { imgY: parseFloat(e.target.value) })}
                onMouseUp={() => useStore.getState()._pushHistory()}
                onTouchEnd={() => useStore.getState()._pushHistory()}
                className="flex-1 accent-white"
              />
            </div>
          </div>
        )}

        {elementPanel === 'style' && (
          <div className="px-4 pb-5 pt-1 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-16">Opacity</span>
              <input
                type="range" min="0" max="1" step="0.01"
                value={layer.opacity}
                onChange={e => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
                onMouseUp={() => useStore.getState()._pushHistory()}
                onTouchEnd={() => useStore.getState()._pushHistory()}
                className="flex-1 accent-white"
              />
              <span className="text-xs text-white/40 w-10 text-right">{Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

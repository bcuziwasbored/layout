import { useStore } from '../../useStore'

function SliderRow({ label, min, max, step, value, onChange, onDone, display }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-12 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={onDone} onTouchEnd={onDone}
        className="flex-1 accent-blue-500" />
      {display && <span className="text-xs text-white/40 w-12 text-right shrink-0">{display}</span>}
    </div>
  )
}

export default function CropControls() {
  const activeLayerId          = useStore(s => s.activeLayerId)
  const layers                 = useStore(s => s.layers)
  const updateLayer            = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const setCropMode            = useStore(s => s.setCropMode)

  const layer = layers.find(l => l.id === activeLayerId)
  if (!layer) return null

  const minScale = Math.max(layer.w / (layer.naturalW ?? 1), layer.h / (layer.naturalH ?? 1))

  return (
    <div className="w-full bg-black border-t border-white/10 px-5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCropMode(false)} className="text-white/50 text-sm active:text-white">Cancel</button>
        <span className="text-xs text-white/40 uppercase tracking-wider">Crop</span>
        <button onClick={() => { updateLayerWithHistory(layer.id, {}); setCropMode(false) }}
          className="text-white text-sm font-semibold active:opacity-60">Done</button>
      </div>
      <SliderRow label="Scale" min={minScale} max={minScale * 4} step={0.001}
        value={layer.imgScale ?? 1}
        onChange={v => updateLayer(layer.id, { imgScale: v })}
        onDone={() => updateLayerWithHistory(layer.id, {})}
        display={`${(layer.imgScale ?? 1).toFixed(2)}×`} />
      <p className="text-center text-white/30 text-xs mt-3">Drag image to reposition</p>
    </div>
  )
}

import { useStore, fitInCell } from '../../useStore'

const ASPECT_PRESETS = [
  { label: 'Free', value: null },
  { label: '1:1',  value: 1 },
  { label: '4:5',  value: 4/5 },
  { label: '3:4',  value: 3/4 },
  { label: '4:3',  value: 4/3 },
  { label: '2:3',  value: 2/3 },
  { label: '9:16', value: 9/16 },
  { label: '16:9', value: 16/9 },
]

export default function CropControls() {
  const activeLayerId          = useStore(s => s.activeLayerId)
  const layers                 = useStore(s => s.layers)
  const updateLayer            = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const setCropMode            = useStore(s => s.setCropMode)
  const cropAspect             = useStore(s => s.cropAspect)
  const setCropAspect          = useStore(s => s.setCropAspect)

  const layer = layers.find(l => l.id === activeLayerId)
  if (!layer) return null

  const minScale = Math.max(layer.w / (layer.naturalW ?? 1), layer.h / (layer.naturalH ?? 1))
  const rotation = layer.rotation ?? 0

  const handleReset = () => {
    const { imgScale, imgX, imgY } = fitInCell(layer.naturalW ?? layer.w, layer.naturalH ?? layer.h, layer.w, layer.h)
    updateLayerWithHistory(layer.id, { imgScale, imgX, imgY, rotation: 0 })
  }

  return (
    <div className="w-full bg-black border-t border-white/10 px-5 pt-3 pb-6"
      style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCropMode(false)}
          className="text-white/50 text-sm active:text-white">Cancel</button>
        <span className="text-xs text-white/40 uppercase tracking-wider">Crop</span>
        <button onClick={() => { updateLayerWithHistory(layer.id, {}); setCropMode(false) }}
          className="text-white text-sm font-semibold active:opacity-60">Done</button>
      </div>

      {/* Aspect ratio presets */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {ASPECT_PRESETS.map(({ label, value }) => {
          const active = value === cropAspect
          return (
            <button key={label} onClick={() => setCropAspect(value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 active:bg-white/20'
              }`}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Rotation slider */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-white/50 w-14 shrink-0">Rotate</span>
        <input type="range" min={-180} max={180} step={0.5}
          value={rotation}
          onChange={e => updateLayer(layer.id, { rotation: parseFloat(e.target.value) })}
          onMouseUp={() => updateLayerWithHistory(layer.id, {})}
          onTouchEnd={() => updateLayerWithHistory(layer.id, {})}
          className="flex-1 accent-blue-500" />
        <span className="text-xs text-white/40 w-12 text-right shrink-0">
          {rotation > 0 ? '+' : ''}{rotation.toFixed(1)}°
        </span>
      </div>

      {/* Scale slider */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-white/50 w-14 shrink-0">Scale</span>
        <input type="range" min={minScale} max={minScale * 4} step={0.001}
          value={layer.imgScale ?? 1}
          onChange={e => updateLayer(layer.id, { imgScale: parseFloat(e.target.value) })}
          onMouseUp={() => updateLayerWithHistory(layer.id, {})}
          onTouchEnd={() => updateLayerWithHistory(layer.id, {})}
          className="flex-1 accent-blue-500" />
        <span className="text-xs text-white/40 w-12 text-right shrink-0">
          {((layer.imgScale ?? 1) / minScale * 100).toFixed(0)}%
        </span>
      </div>

      {/* Reset + hint */}
      <div className="flex items-center justify-between">
        <p className="text-white/30 text-xs">Drag image to reposition</p>
        <button onClick={handleReset}
          className="text-white/50 text-xs px-3 py-1 rounded-lg bg-white/8 active:bg-white/15">
          Reset
        </button>
      </div>
    </div>
  )
}

import { useStore, fitInCell } from '../../useStore'

// Minimum imgScale needed so a rotated image fully covers its frame with no empty corners.
// Formula: for frame (W,H) and image natural size (nW,nH) at angle θ (radians):
//   s ≥ max( (W|cosθ|+H|sinθ|)/nW, (W|sinθ|+H|cosθ|)/nH )
function minScaleForRotation(deg, W, H, nW, nH) {
  const θ = Math.abs(deg % 180) * Math.PI / 180  // symmetry: use [0,90] range
  const abscos = Math.cos(θ)
  const abssin = Math.sin(θ)
  return Math.max(
    (W * abscos + H * abssin) / nW,
    (W * abssin + H * abscos) / nH,
  )
}

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

  const coverScale = Math.max(layer.w / (layer.naturalW ?? 1), layer.h / (layer.naturalH ?? 1))
  const rotation = layer.rotation ?? 0
  // minScale is the larger of cover-scale and rotation-constrained scale
  const minScale = Math.max(coverScale, minScaleForRotation(rotation, layer.w, layer.h, layer.naturalW ?? layer.w, layer.naturalH ?? layer.h))

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
        <button onClick={() => setCropMode(false)}
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
          onPointerDown={() => useStore.getState()._captureUndo()}
          onChange={e => {
            const newRot = parseFloat(e.target.value)
            const nW = layer.naturalW ?? layer.w
            const nH = layer.naturalH ?? layer.h
            const rotMin = minScaleForRotation(newRot, layer.w, layer.h, nW, nH)
            const curScale = layer.imgScale ?? minScale
            const newScale = Math.max(curScale, rotMin)
            const newImgW = nW * newScale
            const newImgH = nH * newScale
            // If scale was bumped, keep the pan offset relative to centered position
            let newImgX = layer.imgX ?? 0
            let newImgY = layer.imgY ?? 0
            if (newScale !== curScale) {
              const oldImgW = nW * curScale
              const oldImgH = nH * curScale
              const panOffX = newImgX - (layer.w - oldImgW) / 2
              const panOffY = newImgY - (layer.h - oldImgH) / 2
              const newCentX = (layer.w - newImgW) / 2
              const newCentY = (layer.h - newImgH) / 2
              newImgX = newCentX + panOffX
              newImgY = newCentY + panOffY
            }
            updateLayer(layer.id, { rotation: newRot, imgScale: newScale, imgX: newImgX, imgY: newImgY })
          }}
          onMouseUp={() => useStore.getState()._commitUndo()}
          onTouchEnd={() => useStore.getState()._commitUndo()}
          className="flex-1 accent-blue-500" />
        <span className="text-xs text-white/40 w-12 text-right shrink-0">
          {rotation > 0 ? '+' : ''}{rotation.toFixed(1)}°
        </span>
      </div>

      {/* Scale slider — min tracks rotation constraint */}
      {(() => {
        const nW = layer.naturalW ?? layer.w
        const nH = layer.naturalH ?? layer.h
        const rotMin = minScaleForRotation(rotation, layer.w, layer.h, nW, nH)
        const sliderMin = Math.max(minScale, rotMin)
        const sliderMax = sliderMin * 4
        return (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-white/50 w-14 shrink-0">Scale</span>
            <input type="range" min={sliderMin} max={sliderMax} step={0.001}
              value={Math.max(layer.imgScale ?? 1, sliderMin)}
              onPointerDown={() => useStore.getState()._captureUndo()}
              onChange={e => {
                const newScale = parseFloat(e.target.value)
                const curScale = layer.imgScale ?? sliderMin
                // Zoom from the center of the frame:
                // keep the image-space point that was under the frame center fixed
                const nW = layer.naturalW ?? layer.w
                const nH = layer.naturalH ?? layer.h
                const curImgX = layer.imgX ?? 0
                const curImgY = layer.imgY ?? 0
                const framePtX = (layer.w / 2 - curImgX) / curScale
                const framePtY = (layer.h / 2 - curImgY) / curScale
                const minImgX = Math.min(0, layer.w  - nW * newScale)
                const minImgY = Math.min(0, layer.h - nH * newScale)
                const newImgX = Math.max(minImgX, Math.min(0, layer.w  / 2 - framePtX * newScale))
                const newImgY = Math.max(minImgY, Math.min(0, layer.h / 2 - framePtY * newScale))
                updateLayer(layer.id, { imgScale: newScale, imgX: newImgX, imgY: newImgY })
              }}
              onMouseUp={() => useStore.getState()._commitUndo()}
              onTouchEnd={() => useStore.getState()._commitUndo()}
              className="flex-1 accent-blue-500" />
            <span className="text-xs text-white/40 w-12 text-right shrink-0">
              {((Math.max(layer.imgScale ?? 1, sliderMin)) / sliderMin * 100).toFixed(0)}%
            </span>
          </div>
        )
      })()}

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

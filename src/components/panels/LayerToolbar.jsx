import { useStore, fitInCell } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import { IconClose } from '../icons'

export default function LayerToolbar() {
  const activeLayerId  = useStore(s => s.activeLayerId)
  const activeCellId   = useStore(s => s.activeCellId)
  const layers         = useStore(s => s.layers)
  const ratio          = useStore(s => s.ratio)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const deleteLayer    = useStore(s => s.deleteLayer)
  const deleteGroup    = useStore(s => s.deleteGroup)
  const updateLayer    = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const elementPanel   = useStore(s => s.elementPanel)
  const setElementPanel = useStore(s => s.setElementPanel)
  const reorderLayer   = useStore(s => s.reorderLayer)
  const setCropMode    = useStore(s => s.setCropMode)
  const cropMode       = useStore(s => s.cropMode)
  const setActiveCellId = useStore(s => s.setActiveCellId)
  const openPickerRef  = useCanvasPicker()

  const layer = layers.find(l => l.id === activeLayerId)
  if (!layer || cropMode) return null

  // Cell edit mode: user tapped into a specific cell within a group
  if (activeCellId) {
    const cell = layers.find(l => l.id === activeCellId)
    const gap = cell ? (cell.cellGap ?? 0) : 0
    const innerW = cell ? cell.w - gap : 1
    const innerH = cell ? cell.h - gap : 1
    const minScale = cell
      ? Math.max(innerW / (cell.naturalW ?? 1), innerH / (cell.naturalH ?? 1))
      : 0.1
    return (
      <div className="bg-black border-t border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setActiveCellId(null)}
            className="text-white/50 text-sm active:text-white">Done</button>
          <span className="text-xs text-white/40 uppercase tracking-wider">
            Drag to reposition
          </span>
          {cell && (
            <button onClick={() => openPickerRef?.current?.(activeCellId)}
              className="text-white text-sm font-medium active:opacity-60">Replace</button>
          )}
        </div>
        {cell && cell.src && (
          <div className="px-4 pb-4 pt-1 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-12 shrink-0">Zoom</span>
              <input type="range" min={minScale} max={minScale * 4} step={0.001}
                value={cell.imgScale ?? minScale}
                onChange={e => {
                  const newScale = parseFloat(e.target.value)
                  const imgW = (cell.naturalW ?? cell.w) * newScale
                  const imgH = (cell.naturalH ?? cell.h) * newScale
                  const minImgX = Math.min(0, innerW - imgW)
                  const minImgY = Math.min(0, innerH - imgH)
                  updateLayer(activeCellId, {
                    imgScale: newScale,
                    imgX: Math.max(minImgX, Math.min(0, cell.imgX ?? 0)),
                    imgY: Math.max(minImgY, Math.min(0, cell.imgY ?? 0)),
                  })
                }}
                onMouseUp={() => updateLayerWithHistory(activeCellId, {})}
                onTouchEnd={() => updateLayerWithHistory(activeCellId, {})}
                className="flex-1 accent-blue-500" />
              <span className="text-xs text-white/40 w-12 text-right shrink-0">
                {Math.round((cell.imgScale ?? minScale) / minScale * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const Btn = ({ label, active, onClick, danger }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-xs transition-colors active:opacity-60 ${danger ? 'text-red-400' : active ? 'text-blue-400' : 'text-white/60'}`}
    >
      {label}
    </button>
  )

  // Group mode: locked layer selected, show group-specific controls (no Crop)
  if (layer.locked) {
    return (
      <div className="bg-black border-t border-white/10">
        <div className="flex items-center justify-between px-1 py-1">
          <Btn label="Replace All" onClick={() => openPickerRef?.current?.(null, null, true)} />
          <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
          <Btn label="Style" active={elementPanel === 'style'} onClick={() => setElementPanel('style')} />
          <Btn label="Delete" danger onClick={() => deleteGroup(layer.groupId)} />
          <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2"><IconClose size={18} /></button>
        </div>

        {elementPanel === 'position' && (() => {
          const grp = layers.filter(l => l.groupId === layer.groupId)
          const gx = Math.min(...grp.map(l => l.x))
          const gy = Math.min(...grp.map(l => l.y))
          const gw = Math.max(...grp.map(l => l.x + l.w)) - gx
          const gh = Math.max(...grp.map(l => l.y + l.h)) - gy
          const si = activeSlideIdx
          const moveGroup = (dx, dy) => {
            updateLayerWithHistory(grp[0].id, { x: grp[0].x + dx, y: grp[0].y + dy })
            grp.slice(1).forEach(l => updateLayer(l.id, { x: l.x + dx, y: l.y + dy }))
          }
          return (
            <div className="px-4 pb-5 pt-1 border-t border-white/10">
              <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Align to Slide</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Left',     fn: () => moveGroup(si * ratio.w - gx, 0) },
                  { label: 'Center H', fn: () => moveGroup(si * ratio.w + (ratio.w - gw) / 2 - gx, 0) },
                  { label: 'Right',    fn: () => moveGroup((si + 1) * ratio.w - (gx + gw), 0) },
                  { label: 'Top',      fn: () => moveGroup(0, -gy) },
                  { label: 'Center V', fn: () => moveGroup(0, (ratio.h - gh) / 2 - gy) },
                  { label: 'Bottom',   fn: () => moveGroup(0, ratio.h - gh - gy) },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="py-2 text-xs text-white/70 bg-white/8 rounded-lg active:bg-white/15">{label}</button>
                ))}
              </div>
            </div>
          )
        })()}

        {elementPanel === 'style' && (
          <div className="px-4 pb-5 pt-1 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-16">Opacity</span>
              <input type="range" min={0} max={1} step={0.01}
                value={layer.opacity ?? 1}
                onChange={e => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
                onMouseUp={() => updateLayerWithHistory(activeLayerId, {})}
                onTouchEnd={() => updateLayerWithHistory(activeLayerId, {})}
                className="flex-1 accent-blue-500" />
              <span className="text-xs text-white/40 w-10 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-16">Border</span>
              <input type="range" min={0} max={40} step={1}
                value={layer.cellGap ?? 0}
                onChange={e => {
                  const gap = parseInt(e.target.value)
                  const grp = layers.filter(l => l.groupId === layer.groupId)
                  grp.forEach(l => {
                    const innerW = l.w - gap
                    const innerH = l.h - gap
                    if (innerW <= 10 || innerH <= 10) return
                    if (l.src) {
                      const { imgScale, imgX, imgY } = fitInCell(l.naturalW ?? l.w, l.naturalH ?? l.h, innerW, innerH)
                      updateLayer(l.id, { cellGap: gap, imgScale, imgX, imgY })
                    } else {
                      updateLayer(l.id, { cellGap: gap })
                    }
                  })
                }}
                onMouseUp={() => updateLayerWithHistory(activeLayerId, {})}
                onTouchEnd={() => updateLayerWithHistory(activeLayerId, {})}
                className="flex-1 accent-blue-500" />
              <span className="text-xs text-white/40 w-10 text-right">{layer.cellGap ?? 0}px</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Regular layer toolbar
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
              { label: 'Left',     fn: () => updateLayerWithHistory(activeLayerId, { x: activeSlideIdx * ratio.w }) },
              { label: 'Center H', fn: () => updateLayerWithHistory(activeLayerId, { x: activeSlideIdx * ratio.w + (ratio.w - layer.w) / 2 }) },
              { label: 'Right',    fn: () => updateLayerWithHistory(activeLayerId, { x: (activeSlideIdx + 1) * ratio.w - layer.w }) },
              { label: 'Top',      fn: () => updateLayerWithHistory(activeLayerId, { y: 0 }) },
              { label: 'Center V', fn: () => updateLayerWithHistory(activeLayerId, { y: (ratio.h - layer.h) / 2 }) },
              { label: 'Bottom',   fn: () => updateLayerWithHistory(activeLayerId, { y: ratio.h - layer.h }) },
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
            <input type="range" min={0} max={1} step={0.01}
              value={layer.opacity ?? 1}
              onChange={e => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
              onMouseUp={() => updateLayerWithHistory(activeLayerId, {})}
              onTouchEnd={() => updateLayerWithHistory(activeLayerId, {})}
              className="flex-1 accent-blue-500" />
            <span className="text-xs text-white/40 w-10 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

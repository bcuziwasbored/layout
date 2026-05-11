import { useState } from 'react'
import { useStore, fitInCell } from '../../useStore'
import { useCanvasPicker } from '../../CanvasContext'
import {
  IconClose,
  IconFront, IconForward, IconBackward, IconBack,
  IconAlignLeft, IconAlignCenterH, IconAlignRight,
  IconAlignTop, IconAlignCenterV, IconAlignBottom,
  IconFillHeight, IconFillWidth, IconFillWidth2x,
  IconFlipH, IconFlipV,
} from '../icons'

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <div className="text-xs text-white/35 uppercase tracking-wider mb-2 mt-1">{children}</div>
}

function IconBtn({ icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl active:opacity-50 ${
        danger ? 'text-red-400' : active ? 'text-blue-400' : 'text-white/70'
      }`}>
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  )
}

// ─── Position tab ──────────────────────────────────────────────────────────────

function PositionTab({ layer, activeLayerId, ratio, activeSlideIdx, layers, reorderLayer, updateLayerWithHistory, updateLayer, isGroup }) {
  const NUDGE = 1

  // Shared align actions
  const alignActions = isGroup ? (() => {
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
    return [
      { icon: <IconAlignLeft />,    label: 'Left',   fn: () => moveGroup(si * ratio.w - gx, 0) },
      { icon: <IconAlignCenterH />, label: 'Center', fn: () => moveGroup(si * ratio.w + (ratio.w - gw) / 2 - gx, 0) },
      { icon: <IconAlignRight />,   label: 'Right',  fn: () => moveGroup((si + 1) * ratio.w - (gx + gw), 0) },
      { icon: <IconAlignTop />,     label: 'Top',    fn: () => moveGroup(0, -gy) },
      { icon: <IconAlignCenterV />, label: 'Center', fn: () => moveGroup(0, (ratio.h - gh) / 2 - gy) },
      { icon: <IconAlignBottom />,  label: 'Bottom', fn: () => moveGroup(0, ratio.h - gh - gy) },
    ]
  })() : [
    { icon: <IconAlignLeft />,    label: 'Left',   fn: () => updateLayerWithHistory(activeLayerId, { x: activeSlideIdx * ratio.w }) },
    { icon: <IconAlignCenterH />, label: 'Center', fn: () => updateLayerWithHistory(activeLayerId, { x: activeSlideIdx * ratio.w + (ratio.w - layer.w) / 2 }) },
    { icon: <IconAlignRight />,   label: 'Right',  fn: () => updateLayerWithHistory(activeLayerId, { x: (activeSlideIdx + 1) * ratio.w - layer.w }) },
    { icon: <IconAlignTop />,     label: 'Top',    fn: () => updateLayerWithHistory(activeLayerId, { y: 0 }) },
    { icon: <IconAlignCenterV />, label: 'Center', fn: () => updateLayerWithHistory(activeLayerId, { y: (ratio.h - layer.h) / 2 }) },
    { icon: <IconAlignBottom />,  label: 'Bottom', fn: () => updateLayerWithHistory(activeLayerId, { y: ratio.h - layer.h }) },
  ]

  // Nudge handler (group-aware)
  const nudge = (dx, dy) => {
    if (isGroup) {
      const grp = layers.filter(l => l.groupId === layer.groupId)
      updateLayerWithHistory(grp[0].id, { x: grp[0].x + dx, y: grp[0].y + dy })
      grp.slice(1).forEach(l => updateLayer(l.id, { x: l.x + dx, y: l.y + dy }))
    } else {
      updateLayerWithHistory(activeLayerId, { x: layer.x + dx, y: layer.y + dy })
    }
  }

  // Fill actions (regular layers only)
  const fillHeight = () => {
    const nW = layer.naturalW ?? layer.w, nH = layer.naturalH ?? layer.h
    const newH = ratio.h, newW = nW / nH * newH
    const fit = fitInCell(nW, nH, newW, newH)
    updateLayerWithHistory(activeLayerId, {
      x: activeSlideIdx * ratio.w + (ratio.w - newW) / 2, y: 0, w: newW, h: newH, ...fit,
    })
  }
  const fillWidth = () => {
    const nW = layer.naturalW ?? layer.w, nH = layer.naturalH ?? layer.h
    const newW = ratio.w, newH = nH / nW * newW
    const fit = fitInCell(nW, nH, newW, newH)
    updateLayerWithHistory(activeLayerId, {
      x: activeSlideIdx * ratio.w, y: (ratio.h - newH) / 2, w: newW, h: newH, ...fit,
    })
  }
  const fillWidth2x = () => {
    const nW = layer.naturalW ?? layer.w, nH = layer.naturalH ?? layer.h
    // Frame spans exactly 2 pages wide × 1 page tall, left-aligned to current page
    const newW = 2 * ratio.w, newH = ratio.h
    const fit = fitInCell(nW, nH, newW, newH)
    updateLayerWithHistory(activeLayerId, {
      x: activeSlideIdx * ratio.w, y: 0, w: newW, h: newH, ...fit,
    })
  }

  return (
    <div className="px-4 pb-6 pt-2 space-y-1 overflow-y-auto" style={{ maxHeight: '62vh' }}>

      {/* Arrange — regular layers only */}
      {!isGroup && (
        <>
          <SectionLabel>Arrange</SectionLabel>
          <div className="grid grid-cols-4 gap-1 mb-1">
            {[
              { icon: <IconFront />,    label: 'Front',    d: 'front' },
              { icon: <IconForward />,  label: 'Forward',  d: 'forward' },
              { icon: <IconBackward />, label: 'Backward', d: 'backward' },
              { icon: <IconBack />,     label: 'Back',     d: 'back' },
            ].map(({ icon, label, d }) => (
              <IconBtn key={d} icon={icon} label={label} onClick={() => reorderLayer(activeLayerId, d)} />
            ))}
          </div>
          <div className="border-t border-white/8 my-1" />
        </>
      )}

      {/* Nudge */}
      <SectionLabel>Nudge</SectionLabel>
      <div className="grid grid-cols-4 gap-1 mb-1">
        {[
          { label: 'Left',  icon: '←', dx: -NUDGE, dy: 0 },
          { label: 'Right', icon: '→', dx:  NUDGE, dy: 0 },
          { label: 'Up',    icon: '↑', dx: 0, dy: -NUDGE },
          { label: 'Down',  icon: '↓', dx: 0, dy:  NUDGE },
        ].map(({ label, icon, dx, dy }) => (
          <button key={label} onClick={() => nudge(dx, dy)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-white/70 active:opacity-50">
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-white/8 my-1" />

      {/* Align */}
      <SectionLabel>Align</SectionLabel>
      <div className="grid grid-cols-3 gap-1 mb-1">
        {alignActions.map(({ icon, label, fn }, i) => (
          <IconBtn key={i} icon={icon} label={label} onClick={fn} />
        ))}
      </div>
      <div className="border-t border-white/8 my-1" />

      {/* Fill — regular layers only */}
      {!isGroup && (
        <>
          <SectionLabel>Fill</SectionLabel>
          <div className="grid grid-cols-3 gap-1 mb-1">
            <IconBtn icon={<IconFillHeight />} label="Height"   onClick={fillHeight} />
            <IconBtn icon={<IconFillWidth />}  label="Width"    onClick={fillWidth} />
            <IconBtn icon={<IconFillWidth2x />} label="Width 2×" onClick={fillWidth2x} />
          </div>
          <div className="border-t border-white/8 my-1" />

          {/* Flip */}
          <SectionLabel>Flip</SectionLabel>
          <div className="grid grid-cols-4 gap-1">
            <IconBtn icon={<IconFlipH />} label="Horizontal"
              active={layer.flipH}
              onClick={() => updateLayerWithHistory(activeLayerId, { flipH: !layer.flipH })} />
            <IconBtn icon={<IconFlipV />} label="Vertical"
              active={layer.flipV}
              onClick={() => updateLayerWithHistory(activeLayerId, { flipV: !layer.flipV })} />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Advanced tab ──────────────────────────────────────────────────────────────

function AdvancedTab({ layer, activeLayerId, layers, updateLayer, updateLayerWithHistory, isGroup }) {
  return (
    <div className="px-4 pb-6 pt-2 space-y-3">
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs text-white/50 w-16">Opacity</span>
        <input type="range" min={0} max={1} step={0.01}
          value={layer.opacity ?? 1}
          onChange={e => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
          onMouseUp={() => updateLayerWithHistory(activeLayerId, {})}
          onTouchEnd={() => updateLayerWithHistory(activeLayerId, {})}
          className="flex-1 accent-blue-500" />
        <span className="text-xs text-white/40 w-10 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
      </div>

      {isGroup && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50 w-16">Border</span>
          <input type="range" min={0} max={40} step={1}
            value={layer.cellGap ?? 0}
            onChange={e => {
              const gap = parseInt(e.target.value)
              const grp = layers.filter(l => l.groupId === layer.groupId)
              grp.forEach(l => {
                const innerW = l.w - gap, innerH = l.h - gap
                if (innerW <= 10 || innerH <= 10) return
                if (l.src) {
                  updateLayer(l.id, { cellGap: gap, ...fitInCell(l.naturalW ?? l.w, l.naturalH ?? l.h, innerW, innerH) })
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
      )}
    </div>
  )
}

// ─── Tabbed position panel ─────────────────────────────────────────────────────

function PositionPanel({ layer, activeLayerId, ratio, activeSlideIdx, layers, reorderLayer,
  updateLayer, updateLayerWithHistory, setElementPanel, isGroup }) {
  const [tab, setTab] = useState('position')

  return (
    <div className="border-t border-white/10">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-0">
        <div className="flex flex-1 bg-white/8 rounded-xl p-0.5">
          <button onClick={() => setTab('position')}
            className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
              tab === 'position' ? 'bg-white/15 text-white' : 'text-white/45'
            }`}>Position</button>
          <button onClick={() => setTab('advanced')}
            className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
              tab === 'advanced' ? 'bg-white/15 text-white' : 'text-white/45'
            }`}>Advanced</button>
        </div>
        <button onClick={() => setElementPanel(null)} className="text-white/40 pl-1">
          <IconClose size={18} />
        </button>
      </div>

      {tab === 'position' ? (
        <PositionTab
          layer={layer} activeLayerId={activeLayerId} ratio={ratio}
          activeSlideIdx={activeSlideIdx} layers={layers}
          reorderLayer={reorderLayer} updateLayer={updateLayer}
          updateLayerWithHistory={updateLayerWithHistory} isGroup={isGroup} />
      ) : (
        <AdvancedTab
          layer={layer} activeLayerId={activeLayerId} layers={layers}
          updateLayer={updateLayer} updateLayerWithHistory={updateLayerWithHistory}
          isGroup={isGroup} />
      )}
    </div>
  )
}

// ─── Main toolbar ──────────────────────────────────────────────────────────────

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

  // ── Cell edit mode ────────────────────────────────────────────────────────
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
          <span className="text-xs text-white/40 uppercase tracking-wider">Drag to reposition</span>
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
                  const curScale = cell.imgScale ?? minScale
                  const imgPtX = (innerW / 2 - (cell.imgX ?? 0)) / curScale
                  const imgPtY = (innerH / 2 - (cell.imgY ?? 0)) / curScale
                  const minImgX = Math.min(0, innerW - (cell.naturalW ?? cell.w) * newScale)
                  const minImgY = Math.min(0, innerH - (cell.naturalH ?? cell.h) * newScale)
                  const newImgX = Math.max(minImgX, Math.min(0, innerW / 2 - imgPtX * newScale))
                  const newImgY = Math.max(minImgY, Math.min(0, innerH / 2 - imgPtY * newScale))
                  updateLayer(activeCellId, { imgScale: newScale, imgX: newImgX, imgY: newImgY })
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
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-xs transition-colors active:opacity-60 ${
        danger ? 'text-red-400' : active ? 'text-blue-400' : 'text-white/60'
      }`}>
      {label}
    </button>
  )

  // ── Group mode ────────────────────────────────────────────────────────────
  if (layer.locked) {
    return (
      <div className="bg-black border-t border-white/10">
        <div className="flex items-center justify-between px-1 py-1">
          <Btn label="Replace All" onClick={() => openPickerRef?.current?.(null, null, true)} />
          <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
          <Btn label="Delete" danger onClick={() => deleteGroup(layer.groupId)} />
          <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2">
            <IconClose size={18} />
          </button>
        </div>

        {elementPanel === 'position' && (
          <PositionPanel
            layer={layer} activeLayerId={activeLayerId} ratio={ratio}
            activeSlideIdx={activeSlideIdx} layers={layers}
            reorderLayer={reorderLayer} updateLayer={updateLayer}
            updateLayerWithHistory={updateLayerWithHistory}
            setElementPanel={setElementPanel} isGroup />
        )}
      </div>
    )
  }

  // ── Regular layer ─────────────────────────────────────────────────────────
  return (
    <div className="bg-black border-t border-white/10">
      <div className="flex items-center justify-between px-1 py-1">
        <Btn label="Replace" onClick={() => openPickerRef?.current?.(activeLayerId)} />
        <Btn label="Position" active={elementPanel === 'position'} onClick={() => setElementPanel('position')} />
        <Btn label="Crop" onClick={() => setCropMode(true)} />
        <Btn label="Delete" danger onClick={() => deleteLayer(activeLayerId)} />
        <button onClick={() => useStore.getState().setActiveLayer(null)} className="text-white/40 px-2">
          <IconClose size={18} />
        </button>
      </div>

      {elementPanel === 'position' && (
        <PositionPanel
          layer={layer} activeLayerId={activeLayerId} ratio={ratio}
          activeSlideIdx={activeSlideIdx} layers={layers}
          reorderLayer={reorderLayer} updateLayer={updateLayer}
          updateLayerWithHistory={updateLayerWithHistory}
          setElementPanel={setElementPanel} isGroup={false} />
      )}
    </div>
  )
}

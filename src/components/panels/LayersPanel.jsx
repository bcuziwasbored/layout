import { useState, useRef } from 'react'
import { useStore } from '../../useStore'
import { IconClose } from '../icons'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconDragHandle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="opacity-40">
      <rect x="3" y="4.5"  width="12" height="1.5" rx="0.75" />
      <rect x="3" y="8.25" width="12" height="1.5" rx="0.75" />
      <rect x="3" y="12"   width="12" height="1.5" rx="0.75" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}

function IconShape() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function IconGroup() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="10" height="10" rx="1" />
      <rect x="12" y="7" width="10" height="10" rx="1" />
      <rect x="7" y="2" width="10" height="5" rx="1" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function layerIcon(layer) {
  if (layer.type === 'text') return <IconText />
  if (layer.type === 'shape') return <IconShape />
  if (layer.type === 'group') return <IconGroup />
  return <IconImage />
}

function layerLabel(layer) {
  if (layer.type === 'text') {
    const t = (layer.text || '').trim().replace(/\n/g, ' ')
    return t.length > 28 ? t.slice(0, 28) + '…' : t || 'Text'
  }
  if (layer.type === 'shape') {
    const t = layer.shapeType || 'shape'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  if (layer.type === 'group') return 'Image group'
  return 'Image'
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LayersPanel() {
  const setPanel    = useStore(s => s.setPanel)
  const layers      = useStore(s => s.layers)
  const ratio       = useStore(s => s.ratio)
  const activeSlideIdx  = useStore(s => s.activeSlideIdx)
  const activeLayerId   = useStore(s => s.activeLayerId)
  const setActiveLayer  = useStore(s => s.setActiveLayer)
  const deleteLayer     = useStore(s => s.deleteLayer)
  const deleteGroup     = useStore(s => s.deleteGroup)

  // Layers belonging to the current slide, in render order (index 0 = bottom)
  const slideStart = activeSlideIdx * ratio.w
  const slideEnd   = (activeSlideIdx + 1) * ratio.w
  const slideLayers = layers.filter(l => l.x < slideEnd && l.x + l.w > slideStart)

  // Display in reverse z-order: top-most layer first
  // We track dragging over a display-index (0 = top of list)
  const displayLayers = [...slideLayers].reverse()

  // ─── Drag-to-reorder ────────────────────────────────────────────────────────
  // Use refs for drag/over indices so the pointerup closure always sees fresh values
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const dragIdxRef = useRef(null)
  const overIdxRef = useRef(null)
  const rowRefs    = useRef([])

  function getDisplayIndex(clientY) {
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY < rect.bottom) return i
    }
    return rowRefs.current.length - 1
  }

  function onDragPointerDown(e, displayI) {
    e.preventDefault()
    e.stopPropagation()
    dragIdxRef.current = displayI
    overIdxRef.current = displayI
    setDragIdx(displayI)
    setOverIdx(displayI)

    function onMove(ev) {
      const clientY = ev.clientY ?? ev.touches?.[0]?.clientY
      if (clientY == null) return
      const next = getDisplayIndex(clientY)
      overIdxRef.current = next
      setOverIdx(next)
    }
    function onUp() {
      const from = dragIdxRef.current
      const to   = overIdxRef.current
      if (from !== null && to !== null && from !== to) {
        commitReorder(from, to)
      }
      dragIdxRef.current = null
      overIdxRef.current = null
      setDragIdx(null)
      setOverIdx(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function commitReorder(fromDisplay, toDisplay) {
    // displayLayers is reversed: displayIdx 0 = last in layers array (top)
    // Convert display indices back to layers-array indices
    const fromGlobal = layers.indexOf(displayLayers[fromDisplay])
    const toGlobal   = layers.indexOf(displayLayers[toDisplay])
    if (fromGlobal === -1 || toGlobal === -1 || fromGlobal === toGlobal) return

    useStore.getState()._pushHistory()
    useStore.setState(s => {
      const next = [...s.layers]
      const [item] = next.splice(fromGlobal, 1)
      next.splice(toGlobal, 0, item)
      return { layers: next }
    })
  }

  function handleSelectLayer(layer) {
    setActiveLayer(layer.id)
    setPanel(null)
  }

  function handleDelete(e, layer) {
    e.stopPropagation()
    if (layer.groupId) deleteGroup(layer.groupId)
    else deleteLayer(layer.id)
  }

  // Build the list to render, applying drag preview swap
  const renderList = [...displayLayers]
  if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
    const [item] = renderList.splice(dragIdx, 1)
    renderList.splice(overIdx, 0, item)
  }

  return (
    <div className="bg-[#111] rounded-t-2xl pb-8" style={{ maxHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <span className="font-semibold">Layers</span>
        <button onClick={() => setPanel(null)} className="text-white/40 active:text-white">
          <IconClose size={18} />
        </button>
      </div>

      {slideLayers.length === 0 ? (
        <p className="text-white/40 text-sm px-5 pb-4">No layers on this slide yet. Use + to add one.</p>
      ) : (
        <div className="overflow-y-auto flex-1 px-3 pb-2">
          {renderList.map((layer, i) => {
            const isDragging = dragIdx !== null && renderList[i] === displayLayers[dragIdx]
            const isActive   = layer.id === activeLayerId

            return (
              <div
                key={layer.id}
                ref={el => { rowRefs.current[i] = el }}
                onClick={() => handleSelectLayer(layer)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl mb-1 cursor-pointer transition-colors
                  ${isActive   ? 'bg-white/15'  : 'hover:bg-white/8 active:bg-white/12'}
                  ${isDragging ? 'opacity-40'   : 'opacity-100'}
                `}
              >
                {/* Drag handle */}
                <div
                  onPointerDown={e => onDragPointerDown(e, i)}
                  className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                >
                  <IconDragHandle />
                </div>

                {/* Type icon */}
                <div className={`shrink-0 ${isActive ? 'text-white' : 'text-white/50'}`}>
                  {layerIcon(layer)}
                </div>

                {/* Label */}
                <span className={`flex-1 text-sm truncate ${isActive ? 'text-white font-medium' : 'text-white/70'}`}>
                  {layerLabel(layer)}
                </span>

                {/* Stacking badge: show position from top */}
                <span className="text-[10px] text-white/25 shrink-0 tabular-nums">
                  {i + 1}/{renderList.length}
                </span>

                {/* Delete */}
                <button
                  onClick={e => handleDelete(e, layer)}
                  className="shrink-0 text-white/30 active:text-red-400 p-1"
                >
                  <IconTrash />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-white/20 text-center px-5 mt-1 shrink-0">
        Drag ≡ to reorder · tap row to select
      </p>
    </div>
  )
}

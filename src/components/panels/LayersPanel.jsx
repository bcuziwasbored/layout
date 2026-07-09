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

// Closed padlock when locked, open shackle when unlocked.
function IconLock({ locked }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      {locked
        ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        : <path d="M7 11V7a5 5 0 0 1 9.9-1" />}
    </svg>
  )
}

function IconDuplicate() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconMove() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

// Checkbox indicator for select mode (checked / unchecked).
function IconCheckbox({ checked }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" fill={checked ? 'currentColor' : 'none'} />
      {checked && <polyline points="8 12.5 11 15.5 16 9" stroke="#111" strokeWidth="2.5" />}
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
  const slides      = useStore(s => s.slides)
  const activeSlideIdx  = useStore(s => s.activeSlideIdx)
  const activeLayerId   = useStore(s => s.activeLayerId)
  const setActiveLayer  = useStore(s => s.setActiveLayer)
  const deleteLayer     = useStore(s => s.deleteLayer)
  const deleteGroup     = useStore(s => s.deleteGroup)
  const toggleUserLock  = useStore(s => s.toggleUserLock)
  const bulkDeleteLayers    = useStore(s => s.bulkDeleteLayers)
  const bulkDuplicateLayers = useStore(s => s.bulkDuplicateLayers)
  const bulkMoveLayers      = useStore(s => s.bulkMoveLayers)

  // Layers belonging to the current slide, in render order (index 0 = bottom)
  const slideStart = activeSlideIdx * ratio.w
  const slideEnd   = (activeSlideIdx + 1) * ratio.w
  const slideLayers = layers.filter(l => l.x < slideEnd && l.x + l.w > slideStart)

  // Display in reverse z-order: top-most layer first
  // We track dragging over a display-index (0 = top of list)
  const displayLayers = [...slideLayers].reverse()

  // Group deletion is guarded by a confirmation dialog; this holds the pending groupId.
  const [confirmGroupId, setConfirmGroupId] = useState(null)

  // ─── Select mode (bulk actions, issue #49) ────────────────────────────────────
  // The checked set is component state (layer ids), never store state. Exiting
  // select mode clears it. Selecting any cell of a template group checks every
  // visible sibling cell so the group reads (and acts) as a single unit.
  const [selectMode, setSelectMode] = useState(false)
  const [checkedIds, setCheckedIds]   = useState(() => new Set())
  const [showMovePicker, setShowMovePicker]     = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  function exitSelectMode() {
    setSelectMode(false)
    setCheckedIds(new Set())
    setShowMovePicker(false)
    setConfirmBulkDelete(false)
  }

  function toggleChecked(layer) {
    // userLocked layers are excluded from bulk selection entirely (#50): their
    // row shows a padlock instead of a checkbox and taps don't check them. The
    // store's _bulkScope is the backstop for ids that slip through anyway.
    if (layer.userLocked) return
    setCheckedIds(prev => {
      const next = new Set(prev)
      // A group toggles as a unit: flip every visible cell sharing its groupId.
      const siblings = layer.groupId
        ? slideLayers.filter(l => l.groupId === layer.groupId && !l.userLocked)
        : [layer]
      const turningOff = next.has(layer.id)
      for (const l of siblings) {
        if (turningOff) next.delete(l.id)
        else next.add(l.id)
      }
      return next
    })
  }

  // Layers currently checked, and whether any belongs to a template group (drives
  // the #46 confirmation before a bulk delete wipes a collage grid).
  const selectedLayers = slideLayers.filter(l => checkedIds.has(l.id))
  const selectedGroupIds = new Set(selectedLayers.filter(l => l.groupId != null).map(l => l.groupId))
  const bulkHasGroup = selectedGroupIds.size > 0
  const bulkGroupPhotoCount = layers.filter(
    l => l.groupId != null && selectedGroupIds.has(l.groupId) && l.src
  ).length

  function handleBulkDelete() {
    if (!checkedIds.size) return
    if (bulkHasGroup) setConfirmBulkDelete(true)
    else { bulkDeleteLayers([...checkedIds]); exitSelectMode() }
  }

  function confirmBulkDeleteNow() {
    bulkDeleteLayers([...checkedIds])
    exitSelectMode()
  }

  function handleBulkDuplicate() {
    if (!checkedIds.size) return
    bulkDuplicateLayers([...checkedIds])
    exitSelectMode()
  }

  function handleBulkMove(targetIdx) {
    if (!checkedIds.size) return
    bulkMoveLayers([...checkedIds], targetIdx)
    exitSelectMode()
  }

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
    function cleanup() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
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
      cleanup()
    }
    // iOS can cancel an in-flight pointer (edge swipe, incoming notification).
    // Reset drag state and tear down listeners WITHOUT committing a reorder, so the
    // stale listeners can't leak and fire on a later tap (phantom reorder).
    function onCancel() {
      dragIdxRef.current = null
      overIdxRef.current = null
      setDragIdx(null)
      setOverIdx(null)
      cleanup()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
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
    // A userLocked layer can't be selected/edited — the row's padlock (which
    // unlocks) is its only affordance. This keeps the panel the escape hatch:
    // unlock here first, then the layer becomes selectable again.
    if (layer.userLocked) return
    setActiveLayer(layer.id)
    setPanel(null)
  }

  function handleDelete(e, layer) {
    e.stopPropagation()
    // Group deletion wipes the whole collage grid, so confirm first. Single-layer
    // deletes are low-blast-radius (and undoable), so they go through immediately.
    if (layer.groupId) setConfirmGroupId(layer.groupId)
    else deleteLayer(layer.id)
  }

  // Filled-photo count for the pending group (cells that actually hold an image).
  const confirmPhotoCount = confirmGroupId
    ? layers.filter(l => l.groupId === confirmGroupId && l.src).length
    : 0

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
        <div className="flex items-center gap-4">
          {slideLayers.length > 0 && (
            selectMode ? (
              <button onClick={exitSelectMode} className="text-sm font-medium text-blue-400 active:text-blue-300">
                Done
              </button>
            ) : (
              <button onClick={() => setSelectMode(true)} className="text-sm font-medium text-white/70 active:text-white">
                Select
              </button>
            )
          )}
          <button onClick={() => setPanel(null)} className="text-white/40 active:text-white">
            <IconClose size={18} />
          </button>
        </div>
      </div>

      {slideLayers.length === 0 ? (
        <p className="text-white/40 text-sm px-5 pb-4">No layers on this slide yet. Use + to add one.</p>
      ) : (
        <div className="overflow-y-auto flex-1 px-3 pb-2">
          {renderList.map((layer, i) => {
            const isDragging = dragIdx !== null && renderList[i] === displayLayers[dragIdx]
            const isActive   = layer.id === activeLayerId
            const isChecked  = checkedIds.has(layer.id)

            return (
              <div
                key={layer.id}
                ref={el => { rowRefs.current[i] = el }}
                onClick={() => selectMode ? toggleChecked(layer) : handleSelectLayer(layer)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl mb-1 cursor-pointer transition-colors
                  ${selectMode && isChecked ? 'bg-white/15' : ''}
                  ${!selectMode && isActive ? 'bg-white/15' : ''}
                  ${!(selectMode && isChecked) && !(!selectMode && isActive) ? 'hover:bg-white/8 active:bg-white/12' : ''}
                  ${isDragging ? 'opacity-40'   : 'opacity-100'}
                `}
              >
                {/* Checkbox (select mode) or drag handle (normal mode).
                    userLocked layers show a static padlock in select mode — they
                    can't be checked and bulk ops skip them (#50). */}
                {selectMode ? (
                  layer.userLocked ? (
                    <div className="shrink-0 text-white/20" aria-label="Locked — excluded from selection">
                      <IconLock locked />
                    </div>
                  ) : (
                    <div className={`shrink-0 ${isChecked ? 'text-blue-400' : 'text-white/30'}`}>
                      <IconCheckbox checked={isChecked} />
                    </div>
                  )
                ) : (
                  <div
                    onPointerDown={e => onDragPointerDown(e, i)}
                    className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                  >
                    <IconDragHandle />
                  </div>
                )}

                {/* Type icon */}
                <div className={`shrink-0 ${(selectMode ? isChecked : isActive) ? 'text-white' : 'text-white/50'}`}>
                  {layerIcon(layer)}
                </div>

                {/* Label */}
                <span className={`flex-1 text-sm truncate ${(selectMode ? isChecked : isActive) ? 'text-white font-medium' : 'text-white/70'}`}>
                  {layerLabel(layer)}
                </span>

                {/* Stacking badge: show position from top */}
                <span className="text-[10px] text-white/25 shrink-0 tabular-nums">
                  {i + 1}/{renderList.length}
                </span>

                {/* Lock toggle — the escape hatch. A locked layer shows a filled
                    padlock here and can only be unlocked from this button (it's
                    inert to canvas taps). Toggling pushes no history. Only offered
                    for standalone layers; template-grid cells (locked/groupId) are
                    managed as a group, matching the canvas quick toolbar. Hidden in
                    select mode (the bulk bar owns row actions there). */}
                {!selectMode && !layer.locked && !layer.groupId && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleUserLock(layer.id) }}
                    className={`shrink-0 p-1 ${layer.userLocked ? 'text-blue-400' : 'text-white/30 active:text-white'}`}
                    aria-label={layer.userLocked ? 'Unlock layer' : 'Lock layer'}
                  >
                    <IconLock locked={!!layer.userLocked} />
                  </button>
                )}

                {/* Delete (normal mode only — bulk bar handles deletes in select mode) */}
                {!selectMode && (
                  <button
                    onClick={e => handleDelete(e, layer)}
                    className="shrink-0 text-white/30 active:text-red-400 p-1"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectMode ? (
        <div className="shrink-0 px-3 pt-2">
          {/* Bulk action bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={!checkedIds.size}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/8 text-red-400 active:bg-white/12 disabled:opacity-30"
            >
              <IconTrash />
              <span className="text-[11px] font-medium">Delete</span>
            </button>
            <button
              onClick={handleBulkDuplicate}
              disabled={!checkedIds.size}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/8 text-white/80 active:bg-white/12 disabled:opacity-30"
            >
              <IconDuplicate />
              <span className="text-[11px] font-medium">Duplicate</span>
            </button>
            <button
              onClick={() => checkedIds.size && setShowMovePicker(true)}
              disabled={!checkedIds.size}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/8 text-white/80 active:bg-white/12 disabled:opacity-30"
            >
              <div className="flex items-center gap-0.5"><IconMove /><IconChevron /></div>
              <span className="text-[11px] font-medium">Move to</span>
            </button>
          </div>
          <p className="text-[10px] text-white/25 text-center px-5 mt-2">
            {checkedIds.size ? `${checkedIds.size} selected` : 'Tap rows to select'}
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-white/20 text-center px-5 mt-1 shrink-0">
          Drag ≡ to reorder · tap row to select
        </p>
      )}

      {/* ── Move-to-slide picker ───────────────────────────────────────────────── */}
      {showMovePicker && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[80]" onClick={() => setShowMovePicker(false)}>
          <div className="w-full max-w-md bg-[#1c1c1c] rounded-t-2xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-white mb-1">Move to slide</div>
            <div className="text-sm text-white/50 mb-3">
              Moving {checkedIds.size} {checkedIds.size === 1 ? 'layer' : 'layers'}.
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '40vh' }}>
              {slides.map((sl, idx) => (
                <button
                  key={sl.id}
                  onClick={() => handleBulkMove(idx)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 text-sm active:bg-white/12
                    ${idx === activeSlideIdx ? 'bg-white/12 text-white' : 'bg-white/6 text-white/80'}`}
                >
                  <span>Slide {idx + 1}{idx === activeSlideIdx ? ' (current)' : ''}</span>
                  <IconChevron />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMovePicker(false)}
              className="w-full py-3 mt-3 rounded-xl bg-white/10 text-white font-medium text-sm active:bg-white/15"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk-delete confirmation (selection includes a collage grid, per #46) ── */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] px-8" onClick={() => setConfirmBulkDelete(false)}>
          <div className="w-full max-w-xs bg-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-white">
              Delete {checkedIds.size} {checkedIds.size === 1 ? 'layer' : 'layers'}?
            </div>
            <div className="text-sm text-white/50 mt-1.5">
              {bulkGroupPhotoCount > 0
                ? `This includes a collage grid and its ${bulkGroupPhotoCount} ${bulkGroupPhotoCount === 1 ? 'photo' : 'photos'}.`
                : 'This includes a whole collage grid.'}
            </div>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setConfirmBulkDelete(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium text-sm active:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDeleteNow}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm active:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete-collage confirmation ────────────────────────────────────────── */}
      {confirmGroupId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] px-8" onClick={() => setConfirmGroupId(null)}>
          <div className="w-full max-w-xs bg-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-white">
              {confirmPhotoCount > 0
                ? `Delete this collage grid and its ${confirmPhotoCount} ${confirmPhotoCount === 1 ? 'photo' : 'photos'}?`
                : 'Delete this collage grid?'}
            </div>
            <div className="text-sm text-white/50 mt-1.5">This removes the whole grid.</div>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setConfirmGroupId(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium text-sm active:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteGroup(confirmGroupId); setConfirmGroupId(null) }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm active:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

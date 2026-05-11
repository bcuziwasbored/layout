import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../useStore'
import { IconClose } from '../icons'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconDragHandle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <rect x="3" y="4.5"  width="12" height="1.5" rx="0.75" />
      <rect x="3" y="8.25" width="12" height="1.5" rx="0.75" />
      <rect x="3" y="12"   width="12" height="1.5" rx="0.75" />
    </svg>
  )
}

function IconDots() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <circle cx="4.5" cy="9" r="1.5" />
      <circle cx="9"   cy="9" r="1.5" />
      <circle cx="13.5" cy="9" r="1.5" />
    </svg>
  )
}

// ─── Context menu (action sheet) ──────────────────────────────────────────────

function SlideMenu({ idx, slideCount, onClose, insertSlide, duplicateSlide, moveSlide, deleteSlide }) {
  const actions = [
    {
      label: 'Add Left',
      icon: '⊞',
      fn: () => { insertSlide(idx); onClose() },
    },
    {
      label: 'Add Right',
      icon: '⊞',
      fn: () => { insertSlide(idx + 1); onClose() },
    },
    {
      label: 'Duplicate',
      icon: '⧉',
      fn: () => { duplicateSlide(idx); onClose() },
    },
    {
      label: 'Move Left',
      icon: '←',
      fn: () => { moveSlide(idx, idx - 1); onClose() },
      disabled: idx === 0,
    },
    {
      label: 'Move Right',
      icon: '→',
      fn: () => { moveSlide(idx, idx + 1); onClose() },
      disabled: idx === slideCount - 1,
    },
    {
      label: 'Delete',
      icon: '🗑',
      fn: () => { deleteSlide(idx); onClose() },
      danger: true,
      disabled: slideCount === 1,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-start" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 160px)' }}>
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      {/* Menu card */}
      <div className="relative mx-4 bg-[#2c2c2e] rounded-2xl overflow-hidden shadow-2xl min-w-[220px]">
        {actions.map(({ label, fn, danger, disabled }, i) => (
          <button
            key={label}
            onClick={disabled ? undefined : fn}
            className={`w-full flex items-center justify-between px-5 py-4 text-[15px] border-b border-white/8 last:border-0 active:bg-white/10 ${
              disabled ? 'opacity-25 pointer-events-none' : danger ? 'text-red-400' : 'text-white'
            }`}
          >
            <span>{label}</span>
            <span className="text-lg opacity-60">{danger ? '🗑' : i <= 1 ? '⊞' : i === 2 ? '⧉' : i === 3 ? '←' : '→'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SlidesPanel() {
  const slides       = useStore(s => s.slides)
  const layers       = useStore(s => s.layers)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const bgColor      = useStore(s => s.bgColor)
  const ratio        = useStore(s => s.ratio)
  const setActiveSlide  = useStore(s => s.setActiveSlide)
  const setPanel        = useStore(s => s.setPanel)
  const addSlide        = useStore(s => s.addSlide)
  const insertSlide     = useStore(s => s.insertSlide)
  const duplicateSlide  = useStore(s => s.duplicateSlide)
  const moveSlide       = useStore(s => s.moveSlide)
  const deleteSlide     = useStore(s => s.deleteSlide)

  const THUMB_H = 88
  const THUMB_W = Math.round(THUMB_H * (ratio.w / ratio.h))
  const GAP = 12

  const [menuIdx, setMenuIdx]   = useState(null)
  // dragState: { fromIdx, currentIdx, startX }
  const [dragState, setDragState] = useState(null)
  const dragStateRef = useRef(null)
  dragStateRef.current = dragState

  // Compute visual order while dragging
  const visualOrder = slides.map((_, i) => i)
  if (dragState) {
    visualOrder.splice(dragState.fromIdx, 1)
    visualOrder.splice(dragState.currentIdx, 0, dragState.fromIdx)
  }

  // ── Pointer-based drag-to-reorder ──────────────────────────────────────────
  const slideCountRef = useRef(slides.length)
  slideCountRef.current = slides.length

  const startDrag = (e, idx) => {
    e.preventDefault()
    const startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const state = { fromIdx: idx, currentIdx: idx, startX }
    setDragState(state)
    dragStateRef.current = state

    const onMove = (ev) => {
      const cx = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0
      const dx = cx - dragStateRef.current.startX
      const step = THUMB_W + GAP
      const rawIdx = dragStateRef.current.fromIdx + Math.round(dx / step)
      const currentIdx = Math.max(0, Math.min(slideCountRef.current - 1, rawIdx))
      const next = { ...dragStateRef.current, currentIdx }
      dragStateRef.current = next
      setDragState({ ...next })
    }

    const onUp = () => {
      const ds = dragStateRef.current
      if (ds && ds.fromIdx !== ds.currentIdx) {
        useStore.getState().moveSlide(ds.fromIdx, ds.currentIdx)
      }
      setDragState(null)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <>
      <div className="bg-[#111] rounded-t-2xl pb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 mb-4">
          <span className="font-semibold text-base">Slides</span>
          <button onClick={() => setPanel(null)} className="text-white/40">
            <IconClose size={18} />
          </button>
        </div>

        {/* Thumbnail strip */}
        <div className="flex px-5 overflow-x-auto pb-2" style={{ gap: GAP }}>
          {visualOrder.map((slideIdx, visualPos) => {
            const slide = slides[slideIdx]
            const slideLayers = layers.filter(l =>
              Math.floor(l.x / ratio.w) === slideIdx && (l.src || l.type === 'shape' || l.type === 'text')
            )
            const isActive  = slideIdx === activeSlideIdx
            const isDragging = dragState?.fromIdx === slideIdx

            return (
              <div
                key={slide.id}
                className={`flex flex-col items-center shrink-0 transition-all duration-150 ${isDragging ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}
                style={{ width: THUMB_W }}
              >
                {/* Thumbnail */}
                <button
                  className={`relative rounded-xl overflow-hidden border-2 w-full transition-colors active:opacity-75 ${
                    isActive ? 'border-blue-500' : 'border-transparent'
                  }`}
                  style={{ height: THUMB_H, background: slide.bgColor ?? bgColor }}
                  onClick={() => { if (!dragState) { setActiveSlide(slideIdx); setPanel(null) } }}
                >
                  {slideLayers.filter(l => l.src).map(layer => (
                    <img
                      key={layer.id}
                      src={layer.src}
                      className="absolute object-cover pointer-events-none"
                      style={{
                        left:   `${((layer.x - slideIdx * ratio.w) / ratio.w) * 100}%`,
                        top:    `${(layer.y / ratio.h) * 100}%`,
                        width:  `${(layer.w / ratio.w) * 100}%`,
                        height: `${(layer.h / ratio.h) * 100}%`,
                      }}
                      alt=""
                    />
                  ))}
                  {/* Slide number badge */}
                  <div className="absolute bottom-1 left-1.5 bg-black/55 text-white text-[9px] px-1.5 py-0.5 rounded-full font-semibold leading-none">
                    {slideIdx + 1}
                  </div>
                </button>

                {/* Controls: drag handle + three-dot menu */}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    className="text-white/30 active:text-white/60 touch-none select-none cursor-grab active:cursor-grabbing"
                    onPointerDown={e => startDrag(e, slideIdx)}
                    title="Drag to reorder"
                  >
                    <IconDragHandle />
                  </button>
                  <button
                    className={`transition-colors ${menuIdx === slideIdx ? 'text-white' : 'text-white/30 active:text-white/60'}`}
                    onClick={() => setMenuIdx(menuIdx === slideIdx ? null : slideIdx)}
                  >
                    <IconDots />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add new slide */}
          <button
            onClick={addSlide}
            className="shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-white/35 text-2xl active:border-white/50 active:text-white/60 transition-colors"
            style={{ width: THUMB_W, height: THUMB_H }}
          >
            +
          </button>
        </div>
      </div>

      {/* Context menu */}
      {menuIdx !== null && (
        <SlideMenu
          idx={menuIdx}
          slideCount={slides.length}
          onClose={() => setMenuIdx(null)}
          insertSlide={insertSlide}
          duplicateSlide={duplicateSlide}
          moveSlide={moveSlide}
          deleteSlide={deleteSlide}
        />
      )}
    </>
  )
}

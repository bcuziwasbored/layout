import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KImage, Group, Text, Line } from 'react-konva'
import { useStore, fitInCell } from '../useStore'
import useImage from 'use-image'

const BORDER_COLOR = '#3b82f6'
const HANDLE_PX = 10  // screen pixels, stays constant regardless of zoom

function getDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

// ─── EmptyCell ───────────────────────────────────────────────────────────────

function EmptyCell({ layer, onPress }) {
  const r = 20
  return (
    <Group x={layer.x} y={layer.y} onClick={onPress} onTap={onPress}>
      <Rect width={layer.w} height={layer.h} fill="#e0e0e0" />
      <Rect x={layer.w / 2 - r} y={layer.h / 2 - r} width={r * 2} height={r * 2}
        cornerRadius={r} fill="rgba(0,0,0,0.18)" />
      <Text text="+" fontSize={22} fill="rgba(0,0,0,0.45)"
        x={layer.w / 2 - 7} y={layer.h / 2 - 13} listening={false} />
    </Group>
  )
}

// ─── FilledCell ───────────────────────────────────────────────────────────────

function FilledCell({ layer, vs, isSelected, isCropTarget, onSelect, onMoveEnd, onPanEnd }) {
  const [img] = useImage(layer.src)
  const hs = HANDLE_PX / vs   // handle half-size in logical units

  const imgW = img ? img.naturalWidth * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0
  const imgX = layer.imgX ?? 0
  const imgY = layer.imgY ?? 0

  const clampPos = (x, y) => ({
    x: Math.max(Math.min(0, layer.w - imgW), Math.min(0, x)),
    y: Math.max(Math.min(0, layer.h - imgH), Math.min(0, y)),
  })

  // ── Crop-target overlay ──
  if (isCropTarget) {
    return (
      <Group>
        {img && (
          <KImage image={img} x={layer.x + imgX} y={layer.y + imgY}
            width={imgW} height={imgH} opacity={0.2} listening={false} />
        )}
        <Group clipFunc={ctx => ctx.rect(layer.x, layer.y, layer.w, layer.h)} listening={false}>
          {img && <KImage image={img} x={layer.x + imgX} y={layer.y + imgY}
            width={imgW} height={imgH} opacity={1} />}
        </Group>
        <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
          stroke="white" strokeWidth={1.5 / vs} dash={[6 / vs, 4 / vs]} listening={false} />
      </Group>
    )
  }

  const handles = [[0, 0], [layer.w, 0], [0, layer.h], [layer.w, layer.h]]

  // ── Cell-locked: drag image to pan within clip ──
  if (layer.locked) {
    return (
      <Group x={layer.x} y={layer.y} clipFunc={ctx => ctx.rect(0, 0, layer.w, layer.h)}
        onClick={onSelect} onTap={onSelect} opacity={layer.opacity ?? 1}>
        {img && (
          <KImage
            image={img} x={imgX} y={imgY} width={imgW} height={imgH}
            draggable={isSelected}
            onDragMove={e => {
              const { x, y } = clampPos(e.target.x(), e.target.y())
              e.target.position({ x, y })
            }}
            onDragEnd={e => {
              const { x, y } = clampPos(e.target.x(), e.target.y())
              onPanEnd({ imgX: x, imgY: y })
            }}
          />
        )}
        {isSelected && <>
          <Rect width={layer.w} height={layer.h}
            stroke={BORDER_COLOR} strokeWidth={2 / vs} listening={false} />
          {handles.map(([hx, hy], i) => (
            <Rect key={i} x={hx - hs} y={hy - hs} width={hs * 2} height={hs * 2}
              fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs}
              cornerRadius={2} listening={false} />
          ))}
        </>}
      </Group>
    )
  }

  // ── Free layer: drag to reposition ──
  return (
    <Group x={layer.x} y={layer.y} width={layer.w} height={layer.h}
      clipFunc={ctx => ctx.rect(0, 0, layer.w, layer.h)}
      draggable={isSelected}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={e => onMoveEnd({ x: e.target.x(), y: e.target.y() })}
      opacity={layer.opacity ?? 1}>
      {img && <KImage image={img} x={imgX} y={imgY} width={imgW} height={imgH} />}
      {isSelected && <>
        <Rect width={layer.w} height={layer.h}
          stroke={BORDER_COLOR} strokeWidth={2 / vs} listening={false} />
        {handles.map(([hx, hy], i) => (
          <Rect key={i} x={hx - hs} y={hy - hs} width={hs * 2} height={hs * 2}
            fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs}
            cornerRadius={2} listening={false} />
        ))}
      </>}
    </Group>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function Canvas({ openPickerRef }) {
  const ratio = useStore(s => s.ratio)
  const bgColor = useStore(s => s.bgColor)
  const slides = useStore(s => s.slides)
  const layers = useStore(s => s.layers)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const activeLayerId = useStore(s => s.activeLayerId)
  const cropMode = useStore(s => s.cropMode)
  const setActiveLayer = useStore(s => s.setActiveLayer)
  const setActiveSlide = useStore(s => s.setActiveSlide)
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const addImageLayer = useStore(s => s.addImageLayer)
  const fillCells = useStore(s => s.fillCells)

  const containerRef = useRef()
  const stageRef = useRef()
  const fileRef = useRef()
  const pendingLayerId = useRef(null)
  const pendingSlideIdx = useRef(null)
  const isMulti = useRef(false)
  const panOrigin = useRef(null)
  const pinchRef = useRef({ active: false, lastDist: 0 })
  const viewRef = useRef(null)

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState(null)   // { x, y, scale }

  // Keep a ref always synced to latest view for use in event handlers
  const setViewSync = useCallback((updater) => {
    setView(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      viewRef.current = next
      return next
    })
  }, [])

  // ── Measure container ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Initialize view (once container is measured) ──
  useEffect(() => {
    if (!containerSize.w || view) return
    const scale = Math.min(
      (containerSize.w - 32) / ratio.w,
      (containerSize.h - 32) / ratio.h
    )
    const initView = {
      x: (containerSize.w - ratio.w * scale) / 2,
      y: (containerSize.h - ratio.h * scale) / 2,
      scale,
    }
    viewRef.current = initView
    setView(initView)
  }, [containerSize, ratio, view])

  // ── Snap to active slide when it changes ──
  useEffect(() => {
    if (!view) return
    setViewSync(v => ({
      ...v,
      x: (containerSize.w - ratio.w * v.scale) / 2 - activeSlideIdx * ratio.w * v.scale,
    }))
  }, [activeSlideIdx, slides.length]) // eslint-disable-line

  // ── Pinch zoom (passive:false required for preventDefault) ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      const t1 = e.touches[0], t2 = e.touches[1]
      const newDist = getDistance({ x: t1.clientX, y: t1.clientY }, { x: t2.clientX, y: t2.clientY })
      const mid = {
        x: (t1.clientX + t2.clientX) / 2 - el.getBoundingClientRect().left,
        y: (t1.clientY + t2.clientY) / 2 - el.getBoundingClientRect().top,
      }
      if (!pinchRef.current.active) {
        pinchRef.current = { active: true, lastDist: newDist }
        // cancel any canvas pan that started
        panOrigin.current = null
        return
      }
      const factor = newDist / pinchRef.current.lastDist
      pinchRef.current.lastDist = newDist
      setViewSync(v => {
        const ns = Math.max(0.15, Math.min(8, v.scale * factor))
        return {
          scale: ns,
          x: mid.x - (mid.x - v.x) * (ns / v.scale),
          y: mid.y - (mid.y - v.y) * (ns / v.scale),
        }
      })
    }
    const endHandler = () => { pinchRef.current = { active: false, lastDist: 0 } }
    el.addEventListener('touchmove', handler, { passive: false })
    el.addEventListener('touchend', endHandler)
    return () => {
      el.removeEventListener('touchmove', handler)
      el.removeEventListener('touchend', endHandler)
    }
  }, [setViewSync])

  // ── Canvas pan via Konva (1-finger on background) ──
  const handleBgPointerDown = useCallback((e) => {
    // Only start pan from background, not from a layer node
    const nativeTouches = e.evt.touches
    if (nativeTouches && nativeTouches.length > 1) return  // let pinch handler take over
    const pt = nativeTouches ? nativeTouches[0] : e.evt
    panOrigin.current = {
      clientX: pt.clientX,
      clientY: pt.clientY,
      vx: viewRef.current?.x ?? 0,
      vy: viewRef.current?.y ?? 0,
    }
    setActiveLayer(null)
  }, [setActiveLayer])

  const handleStageMouseMove = useCallback((e) => {
    if (!panOrigin.current) return
    const nativeTouches = e.evt.touches
    if (nativeTouches && nativeTouches.length > 1) { panOrigin.current = null; return }
    const pt = nativeTouches ? nativeTouches[0] : e.evt
    const dx = pt.clientX - panOrigin.current.clientX
    const dy = pt.clientY - panOrigin.current.clientY
    setViewSync(v => ({ ...v, x: panOrigin.current.vx + dx, y: panOrigin.current.vy + dy }))
  }, [setViewSync])

  const handleStagePointerUp = useCallback(() => {
    panOrigin.current = null
  }, [])

  // ── File picker ──
  const openPickerForCell = useCallback((layerId, slideIdx, multi = false) => {
    pendingLayerId.current = layerId
    pendingSlideIdx.current = slideIdx
    isMulti.current = multi
    if (fileRef.current) {
      fileRef.current.multiple = multi
      fileRef.current.click()
    }
  }, [])

  useEffect(() => {
    if (openPickerRef) {
      openPickerRef.current = (layerId = null, slideIdx = null, multi = false) =>
        openPickerForCell(layerId, slideIdx ?? activeSlideIdx, multi)
    }
  }, [openPickerRef, openPickerForCell, activeSlideIdx])

  const handleFileChange = (e) => {
    const files = [...e.target.files]
    if (!files.length) return

    if (isMulti.current && files.length > 1) {
      fillCells(files)
    } else {
      const file = files[0]
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        if (pendingLayerId.current) {
          const layer = useStore.getState().layers.find(l => l.id === pendingLayerId.current)
          if (layer) {
            const fit = fitInCell(img.naturalWidth, img.naturalHeight, layer.w, layer.h)
            updateLayerWithHistory(pendingLayerId.current, {
              src: url, naturalW: img.naturalWidth, naturalH: img.naturalHeight, ...fit,
            })
          }
          pendingLayerId.current = null
        } else {
          addImageLayer(url, img.naturalWidth, img.naturalHeight, pendingSlideIdx.current ?? activeSlideIdx)
        }
      }
      img.src = url
    }
    e.target.value = ''
  }

  const activeLayer = layers.find(l => l.id === activeLayerId)

  if (!view) return <div ref={containerRef} className="flex-1 w-full" />

  const vs = view.scale

  return (
    <div ref={containerRef} className="flex-1 w-full overflow-hidden">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <Stage
        ref={stageRef}
        width={containerSize.w}
        height={containerSize.h}
        onMouseMove={handleStageMouseMove}
        onTouchMove={handleStageMouseMove}
        onMouseUp={handleStagePointerUp}
        onTouchEnd={handleStagePointerUp}
      >
        <Layer>
          {/* Content group: all slides in logical coordinates, transformed for pan/zoom */}
          <Group x={view.x} y={view.y} scaleX={vs} scaleY={vs}>

            {/* Large background catch-all for pan + deselect */}
            <Rect
              x={-ratio.w * 2} y={-ratio.h * 2}
              width={(slides.length + 4) * ratio.w} height={ratio.h * 5}
              fill="transparent"
              onMouseDown={handleBgPointerDown}
              onTouchStart={handleBgPointerDown}
            />

            {/* Slide backgrounds */}
            {slides.map((slide, i) => (
              <Rect key={slide.id}
                x={i * ratio.w} y={0} width={ratio.w} height={ratio.h}
                fill={bgColor}
                onMouseDown={e => { setActiveSlide(i); handleBgPointerDown(e) }}
                onTouchStart={e => { setActiveSlide(i); handleBgPointerDown(e) }}
              />
            ))}

            {/* Active slide indicator */}
            <Rect
              x={activeSlideIdx * ratio.w} y={0}
              width={ratio.w} height={ratio.h}
              stroke={BORDER_COLOR} strokeWidth={2 / vs}
              listening={false}
            />

            {/* Slide dividers (no coordinate gap — purely visual) */}
            {slides.slice(1).map((_, i) => (
              <Line key={i}
                points={[(i + 1) * ratio.w, 0, (i + 1) * ratio.w, ratio.h]}
                stroke="#555" strokeWidth={2 / vs} listening={false}
              />
            ))}

            {/* Crop overlay */}
            {cropMode && (
              <Rect
                x={0} y={0} width={slides.length * ratio.w} height={ratio.h}
                fill="rgba(0,0,0,0.75)" listening={false}
              />
            )}

            {/* Layers */}
            {layers.map(layer => {
              if (cropMode && layer.id === activeLayerId) {
                return (
                  <FilledCell key={layer.id} layer={layer} vs={vs}
                    isSelected={false} isCropTarget={true}
                    onSelect={() => {}} onMoveEnd={() => {}} onPanEnd={() => {}} />
                )
              }
              if (cropMode) return null

              return layer.src ? (
                <FilledCell key={layer.id} layer={layer} vs={vs}
                  isSelected={activeLayerId === layer.id}
                  isCropTarget={false}
                  onSelect={() => {
                    setActiveLayer(layer.id)
                    setActiveSlide(Math.floor(layer.x / ratio.w))
                  }}
                  onMoveEnd={pos => updateLayerWithHistory(layer.id, pos)}
                  onPanEnd={pos => updateLayerWithHistory(layer.id, pos)}
                />
              ) : (
                <EmptyCell key={layer.id} layer={layer}
                  onPress={() => {
                    const si = Math.floor(layer.x / ratio.w)
                    const emptyInSlide = layers.filter(l => !l.src && Math.floor(l.x / ratio.w) === si)
                    openPickerForCell(layer.id, si, emptyInSlide.length > 1)
                  }}
                />
              )
            })}
          </Group>
        </Layer>
      </Stage>

      {cropMode && activeLayer && <CropControls layer={activeLayer} />}
    </div>
  )
}

// ─── CropControls ─────────────────────────────────────────────────────────────

function CropControls({ layer }) {
  const updateLayer = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const setCropMode = useStore(s => s.setCropMode)

  const imgW = (layer.naturalW ?? 1) * (layer.imgScale ?? 1)
  const imgH = (layer.naturalH ?? 1) * (layer.imgScale ?? 1)
  const maxPanX = Math.max(0, imgW - layer.w)
  const maxPanY = Math.max(0, imgH - layer.h)
  const minScale = Math.max(layer.w / (layer.naturalW ?? 1), layer.h / (layer.naturalH ?? 1))

  return (
    <div className="w-full bg-black/90 px-5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCropMode(false)} className="text-white/50 text-sm">Cancel</button>
        <span className="text-xs text-white/40 uppercase tracking-wider">Crop & Position</span>
        <button
          onClick={() => { updateLayerWithHistory(layer.id, {}); setCropMode(false) }}
          className="text-white text-sm font-semibold"
        >Done</button>
      </div>
      <div className="space-y-3">
        <SliderRow label="Scale" min={minScale} max={minScale * 4} step={0.001}
          value={layer.imgScale ?? 1}
          onChange={v => updateLayer(layer.id, { imgScale: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
          display={`${(layer.imgScale ?? 1).toFixed(2)}×`}
        />
        <SliderRow label="Pan X" min={-maxPanX} max={0} step={1}
          value={layer.imgX ?? 0}
          onChange={v => updateLayer(layer.id, { imgX: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
        />
        <SliderRow label="Pan Y" min={-maxPanY} max={0} step={1}
          value={layer.imgY ?? 0}
          onChange={v => updateLayer(layer.id, { imgY: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
        />
      </div>
    </div>
  )
}

function SliderRow({ label, min, max, step, value, onChange, onDone, display }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-12 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={onDone} onTouchEnd={onDone}
        className="flex-1 accent-blue-500"
      />
      {display && <span className="text-xs text-white/40 w-12 text-right shrink-0">{display}</span>}
    </div>
  )
}

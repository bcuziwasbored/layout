import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Image as KImage, Group, Text, Line } from 'react-konva'
import { useStore, fitInCell } from '../useStore'
import useImage from 'use-image'

const BORDER_COLOR = '#3b82f6'
const HANDLE_R_PX = 14
const DRAG_THRESHOLD_PX = 12
const SNAP_THRESHOLD_PX = 8

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function getSnapLines(layers, excludeId, ratio, slideCount) {
  const xs = [], ys = []
  for (let i = 0; i < slideCount; i++) {
    const sx = i * ratio.w
    xs.push(sx, sx + ratio.w, sx + ratio.w / 2)
    ys.push(0, ratio.h, ratio.h / 2)
  }
  for (const l of layers) {
    if (l.id === excludeId) continue
    xs.push(l.x, l.x + l.w, l.x + l.w / 2)
    ys.push(l.y, l.y + l.h, l.y + l.h / 2)
  }
  return { xs, ys }
}

function snapPosition(x, y, w, h, lines, vs) {
  const thr = SNAP_THRESHOLD_PX / vs
  let nx = x, ny = y, gx = null, gy = null
  for (const lx of lines.xs) {
    for (const cx of [x, x + w, x + w / 2]) {
      if (Math.abs(cx - lx) < thr) { nx = lx - (cx - x); gx = lx; break }
    }
    if (gx !== null) break
  }
  for (const ly of lines.ys) {
    for (const cy of [y, y + h, y + h / 2]) {
      if (Math.abs(cy - ly) < thr) { ny = ly - (cy - y); gy = ly; break }
    }
    if (gy !== null) break
  }
  return { x: nx, y: ny, gx, gy }
}

function computeResize(sl, handle, ddx, ddy) {
  const ar = sl.w / sl.h
  const isCorner = handle.length === 2
  let x = sl.x, y = sl.y, w = sl.w, h = sl.h
  if (isCorner) {
    if (Math.abs(ddx) >= Math.abs(ddy)) {
      w = Math.max(20, handle.includes('r') ? sl.w + ddx : sl.w - ddx)
      h = w / ar
      if (handle.includes('l')) x = sl.x + sl.w - w
      if (handle.includes('t')) y = sl.y + sl.h - h
    } else {
      h = Math.max(20, handle.includes('b') ? sl.h + ddy : sl.h - ddy)
      w = h * ar
      if (handle.includes('l')) x = sl.x + sl.w - w
      if (handle.includes('t')) y = sl.y + sl.h - h
    }
  } else {
    if (handle === 'r') w = Math.max(20, sl.w + ddx)
    if (handle === 'l') { w = Math.max(20, sl.w - ddx); x = sl.x + sl.w - w }
    if (handle === 'b') h = Math.max(20, sl.h + ddy)
    if (handle === 't') { h = Math.max(20, sl.h - ddy); y = sl.y + sl.h - h }
  }
  return { x, y, w, h }
}

// ─── Layer visuals ─────────────────────────────────────────────────────────────

function EmptyCell({ layer, onTap }) {
  const r = Math.min(layer.w, layer.h) * 0.12
  return (
    <Group x={layer.x} y={layer.y}
      onClick={e => { e.cancelBubble = true; onTap() }}
      onTap={e => { e.cancelBubble = true; onTap() }}>
      <Rect width={layer.w} height={layer.h} fill="#e0e0e0" />
      <Rect x={layer.w / 2 - r} y={layer.h / 2 - r} width={r * 2} height={r * 2}
        cornerRadius={r} fill="rgba(0,0,0,0.18)" listening={false} />
      <Text text="+" fill="rgba(0,0,0,0.45)"
        fontSize={r * 1.4} x={layer.w / 2 - r * 0.4} y={layer.h / 2 - r * 0.75}
        listening={false} />
    </Group>
  )
}

function FilledCell({ layer, vs, isActive, onSelect, onMoveEnd, onPanEnd }) {
  const [img] = useImage(layer.src)
  const imgW = img ? img.naturalWidth  * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0
  const imgX = layer.imgX ?? 0
  const imgY = layer.imgY ?? 0

  const minImgX = Math.min(0, layer.w - imgW)
  const minImgY = Math.min(0, layer.h - imgH)

  const handleSelect = useCallback((e) => {
    e.cancelBubble = true
    onSelect()
  }, [onSelect])

  if (layer.locked) {
    // Template cell: group fixed, image pannable when active.
    // clipFunc is on an inner group so the hit Rect lives OUTSIDE the clip —
    // Konva's hit canvas clips contents of clipFunc groups, making nodes inside
    // unreliable for hit detection when the layer is not selected.
    return (
      <Group x={layer.x} y={layer.y}
        opacity={layer.opacity ?? 1}
        onClick={handleSelect} onTap={handleSelect}>
        {/* Visual clip — listening=false so only the hit Rect below catches events */}
        <Group clipFunc={ctx => ctx.rect(0, 0, layer.w, layer.h)} listening={isActive}>
          {img && (
            <KImage name="layer" image={img} x={imgX} y={imgY} width={imgW} height={imgH}
              draggable={isActive}
              onDragMove={e => {
                e.cancelBubble = true
                const x = clamp(e.target.x(), minImgX, 0)
                const y = clamp(e.target.y(), minImgY, 0)
                e.target.position({ x, y })
              }}
              onDragEnd={e => {
                e.cancelBubble = true
                onPanEnd({ imgX: clamp(e.target.x(), minImgX, 0), imgY: clamp(e.target.y(), minImgY, 0) })
              }}
            />
          )}
        </Group>
        {/* Hit area outside clipFunc — always reliably hittable */}
        <Rect name="layer" width={layer.w} height={layer.h} fill="rgba(0,0,0,0.01)"
          listening={!isActive} />
      </Group>
    )
  }

  // Free layer: whole group moves
  return (
    <Group x={layer.x} y={layer.y}
      opacity={layer.opacity ?? 1}
      draggable={isActive}
      onClick={handleSelect} onTap={handleSelect}
      onDragMove={e => { e.cancelBubble = true }}
      onDragEnd={e => {
        e.cancelBubble = true
        onMoveEnd({ x: e.target.x(), y: e.target.y() })
      }}>
      {/* Visual clip — listening=false keeps image visually bounded */}
      <Group clipFunc={ctx => ctx.rect(0, 0, layer.w, layer.h)} listening={false}>
        {img && <KImage image={img} x={imgX} y={imgY} width={imgW} height={imgH} />}
      </Group>
      {/* Hit area outside clipFunc — reliably hittable */}
      <Rect name="layer" width={layer.w} height={layer.h} fill="rgba(0,0,0,0.01)" />
    </Group>
  )
}

function SelectionOverlay({ layer, vs }) {
  const hr = HANDLE_R_PX / vs
  const handles = [
    ['tl', layer.x,                layer.y               ],
    ['t',  layer.x + layer.w / 2,  layer.y               ],
    ['tr', layer.x + layer.w,      layer.y               ],
    ['r',  layer.x + layer.w,      layer.y + layer.h / 2 ],
    ['br', layer.x + layer.w,      layer.y + layer.h     ],
    ['b',  layer.x + layer.w / 2,  layer.y + layer.h     ],
    ['bl', layer.x,                layer.y + layer.h     ],
    ['l',  layer.x,                layer.y + layer.h / 2 ],
  ]
  return (
    <Group>
      {/* Border only — no pointer events */}
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
        stroke={BORDER_COLOR} strokeWidth={2 / vs} listening={false} />
      {/* Handles DO need to receive pointer events for resize dragging */}
      {handles.map(([h, hx, hy]) => (
        <Circle key={h} name={`handle|${h}|${layer.id}`}
          x={hx} y={hy} radius={hr}
          fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs} />
      ))}
    </Group>
  )
}

function CropTarget({ layer, vs, onPanEnd, onResizeEnd }) {
  const [img] = useImage(layer.src)
  const hr = HANDLE_R_PX / vs
  const imgW = img ? img.naturalWidth  * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0
  const ix = layer.imgX ?? 0, iy = layer.imgY ?? 0
  const minImgX = Math.min(0, layer.w - imgW)
  const minImgY = Math.min(0, layer.h - imgH)

  return (
    <Group>
      {img && <KImage image={img} x={layer.x + ix} y={layer.y + iy}
        width={imgW} height={imgH} opacity={0.25} listening={false} />}
      <Group clipFunc={ctx => ctx.rect(layer.x, layer.y, layer.w, layer.h)} listening={false}>
        {img && <KImage image={img} x={layer.x + ix} y={layer.y + iy}
          width={imgW} height={imgH} />}
      </Group>
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
        stroke="white" strokeWidth={1.5 / vs} dash={[6 / vs, 4 / vs]} listening={false} />
      {[['tl', layer.x, layer.y], ['tr', layer.x + layer.w, layer.y],
        ['bl', layer.x, layer.y + layer.h], ['br', layer.x + layer.w, layer.y + layer.h]
      ].map(([h, hx, hy]) => (
        <Circle key={h} name={`crophandle|${h}|${layer.id}`}
          x={hx} y={hy} radius={hr}
          fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth={1 / vs}
        />
      ))}
    </Group>
  )
}

// ─── Canvas ────────────────────────────────────────────────────────────────────

export default function Canvas({ openPickerRef }) {
  const ratio        = useStore(s => s.ratio)
  const bgColor      = useStore(s => s.bgColor)
  const slides       = useStore(s => s.slides)
  const layers       = useStore(s => s.layers)
  const activeSlideIdx  = useStore(s => s.activeSlideIdx)
  const activeLayerId   = useStore(s => s.activeLayerId)
  const cropMode        = useStore(s => s.cropMode)
  const setActiveLayer  = useStore(s => s.setActiveLayer)
  const setActiveSlide  = useStore(s => s.setActiveSlide)
  const addSlide        = useStore(s => s.addSlide)
  const updateLayer     = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const addImageLayer   = useStore(s => s.addImageLayer)
  const fillCells       = useStore(s => s.fillCells)

  const containerRef = useRef()
  const fileRef      = useRef()
  const pendingLayerId  = useRef(null)
  const pendingSlideIdx = useRef(null)
  const isMulti         = useRef(false)
  const viewRef         = useRef(null)
  const pinchRef        = useRef({ active: false, lastDist: 0 })

  // For pan + resize handle gestures on the Stage
  const panRef = useRef(null)   // { startX, startY, viewX, viewY, type, handle?, layerId?, startLayer? }

  // Keep always-fresh values accessible in stable callbacks
  const fresh = useRef({})
  fresh.current = { layers, slides, ratio, activeLayerId, cropMode, activeSlideIdx,
    setActiveLayer, setActiveSlide, addSlide, updateLayer, updateLayerWithHistory,
    addImageLayer, fillCells }

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState(null)
  const [snapGuides, setSnapGuides] = useState({ x: null, y: null })

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

  // ── Initialize view ──
  useEffect(() => {
    if (!containerSize.w || view) return
    const { ratio: r } = fresh.current
    const scale = Math.min((containerSize.w - 32) / r.w, (containerSize.h - 32) / r.h)
    const init = {
      x: (containerSize.w - r.w * scale) / 2,
      y: (containerSize.h - r.h * scale) / 2,
      scale,
    }
    viewRef.current = init
    setView(init)
  }, [containerSize]) // eslint-disable-line

  // ── Snap to active slide ──
  useEffect(() => {
    if (!view) return
    const { ratio: r } = fresh.current
    setViewSync(v => ({
      ...v,
      x: (containerSize.w - r.w * v.scale) / 2 - activeSlideIdx * r.w * v.scale,
    }))
  }, [activeSlideIdx, slides.length]) // eslint-disable-line

  // ── Pinch zoom ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      const t1 = e.touches[0], t2 = e.touches[1]
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const rect = el.getBoundingClientRect()
      const mid = { x: (t1.clientX + t2.clientX) / 2 - rect.left, y: (t1.clientY + t2.clientY) / 2 - rect.top }
      if (!pinchRef.current.active) { pinchRef.current = { active: true, lastDist: newDist }; panRef.current = null; return }
      const factor = newDist / pinchRef.current.lastDist
      pinchRef.current.lastDist = newDist
      setViewSync(v => {
        const ns = clamp(v.scale * factor, 0.1, 10)
        return { scale: ns, x: mid.x - (mid.x - v.x) * (ns / v.scale), y: mid.y - (mid.y - v.y) * (ns / v.scale) }
      })
    }
    const onEnd = () => { pinchRef.current = { active: false, lastDist: 0 } }
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => { el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd) }
  }, [setViewSync])

  // ── Stage pointer events: pan + resize handles only ──
  // (Selection is handled directly by Konva onClick/onTap on each layer)

  const getHandleInfo = (target) => {
    let node = target
    while (node) {
      const name = node.attrs?.name || ''
      if (name.startsWith('handle|') || name.startsWith('crophandle|')) {
        const parts = name.split('|')
        return { type: parts[0] === 'handle' ? 'resize' : 'crop-resize', handle: parts[1], layerId: parts[2] }
      }
      if (name === 'addslide') return { type: 'addslide' }
      node = node.parent
    }
    return null
  }

  const handleStageDown = (e) => {
    if (pinchRef.current.active) return
    const ne = e.evt
    if (ne.touches && ne.touches.length > 1) return
    const pt = ne.touches ? ne.touches[0] : ne

    const info = getHandleInfo(e.target)
    const v = viewRef.current
    const { activeLayerId: activeId, layers: curLayers, cropMode: isCrop } = fresh.current

    if (info?.type === 'addslide') {
      panRef.current = { type: 'addslide' }
      return
    }

    if (info?.type === 'resize' && info.layerId === activeId && !isCrop) {
      const layer = curLayers.find(l => l.id === info.layerId)
      if (layer) {
        panRef.current = { type: 'resize', handle: info.handle, layerId: info.layerId,
          startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
        return
      }
    }

    if (info?.type === 'crop-resize' && isCrop) {
      const layer = curLayers.find(l => l.id === activeId)
      if (layer) {
        panRef.current = { type: 'crop-resize', handle: info.handle, layerId: activeId,
          startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
        return
      }
    }

    // In crop mode any non-handle touch pans the image within the crop boundary
    if (isCrop && activeId) {
      const layer = curLayers.find(l => l.id === activeId)
      if (layer) {
        panRef.current = { type: 'crop-pan', layerId: activeId,
          startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
      }
      return
    }

    // Coordinate-based hit test — bypasses Konva hit detection entirely.
    // Konva's hit canvas is unreliable inside clipFunc groups, so we test
    // layer bounding boxes directly in canvas (world) space.
    const containerRect = containerRef.current?.getBoundingClientRect()
    const clientX = pt.clientX - (containerRect?.left ?? 0)
    const clientY = pt.clientY - (containerRect?.top ?? 0)
    const canvasX = (clientX - v.x) / v.scale
    const canvasY = (clientY - v.y) / v.scale

    const hitLayer = [...curLayers].reverse().find(l =>
      l.src &&
      canvasX >= l.x && canvasX <= l.x + l.w &&
      canvasY >= l.y && canvasY <= l.y + l.h
    )

    if (hitLayer) {
      if (hitLayer.id === activeId) {
        return
      }
      panRef.current = { type: 'select', layerId: hitLayer.id,
        startX: pt.clientX, startY: pt.clientY, viewX: v.x, viewY: v.y, moved: false }
      return
    }

    if (activeId) {
      panRef.current = { type: 'deselect', startX: pt.clientX, startY: pt.clientY, moved: false }
      return
    }

    panRef.current = { type: 'pan', startX: pt.clientX, startY: pt.clientY,
      viewX: v.x, viewY: v.y, moved: false }
  }

  const handleStageMove = (e) => {
    const p = panRef.current
    if (!p || p.type === 'addslide') return
    if (pinchRef.current.active) { panRef.current = null; return }
    const ne = e.evt
    if (ne.touches && ne.touches.length > 1) { panRef.current = null; return }
    const pt = ne.touches ? ne.touches[0] : ne
    const dx = pt.clientX - p.startX
    const dy = pt.clientY - p.startY
    if (!p.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    p.moved = true

    const vs = viewRef.current.scale
    const { ratio: r, layers: curLayers, slides: curSlides, updateLayer: upd } = fresh.current

    if (p.type === 'pan' || p.type === 'select') {
      setViewSync(v => ({ ...v, x: p.viewX + dx, y: p.viewY + dy }))
    } else if (p.type === 'resize') {
      const sl = p.startLayer
      const { x: nx, y: ny, w: nw, h: nh } = computeResize(sl, p.handle, dx / vs, dy / vs)
      if (nw > 20 && nh > 20) {
        // Always refit image to cover the new dimensions uniformly, centered
        const { imgScale: newImgScale, imgX: newImgX, imgY: newImgY } =
          fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, nw, nh)
        upd(sl.id, { x: nx, y: ny, w: nw, h: nh, imgScale: newImgScale, imgX: newImgX, imgY: newImgY })
        setSnapGuides({ x: null, y: null })
      }
    } else if (p.type === 'crop-pan') {
      const sl = p.startLayer
      const imgW = (sl.naturalW ?? sl.w) * (sl.imgScale ?? 1)
      const imgH = (sl.naturalH ?? sl.h) * (sl.imgScale ?? 1)
      const minImgX = Math.min(0, sl.w - imgW)
      const minImgY = Math.min(0, sl.h - imgH)
      upd(sl.id, {
        imgX: clamp((sl.imgX ?? 0) + dx / vs, minImgX, 0),
        imgY: clamp((sl.imgY ?? 0) + dy / vs, minImgY, 0),
      })
    } else if (p.type === 'crop-resize') {
      const sl = p.startLayer
      const { x: nx, y: ny, w: nw, h: nh } = computeResize(sl, p.handle, dx / vs, dy / vs)
      if (nw > 20 && nh > 20) upd(sl.id, { x: nx, y: ny, w: nw, h: nh })
    }
  }

  const handleStageUp = (e) => {
    const p = panRef.current
    if (!p) return
    panRef.current = null
    setSnapGuides({ x: null, y: null })

    if (p.type === 'addslide' && !p.moved) {
      fresh.current.addSlide()
      return
    }

    if (p.type === 'select' && !p.moved) {
      const layer = fresh.current.layers.find(l => l.id === p.layerId)
      if (layer) fresh.current.setActiveSlide(Math.floor(layer.x / fresh.current.ratio.w))
      fresh.current.setActiveLayer(p.layerId)  // must come after setActiveSlide (which resets activeLayerId)
      return
    }

    if (p.type === 'deselect' && !p.moved) {
      fresh.current.setActiveLayer(null)
      return
    }

    if (p.type === 'crop-pan' && p.moved) {
      fresh.current.updateLayerWithHistory(p.startLayer.id, {})
      return
    }

    if ((p.type === 'resize' || p.type === 'crop-resize') && p.moved) {
      fresh.current.updateLayerWithHistory(p.startLayer.id, {})
    }
  }

  // ── File picker ──
  const openPickerRef2 = useRef(null)
  const openPickerForCell = useCallback((layerId, slideIdx, multi = false) => {
    pendingLayerId.current  = layerId
    pendingSlideIdx.current = slideIdx
    isMulti.current = multi
    if (fileRef.current) { fileRef.current.multiple = multi; fileRef.current.click() }
  }, [])

  useEffect(() => {
    openPickerRef2.current = openPickerForCell
    if (openPickerRef) {
      openPickerRef.current = (layerId = null, slideIdx = null, multi = false) =>
        openPickerForCell(layerId, slideIdx ?? fresh.current.activeSlideIdx, multi)
    }
  })

  const handleFileChange = (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    const { addImageLayer: addImg, fillCells: fill, updateLayerWithHistory: upd,
      layers: curLayers, activeSlideIdx: asi } = fresh.current

    if (isMulti.current && files.length > 1) {
      fill(files)
    } else {
      const url = URL.createObjectURL(files[0])
      const img = new Image()
      img.onload = () => {
        if (pendingLayerId.current) {
          const layer = curLayers.find(l => l.id === pendingLayerId.current)
          if (layer) {
            const fit = fitInCell(img.naturalWidth, img.naturalHeight, layer.w, layer.h)
            upd(pendingLayerId.current, { src: url, naturalW: img.naturalWidth, naturalH: img.naturalHeight, ...fit })
          }
          pendingLayerId.current = null
        } else {
          addImg(url, img.naturalWidth, img.naturalHeight, pendingSlideIdx.current ?? asi)
        }
      }
      img.src = url
    }
    e.target.value = ''
  }

  if (!view) return <div ref={containerRef} className="flex-1 w-full" />

  const vs = view.scale
  const activeLayer = layers.find(l => l.id === activeLayerId)

  return (
    <div ref={containerRef} className="flex-1 w-full overflow-hidden">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <Stage
        width={containerSize.w} height={containerSize.h}
        onMouseDown={handleStageDown}  onTouchStart={handleStageDown}
        onMouseMove={handleStageMove}  onTouchMove={handleStageMove}
        onMouseUp={handleStageUp}      onTouchEnd={handleStageUp}
      >
        <Layer>
          <Group x={view.x} y={view.y} scaleX={vs} scaleY={vs}>

            {/* Background hit area — must use near-transparent fill, not "transparent", to be hittable in Konva */}
            <Rect x={-ratio.w * 2} y={-ratio.h * 2}
              width={(slides.length + 4) * ratio.w} height={ratio.h * 5}
              fill="rgba(0,0,0,0.001)" />

            {/* Slide backgrounds — no tap handler; slide selection is via Slides panel only */}
            {slides.map((slide, i) => (
              <Rect key={slide.id} x={i * ratio.w} y={0} width={ratio.w} height={ratio.h}
                fill={bgColor} listening={false} />
            ))}

            {/* Inner 1px grey border (visual only, not in export) */}
            {slides.map((slide, i) => (
              <Rect key={`ib-${slide.id}`}
                x={i * ratio.w + 1 / vs} y={1 / vs}
                width={ratio.w - 2 / vs} height={ratio.h - 2 / vs}
                stroke="rgba(150,150,150,0.3)" strokeWidth={1 / vs} listening={false} />
            ))}

            {/* Slide dividers */}
            {slides.slice(1).map((_, i) => (
              <Line key={i}
                points={[(i + 1) * ratio.w, 0, (i + 1) * ratio.w, ratio.h]}
                stroke="#555" strokeWidth={1 / vs} listening={false} />
            ))}

            {/* + Add slide button */}
            <Group name="addslide" x={slides.length * ratio.w + 16 / vs} y={(ratio.h - ratio.h * 0.22) / 2}>
              <Rect name="addslide" width={ratio.h * 0.22} height={ratio.h * 0.22}
                cornerRadius={ratio.h * 0.03}
                stroke="rgba(255,255,255,0.35)" strokeWidth={2 / vs}
                dash={[8 / vs, 6 / vs]} fill="transparent" />
              <Text name="addslide" text="+" fill="rgba(255,255,255,0.55)"
                fontSize={ratio.h * 0.14} width={ratio.h * 0.22} align="center" y={ratio.h * 0.03}
                listening={false} />
            </Group>

            {/* Snap guides */}
            {snapGuides.x !== null && (
              <Line points={[snapGuides.x, -ratio.h, snapGuides.x, ratio.h * 2]}
                stroke="#ffff00" strokeWidth={1 / vs} listening={false} />
            )}
            {snapGuides.y !== null && (
              <Line points={[-ratio.w, snapGuides.y, ratio.w * (slides.length + 1), snapGuides.y]}
                stroke="#ffff00" strokeWidth={1 / vs} listening={false} />
            )}

            {/* Crop overlay */}
            {cropMode && (
              <Rect x={0} y={0} width={slides.length * ratio.w} height={ratio.h}
                fill="rgba(0,0,0,0.75)" listening={false} />
            )}

            {/* Layers */}
            {layers.map(layer => {
              const isActive = layer.id === activeLayerId
              if (cropMode && !isActive) return null
              if (cropMode && isActive) {
                return (
                  <CropTarget key={layer.id} layer={layer} vs={vs}
                    onPanEnd={pos => updateLayerWithHistory(layer.id, pos)}
                    onResizeEnd={pos => updateLayerWithHistory(layer.id, pos)}
                  />
                )
              }
              return layer.src ? (
                <FilledCell key={layer.id} layer={layer} vs={vs} isActive={isActive}
                  onSelect={() => {
                    fresh.current.setActiveSlide(Math.floor(layer.x / fresh.current.ratio.w))
                    fresh.current.setActiveLayer(layer.id)
                  }}
                  onMoveEnd={pos => updateLayerWithHistory(layer.id, pos)}
                  onPanEnd={pos => updateLayerWithHistory(layer.id, pos)}
                />
              ) : (
                <EmptyCell key={layer.id} layer={layer}
                  onTap={() => {
                    const si = Math.floor(layer.x / ratio.w)
                    const emptyInSlide = layers.filter(l => !l.src && Math.floor(l.x / ratio.w) === si)
                    openPickerRef2.current?.(layer.id, si, emptyInSlide.length > 1)
                  }}
                />
              )
            })}

            {/* Selection border + resize handles (outside clip) */}
            {!cropMode && activeLayer?.src && (
              <SelectionOverlay layer={activeLayer} vs={vs} />
            )}
          </Group>
        </Layer>
      </Stage>

      {cropMode && activeLayer && <CropControls layer={activeLayer} />}
    </div>
  )
}

// ─── CropControls ─────────────────────────────────────────────────────────────

function CropControls({ layer }) {
  const updateLayer            = useStore(s => s.updateLayer)
  const updateLayerWithHistory = useStore(s => s.updateLayerWithHistory)
  const setCropMode            = useStore(s => s.setCropMode)
  const minScale = Math.max(layer.w / (layer.naturalW ?? 1), layer.h / (layer.naturalH ?? 1))

  return (
    <div className="w-full bg-black/90 px-5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCropMode(false)} className="text-white/50 text-sm">Cancel</button>
        <span className="text-xs text-white/40 uppercase tracking-wider">Crop</span>
        <button onClick={() => { updateLayerWithHistory(layer.id, {}); setCropMode(false) }}
          className="text-white text-sm font-semibold">Done</button>
      </div>
      <div className="space-y-3">
        <SliderRow label="Scale" min={minScale} max={minScale * 4} step={0.001}
          value={layer.imgScale ?? 1}
          onChange={v => updateLayer(layer.id, { imgScale: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
          display={`${(layer.imgScale ?? 1).toFixed(2)}×`} />
      </div>
      <p className="text-center text-white/30 text-xs mt-3">
        Drag image to reposition · Drag corners to resize crop
      </p>
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
        className="flex-1 accent-blue-500" />
      {display && <span className="text-xs text-white/40 w-12 text-right shrink-0">{display}</span>}
    </div>
  )
}

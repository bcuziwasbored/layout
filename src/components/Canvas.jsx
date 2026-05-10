import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Image as KImage, Group, Text, Line } from 'react-konva'
import { useStore, fitInCell } from '../useStore'
import useImage from 'use-image'

const BORDER_COLOR = '#3b82f6'
const HANDLE_R_PX = 14
const DRAG_THRESHOLD_PX = 5
const SNAP_THRESHOLD_PX = 8

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Traverse Konva node tree upward to determine what was hit
function getGestureInfo(target) {
  let node = target
  while (node) {
    const name = node.name?.()
    if (name) {
      if (name === 'addslide') return { type: 'addslide' }
      const parts = name.split('|')
      if (parts[0] === 'handle')     return { type: 'resize',      handle: parts[1], layerId: parts[2] }
      if (parts[0] === 'crophandle') return { type: 'crop-resize', handle: parts[1], layerId: parts[2] }
      if (parts[0] === 'layer')      return { type: 'layer',       layerId: parts[1] }
    }
    node = node.parent
  }
  return { type: 'background' }
}

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

function snapPosition(x, y, w, h, snapLines, vs) {
  const thr = SNAP_THRESHOLD_PX / vs
  let nx = x, ny = y, gx = null, gy = null
  for (const lx of snapLines.xs) {
    for (const cx of [x, x + w, x + w / 2]) {
      if (Math.abs(cx - lx) < thr) { nx = lx - (cx - x); gx = lx; break }
    }
    if (gx !== null) break
  }
  for (const ly of snapLines.ys) {
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

// ─── Visual components (purely presentational) ───────────────────────────────

function EmptyCell({ layer, vs }) {
  const r = Math.min(layer.w, layer.h) * 0.12
  return (
    <Group name={`layer|${layer.id}`} x={layer.x} y={layer.y}>
      <Rect width={layer.w} height={layer.h} fill="#e0e0e0" />
      <Rect x={layer.w / 2 - r} y={layer.h / 2 - r} width={r * 2} height={r * 2}
        cornerRadius={r} fill="rgba(0,0,0,0.18)" />
      <Text text="+" fill="rgba(0,0,0,0.45)"
        fontSize={r * 1.4} x={layer.w / 2 - r * 0.4} y={layer.h / 2 - r * 0.75}
        listening={false} />
    </Group>
  )
}

function FilledCell({ layer, vs }) {
  const [img] = useImage(layer.src)
  const imgW = img ? img.naturalWidth  * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0

  return (
    <Group name={`layer|${layer.id}`} x={layer.x} y={layer.y}
      clipFunc={ctx => ctx.rect(0, 0, layer.w, layer.h)}
      opacity={layer.opacity ?? 1}>
      {img && (
        <KImage image={img} x={layer.imgX ?? 0} y={layer.imgY ?? 0}
          width={imgW} height={imgH} listening={false} />
      )}
      {/* Transparent hit area — required because KImage has listening=false,
          without this the Group has no hittable children and taps fall through */}
      <Rect width={layer.w} height={layer.h} fill="rgba(0,0,0,0)" />
    </Group>
  )
}

// Selection border + resize handles rendered OUTSIDE the clip group
function SelectionOverlay({ layer, vs }) {
  const hr = HANDLE_R_PX / vs
  const handles = [
    ['tl', layer.x,                   layer.y                  ],
    ['t',  layer.x + layer.w / 2,     layer.y                  ],
    ['tr', layer.x + layer.w,         layer.y                  ],
    ['r',  layer.x + layer.w,         layer.y + layer.h / 2    ],
    ['br', layer.x + layer.w,         layer.y + layer.h        ],
    ['b',  layer.x + layer.w / 2,     layer.y + layer.h        ],
    ['bl', layer.x,                   layer.y + layer.h        ],
    ['l',  layer.x,                   layer.y + layer.h / 2    ],
  ]
  return (
    <Group>
      {/* Border outside clip so full stroke width is visible */}
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
        stroke={BORDER_COLOR} strokeWidth={2 / vs} listening={false} />
      {handles.map(([handle, hx, hy]) => (
        <Circle key={handle}
          name={`handle|${handle}|${layer.id}`}
          x={hx} y={hy} radius={hr}
          fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs}
        />
      ))}
    </Group>
  )
}

function CropTarget({ layer, vs }) {
  const [img] = useImage(layer.src)
  const hr = HANDLE_R_PX / vs
  const imgW = img ? img.naturalWidth  * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0
  const ix = layer.imgX ?? 0, iy = layer.imgY ?? 0

  const corners = [
    ['tl', layer.x,           layer.y          ],
    ['tr', layer.x + layer.w, layer.y          ],
    ['bl', layer.x,           layer.y + layer.h],
    ['br', layer.x + layer.w, layer.y + layer.h],
  ]

  return (
    <Group name={`layer|${layer.id}`}>
      {/* Faded image outside clip */}
      {img && <KImage image={img} x={layer.x + ix} y={layer.y + iy}
        width={imgW} height={imgH} opacity={0.25} listening={false} />}
      {/* Full-opacity image within clip */}
      <Group clipFunc={ctx => ctx.rect(layer.x, layer.y, layer.w, layer.h)} listening={false}>
        {img && <KImage image={img} x={layer.x + ix} y={layer.y + iy}
          width={imgW} height={imgH} />}
      </Group>
      {/* Transparent hit area so touches on image area reach this Group */}
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h} fill="rgba(0,0,0,0)" />
      {/* Dashed crop border */}
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
        stroke="white" strokeWidth={1.5 / vs}
        dash={[6 / vs, 4 / vs]} listening={false} />
      {/* Corner crop handles */}
      {corners.map(([handle, hx, hy]) => (
        <Circle key={handle}
          name={`crophandle|${handle}|${layer.id}`}
          x={hx} y={hy} radius={hr}
          fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth={1 / vs}
        />
      ))}
    </Group>
  )
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────

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
  const gestureRef      = useRef({ active: false })
  const pinchRef        = useRef({ active: false, lastDist: 0 })

  // Keep always-fresh refs for use in stable callbacks
  const freshRef = useRef({})
  freshRef.current = { layers, slides, ratio, activeLayerId, cropMode,
    setActiveLayer, setActiveSlide, addSlide, updateLayer, updateLayerWithHistory,
    addImageLayer, fillCells, activeSlideIdx }

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [view, setView]         = useState(null)
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
    const ro = new ResizeObserver(() =>
      setContainerSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Initialize view ──
  useEffect(() => {
    if (!containerSize.w || view) return
    const { ratio } = freshRef.current
    const scale = Math.min(
      (containerSize.w - 32) / ratio.w,
      (containerSize.h - 32) / ratio.h
    )
    const init = {
      x: (containerSize.w - ratio.w * scale) / 2,
      y: (containerSize.h - ratio.h * scale) / 2,
      scale,
    }
    viewRef.current = init
    setView(init)
  }, [containerSize]) // eslint-disable-line

  // ── Snap to active slide when it changes ──
  useEffect(() => {
    if (!view) return
    const { ratio } = freshRef.current
    setViewSync(v => ({
      ...v,
      x: (containerSize.w - ratio.w * v.scale) / 2 - activeSlideIdx * ratio.w * v.scale,
    }))
  }, [activeSlideIdx, slides.length]) // eslint-disable-line

  // ── Pinch zoom (passive:false required) ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      const t1 = e.touches[0], t2 = e.touches[1]
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const rect = el.getBoundingClientRect()
      const mid = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      }
      if (!pinchRef.current.active) {
        pinchRef.current = { active: true, lastDist: newDist }
        gestureRef.current.active = false
        return
      }
      const factor = newDist / pinchRef.current.lastDist
      pinchRef.current.lastDist = newDist
      setViewSync(v => {
        const ns = clamp(v.scale * factor, 0.1, 10)
        return {
          scale: ns,
          x: mid.x - (mid.x - v.x) * (ns / v.scale),
          y: mid.y - (mid.y - v.y) * (ns / v.scale),
        }
      })
    }
    const onEnd = () => { pinchRef.current = { active: false, lastDist: 0 } }
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => { el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd) }
  }, [setViewSync])

  // ── Unified gesture handler ──
  const handlePointerDown = (e) => {
    if (pinchRef.current.active) return
    const ne = e.evt
    if (ne.touches && ne.touches.length > 1) return
    const pt = ne.touches ? ne.touches[0] : ne

    const info = getGestureInfo(e.target)
    const { activeLayerId: activeId, cropMode: isCrop, layers: curLayers, ratio: r } = freshRef.current
    const v = viewRef.current

    const g = {
      active: true, moved: false,
      startX: pt.clientX, startY: pt.clientY,
      viewX: v.x, viewY: v.y,
      type: 'pan', layerId: null, handle: null, startLayer: null,
    }

    if (info.type === 'addslide') {
      g.type = 'addslide'
    } else if (info.type === 'resize' && info.layerId === activeId && !isCrop) {
      const layer = curLayers.find(l => l.id === info.layerId)
      if (layer) { g.type = 'resize'; g.handle = info.handle; g.layerId = info.layerId; g.startLayer = { ...layer } }
    } else if (info.type === 'crop-resize' && isCrop) {
      const layer = curLayers.find(l => l.id === activeId)
      if (layer) { g.type = 'crop-resize'; g.handle = info.handle; g.layerId = activeId; g.startLayer = { ...layer } }
    } else if (activeId && (info.layerId === activeId || (isCrop && info.type === 'layer'))) {
      // Touching selected layer (or image in crop mode) — will move/pan on drag
      const layer = curLayers.find(l => l.id === activeId)
      if (layer) {
        g.type = (layer.locked || isCrop) ? 'crop-pan' : 'move'
        g.layerId = activeId
        g.startLayer = { ...layer }
      }
    } else if (activeId) {
      // Touching outside selected layer → immediately deselect, then pan
      freshRef.current.setActiveLayer(null)
      g.type = 'pan'
    } else if (info.type === 'layer') {
      // Nothing selected, tap on layer → will select on tap; drag = pan canvas
      g.type = 'select-or-pan'
      g.layerId = info.layerId
    }
    // else: background → pan

    gestureRef.current = g
  }

  const handlePointerMove = (e) => {
    const g = gestureRef.current
    if (!g.active || pinchRef.current.active) return
    const ne = e.evt
    if (ne.touches && ne.touches.length > 1) { g.active = false; return }
    const pt = ne.touches ? ne.touches[0] : ne
    const dx = pt.clientX - g.startX
    const dy = pt.clientY - g.startY

    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    g.moved = true

    const { ratio: r, layers: curLayers, slides: curSlides, updateLayer: upd } = freshRef.current
    const vs = viewRef.current.scale

    if (g.type === 'pan' || g.type === 'select-or-pan') {
      setViewSync(v => ({ ...v, x: g.viewX + dx, y: g.viewY + dy }))
    } else if (g.type === 'move') {
      const sl = g.startLayer
      const rawX = sl.x + dx / vs, rawY = sl.y + dy / vs
      const snapLines = getSnapLines(curLayers, sl.id, r, curSlides.length)
      const { x, y, gx, gy } = snapPosition(rawX, rawY, sl.w, sl.h, snapLines, vs)
      setSnapGuides({ x: gx, y: gy })
      upd(sl.id, { x, y })
    } else if (g.type === 'crop-pan') {
      const sl = g.startLayer
      const imgW = (sl.naturalW ?? 1) * (sl.imgScale ?? 1)
      const imgH = (sl.naturalH ?? 1) * (sl.imgScale ?? 1)
      upd(sl.id, {
        imgX: clamp((sl.imgX ?? 0) + dx / vs, Math.min(0, sl.w - imgW), 0),
        imgY: clamp((sl.imgY ?? 0) + dy / vs, Math.min(0, sl.h - imgH), 0),
      })
    } else if (g.type === 'resize') {
      const sl = g.startLayer
      const { x: nx, y: ny, w: nw, h: nh } = computeResize(sl, g.handle, dx / vs, dy / vs)
      if (nw > 20 && nh > 20) {
        // Scale image proportionally so it continues to fill the new bounds
        const sW = nw / sl.w, sH = nh / sl.h
        const cover = Math.max(Math.abs(sW), Math.abs(sH))
        const newImgScale = (sl.imgScale ?? 1) * cover
        const imgW = (sl.naturalW ?? nw) * newImgScale
        const imgH = (sl.naturalH ?? nh) * newImgScale
        const newImgX = clamp((sl.imgX ?? 0) * sW, Math.min(0, nw - imgW), 0)
        const newImgY = clamp((sl.imgY ?? 0) * sH, Math.min(0, nh - imgH), 0)
        upd(sl.id, { x: nx, y: ny, w: nw, h: nh,
          imgScale: newImgScale, imgX: newImgX, imgY: newImgY })
      }
    } else if (g.type === 'crop-resize') {
      const sl = g.startLayer
      const { x: nx, y: ny, w: nw, h: nh } = computeResize(sl, g.handle, dx / vs, dy / vs)
      // Crop resize: only move the boundary, keep image unchanged
      if (nw > 20 && nh > 20) upd(sl.id, { x: nx, y: ny, w: nw, h: nh })
    }
  }

  const handlePointerUp = (e) => {
    const g = gestureRef.current
    if (!g.active) return
    g.active = false
    setSnapGuides({ x: null, y: null })

    const { ratio: r, layers: curLayers, slides: curSlides,
      setActiveLayer: selLayer, setActiveSlide: selSlide,
      addSlide: addSl, updateLayerWithHistory: upd } = freshRef.current

    if (!g.moved) {
      if (g.type === 'addslide') {
        addSl()
      } else if (g.type === 'select-or-pan' && g.layerId) {
        const layer = curLayers.find(l => l.id === g.layerId)
        if (layer && !layer.src) {
          // Empty cell → open picker
          const si = Math.floor(layer.x / r.w)
          const emptyInSlide = curLayers.filter(l => !l.src && Math.floor(l.x / r.w) === si)
          openPickerFn.current?.(layer.id, si, emptyInSlide.length > 1)
        } else if (layer) {
          selLayer(g.layerId)
          selSlide(Math.floor(layer.x / r.w))
        }
      } else if (g.type === 'pan') {
        // Tap on background → set active slide from tap position
        const v = viewRef.current
        const lx = (g.startX - v.x) / v.scale
        const ly = (g.startY - v.y) / v.scale
        if (ly >= 0 && ly <= r.h) {
          const si = Math.floor(lx / r.w)
          if (si >= 0 && si < curSlides.length) selSlide(si)
        }
      }
    } else if (['move', 'crop-pan', 'resize', 'crop-resize'].includes(g.type)) {
      upd(g.startLayer.id, {})
    }

    gestureRef.current = { active: false }
  }

  // ── File picker ──
  const openPickerFn = useRef(null)

  const openPickerForCell = useCallback((layerId, slideIdx, multi = false) => {
    pendingLayerId.current  = layerId
    pendingSlideIdx.current = slideIdx
    isMulti.current = multi
    if (fileRef.current) {
      fileRef.current.multiple = multi
      fileRef.current.click()
    }
  }, [])

  // Expose to parent (AddPanel etc.)
  useEffect(() => {
    openPickerFn.current = openPickerForCell
    if (openPickerRef) {
      openPickerRef.current = (layerId = null, slideIdx = null, multi = false) =>
        openPickerForCell(layerId, slideIdx ?? freshRef.current.activeSlideIdx, multi)
    }
  })

  const handleFileChange = (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    const { addImageLayer: addImg, fillCells: fill,
      updateLayerWithHistory: upd, layers: curLayers, activeSlideIdx: asi } = freshRef.current

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
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={handleFileChange} />

      <Stage
        width={containerSize.w} height={containerSize.h}
        onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
        onMouseMove={handlePointerMove} onTouchMove={handlePointerMove}
        onMouseUp={handlePointerUp}   onTouchEnd={handlePointerUp}
      >
        <Layer>
          <Group x={view.x} y={view.y} scaleX={vs} scaleY={vs}>

            {/* Large transparent hit area for pan/background taps */}
            <Rect
              x={-ratio.w * 2} y={-ratio.h * 2}
              width={(slides.length + 4) * ratio.w} height={ratio.h * 5}
              fill="transparent"
            />

            {/* Slide backgrounds */}
            {slides.map((slide, i) => (
              <Rect key={slide.id}
                x={i * ratio.w} y={0} width={ratio.w} height={ratio.h}
                fill={bgColor}
              />
            ))}

            {/* Inner grey border on each slide (visual only — 1px inside, not in export) */}
            {slides.map((slide, i) => (
              <Rect key={`ib-${slide.id}`}
                x={i * ratio.w + 1 / vs} y={1 / vs}
                width={ratio.w - 2 / vs} height={ratio.h - 2 / vs}
                stroke="rgba(150,150,150,0.3)" strokeWidth={1 / vs}
                listening={false}
              />
            ))}

            {/* Active-slide blue indicator */}
            <Rect
              x={activeSlideIdx * ratio.w} y={0}
              width={ratio.w} height={ratio.h}
              stroke={BORDER_COLOR} strokeWidth={2 / vs} listening={false}
            />

            {/* Slide dividers */}
            {slides.slice(1).map((_, i) => (
              <Line key={i}
                points={[(i + 1) * ratio.w, 0, (i + 1) * ratio.w, ratio.h]}
                stroke="#555" strokeWidth={1 / vs} listening={false}
              />
            ))}

            {/* + Add slide button (right of last slide) */}
            <Group name="addslide"
              x={slides.length * ratio.w + 16 / vs}
              y={(ratio.h - ratio.h * 0.22) / 2}
            >
              <Rect
                name="addslide"
                width={ratio.h * 0.22} height={ratio.h * 0.22}
                cornerRadius={ratio.h * 0.03}
                stroke="rgba(255,255,255,0.35)" strokeWidth={2 / vs}
                dash={[8 / vs, 6 / vs]} fill="transparent"
              />
              <Text name="addslide" text="+"
                fill="rgba(255,255,255,0.55)"
                fontSize={ratio.h * 0.14}
                width={ratio.h * 0.22} align="center"
                y={ratio.h * 0.03} listening={false}
              />
            </Group>

            {/* Snap guides */}
            {snapGuides.x !== null && (
              <Line points={[snapGuides.x, -ratio.h, snapGuides.x, ratio.h * (slides.length + 1)]}
                stroke="#ffff00" strokeWidth={1 / vs} listening={false} />
            )}
            {snapGuides.y !== null && (
              <Line points={[-ratio.w, snapGuides.y, ratio.w * (slides.length + 1), snapGuides.y]}
                stroke="#ffff00" strokeWidth={1 / vs} listening={false} />
            )}

            {/* Crop dark overlay */}
            {cropMode && (
              <Rect x={0} y={0} width={slides.length * ratio.w} height={ratio.h}
                fill="rgba(0,0,0,0.75)" listening={false} />
            )}

            {/* Layers */}
            {layers.map(layer => {
              const isActive = layer.id === activeLayerId
              if (cropMode && !isActive) return null
              if (cropMode && isActive) return <CropTarget key={layer.id} layer={layer} vs={vs} />

              return layer.src
                ? <FilledCell key={layer.id} layer={layer} vs={vs} />
                : <EmptyCell  key={layer.id} layer={layer} vs={vs} />
            })}

            {/* Selection border + resize handles outside clip so always fully visible */}
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

  const imgW = (layer.naturalW ?? 1) * (layer.imgScale ?? 1)
  const imgH = (layer.naturalH ?? 1) * (layer.imgScale ?? 1)
  const minScale = Math.max(
    layer.w / (layer.naturalW ?? 1),
    layer.h / (layer.naturalH ?? 1)
  )

  return (
    <div className="w-full bg-black/90 px-5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCropMode(false)} className="text-white/50 text-sm">Cancel</button>
        <span className="text-xs text-white/40 uppercase tracking-wider">Crop</span>
        <button
          onClick={() => { updateLayerWithHistory(layer.id, {}); setCropMode(false) }}
          className="text-white text-sm font-semibold"
        >Done</button>
      </div>
      <div className="space-y-3">
        <SliderRow label="Scale"
          min={minScale} max={minScale * 4} step={0.001}
          value={layer.imgScale ?? 1}
          onChange={v => updateLayer(layer.id, { imgScale: v })}
          onDone={() => updateLayerWithHistory(layer.id, {})}
          display={`${(layer.imgScale ?? 1).toFixed(2)}×`}
        />
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

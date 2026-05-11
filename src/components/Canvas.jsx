import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Image as KImage, Group, Text, Line } from 'react-konva'
import { useStore, fitInCell } from '../useStore'
import useImage from 'use-image'

const BORDER_COLOR = '#3b82f6'
const HANDLE_R_PX = 14
const DRAG_THRESHOLD_PX = 12
const SNAP_THRESHOLD_PX = 8

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function getSnapLines(layers, excludeIds, ratio, slideCount) {
  const excl = new Set(Array.isArray(excludeIds) ? excludeIds : [excludeIds])
  const xs = [], ys = []
  for (let i = 0; i < slideCount; i++) {
    const sx = i * ratio.w
    xs.push(sx, sx + ratio.w, sx + ratio.w / 2)
    ys.push(0, ratio.h, ratio.h / 2)
  }
  for (const l of layers) {
    if (excl.has(l.id)) continue
    xs.push(l.x, l.x + l.w, l.x + l.w / 2)
    ys.push(l.y, l.y + l.h, l.y + l.h / 2)
  }
  return { xs, ys }
}

// Returns snapped x/y and all active guide lines (xs/ys arrays).
// Checks all 3 candidate edges of the moving rect against all snap lines.
function snapPosition(x, y, w, h, lines, vs) {
  const thr = SNAP_THRESHOLD_PX / vs
  let nx = x, ny = y
  const gxs = [], gys = []

  // Find the closest snap on x axis among all 3 candidate edges
  let bestDX = thr, bestGX = null, bestOffset = 0
  for (const lx of lines.xs) {
    for (const cx of [x, x + w / 2, x + w]) {
      const d = Math.abs(cx - lx)
      if (d < bestDX) { bestDX = d; bestGX = lx; bestOffset = cx - x }
    }
  }
  if (bestGX !== null) { nx = bestGX - bestOffset; gxs.push(bestGX) }

  // Find the closest snap on y axis
  let bestDY = thr, bestGY = null, bestOffsetY = 0
  for (const ly of lines.ys) {
    for (const cy of [y, y + h / 2, y + h]) {
      const d = Math.abs(cy - ly)
      if (d < bestDY) { bestDY = d; bestGY = ly; bestOffsetY = cy - y }
    }
  }
  if (bestGY !== null) { ny = bestGY - bestOffsetY; gys.push(bestGY) }

  return { x: nx, y: ny, gxs, gys }
}

// Returns snapped value if within threshold, otherwise null
function snapEdge(v, lines, thr) {
  for (const l of lines) if (Math.abs(v - l) < thr) return l
  return null
}

const CELL_GAP = 0  // must match GAP in useStore applyTemplate

// Returns { vertical: [{xMid, y1, y2},...], horizontal: [{yMid, x1, x2},...] }
// y1/y2 and x1/x2 are the actual shared edge span, used to center the handle.
// Multiple cell pairs sharing the same seam x/y are merged into one entry.
function findGroupSeams(groupLayers) {
  const tol = CELL_GAP + 2
  const vMap = new Map()  // key: rounded xMid → { xMid, y1, y2 }
  const hMap = new Map()  // key: rounded yMid → { yMid, x1, x2 }
  for (const a of groupLayers) {
    for (const b of groupLayers) {
      if (a === b) continue
      const gapX = b.x - (a.x + a.w)
      if (gapX >= -1 && gapX <= tol) {
        const sharedY1 = Math.max(a.y, b.y)
        const sharedY2 = Math.min(a.y + a.h, b.y + b.h)
        if (sharedY2 > sharedY1) {
          const xMid = (a.x + a.w + b.x) / 2
          const key = Math.round(xMid)
          if (!vMap.has(key)) vMap.set(key, { xMid, y1: sharedY1, y2: sharedY2 })
          else { const v = vMap.get(key); v.y1 = Math.min(v.y1, sharedY1); v.y2 = Math.max(v.y2, sharedY2) }
        }
      }
      const gapY = b.y - (a.y + a.h)
      if (gapY >= -1 && gapY <= tol) {
        const sharedX1 = Math.max(a.x, b.x)
        const sharedX2 = Math.min(a.x + a.w, b.x + b.w)
        if (sharedX2 > sharedX1) {
          const yMid = (a.y + a.h + b.y) / 2
          const key = Math.round(yMid)
          if (!hMap.has(key)) hMap.set(key, { yMid, x1: sharedX1, x2: sharedX2 })
          else { const h = hMap.get(key); h.x1 = Math.min(h.x1, sharedX1); h.x2 = Math.max(h.x2, sharedX2) }
        }
      }
    }
  }
  return { vertical: [...vMap.values()], horizontal: [...hMap.values()] }
}

function computeResize(sl, handle, ddx, ddy, aspectOverride) {
  const ar = aspectOverride ?? (sl.w / sl.h)
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
  } else if (aspectOverride) {
    // With aspect constraint: edge handles adjust both dims to maintain ratio
    if (handle === 'r') { w = Math.max(20, sl.w + ddx); h = w / ar; y = sl.y + (sl.h - h) / 2 }
    if (handle === 'l') { w = Math.max(20, sl.w - ddx); x = sl.x + sl.w - w; h = w / ar; y = sl.y + (sl.h - h) / 2 }
    if (handle === 'b') { h = Math.max(20, sl.h + ddy); w = h * ar; x = sl.x + (sl.w - w) / 2 }
    if (handle === 't') { h = Math.max(20, sl.h - ddy); y = sl.y + sl.h - h; w = h * ar; x = sl.x + (sl.w - w) / 2 }
  } else {
    if (handle === 'r') w = Math.max(20, sl.w + ddx)
    if (handle === 'l') { w = Math.max(20, sl.w - ddx); x = sl.x + sl.w - w }
    if (handle === 'b') h = Math.max(20, sl.h + ddy)
    if (handle === 't') { h = Math.max(20, sl.h - ddy); y = sl.y + sl.h - h }
  }
  return { x, y, w, h }
}

// ─── Layer visuals ─────────────────────────────────────────────────────────────

// Clip path helper: rounded rect if cornerRadius > 0, plain rect otherwise.
// Called inside Konva clipFunc (ctx is already in node-local space).
function applyRoundRectClip(ctx, x, y, w, h, r) {
  const cr = Math.min(r, w / 2, h / 2)
  if (cr > 0 && ctx.roundRect) {
    ctx.roundRect(x, y, w, h, cr)
  } else if (cr > 0) {
    ctx.moveTo(x + cr, y)
    ctx.lineTo(x + w - cr, y); ctx.arcTo(x + w, y, x + w, y + cr, cr)
    ctx.lineTo(x + w, y + h - cr); ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr)
    ctx.lineTo(x + cr, y + h); ctx.arcTo(x, y + h, x, y + h - cr, cr)
    ctx.lineTo(x, y + cr); ctx.arcTo(x, y, x + cr, y, cr)
    ctx.closePath()
  } else {
    ctx.rect(x, y, w, h)
  }
}

function EmptyCell({ layer, onTap, vs }) {
  const gap = layer.cellGap ?? 0
  const inset = gap / 2
  const innerW = layer.w - gap
  const innerH = layer.h - gap
  const cr = layer.cornerRadius ?? 0
  const iconR = Math.min(Math.min(innerW, innerH) * 0.12, 30)
  const sw = 2 / vs
  return (
    <Group x={layer.x} y={layer.y}
      onClick={e => { e.cancelBubble = true; onTap() }}
      onTap={e => { e.cancelBubble = true; onTap() }}>
      <Rect x={inset} y={inset} width={innerW} height={innerH} fill="#e0e0e0"
        stroke="white" strokeWidth={sw} cornerRadius={cr} />
      <Rect x={layer.w / 2 - iconR} y={layer.h / 2 - iconR} width={iconR * 2} height={iconR * 2}
        cornerRadius={iconR} fill="rgba(0,0,0,0.18)" listening={false} />
      <Text text="+" fill="rgba(0,0,0,0.45)"
        fontSize={iconR * 1.4} x={layer.w / 2 - iconR * 0.4} y={layer.h / 2 - iconR * 0.75}
        listening={false} />
    </Group>
  )
}

// All interaction (select, drag, cell-edit) is handled at the Stage level via
// handleStageDown/Move/Up — FilledCell is purely visual.
function FilledCell({ layer, vs }) {
  const [img] = useImage(layer.src)
  const gap = layer.cellGap ?? 0
  const inset = gap / 2
  const innerW = layer.w - gap
  const innerH = layer.h - gap
  const imgW = img ? img.naturalWidth  * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0
  const imgX = (layer.imgX ?? 0) + inset
  const imgY = (layer.imgY ?? 0) + inset
  const rotation = layer.rotation ?? 0
  const scaleX  = layer.flipH ? -1 : 1
  const scaleY  = layer.flipV ? -1 : 1
  const hasTransform = rotation || layer.flipH || layer.flipV
  const cr = layer.cornerRadius ?? 0
  const bw = layer.borderWidth ?? 0
  const bc = layer.borderColor ?? '#000000'

  return (
    <Group x={layer.x} y={layer.y} opacity={layer.opacity ?? 1}>
      <Group clipFunc={ctx => applyRoundRectClip(ctx, inset, inset, innerW, innerH, cr)} listening={false}>
        {img && (hasTransform ? (
          // All transforms (rotation + flip) around frame center
          <Group x={layer.w / 2} y={layer.h / 2} rotation={rotation} scaleX={scaleX} scaleY={scaleY}>
            <KImage image={img} x={imgX - layer.w / 2} y={imgY - layer.h / 2} width={imgW} height={imgH} />
          </Group>
        ) : (
          <KImage image={img} x={imgX} y={imgY} width={imgW} height={imgH} />
        ))}
      </Group>
      {/* Border overlay (outside clip so full stroke is visible) */}
      {bw > 0 && (
        <Rect x={inset} y={inset} width={innerW} height={innerH}
          cornerRadius={cr} stroke={bc} strokeWidth={bw} listening={false} />
      )}
      {/* Hit area outside clipFunc so coordinate hit-testing in handleStageDown works */}
      <Rect width={layer.w} height={layer.h} fill="rgba(0,0,0,0.01)" />
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

function CropTarget({ layer, vs }) {
  const [img] = useImage(layer.src)
  const hr = HANDLE_R_PX / vs
  const imgW = img ? img.naturalWidth  * (layer.imgScale ?? 1) : 0
  const imgH = img ? img.naturalHeight * (layer.imgScale ?? 1) : 0
  const ix = layer.imgX ?? 0, iy = layer.imgY ?? 0
  const rotation = layer.rotation ?? 0

  const scaleX = layer.flipH ? -1 : 1
  const scaleY = layer.flipV ? -1 : 1
  const hasTransform = rotation || layer.flipH || layer.flipV

  // Render image with rotation/flip around frame center (global coords)
  const renderImg = (opacity) => {
    if (!img) return null
    if (hasTransform) return (
      <Group x={layer.x + layer.w / 2} y={layer.y + layer.h / 2}
        rotation={rotation} scaleX={scaleX} scaleY={scaleY} opacity={opacity} listening={false}>
        <KImage image={img} x={ix - layer.w / 2} y={iy - layer.h / 2} width={imgW} height={imgH} />
      </Group>
    )
    return <KImage image={img} x={layer.x + ix} y={layer.y + iy} width={imgW} height={imgH} opacity={opacity} listening={false} />
  }

  const cx = layer.x + layer.w / 2
  const cy = layer.y + layer.h / 2
  const handles = [
    ['tl', layer.x,        layer.y],
    ['tr', layer.x + layer.w, layer.y],
    ['bl', layer.x,        layer.y + layer.h],
    ['br', layer.x + layer.w, layer.y + layer.h],
    ['t',  cx,             layer.y],
    ['b',  cx,             layer.y + layer.h],
    ['l',  layer.x,        cy],
    ['r',  layer.x + layer.w, cy],
  ]

  return (
    <Group>
      {/* Ghost image outside clip */}
      {renderImg(0.25)}
      {/* Clipped image */}
      <Group clipFunc={ctx => ctx.rect(layer.x, layer.y, layer.w, layer.h)} listening={false}>
        {renderImg(1)}
      </Group>
      {/* Dashed border */}
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
        stroke="white" strokeWidth={1.5 / vs} dash={[6 / vs, 4 / vs]} listening={false} />
      {/* Rule-of-thirds grid */}
      {[1/3, 2/3].map(t => (
        <React.Fragment key={t}>
          <Line points={[layer.x + layer.w*t, layer.y, layer.x + layer.w*t, layer.y + layer.h]}
            stroke="rgba(255,255,255,0.25)" strokeWidth={0.75/vs} listening={false} />
          <Line points={[layer.x, layer.y + layer.h*t, layer.x + layer.w, layer.y + layer.h*t]}
            stroke="rgba(255,255,255,0.25)" strokeWidth={0.75/vs} listening={false} />
        </React.Fragment>
      ))}
      {/* Handles: corners are full circles, edges are smaller */}
      {handles.map(([h, hx, hy]) => {
        const isCorner = h.length === 2
        const r = isCorner ? hr : hr * 0.65
        return (
          <Circle key={h} name={`crophandle|${h}|${layer.id}`}
            x={hx} y={hy} radius={r}
            fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth={1 / vs} />
        )
      })}
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
  const activeCellId    = useStore(s => s.activeCellId)
  const cropMode        = useStore(s => s.cropMode)
  const cropAspect      = useStore(s => s.cropAspect)
  const setActiveLayer  = useStore(s => s.setActiveLayer)
  const setActiveCellId = useStore(s => s.setActiveCellId)
  const setCropMode     = useStore(s => s.setCropMode)
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
  fresh.current = { layers, slides, ratio, activeLayerId, activeCellId, cropMode, cropAspect, activeSlideIdx,
    setActiveLayer, setActiveCellId, setCropMode, addSlide, updateLayer, updateLayerWithHistory,
    addImageLayer, fillCells }

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState(null)
  // snapGuides: { xs: number[], ys: number[] } — all active guide positions this frame
  const [snapGuides, setSnapGuides] = useState({ xs: [], ys: [] })

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
    const scale = Math.min((containerSize.w - 32) / r.w, (containerSize.h - 32) / r.h) * 0.88
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

      if (!pinchRef.current.active) {
        const { activeCellId: cellId, layers: curLayers } = fresh.current
        const cell = cellId ? curLayers.find(l => l.id === cellId) : null
        // Decide at gesture start if both fingers land inside the cell
        let cellPinch = false
        if (cell) {
          const v = viewRef.current
          const toCanvas = (t) => ({
            x: (t.clientX - rect.left - v.x) / v.scale,
            y: (t.clientY - rect.top  - v.y) / v.scale,
          })
          const p1 = toCanvas(t1), p2 = toCanvas(t2)
          const inside = (p) => p.x >= cell.x && p.x <= cell.x + cell.w && p.y >= cell.y && p.y <= cell.y + cell.h
          cellPinch = inside(p1) && inside(p2)
        }
        pinchRef.current = {
          active: true, lastDist: newDist, cellPinch,
          cellScale: cell?.imgScale ?? null,
          imgX: cell?.imgX ?? null,
          imgY: cell?.imgY ?? null,
        }
        panRef.current = null
        return
      }

      const factor = newDist / pinchRef.current.lastDist
      pinchRef.current.lastDist = newDist

      const { activeCellId: cellId, layers: curLayers, updateLayer: upd } = fresh.current
      if (cellId && pinchRef.current.cellPinch) {
        const cell = curLayers.find(l => l.id === cellId)
        if (cell) {
          const gap = cell.cellGap ?? 0
          const inset = gap / 2
          const innerW = cell.w - gap
          const innerH = cell.h - gap
          const naturalW = cell.naturalW ?? cell.w
          const naturalH = cell.naturalH ?? cell.h
          const minScale = Math.max(innerW / naturalW, innerH / naturalH)
          const cur = pinchRef.current.cellScale ?? cell.imgScale ?? minScale
          const next = clamp(cur * factor, minScale, minScale * 8)
          pinchRef.current.cellScale = next

          // Finger midpoint in cell inner-area coords
          const v = viewRef.current
          const midCanvas = { x: (mid.x - v.x) / v.scale, y: (mid.y - v.y) / v.scale }
          const midCell = { x: midCanvas.x - cell.x - inset, y: midCanvas.y - cell.y - inset }

          // Keep the image point under the midpoint fixed
          const curImgX = pinchRef.current.imgX ?? cell.imgX ?? 0
          const curImgY = pinchRef.current.imgY ?? cell.imgY ?? 0
          const imgPtX = (midCell.x - curImgX) / cur
          const imgPtY = (midCell.y - curImgY) / cur
          const minImgX = Math.min(0, innerW - naturalW * next)
          const minImgY = Math.min(0, innerH - naturalH * next)
          const newImgX = clamp(midCell.x - imgPtX * next, minImgX, 0)
          const newImgY = clamp(midCell.y - imgPtY * next, minImgY, 0)
          pinchRef.current.imgX = newImgX
          pinchRef.current.imgY = newImgY

          upd(cellId, { imgScale: next, imgX: newImgX, imgY: newImgY })
        }
        return
      }

      setViewSync(v => {
        const ns = clamp(v.scale * factor, 0.1, 10)
        return { scale: ns, x: mid.x - (mid.x - v.x) * (ns / v.scale), y: mid.y - (mid.y - v.y) * (ns / v.scale) }
      })
    }
    const onEnd = () => {
      const { activeCellId: cellId, updateLayerWithHistory: updH } = fresh.current
      if (cellId && pinchRef.current.cellPinch && pinchRef.current.active) updH(cellId, {})
      pinchRef.current = { active: false, lastDist: 0 }
    }
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
      if (name.startsWith('handle|')) {
        const parts = name.split('|')
        return { type: 'resize', handle: parts[1], layerId: parts[2] }
      }
      if (name.startsWith('crophandle|')) {
        const parts = name.split('|')
        return { type: 'crop-resize', handle: parts[1], layerId: parts[2] }
      }
      if (name.startsWith('seam|')) {
        const parts = name.split('|')
        return { type: 'seam', seamType: parts[1], layerId: parts[2], seamMid: parseFloat(parts[3]) }
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
    const { activeLayerId: activeId, activeCellId: curCellId, layers: curLayers, cropMode: isCrop } = fresh.current

    if (info?.type === 'addslide') {
      panRef.current = { type: 'addslide' }
      return
    }

    // Canvas coords needed by both crop-pan and hit test — compute once up front
    const containerRect = containerRef.current?.getBoundingClientRect()
    const clientX = pt.clientX - (containerRect?.left ?? 0)
    const clientY = pt.clientY - (containerRect?.top ?? 0)
    const canvasX = (clientX - v.x) / v.scale
    const canvasY = (clientY - v.y) / v.scale
    const { ratio: curRatio } = fresh.current

    if (info?.type === 'resize' && info.layerId === activeId && !isCrop) {
      const layer = curLayers.find(l => l.id === info.layerId)
      if (layer) {
        if (layer.locked) {
          const grp = curLayers.filter(l => l.groupId && l.groupId === layer.groupId)
          const gx = Math.min(...grp.map(l => l.x))
          const gy = Math.min(...grp.map(l => l.y))
          const gw = Math.max(...grp.map(l => l.x + l.w)) - gx
          const gh = Math.max(...grp.map(l => l.y + l.h)) - gy
          panRef.current = { type: 'group-resize', handle: info.handle,
            groupLayers: grp.map(l => ({ ...l })),
            startBounds: { x: gx, y: gy, w: gw, h: gh },
            startX: pt.clientX, startY: pt.clientY, moved: false }
        } else {
          panRef.current = { type: 'resize', handle: info.handle, layerId: info.layerId,
            startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
        }
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

    if (info?.type === 'seam' && !isCrop) {
      const layer = curLayers.find(l => l.id === info.layerId)
      if (layer?.locked) {
        const grp = curLayers.filter(l => l.groupId && l.groupId === layer.groupId)
        panRef.current = { type: 'seam-drag', seamType: info.seamType, seamMid: info.seamMid,
          groupLayers: grp.map(l => ({ ...l })), startX: pt.clientX, startY: pt.clientY, moved: false }
        return
      }
    }

    // In crop mode: touch outside layer bounds exits crop; inside pans the image
    if (isCrop && activeId) {
      const layer = curLayers.find(l => l.id === activeId)
      if (!layer || canvasX < layer.x || canvasX > layer.x + layer.w ||
          canvasY < layer.y || canvasY > layer.y + layer.h) {
        fresh.current.setCropMode(false)
        return
      }
      panRef.current = { type: 'crop-pan', layerId: activeId,
        startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
      return
    }

    const hitLayer = [...curLayers].reverse().find(l =>
      (l.src || l.locked) &&
      canvasX >= l.x && canvasX <= l.x + l.w &&
      canvasY >= l.y && canvasY <= l.y + l.h
    )

    if (hitLayer) {
      if (hitLayer.locked) {
        const grp = curLayers.filter(l => l.groupId && l.groupId === hitLayer.groupId)
        const isGroupActive = grp.some(l => l.id === activeId)
        if (!isGroupActive) {
          // Group not selected — select it
          panRef.current = { type: 'select', layerId: hitLayer.id,
            startX: pt.clientX, startY: pt.clientY, viewX: v.x, viewY: v.y, moved: false }
        } else if (!curCellId) {
          // Group selected, no cell sub-selected — drag group; tap will enter cell
          panRef.current = { type: 'group-drag',
            groupLayers: grp.map(l => ({ ...l })), tappedCellId: hitLayer.id,
            startX: pt.clientX, startY: pt.clientY, moved: false }
        } else {
          // A cell is sub-selected — pan its image or clear sub-selection
          const cell = curLayers.find(l => l.id === curCellId)
          if (cell && canvasX >= cell.x && canvasX <= cell.x + cell.w &&
              canvasY >= cell.y && canvasY <= cell.y + cell.h) {
            panRef.current = { type: 'crop-pan', layerId: curCellId,
              startLayer: { ...cell }, startX: pt.clientX, startY: pt.clientY, moved: false }
          } else {
            panRef.current = { type: 'clear-cell', moved: false }
          }
        }
        return
      }
      if (hitLayer.id === activeId) {
        // Already selected — drag it
        panRef.current = { type: 'drag', layerId: hitLayer.id,
          startLayer: { ...hitLayer }, startX: pt.clientX, startY: pt.clientY, moved: false }
        return
      }
      panRef.current = { type: 'select', layerId: hitLayer.id,
        startX: pt.clientX, startY: pt.clientY, viewX: v.x, viewY: v.y, moved: false }
      return
    }

    if (activeId) {
      panRef.current = { type: 'deselect', startX: pt.clientX, startY: pt.clientY, viewX: v.x, viewY: v.y, moved: false }
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

    if (p.type === 'pan' || p.type === 'select' || p.type === 'deselect') {
      setViewSync(v => ({ ...v, x: p.viewX + dx, y: p.viewY + dy }))
    } else if (p.type === 'drag') {
      const sl = p.startLayer
      const rawX = sl.x + dx / vs, rawY = sl.y + dy / vs
      const lines = getSnapLines(curLayers, sl.id, r, curSlides.length)
      const { x: nx, y: ny, gxs, gys } = snapPosition(rawX, rawY, sl.w, sl.h, lines, vs)
      setSnapGuides({ xs: gxs, ys: gys })
      upd(sl.id, { x: nx, y: ny })
    } else if (p.type === 'group-drag') {
      const grpStart = p.groupLayers
      const gx0 = Math.min(...grpStart.map(l => l.x))
      const gy0 = Math.min(...grpStart.map(l => l.y))
      const gw  = Math.max(...grpStart.map(l => l.x + l.w)) - gx0
      const gh  = Math.max(...grpStart.map(l => l.y + l.h)) - gy0
      const rawX = gx0 + dx / vs, rawY = gy0 + dy / vs
      const excludeIds = grpStart.map(l => l.id)
      const lines = getSnapLines(curLayers, excludeIds, r, curSlides.length)
      const { x: snapX, y: snapY, gxs, gys } = snapPosition(rawX, rawY, gw, gh, lines, vs)
      setSnapGuides({ xs: gxs, ys: gys })
      const dSnapX = snapX - gx0, dSnapY = snapY - gy0
      grpStart.forEach(sl => upd(sl.id, { x: sl.x + dSnapX, y: sl.y + dSnapY }))
    } else if (p.type === 'resize') {
      const sl = p.startLayer
      let { x: nx, y: ny, w: nw, h: nh } = computeResize(sl, p.handle, dx / vs, dy / vs)
      if (nw > 20 && nh > 20) {
        const lines = getSnapLines(curLayers, sl.id, r, curSlides.length)
        const thr = SNAP_THRESHOLD_PX / vs
        let sgx = null, sgy = null
        if (p.handle === 'r')  { const s = snapEdge(nx + nw, lines.xs, thr); if (s !== null) { nw = s - nx; sgx = s } }
        if (p.handle === 'l')  { const s = snapEdge(nx, lines.xs, thr);      if (s !== null) { nw += nx - s; nx = s; sgx = s } }
        if (p.handle === 'b')  { const s = snapEdge(ny + nh, lines.ys, thr); if (s !== null) { nh = s - ny; sgy = s } }
        if (p.handle === 't')  { const s = snapEdge(ny, lines.ys, thr);      if (s !== null) { nh += ny - s; ny = s; sgy = s } }
        // corners: snap each moving edge independently
        if (p.handle === 'tr' || p.handle === 'br' || p.handle === 'tl' || p.handle === 'bl') {
          const snapX = p.handle.includes('r')
            ? snapEdge(nx + nw, lines.xs, thr) : snapEdge(nx, lines.xs, thr)
          const snapY = p.handle.includes('b')
            ? snapEdge(ny + nh, lines.ys, thr) : snapEdge(ny, lines.ys, thr)
          if (snapX !== null) { if (p.handle.includes('r')) nw = snapX - nx; else { nw += nx - snapX; nx = snapX }; sgx = snapX }
          if (snapY !== null) { if (p.handle.includes('b')) nh = snapY - ny; else { nh += ny - snapY; ny = snapY }; sgy = snapY }
        }
        setSnapGuides({ xs: sgx !== null ? [sgx] : [], ys: sgy !== null ? [sgy] : [] })
        const { imgScale: newImgScale, imgX: newImgX, imgY: newImgY } =
          fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, nw, nh)
        upd(sl.id, { x: nx, y: ny, w: nw, h: nh, imgScale: newImgScale, imgX: newImgX, imgY: newImgY })
      }
    } else if (p.type === 'group-resize') {
      const gb = p.startBounds
      let { x: ngx, y: ngy, w: ngw, h: ngh } = computeResize(gb, p.handle, dx / vs, dy / vs)
      if (ngw > 20 && ngh > 20) {
        const excludeIds = p.groupLayers.map(l => l.id)
        const lines = getSnapLines(curLayers, excludeIds, r, curSlides.length)
        const thr = SNAP_THRESHOLD_PX / vs
        let sgx = null, sgy = null
        if (p.handle === 'r')  { const s = snapEdge(ngx + ngw, lines.xs, thr); if (s !== null) { ngw = s - ngx; sgx = s } }
        if (p.handle === 'l')  { const s = snapEdge(ngx, lines.xs, thr);       if (s !== null) { ngw += ngx - s; ngx = s; sgx = s } }
        if (p.handle === 'b')  { const s = snapEdge(ngy + ngh, lines.ys, thr); if (s !== null) { ngh = s - ngy; sgy = s } }
        if (p.handle === 't')  { const s = snapEdge(ngy, lines.ys, thr);       if (s !== null) { ngh += ngy - s; ngy = s; sgy = s } }
        setSnapGuides({ xs: sgx !== null ? [sgx] : [], ys: sgy !== null ? [sgy] : [] })
        p.groupLayers.forEach(sl => {
          const nx = ngx + (sl.x - gb.x) / gb.w * ngw
          const ny = ngy + (sl.y - gb.y) / gb.h * ngh
          const nw = sl.w / gb.w * ngw
          const nh = sl.h / gb.h * ngh
          const gap = sl.cellGap ?? 0
          const { imgScale, imgX, imgY } = fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, nw - gap, nh - gap)
          upd(sl.id, { x: nx, y: ny, w: nw, h: nh, imgScale, imgX, imgY })
        })
      }
    } else if (p.type === 'seam-drag') {
      let delta = (p.seamType === 'v' ? dx : dy) / vs
      const halfGap = CELL_GAP / 2
      const MIN = 40
      // Clamp delta so no cell goes below MIN size
      for (const sl of p.groupLayers) {
        if (p.seamType === 'v') {
          if (Math.abs(sl.x + sl.w - (p.seamMid - halfGap)) <= 3) delta = Math.max(delta, MIN - sl.w)
          else if (Math.abs(sl.x - (p.seamMid + halfGap)) <= 3)   delta = Math.min(delta, sl.w - MIN)
        } else {
          if (Math.abs(sl.y + sl.h - (p.seamMid - halfGap)) <= 3) delta = Math.max(delta, MIN - sl.h)
          else if (Math.abs(sl.y - (p.seamMid + halfGap)) <= 3)   delta = Math.min(delta, sl.h - MIN)
        }
      }
      p.groupLayers.forEach(sl => {
        const gap = sl.cellGap ?? 0
        if (p.seamType === 'v') {
          if (Math.abs(sl.x + sl.w - (p.seamMid - halfGap)) <= 3) {
            const nw = sl.w + delta
            upd(sl.id, { w: nw, ...fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, nw - gap, sl.h - gap) })
          } else if (Math.abs(sl.x - (p.seamMid + halfGap)) <= 3) {
            const nw = sl.w - delta
            upd(sl.id, { x: sl.x + delta, w: nw, ...fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, nw - gap, sl.h - gap) })
          }
        } else {
          if (Math.abs(sl.y + sl.h - (p.seamMid - halfGap)) <= 3) {
            const nh = sl.h + delta
            upd(sl.id, { h: nh, ...fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, sl.w - gap, nh - gap) })
          } else if (Math.abs(sl.y - (p.seamMid + halfGap)) <= 3) {
            const nh = sl.h - delta
            upd(sl.id, { y: sl.y + delta, h: nh, ...fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, sl.w - gap, nh - gap) })
          }
        }
      })
    } else if (p.type === 'crop-pan') {
      const sl = p.startLayer
      const gap = sl.cellGap ?? 0
      const innerW = sl.w - gap
      const innerH = sl.h - gap
      const imgW = (sl.naturalW ?? sl.w) * (sl.imgScale ?? 1)
      const imgH = (sl.naturalH ?? sl.h) * (sl.imgScale ?? 1)
      const rotation = sl.rotation ?? 0
      // When rotated, the image diagonal can fill the cell at wider range — relax bounds
      const extra = rotation ? Math.max(imgW, imgH) : 0
      const minImgX = Math.min(0, innerW - imgW) - extra
      const maxImgX = extra
      const minImgY = Math.min(0, innerH - imgH) - extra
      const maxImgY = extra
      upd(sl.id, {
        imgX: clamp((sl.imgX ?? 0) + dx / vs, minImgX, maxImgX),
        imgY: clamp((sl.imgY ?? 0) + dy / vs, minImgY, maxImgY),
      })
    } else if (p.type === 'crop-resize') {
      const sl = p.startLayer
      const { cropAspect } = fresh.current
      const { x: nx, y: ny, w: nw, h: nh } = computeResize(sl, p.handle, dx / vs, dy / vs, cropAspect)
      if (nw > 20 && nh > 20) upd(sl.id, { x: nx, y: ny, w: nw, h: nh })
    }
  }

  const handleStageUp = (e) => {
    const p = panRef.current
    if (!p) return
    panRef.current = null
    setSnapGuides({ xs: [], ys: [] })

    if (p.type === 'addslide' && !p.moved) {
      fresh.current.addSlide()
      return
    }

    if (p.type === 'select' && !p.moved) {
      // setActiveLayer now atomically updates activeSlideIdx — no separate setActiveSlide needed
      fresh.current.setActiveLayer(p.layerId)
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

    if (p.type === 'drag' && p.moved) {
      fresh.current.updateLayerWithHistory(p.layerId, {})
      return
    }

    if (p.type === 'group-drag' && !p.moved) {
      // Tap on already-selected group → sub-select the tapped cell
      fresh.current.setActiveCellId(p.tappedCellId)
      return
    }

    if (p.type === 'group-drag' && p.moved) {
      if (p.groupLayers.length) fresh.current.updateLayerWithHistory(p.groupLayers[0].id, {})
      return
    }

    if (p.type === 'clear-cell') {
      fresh.current.setActiveCellId(null)
      return
    }

    if (p.type === 'group-resize' && p.moved) {
      if (p.groupLayers.length) fresh.current.updateLayerWithHistory(p.groupLayers[0].id, {})
      return
    }

    if (p.type === 'seam-drag' && p.moved) {
      if (p.groupLayers.length) fresh.current.updateLayerWithHistory(p.groupLayers[0].id, {})
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
            const gap = layer.cellGap ?? 0
            const fit = fitInCell(img.naturalWidth, img.naturalHeight, layer.w - gap, layer.h - gap)
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

            {/* Slide borders — active slide slightly brighter (visual only, not in export) */}
            {slides.map((slide, i) => (
              <Rect key={`ib-${slide.id}`}
                x={i * ratio.w + 1 / vs} y={1 / vs}
                width={ratio.w - 2 / vs} height={ratio.h - 2 / vs}
                stroke={i === activeSlideIdx ? 'rgba(255,255,255,0.25)' : 'rgba(150,150,150,0.2)'}
                strokeWidth={1 / vs} listening={false} />
            ))}

            {/* Slide dividers — dashed guide lines, editor-only (not in export) */}
            {slides.slice(1).map((_, i) => (
              <Line key={i}
                points={[(i + 1) * ratio.w, 0, (i + 1) * ratio.w, ratio.h]}
                stroke="rgba(160,160,160,0.7)" strokeWidth={1.5 / vs}
                dash={[8 / vs, 5 / vs]} listening={false} />
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
            {snapGuides.xs.map(gx => (
              <Line key={`gx${gx}`}
                points={[gx, -ratio.h * 0.5, gx, ratio.h * 1.5]}
                stroke="#3b82f6" strokeWidth={1 / vs} dash={[6 / vs, 3 / vs]} listening={false} />
            ))}
            {snapGuides.ys.map(gy => (
              <Line key={`gy${gy}`}
                points={[-ratio.w * 0.5, gy, ratio.w * (slides.length + 0.5), gy]}
                stroke="#3b82f6" strokeWidth={1 / vs} dash={[6 / vs, 3 / vs]} listening={false} />
            ))}

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
                <FilledCell key={layer.id} layer={layer} vs={vs} />
              ) : (
                <EmptyCell key={layer.id} layer={layer} vs={vs}
                  onTap={() => {
                    const si = Math.floor(layer.x / ratio.w)
                    const emptyInSlide = layers.filter(l => !l.src && Math.floor(l.x / ratio.w) === si)
                    openPickerRef2.current?.(layer.id, si, emptyInSlide.length > 1)
                  }}
                />
              )
            })}

            {/* Outside-slide dimming overlay — covers areas outside all slide bounds.
                Content within [0, totalW] × [0, ratio.h] will appear in some slide's export;
                anything outside is darkened. Renders above layers, below selection handles. */}
            {!cropMode && (() => {
              const totalW = slides.length * ratio.w
              const OV = 60 * Math.max(ratio.w, ratio.h)  // large enough to cover any overflow
              const dim = 'rgba(0,0,0,0.5)'
              return (
                <>
                  <Rect x={-OV}    y={-OV}    width={totalW + OV * 2} height={OV}       fill={dim} listening={false} />
                  <Rect x={-OV}    y={ratio.h} width={totalW + OV * 2} height={OV}       fill={dim} listening={false} />
                  <Rect x={-OV}    y={0}       width={OV}              height={ratio.h}  fill={dim} listening={false} />
                  <Rect x={totalW} y={0}       width={OV}              height={ratio.h}  fill={dim} listening={false} />
                </>
              )
            })()}

            {/* Selection border + resize handles (outside clip) */}
            {!cropMode && activeLayer && (() => {
              if (activeLayer.locked) {
                if (activeCellId) {
                  // Cell edit mode — show a simple dashed border on the sub-selected cell
                  const cell = layers.find(l => l.id === activeCellId)
                  if (!cell) return null
                  return (
                    <Rect x={cell.x} y={cell.y} width={cell.w} height={cell.h}
                      stroke={BORDER_COLOR} strokeWidth={2 / vs}
                      dash={[8 / vs, 4 / vs]} listening={false} />
                  )
                }
                // Group mode — show group overlay with corner handles and seam handles
                const grp = layers.filter(l => l.groupId && l.groupId === activeLayer.groupId)
                const gx = Math.min(...grp.map(l => l.x))
                const gy = Math.min(...grp.map(l => l.y))
                const gx2 = Math.max(...grp.map(l => l.x + l.w))
                const gy2 = Math.max(...grp.map(l => l.y + l.h))
                const seams = findGroupSeams(grp)
                return (
                  <Group>
                    <SelectionOverlay layer={{ id: activeLayerId, x: gx, y: gy, w: gx2 - gx, h: gy2 - gy }} vs={vs} />
                    {seams.vertical.map(seam => (
                      <Rect key={`sv${Math.round(seam.xMid)}`}
                        name={`seam|v|${activeLayerId}|${seam.xMid.toFixed(1)}`}
                        x={seam.xMid - 5 / vs} y={(seam.y1 + seam.y2) / 2 - 18 / vs}
                        width={10 / vs} height={36 / vs}
                        cornerRadius={4 / vs}
                        fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs}
                        hitStrokeWidth={22 / vs}
                      />
                    ))}
                    {seams.horizontal.map(seam => (
                      <Rect key={`sh${Math.round(seam.yMid)}`}
                        name={`seam|h|${activeLayerId}|${seam.yMid.toFixed(1)}`}
                        x={(seam.x1 + seam.x2) / 2 - 18 / vs} y={seam.yMid - 5 / vs}
                        width={36 / vs} height={10 / vs}
                        cornerRadius={4 / vs}
                        fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs}
                        hitStrokeWidth={22 / vs}
                      />
                    ))}
                  </Group>
                )
              }
              if (!activeLayer.src) return null
              return <SelectionOverlay layer={activeLayer} vs={vs} />
            })()}
          </Group>
        </Layer>
      </Stage>

    </div>
  )
}

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Ellipse, Image as KImage, Group, Text, Line, Shape } from 'react-konva'
import { useStore, fitInCell } from '../useStore'
import useImage from 'use-image'
import { dbGetBlob } from '../db'
import { blobCache, dataURLCache } from '../blobCache'
import { drawShapePath, STROKE_AWARE_SHAPES } from '../shapes'

// ─── Image downscaling ─────────────────────────────────────────────────────────
// Phone cameras produce 12–50MP images. Drawing a 4032×3024 image in Konva every
// animation frame will overheat mobile GPUs. We cap at 2048px on the longest side,
// which is more than enough for any display — this is done once at pick-time.

const MAX_DIM = 2048

function processImageFile(file) {
  // Stable content id for this imported image. Travels with the image onto the
  // layer (as layer.imgId) so undo/redo can restore the exact image a snapshot
  // saw, even after the layer's image is later replaced. See useStore.js.
  const imgId = Math.random().toString(36).slice(2)
  return new Promise((resolve, reject) => {
    const rawUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const { naturalWidth: nW, naturalHeight: nH } = img
      if (nW <= MAX_DIM && nH <= MAX_DIM) {
        // Already small enough — use same URL for both display and export
        blobCache.set(rawUrl, null)  // sentinel: fetch from rawUrl directly
        resolve({ src: rawUrl, srcOriginal: rawUrl, naturalW: nW, naturalH: nH, imgId })
        return
      }
      // Downscale for display — keep rawUrl alive as srcOriginal for export
      const scale = MAX_DIM / Math.max(nW, nH)
      const w = Math.round(nW * scale)
      const h = Math.round(nH * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      // NOTE: rawUrl is intentionally NOT revoked — it's kept as srcOriginal for export
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('toBlob failed')); return }
          const url = URL.createObjectURL(blob)
          blobCache.set(url, blob)  // cache so serializeLayers never needs fetch(url)
          // Cache the original File too (a Blob) so serializeLayers can persist the
          // full-res original without fetch(blob:), unreliable on iOS Safari PWA.
          blobCache.set(rawUrl, file)
          resolve({ src: url, srcOriginal: rawUrl, naturalW: w, naturalH: h, imgId })
        },
        'image/jpeg', 0.92,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(rawUrl); reject(new Error('load failed')) }
    img.src = rawUrl
  })
}

function linearGradientPoints(angleDeg, w, h) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const len = Math.abs(w * sin) + Math.abs(h * cos)
  const cx = w / 2, cy = h / 2
  return {
    x1: cx - sin * len / 2, y1: cy - cos * len / 2,
    x2: cx + sin * len / 2, y2: cy + cos * len / 2,
  }
}

const BORDER_COLOR = '#3b82f6'
const HANDLE_R_PX = 14
const DRAG_THRESHOLD_PX = 12
const SNAP_THRESHOLD_PX = 8

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Minimum imgScale so an image rotated by `deg` fully covers a frame (W,H) with
// no empty corners. Mirrors the same helper in CropControls (kept local to avoid
// a panel→canvas import). See that file for the derivation.
function minScaleForRotation(deg, W, H, nW, nH) {
  const θ = Math.abs(deg % 180) * Math.PI / 180
  const abscos = Math.abs(Math.cos(θ))
  const abssin = Math.abs(Math.sin(θ))
  return Math.max(
    (W * abscos + H * abssin) / nW,
    (W * abssin + H * abscos) / nH,
  )
}

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

// Transform a canvas-space point into a (possibly freeRotation'd) layer's local
// unrotated space, rotating about the layer center by -rotation. The result is
// in the same units as layer.x/y/w/h, so the standard AABB test applies. Mirrors
// the forward corner math in QuickToolbar. No-op (returns the point unchanged)
// when the layer has no rotation.
function toLayerLocal(px, py, layer) {
  const rot = (layer.freeRotation ?? 0) * Math.PI / 180
  if (!rot) return { x: px, y: py }
  const cx = layer.x + layer.w / 2
  const cy = layer.y + layer.h / 2
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const ddx = px - cx, ddy = py - cy
  return {
    x: cx + ddx * cos + ddy * sin,
    y: cy - ddx * sin + ddy * cos,
  }
}

// True when the canvas-space point lands inside the layer's rendered (rotated) box.
function pointInLayer(px, py, layer) {
  const { x, y } = toLayerLocal(px, py, layer)
  return x >= layer.x && x <= layer.x + layer.w &&
         y >= layer.y && y <= layer.y + layer.h
}

function computeResize(sl, handle, ddx, ddy, aspectOverride) {
  const ar = aspectOverride ?? (sl.w / sl.h)
  const isCorner = handle.length === 2
  // Rotate the screen-space pointer delta into the layer's local (unrotated)
  // axes so the resize happens along the axes the user visually sees.
  const rot = (sl.freeRotation ?? 0) * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const ldx = ddx * cos + ddy * sin
  const ldy = -ddx * sin + ddy * cos

  let w = sl.w, h = sl.h
  if (isCorner) {
    if (Math.abs(ldx) >= Math.abs(ldy)) {
      w = Math.max(20, handle.includes('r') ? sl.w + ldx : sl.w - ldx)
      h = w / ar
    } else {
      h = Math.max(20, handle.includes('b') ? sl.h + ldy : sl.h - ldy)
      w = h * ar
    }
  } else if (aspectOverride) {
    // With aspect constraint: edge handles adjust both dims to maintain ratio
    if (handle === 'r') { w = Math.max(20, sl.w + ldx); h = w / ar }
    if (handle === 'l') { w = Math.max(20, sl.w - ldx); h = w / ar }
    if (handle === 'b') { h = Math.max(20, sl.h + ldy); w = h * ar }
    if (handle === 't') { h = Math.max(20, sl.h - ldy); w = h * ar }
  } else {
    if (handle === 'r') w = Math.max(20, sl.w + ldx)
    if (handle === 'l') w = Math.max(20, sl.w - ldx)
    if (handle === 'b') h = Math.max(20, sl.h + ldy)
    if (handle === 't') h = Math.max(20, sl.h - ldy)
  }

  // Reposition so the OPPOSITE corner/edge stays pinned in rotated screen space.
  // signX/signY select which local edge is held fixed:
  //   'r'/'b' handle → hold the left/top edge  (sign -1)
  //   'l'/'t' handle → hold the right/bottom edge (sign +1)
  //   axis untouched by the handle stays centered (sign 0).
  const signX = handle.includes('r') ? -1 : handle.includes('l') ? 1 : 0
  const signY = handle.includes('b') ? -1 : handle.includes('t') ? 1 : 0
  const cx0 = sl.x + sl.w / 2, cy0 = sl.y + sl.h / 2
  // Anchor's canvas position from the ORIGINAL geometry (rotate local → canvas).
  const ax0 = signX * sl.w / 2, ay0 = signY * sl.h / 2
  const anchorX = cx0 + ax0 * cos - ay0 * sin
  const anchorY = cy0 + ax0 * sin + ay0 * cos
  // New center so that same anchor keeps its canvas position under the new size.
  const ax1 = signX * w / 2, ay1 = signY * h / 2
  const cx1 = anchorX - (ax1 * cos - ay1 * sin)
  const cy1 = anchorY - (ax1 * sin + ay1 * cos)
  return { x: cx1 - w / 2, y: cy1 - h / 2, w, h }
}

// ─── Layer visuals ─────────────────────────────────────────────────────────────

// Konva node renderers for shape-aware fill and border. For rect/circle we use
// Konva primitives (cheaper). For other shapes we use a custom Shape with the
// shared drawShapePath helper.

function ShapedFill({ shape, x, y, w, h, cornerRadius, fill }) {
  const s = shape ?? 'rect'
  if (s === 'rect') {
    return <Rect x={x} y={y} width={w} height={h} cornerRadius={cornerRadius} fill={fill} listening={false} />
  }
  if (s === 'circle') {
    return <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} fill={fill} listening={false} />
  }
  return (
    <Shape
      sceneFunc={(ctx, sh) => {
        ctx.beginPath()
        drawShapePath(ctx, x, y, w, h, s, cornerRadius)
        ctx.fillStrokeShape(sh)
      }}
      fill={fill} listening={false}
    />
  )
}

function ShapedBorder({ shape, x, y, w, h, cornerRadius, stroke, strokeWidth }) {
  const s = shape ?? 'rect'
  if (s === 'rect') {
    return <Rect x={x} y={y} width={w} height={h} cornerRadius={cornerRadius}
      stroke={stroke} strokeWidth={strokeWidth} listening={false} />
  }
  if (s === 'circle') {
    return <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2}
      stroke={stroke} strokeWidth={strokeWidth} listening={false} />
  }
  return (
    <Shape
      sceneFunc={(ctx, sh) => {
        ctx.beginPath()
        drawShapePath(ctx, x, y, w, h, s, cornerRadius)
        ctx.fillStrokeShape(sh)
      }}
      stroke={stroke} strokeWidth={strokeWidth} listening={false}
    />
  )
}

// dataURLCache (blobId → data URL) lives in ../blobCache so the store can clear
// it on project switch. See useBlobSrc below.

// Resolves src to something useImage can load:
// - blob: and data: URLs pass through directly (same-session picks)
// - blob-ref://layerId: reads data URL from IDB, cached in dataURLCache
//   Data URLs are used directly as img.src — no blob: URL is created so
//   iOS Safari background eviction can't affect loaded images.
function useBlobSrc(src) {
  const blobId = src?.startsWith('blob-ref://') ? src.slice('blob-ref://'.length) : null
  const [resolved, setResolved] = React.useState(() => {
    if (!blobId) return src ?? null
    return dataURLCache.get(blobId) ?? null   // serve from cache if already loaded
  })

  React.useEffect(() => {
    if (!blobId) { setResolved(src ?? null); return }
    // Already cached — no IDB round-trip needed
    const cached = dataURLCache.get(blobId)
    if (cached) { setResolved(cached); return }

    let cancelled = false
    dbGetBlob(blobId)
      .then(dataURL => {
        if (!cancelled && dataURL) {
          dataURLCache.set(blobId, dataURL)
          setResolved(dataURL)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [src, blobId])

  return resolved
}

function useAdjustedImage(src, brightness, contrast, saturation) {
  const resolvedSrc = useBlobSrc(src)
  const [img] = useImage(resolvedSrc ?? undefined)
  const [adjusted, setAdjusted] = React.useState(null)
  // One reusable canvas per hook instance. Every brightness/contrast/saturation
  // tick used to allocate a fresh full-res canvas (up to 2048²≈16MB RGBA); while
  // scrubbing a slider that churned a new 16MB buffer per frame. We now redraw
  // onto the same canvas and only reallocate its backing store when the source
  // image dimensions change. See issue #16 (b).
  const canvasRef = React.useRef(null)
  React.useEffect(() => {
    if (!img) { setAdjusted(null); return }
    const b = brightness ?? 0, c = contrast ?? 0, s = saturation ?? 0
    if (!b && !c && !s) { setAdjusted(img); return }
    let canvas = canvasRef.current
    if (!canvas) { canvas = document.createElement('canvas'); canvasRef.current = canvas }
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      // Assigning width/height also clears the canvas; only do it on a real change.
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    }
    // Stamp naturalWidth/naturalHeight so FilledCell's dimension math works the same as with HTMLImageElement
    canvas.naturalWidth = img.naturalWidth; canvas.naturalHeight = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.filter = `brightness(${1 + b/100}) contrast(${1 + c/100}) saturate(${1 + s/100})`
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    // The canvas object reference is stable across ticks, so a setAdjusted with the
    // same ref would bail out of re-render and Konva would never repaint the new
    // pixels. FilledCell forces a layer batchDraw on adjustment change (see below).
    setAdjusted(canvas)
  }, [img, brightness, contrast, saturation])
  return adjusted
}

function TextCell({ layer, isEditing }) {
  const fontStyle = [layer.italic && 'italic', layer.bold && 'bold'].filter(Boolean).join(' ') || 'normal'
  const hasText = layer.text && layer.text.trim().length > 0
  // Konva rasterizes text with whatever font is loaded at draw time and doesn't
  // re-measure when a lazily-loaded web font arrives later. Subscribing to
  // fontsVersion re-renders this cell on every 'loadingdone' batch, and keying
  // the Text node on it remounts the node so it re-rasterizes in the real font.
  const fontsVersion = useStore(s => s.fontsVersion)
  return (
    <Group
      x={layer.x + layer.w / 2} y={layer.y + layer.h / 2}
      offsetX={layer.w / 2} offsetY={layer.h / 2}
      rotation={layer.freeRotation ?? 0}
      opacity={layer.opacity ?? 1}
    >
      {layer.textBg && (
        <Rect width={layer.w} height={layer.h}
          fill={layer.textBg}
          opacity={layer.textBgOpacity ?? 1}
          listening={false} />
      )}
      {/* While inline-editing, the HTML textarea overlay shows the text instead
          (true WYSIWYG). We keep the textBg + hit area but hide the Konva text. */}
      {isEditing ? null : hasText ? (
        <Text
          key={fontsVersion}
          x={0} y={0}
          width={layer.w} height={layer.h}
          text={layer.text}
          fontFamily={layer.fontFamily ?? 'Inter'}
          fontSize={layer.fontSize ?? 72}
          fontStyle={fontStyle}
          fill={layer.color ?? '#000000'}
          align={layer.align ?? 'center'}
          verticalAlign={layer.verticalAlign ?? 'middle'}
          lineHeight={layer.lineHeight ?? 1.2}
          letterSpacing={layer.letterSpacing ?? 0}
          wrap="word"
          listening={false}
        />
      ) : (
        <Text
          x={0} y={0} width={layer.w} height={layer.h}
          text="Tap to type…"
          fontFamily={layer.fontFamily ?? 'Inter'}
          fontSize={layer.fontSize ?? 72}
          fill="rgba(160,160,160,0.5)"
          align="center" verticalAlign="middle"
          listening={false}
        />
      )}
      {/* Transparent hit area */}
      <Rect width={layer.w} height={layer.h} fill="rgba(0,0,0,0.01)" />
    </Group>
  )
}

function ShapeCell({ layer }) {
  const sw = layer.strokeWidth ?? 0
  const shapeType = layer.shapeType ?? 'rect'
  // Stroke pass matches export (renderShapeLayer): only when a stroke color is
  // actually set, and never for the stroke-aware line/arrow — their strokeWidth
  // is geometry thickness, not an outline.
  const strokeColor = sw > 0 && layer.stroke && !STROKE_AWARE_SHAPES.has(shapeType)
    ? layer.stroke : null
  return (
    <Group
      x={layer.x + layer.w / 2} y={layer.y + layer.h / 2}
      offsetX={layer.w / 2} offsetY={layer.h / 2}
      rotation={layer.freeRotation ?? 0}
      opacity={layer.opacity ?? 1}
    >
      {/* Single source of truth: same drawShapePath as export (renderShapeLayer
          in renderSlide.js) — editor/export parity for every shape type.
          cornerRadius is gated to rect inside drawShapePath; strokeWidth feeds
          the stroke-aware line/arrow geometry. */}
      <Shape
        sceneFunc={(ctx, sh) => {
          ctx.beginPath()
          drawShapePath(ctx, 0, 0, layer.w, layer.h, shapeType,
            layer.cornerRadius ?? 0, false, sw)
          ctx.fillStrokeShape(sh)
        }}
        fill={layer.fill ?? '#000000'}
        stroke={strokeColor}
        strokeWidth={sw}
        listening={false}
      />
      <Rect width={layer.w} height={layer.h} fill="rgba(0,0,0,0.01)" />
    </Group>
  )
}

function EmptyCell({ layer, onTap, vs }) {
  const gap = layer.cellGap ?? 0
  const inset = gap / 2
  const innerW = layer.w - gap
  const innerH = layer.h - gap
  const cr = layer.cornerRadius ?? 0
  const iconR = Math.min(Math.min(innerW, innerH) * 0.12, 30)
  const sw = 2 / vs
  const labelSize = Math.max(Math.min(iconR * 0.7, 22), 10)
  const showLabel = innerH > iconR * 4.5  // only show text if cell is tall enough
  return (
    <Group
      x={layer.x + layer.w / 2} y={layer.y + layer.h / 2}
      offsetX={layer.w / 2} offsetY={layer.h / 2}
      rotation={layer.freeRotation ?? 0}
      onClick={e => { e.cancelBubble = true; onTap() }}
      onTap={e => { e.cancelBubble = true; onTap() }}
    >
      <Rect x={inset} y={inset} width={innerW} height={innerH} fill="#d8d8d8"
        stroke="white" strokeWidth={sw} cornerRadius={cr} />
      {/* Icon circle */}
      <Rect x={layer.w / 2 - iconR} y={layer.h / 2 - iconR - (showLabel ? labelSize * 0.8 : 0)}
        width={iconR * 2} height={iconR * 2}
        cornerRadius={iconR} fill="rgba(0,0,0,0.2)" listening={false} />
      <Text text="+" fill="rgba(0,0,0,0.5)"
        fontSize={iconR * 1.4}
        x={layer.w / 2 - iconR * 0.42}
        y={layer.h / 2 - iconR * 0.82 - (showLabel ? labelSize * 0.8 : 0)}
        listening={false} />
      {/* "Tap to add photo" hint */}
      {showLabel && (
        <Text
          text="Tap to add photo"
          fontFamily="Inter, system-ui"
          fontSize={labelSize}
          fill="rgba(0,0,0,0.38)"
          width={innerW}
          x={inset}
          y={layer.h / 2 + iconR * 1.1}
          align="center"
          listening={false}
        />
      )}
    </Group>
  )
}

// All interaction (select, drag, cell-edit) is handled at the Stage level via
// handleStageDown/Move/Up — FilledCell is purely visual.
function FilledCell({ layer, vs }) {
  const img = useAdjustedImage(layer.src, layer.brightness, layer.contrast, layer.saturation)
  // useAdjustedImage redraws onto a REUSED canvas, so its object reference is
  // stable between slider ticks and react-konva won't auto-repaint. Force the
  // layer to redraw whenever an adjustment (or the resolved image) changes.
  const imgNodeRef = useRef(null)
  useEffect(() => {
    imgNodeRef.current?.getLayer()?.batchDraw()
  }, [img, layer.brightness, layer.contrast, layer.saturation])
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
  const shape = layer.shape ?? 'rect'

  return (
    <Group
      x={layer.x + layer.w / 2} y={layer.y + layer.h / 2}
      offsetX={layer.w / 2} offsetY={layer.h / 2}
      rotation={layer.freeRotation ?? 0}
      opacity={layer.opacity ?? 1}
    >
      <Group clipFunc={ctx => drawShapePath(ctx, inset, inset, innerW, innerH, shape, cr)} listening={false}>
        {/* Gray placeholder while image decodes — prevents blank-white flash */}
        {!img && (
          <ShapedFill shape={shape} x={inset} y={inset} w={innerW} h={innerH}
            cornerRadius={cr} fill="#c8c8c8" />
        )}
        {img && (hasTransform ? (
          // All transforms (rotation + flip) around frame center
          <Group x={layer.w / 2} y={layer.h / 2} rotation={rotation} scaleX={scaleX} scaleY={scaleY}>
            <KImage ref={imgNodeRef} image={img} x={imgX - layer.w / 2} y={imgY - layer.h / 2} width={imgW} height={imgH} />
          </Group>
        ) : (
          <KImage ref={imgNodeRef} image={img} x={imgX} y={imgY} width={imgW} height={imgH} />
        ))}
      </Group>
      {/* Border overlay (outside clip so full stroke is visible) */}
      {bw > 0 && (
        <ShapedBorder shape={shape} x={inset} y={inset} w={innerW} h={innerH}
          cornerRadius={cr} stroke={bc} strokeWidth={bw} />
      )}
      {/* Hit area outside clipFunc so coordinate hit-testing in handleStageDown works */}
      <Rect width={layer.w} height={layer.h} fill="rgba(0,0,0,0.01)" />
    </Group>
  )
}

function SelectionOverlay({ layer, vs }) {
  const hr = HANDLE_R_PX / vs
  const rotOffset = 36 / vs   // stem length above top edge

  // All coords are relative to the layer's top-left (0,0)
  const handles = [
    ['tl', 0,            0           ],
    ['t',  layer.w / 2,  0           ],
    ['tr', layer.w,      0           ],
    ['r',  layer.w,      layer.h / 2 ],
    ['br', layer.w,      layer.h     ],
    ['b',  layer.w / 2,  layer.h     ],
    ['bl', 0,            layer.h     ],
    ['l',  0,            layer.h / 2 ],
  ]
  return (
    // Rotate the whole overlay to match the layer's freeRotation
    <Group
      x={layer.x + layer.w / 2} y={layer.y + layer.h / 2}
      offsetX={layer.w / 2}     offsetY={layer.h / 2}
      rotation={layer.freeRotation ?? 0}
    >
      {/* Border */}
      <Rect x={0} y={0} width={layer.w} height={layer.h}
        stroke={BORDER_COLOR} strokeWidth={2 / vs} listening={false} />
      {/* Resize handles */}
      {handles.map(([h, hx, hy]) => (
        <Circle key={h} name={`handle|${h}|${layer.id}`}
          x={hx} y={hy} radius={hr}
          fill="white" stroke={BORDER_COLOR} strokeWidth={1.5 / vs} />
      ))}
      {/* Rotation stem */}
      <Line
        points={[layer.w / 2, 0, layer.w / 2, -rotOffset]}
        stroke={BORDER_COLOR} strokeWidth={1.5 / vs} listening={false} />
      {/* Rotation handle — filled with accent colour to distinguish from resize */}
      <Circle
        name={`rothandle|${layer.id}`}
        x={layer.w / 2} y={-rotOffset}
        radius={hr}
        fill={BORDER_COLOR} stroke="white" strokeWidth={1.5 / vs} />
    </Group>
  )
}

function CropTarget({ layer, vs }) {
  const resolvedSrc = useBlobSrc(layer.src)
  const [img] = useImage(resolvedSrc ?? undefined)
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

  const shapeId = layer.shape ?? 'rect'
  const showShapePreview = shapeId !== 'rect'

  return (
    <Group>
      {/* Ghost image outside clip */}
      {renderImg(0.25)}
      {/* Clipped image */}
      <Group clipFunc={ctx => ctx.rect(layer.x, layer.y, layer.w, layer.h)} listening={false}>
        {renderImg(1)}
      </Group>
      {/* Shape preview overlay: darken the part of the rectangle that won't be
          in the final cropped shape. Uses non-zero winding — outer rect drawn
          clockwise, inner shape drawn anti-clockwise so it cuts a hole. */}
      {showShapePreview && (
        <Shape
          sceneFunc={(ctx, sh) => {
            ctx.beginPath()
            ctx.rect(layer.x, layer.y, layer.w, layer.h)
            drawShapePath(ctx, layer.x, layer.y, layer.w, layer.h, shapeId, 0, true)
            ctx.fillStrokeShape(sh)
          }}
          fill="rgba(0, 0, 0, 0.55)"
          listening={false}
        />
      )}
      {/* Dashed border around the crop rectangle */}
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}
        stroke="white" strokeWidth={1.5 / vs} dash={[6 / vs, 4 / vs]} listening={false} />
      {/* Solid outline of the actual crop shape (only when it's not a rect) */}
      {showShapePreview && (
        <Shape
          sceneFunc={(ctx, sh) => {
            ctx.beginPath()
            drawShapePath(ctx, layer.x, layer.y, layer.w, layer.h, shapeId, 0)
            ctx.fillStrokeShape(sh)
          }}
          stroke="white" strokeWidth={1.5 / vs}
          listening={false}
        />
      )}
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

// ─── Floating quick-action toolbar ──────────────────────────────────────────────
// HTML overlay positioned in screen space above the selected layer. Surfaces the
// most common one-tap actions (Canva/Figma pattern): duplicate, layer order,
// delete. Positioned from the layer's rotated bounding box; flips below the
// element when it would clip the top of the canvas.

function QuickToolbar({ layer, view, containerH }) {
  const duplicateLayer = useStore(s => s.duplicateLayer)
  const copyLayer      = useStore(s => s.copyLayer)
  const reorderLayer   = useStore(s => s.reorderLayer)
  const deleteLayer    = useStore(s => s.deleteLayer)

  // Compute the screen-space bounding box of the (possibly rotated) layer
  const cx = layer.x + layer.w / 2
  const cy = layer.y + layer.h / 2
  const rot = (layer.freeRotation ?? 0) * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const hw = layer.w / 2, hh = layer.h / 2
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => ({
    sx: (cx + dx * cos - dy * sin) * view.scale + view.x,
    sy: (cy + dx * sin + dy * cos) * view.scale + view.y,
  }))
  const minSY = Math.min(...corners.map(c => c.sy))
  const maxSY = Math.max(...corners.map(c => c.sy))
  const centerSX = corners.reduce((a, c) => a + c.sx, 0) / 4

  const BAR_H = 56       // taller now that buttons have labels
  const GAP = 14         // clearance above the rotate handle
  // Default above the top edge; flip below if it'd clip the top of the canvas
  let top = minSY - GAP - BAR_H
  if (top < 8) { top = maxSY + GAP }
  // Keep on-screen vertically
  top = Math.max(8, Math.min(top, containerH - BAR_H - 8))

  const btn = (key, label, onClick, children, danger) => (
    <button key={key}
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl active:bg-white/10 active:scale-90 transition-transform ${
        danger ? 'text-red-400' : 'text-white/85'
      }`}>
      {children}
      <span className="text-[9px] leading-none font-medium">{label}</span>
    </button>
  )

  return (
    <div
      className="absolute z-40 pointer-events-auto"
      style={{ left: centerSX, top, transform: 'translateX(-50%)' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-md shadow-2xl border border-white/10">
        {btn('dup', 'Duplicate', () => duplicateLayer(layer.id),
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>)}
        {btn('copy', 'Copy', () => copyLayer(layer.id),
          // Clipboard glyph — copy to the cross-slide clipboard (paste from Add panel)
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>)}
        {btn('fwd', 'Forward', () => reorderLayer(layer.id, 'forward'),
          // Stack with the front square highlighted + up arrow
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v8" /><path d="M8.5 6.5 12 3l3.5 3.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" />
          </svg>)}
        {btn('bwd', 'Backward', () => reorderLayer(layer.id, 'backward'),
          // Stack with down arrow
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21v-8" /><path d="M8.5 17.5 12 21l3.5-3.5" />
            <rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" />
          </svg>)}
        <div className="w-px h-7 bg-white/15 mx-0.5" />
        {btn('del', 'Delete', () => deleteLayer(layer.id),
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>, true)}
      </div>
    </div>
  )
}

// ─── Inline text editor ─────────────────────────────────────────────────────────
// An HTML <textarea> overlaid exactly on top of the selected text layer, styled
// to match (font, size, color, alignment, rotation), so the user types WYSIWYG
// on the canvas instead of in a separate panel. The Konva text node is hidden
// while this is active (TextCell isEditing).

function InlineTextEditor({ layer, view, onDone }) {
  const updateLayer = useStore(s => s.updateLayer)
  const taRef = useRef(null)

  // Focus + place caret at end + size to content on mount.
  // Capture a pre-edit undo snapshot now; finishTextEdit() commits it so undo
  // restores the text as it was before this editing session.
  useEffect(() => {
    useStore.getState()._captureUndo()
    const ta = taRef.current
    if (!ta) return
    ta.focus()
    const len = ta.value.length
    try { ta.setSelectionRange(len, len) } catch {}
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [])

  const scale = view.scale
  const left = layer.x * scale + view.x
  const top  = layer.y * scale + view.y
  const w = layer.w * scale
  const h = layer.h * scale
  const rot = layer.freeRotation ?? 0
  const va = layer.verticalAlign ?? 'middle'
  const justify = va === 'top' ? 'flex-start' : va === 'bottom' ? 'flex-end' : 'center'

  const onInput = (e) => {
    updateLayer(layer.id, { text: e.target.value })
    // Auto-grow so flex vertical-centering matches Konva's verticalAlign
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  return (
    <div
      className="absolute z-40"
      style={{
        left, top, width: w, height: h,
        transform: `rotate(${rot}deg)`,
        transformOrigin: 'center center',
        display: 'flex', flexDirection: 'column', justifyContent: justify,
        overflow: 'hidden',
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <textarea
        ref={taRef}
        value={layer.text ?? ''}
        onChange={onInput}
        onBlur={onDone}
        rows={1}
        spellCheck={false}
        style={{
          width: '100%',
          fontFamily: layer.fontFamily ?? 'Inter',
          fontSize: (layer.fontSize ?? 72) * scale,
          fontStyle: layer.italic ? 'italic' : 'normal',
          fontWeight: layer.bold ? 700 : 400,
          color: layer.color ?? '#000000',
          textAlign: layer.align ?? 'center',
          lineHeight: layer.lineHeight ?? 1.2,
          letterSpacing: (layer.letterSpacing ?? 0) * scale,
          background: 'transparent',
          border: 'none', outline: 'none', resize: 'none',
          padding: 0, margin: 0, overflow: 'hidden',
          display: 'block', boxSizing: 'border-box',
          caretColor: layer.color ?? '#000000',
        }}
      />
    </div>
  )
}

// ─── Canvas ────────────────────────────────────────────────────────────────────

export default function Canvas({ openPickerRef }) {
  const ratio        = useStore(s => s.ratio)
  const bgColor      = useStore(s => s.bgColor)
  const bgGradient   = useStore(s => s.bgGradient)
  const slides       = useStore(s => s.slides)
  const layers       = useStore(s => s.layers)
  const activeSlideIdx  = useStore(s => s.activeSlideIdx)
  const activeLayerId   = useStore(s => s.activeLayerId)
  const elementPanel    = useStore(s => s.elementPanel)
  const activeCellId    = useStore(s => s.activeCellId)
  const cropMode        = useStore(s => s.cropMode)
  const cropAspect      = useStore(s => s.cropAspect)
  const textEditId      = useStore(s => s.textEditId)
  const setTextEditId   = useStore(s => s.setTextEditId)
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
  const pendingLayerId       = useRef(null)
  const pendingSlideIdx      = useRef(null)
  const pendingReplaceFilled = useRef(false)
  const isMulti              = useRef(false)
  const viewRef         = useRef(null)
  const pinchRef        = useRef({ active: false, lastDist: 0 })
  // When true, the next activeSlideIdx-change effect is suppressed (used to
  // avoid snap-back when the user is panning between slides).
  const skipSnapRef     = useRef(false)

  // For pan + resize handle gestures on the Stage
  const panRef = useRef(null)   // { startX, startY, viewX, viewY, type, handle?, layerId?, startLayer? }

  // Keep always-fresh values accessible in stable callbacks
  const fresh = useRef({})
  fresh.current = { layers, slides, ratio, activeLayerId, activeCellId, cropMode, cropAspect, activeSlideIdx,
    setActiveLayer, setActiveCellId, setCropMode, addSlide, updateLayer, updateLayerWithHistory,
    addImageLayer, fillCells, setTextEditId }

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState(null)
  // snapGuides: { xs: number[], ys: number[] } — all active guide positions this frame
  const [snapGuides, setSnapGuides] = useState({ xs: [], ys: [] })
  // True while a drag/resize/rotate gesture is actively moving — hides the
  // floating quick-action toolbar so it doesn't get in the way.
  const [gestureActive, setGestureActive] = useState(false)
  // Keyboard-aware visible viewport height. iOS Safari overlays the soft
  // keyboard without resizing the layout viewport (the interactive-widget meta
  // tag is Android-only), so we track window.visualViewport — which DOES shrink
  // on iOS — to know how much space is visible above the keyboard.
  const [viewportH, setViewportH] = useState(
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 0
  )
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setViewportH(vv.height)
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [])

  const setViewSync = useCallback((updater) => {
    setView(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      viewRef.current = next
      return next
    })
  }, [])

  // ── Text-style panel: pan canvas to show active layer ──
  const animFrameRef  = useRef(null)
  const savedViewYRef = useRef(null)

  const animateViewY = useCallback((toY) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    const fromY = viewRef.current?.y ?? toY
    if (Math.abs(fromY - toY) < 0.5) return
    const start = performance.now()
    const dur = 300
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const y = fromY + (toY - fromY) * e
      setViewSync(v => ({ ...v, y }))
      if (t < 1) animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [setViewSync])

  // Cancel any in-flight view-pan animation on unmount so its rAF callback can't
  // fire setViewSync after the component is gone (setState-after-unmount). See #16 (d).
  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }, [])

  // Re-runs when any panel opens/closes, textEditId changes, or containerSize.h changes
  useEffect(() => {
    if (!viewRef.current) return

    const layer = layers.find(l => l.id === activeLayerId)
    const isTextLayer = layer?.type === 'text'
    const panelOpen = elementPanel !== null || textEditId === activeLayerId

    if (isTextLayer && panelOpen) {
      // Save the original view.y only the first time
      if (savedViewYRef.current === null) savedViewYRef.current = viewRef.current.y

      const scale = viewRef.current.scale
      // Available height = the part of the canvas container visible ABOVE the
      // keyboard. On iOS the keyboard overlays without shrinking the container,
      // so we intersect the container rect with the visual viewport's visible
      // band (vv.offsetTop … vv.offsetTop + vv.height).
      let availH = containerSize.h
      const el = containerRef.current
      const vv = window.visualViewport
      if (el && vv) {
        const rect = el.getBoundingClientRect()
        const visibleBottom = vv.offsetTop + vv.height
        availH = Math.max(120, Math.min(rect.bottom, visibleBottom) - rect.top)
      }
      const topPad = 20, botPad = 20

      // Place the text layer's center at the middle of the available canvas area
      const layerMidCanvas = (layer.y + layer.h / 2) * scale
      let targetY = availH / 2 - layerMidCanvas

      // Clamp so the whole layer fits with padding on both sides
      const layerTopScreen = targetY + layer.y * scale
      const layerBotScreen = targetY + (layer.y + layer.h) * scale
      if (layerTopScreen < topPad) targetY += topPad - layerTopScreen
      if (layerBotScreen > availH - botPad) targetY -= layerBotScreen - (availH - botPad)

      animateViewY(targetY)
    } else {
      if (savedViewYRef.current !== null) {
        const savedY = savedViewYRef.current
        savedViewYRef.current = null
        animateViewY(savedY)
      }
    }
  }, [elementPanel, textEditId, containerSize.h, activeLayerId, viewportH]) // eslint-disable-line

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
  // Re-centers the view when activeSlideIdx changes explicitly (slides panel,
  // addSlide, opening a project, etc.). Skips the snap when the change came
  // from the user panning across slides (see view-tracking effect below).
  useEffect(() => {
    if (!view) return
    if (skipSnapRef.current) { skipSnapRef.current = false; return }
    const { ratio: r } = fresh.current
    setViewSync(v => ({
      ...v,
      x: (containerSize.w - r.w * v.scale) / 2 - activeSlideIdx * r.w * v.scale,
    }))
  }, [activeSlideIdx, slides.length]) // eslint-disable-line

  // ── Track which slide is closest to screen center as the user pans ──
  // Updates activeSlideIdx so the next "add" action targets the visible slide,
  // not whatever slide was last selected via the slides panel.
  useEffect(() => {
    if (!view || !containerSize.w) return
    const r = fresh.current.ratio
    // Find the canvas-space x position currently at the center of the viewport
    const canvasCenterX = (containerSize.w / 2 - view.x) / view.scale
    // Pick the slide whose center is closest to that x
    const idx = Math.max(0, Math.min(
      slides.length - 1,
      Math.round((canvasCenterX - r.w / 2) / r.w),
    ))
    if (idx !== activeSlideIdx) {
      skipSnapRef.current = true  // don't re-center the view we already match
      useStore.setState({ activeSlideIdx: idx })
    }
  }, [view, containerSize.w, slides.length]) // eslint-disable-line

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
        const { activeCellId: cellId, activeLayerId: activeId, layers: curLayers } = fresh.current
        const v = viewRef.current
        const toCanvas = (t) => ({
          x: (t.clientX - rect.left - v.x) / v.scale,
          y: (t.clientY - rect.top  - v.y) / v.scale,
        })
        const p1 = toCanvas(t1), p2 = toCanvas(t2)

        const cell = cellId ? curLayers.find(l => l.id === cellId) : null
        // Decide at gesture start if both fingers land inside the cell
        let cellPinch = false
        if (cell) {
          const inside = (p) => p.x >= cell.x && p.x <= cell.x + cell.w && p.y >= cell.y && p.y <= cell.y + cell.h
          cellPinch = inside(p1) && inside(p2)
        }

        // Layer pinch: both fingers start on the currently selected standalone
        // layer (text / shape / free image — NOT a locked template cell, NOT a
        // group). Cell sub-selection pinch takes priority (handled above). Uses
        // pointInLayer so an already-rotated layer is hit-tested against its
        // rendered box (PR #29).
        let layerPinch = false
        let startLayer = null
        const selLayer = (!cellPinch && activeId) ? curLayers.find(l => l.id === activeId) : null
        const isStandalone = selLayer && !selLayer.locked &&
          (selLayer.type === 'text' || selLayer.type === 'shape' || selLayer.src)
        if (isStandalone && pointInLayer(p1.x, p1.y, selLayer) && pointInLayer(p2.x, p2.y, selLayer)) {
          layerPinch = true
          startLayer = { ...selLayer }
        }

        pinchRef.current = {
          active: true, lastDist: newDist, cellPinch, layerPinch,
          startDist: newDist,
          // Twist tracking: accumulate per-move wrapped deltas so rotation stays
          // continuous when the raw atan2 angle wraps at ±180°.
          lastAngle: Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX),
          accumDeg: 0,
          layerId: layerPinch ? activeId : null,
          startLayer,
          cellScale: cell?.imgScale ?? null,
          imgX: cell?.imgX ?? null,
          imgY: cell?.imgY ?? null,
        }
        if (cellPinch) {
          useStore.getState()._captureUndo()
        } else if (layerPinch) {
          // A 1-finger drag that escalates into this pinch leaves its captured
          // snapshot dangling (its panRef is nulled without commit/discard).
          // Reuse it so the whole physical gesture is one history entry;
          // otherwise capture the pre-pinch state now.
          if (useStore.getState()._undoSnap == null) useStore.getState()._captureUndo()
          setGestureActive(true)  // hide the quick toolbar while pinching the layer
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

      if (pinchRef.current.layerPinch) {
        const sl = pinchRef.current.startLayer
        // Update the accumulated twist even if the layer vanished mid-gesture
        const curAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX)
        let stepDeg = (curAngle - pinchRef.current.lastAngle) * 180 / Math.PI
        // Wrap the per-move step into (-180, 180] so crossing atan2's ±180°
        // seam doesn't produce a 360° jump.
        stepDeg = ((stepDeg + 180) % 360 + 360) % 360 - 180
        pinchRef.current.accumDeg += stepDeg
        pinchRef.current.lastAngle = curAngle
        if (!sl || !curLayers.some(l => l.id === pinchRef.current.layerId)) return

        // ── Scale about the layer center ──
        // Absolute factor from gesture-start geometry (no per-frame compounding
        // drift). Clamped so w/h never go below 20 and text fontSize never
        // below 8 — same floors as the handle-resize paths.
        let factor = newDist / pinchRef.current.startDist
        let minFactor = Math.max(20 / sl.w, 20 / sl.h)
        if (sl.type === 'text') minFactor = Math.max(minFactor, 8 / (sl.fontSize ?? 72))
        factor = Math.max(factor, minFactor)
        const nw = sl.w * factor
        const nh = sl.h * factor
        const cx = sl.x + sl.w / 2
        const cy = sl.y + sl.h / 2
        const patch = { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }
        if (sl.type === 'text') {
          // Text scales via fontSize so the glyphs grow with the box
          patch.fontSize = Math.max(8, Math.round((sl.fontSize ?? 72) * factor * 10) / 10)
        } else if (sl.type !== 'shape') {
          // Free image: uniform scale, so scaling the fitted image params by the
          // same factor preserves the current crop exactly (cover still holds).
          patch.imgScale = (sl.imgScale ?? 1) * factor
          patch.imgX = (sl.imgX ?? 0) * factor
          patch.imgY = (sl.imgY ?? 0) * factor
        }

        // ── Two-finger twist → freeRotation delta ──
        let deg = (sl.freeRotation ?? 0) + pinchRef.current.accumDeg
        let nr = ((deg % 360) + 360) % 360
        if (nr > 180) nr -= 360
        // Soft-snap the RESULT to the nearest key angle when within 3°
        // (-180 is the same pose as 180 — snap it to the canonical 180)
        for (const s of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
          if (Math.abs(nr - s) < 3) { nr = s === -180 ? 180 : s; break }
        }
        patch.freeRotation = Math.round(nr * 10) / 10

        upd(pinchRef.current.layerId, patch)
        return
      }

      setViewSync(v => {
        const ns = clamp(v.scale * factor, 0.1, 10)
        return { scale: ns, x: mid.x - (mid.x - v.x) * (ns / v.scale), y: mid.y - (mid.y - v.y) * (ns / v.scale) }
      })
    }
    const onEnd = (e) => {
      // A pinch can still continue while 2+ fingers remain down, so don't finalize
      // on an intermediate finger lift — that let one physical pinch commit more
      // than once. Only finalize when the pinch can no longer continue.
      if (e.touches && e.touches.length >= 2) return
      if (pinchRef.current.active) {
        // Exactly one outcome per pinch: commit the cell-pinch's or layer-pinch's
        // captured snapshot (skipped automatically if nothing moved), otherwise
        // discard any captured snapshot — including one left dangling by a
        // 1-finger drag that escalated into this pinch (its panRef was nulled
        // without a commit/discard).
        if (pinchRef.current.cellPinch || pinchRef.current.layerPinch) useStore.getState()._commitUndo()
        else useStore.getState()._discardUndo()
        if (pinchRef.current.layerPinch) setGestureActive(false)
      }
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
      if (name.startsWith('rothandle|')) {
        return { type: 'rothandle', layerId: name.split('|')[1] }
      }
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
          useStore.getState()._captureUndo()
        } else {
          panRef.current = { type: 'resize', handle: info.handle, layerId: info.layerId,
            startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
          useStore.getState()._captureUndo()
        }
        return
      }
    }

    if (info?.type === 'rothandle' && info.layerId === activeId && !isCrop) {
      const layer = curLayers.find(l => l.id === info.layerId)
      if (layer) {
        const cx = layer.x + layer.w / 2
        const cy = layer.y + layer.h / 2
        panRef.current = {
          type: 'rotate',
          layerId: info.layerId,
          cx, cy,
          startAngle: Math.atan2(canvasY - cy, canvasX - cx),
          startFreeRotation: layer.freeRotation ?? 0,
          startX: pt.clientX, startY: pt.clientY, moved: false,
        }
        useStore.getState()._captureUndo()
        return
      }
    }

    if (info?.type === 'crop-resize' && isCrop) {
      const layer = curLayers.find(l => l.id === activeId)
      if (layer) {
        panRef.current = { type: 'crop-resize', handle: info.handle, layerId: activeId,
          startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
        useStore.getState()._captureUndo()
        return
      }
    }

    if (info?.type === 'seam' && !isCrop) {
      const layer = curLayers.find(l => l.id === info.layerId)
      if (layer?.locked) {
        const grp = curLayers.filter(l => l.groupId && l.groupId === layer.groupId)
        panRef.current = { type: 'seam-drag', seamType: info.seamType, seamMid: info.seamMid,
          groupLayers: grp.map(l => ({ ...l })), startX: pt.clientX, startY: pt.clientY, moved: false }
        useStore.getState()._captureUndo()
        return
      }
    }

    // In crop mode: touch outside layer bounds exits crop; inside pans the image
    if (isCrop && activeId) {
      const layer = curLayers.find(l => l.id === activeId)
      if (!layer || !pointInLayer(canvasX, canvasY, layer)) {
        fresh.current.setCropMode(false)
        return
      }
      panRef.current = { type: 'crop-pan', layerId: activeId,
        startLayer: { ...layer }, startX: pt.clientX, startY: pt.clientY, moved: false }
      useStore.getState()._captureUndo()
      return
    }

    const hitLayer = [...curLayers].reverse().find(l =>
      (l.src || l.locked || l.type === 'text' || l.type === 'shape') &&
      pointInLayer(canvasX, canvasY, l)
    )

    if (hitLayer) {
      if (hitLayer.locked) {
        const grp = curLayers.filter(l => l.groupId && l.groupId === hitLayer.groupId)
        const isGroupActive = grp.some(l => l.id === activeId)
        if (!isGroupActive) {
          // Group not selected — select it (no undo capture, no layer change)
          panRef.current = { type: 'select', layerId: hitLayer.id,
            startX: pt.clientX, startY: pt.clientY, viewX: v.x, viewY: v.y, moved: false }
        } else if (!curCellId) {
          // Group selected, no cell sub-selected — drag group; tap will enter cell
          panRef.current = { type: 'group-drag',
            groupLayers: grp.map(l => ({ ...l })), tappedCellId: hitLayer.id,
            startX: pt.clientX, startY: pt.clientY, moved: false }
          useStore.getState()._captureUndo()
        } else {
          // A cell is sub-selected — pan its image or clear sub-selection
          const cell = curLayers.find(l => l.id === curCellId)
          if (cell && pointInLayer(canvasX, canvasY, cell)) {
            panRef.current = { type: 'crop-pan', layerId: curCellId,
              startLayer: { ...cell }, startX: pt.clientX, startY: pt.clientY, moved: false }
            useStore.getState()._captureUndo()
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
        useStore.getState()._captureUndo()
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
    if (!p.moved) setGestureActive(true)  // first movement of this gesture
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
        // Edge snapping assumes axis-aligned edges; for a rotated layer nx/nw are
        // the local (unrotated) AABB, not the visible edges, so snapping them
        // would translate the layer — skip snapping while rotated.
        const rotated = (sl.freeRotation ?? 0) !== 0
        const lines = getSnapLines(curLayers, sl.id, r, curSlides.length)
        const thr = SNAP_THRESHOLD_PX / vs
        let sgx = null, sgy = null
        if (!rotated && p.handle === 'r')  { const s = snapEdge(nx + nw, lines.xs, thr); if (s !== null) { nw = s - nx; sgx = s } }
        if (!rotated && p.handle === 'l')  { const s = snapEdge(nx, lines.xs, thr);      if (s !== null) { nw += nx - s; nx = s; sgx = s } }
        if (!rotated && p.handle === 'b')  { const s = snapEdge(ny + nh, lines.ys, thr); if (s !== null) { nh = s - ny; sgy = s } }
        if (!rotated && p.handle === 't')  { const s = snapEdge(ny, lines.ys, thr);      if (s !== null) { nh += ny - s; ny = s; sgy = s } }
        // corners: snap each moving edge independently
        if (!rotated && (p.handle === 'tr' || p.handle === 'br' || p.handle === 'tl' || p.handle === 'bl')) {
          const snapX = p.handle.includes('r')
            ? snapEdge(nx + nw, lines.xs, thr) : snapEdge(nx, lines.xs, thr)
          const snapY = p.handle.includes('b')
            ? snapEdge(ny + nh, lines.ys, thr) : snapEdge(ny, lines.ys, thr)
          if (snapX !== null) { if (p.handle.includes('r')) nw = snapX - nx; else { nw += nx - snapX; nx = snapX }; sgx = snapX }
          if (snapY !== null) { if (p.handle.includes('b')) nh = snapY - ny; else { nh += ny - snapY; ny = snapY }; sgy = snapY }
        }
        setSnapGuides({ xs: sgx !== null ? [sgx] : [], ys: sgy !== null ? [sgy] : [] })
        if (sl.type === 'text' || sl.type === 'shape') {
          upd(sl.id, { x: nx, y: ny, w: nw, h: nh })
        } else {
          const { imgScale: newImgScale, imgX: newImgX, imgY: newImgY } =
            fitInCell(sl.naturalW ?? sl.w, sl.naturalH ?? sl.h, nw, nh)
          upd(sl.id, { x: nx, y: ny, w: nw, h: nh, imgScale: newImgScale, imgX: newImgX, imgY: newImgY })
        }
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
      if (nw > 20 && nh > 20) {
        // Never let the frame grow past the drawn image: bump imgScale up to the
        // cover/rotation minimum for the new frame, and re-clamp the pan offset
        // so no background band can show inside the crop. Computed from the
        // gesture-start layer each move, so scale bumps don't compound.
        const nW = sl.naturalW ?? nw
        const nH = sl.naturalH ?? nh
        const rot = sl.rotation ?? 0
        const coverMin = Math.max(nw / nW, nh / nH)
        const rotMin = minScaleForRotation(rot, nw, nh, nW, nH)
        const newScale = Math.max(sl.imgScale ?? 1, coverMin, rotMin)
        const imgW = nW * newScale
        const imgH = nH * newScale
        const extra = rot ? Math.max(imgW, imgH) : 0
        const imgX = clamp(sl.imgX ?? 0, Math.min(0, nw - imgW) - extra, extra)
        const imgY = clamp(sl.imgY ?? 0, Math.min(0, nh - imgH) - extra, extra)
        upd(sl.id, { x: nx, y: ny, w: nw, h: nh, imgScale: newScale, imgX, imgY })
      }
    } else if (p.type === 'rotate') {
      const containerRect = containerRef.current?.getBoundingClientRect()
      const cX = pt.clientX - (containerRect?.left ?? 0)
      const cY = pt.clientY - (containerRect?.top ?? 0)
      const v  = viewRef.current
      const curCanvasX = (cX - v.x) / v.scale
      const curCanvasY = (cY - v.y) / v.scale
      const currentAngle = Math.atan2(curCanvasY - p.cy, curCanvasX - p.cx)
      let deg = p.startFreeRotation + (currentAngle - p.startAngle) * 180 / Math.PI
      // Snap to every 45° when within 5°
      let nr = ((deg % 360) + 360) % 360
      if (nr > 180) nr -= 360
      const snaps = [0, 45, 90, 135, 180, -45, -90, -135]
      for (const s of snaps) {
        if (Math.abs(nr - s) < 5) { deg = s; break }
      }
      upd(p.layerId, { freeRotation: Math.round(deg * 10) / 10 })
    }
  }

  const handleStageUp = (e) => {
    const p = panRef.current
    if (!p) return
    panRef.current = null
    setSnapGuides({ xs: [], ys: [] })
    setGestureActive(false)

    if (p.type === 'addslide' && !p.moved) {
      fresh.current.addSlide()
      return
    }

    if (p.type === 'select' && !p.moved) {
      // setActiveLayer now atomically updates activeSlideIdx — no separate setActiveSlide needed
      fresh.current.setActiveLayer(p.layerId)
      // Empty text layers should jump straight into edit mode on first tap —
      // saves a tap for the very common case of "I just want to type".
      const tapped = fresh.current.layers.find(l => l.id === p.layerId)
      if (tapped?.type === 'text' && !(tapped.text && tapped.text.trim())) {
        fresh.current.setTextEditId(p.layerId)
      }
      return
    }

    if (p.type === 'deselect' && !p.moved) {
      fresh.current.setActiveLayer(null)
      return
    }

    if (p.type === 'crop-pan' && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    if (p.type === 'drag' && !p.moved) {
      // Second tap on an already-selected text layer → enter edit mode
      const tapped = fresh.current.layers.find(l => l.id === p.layerId)
      if (tapped?.type === 'text') {
        fresh.current.setTextEditId(p.layerId)
        return
      }
    }

    if (p.type === 'drag' && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    if (p.type === 'group-drag' && !p.moved) {
      // Tap on already-selected group → sub-select the tapped cell
      fresh.current.setActiveCellId(p.tappedCellId)
      return
    }

    if (p.type === 'group-drag' && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    if (p.type === 'clear-cell') {
      fresh.current.setActiveCellId(null)
      return
    }

    if (p.type === 'group-resize' && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    if (p.type === 'seam-drag' && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    if ((p.type === 'resize' || p.type === 'crop-resize') && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    if (p.type === 'rotate' && p.moved) {
      useStore.getState()._commitUndo()
      return
    }

    // Gesture ended without movement (or unrecognized type) — discard any captured snapshot
    useStore.getState()._discardUndo()
  }

  // ── File picker ──
  const openPickerRef2 = useRef(null)
  const openPickerForCell = useCallback((layerId, slideIdx, multi = false, replaceFilled = false) => {
    pendingLayerId.current       = layerId
    pendingSlideIdx.current      = slideIdx
    pendingReplaceFilled.current = replaceFilled
    isMulti.current              = multi
    if (fileRef.current) { fileRef.current.multiple = multi; fileRef.current.click() }
  }, [])

  useEffect(() => {
    openPickerRef2.current = openPickerForCell
    if (openPickerRef) {
      openPickerRef.current = (layerId = null, slideIdx = null, multi = false, replaceFilled = false) =>
        openPickerForCell(layerId, slideIdx ?? fresh.current.activeSlideIdx, multi, replaceFilled)
    }
  })

  const handleFileChange = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    const { addImageLayer: addImg, fillCells: fill, updateLayerWithHistory: upd,
      layers: curLayers, activeSlideIdx: asi } = fresh.current

    if (isMulti.current && files.length > 1) {
      // Process all files (downscale), then fill cells in order
      const processed = await Promise.all(files.map(processImageFile))
      // Pass pendingLayerId so fillCells can scope by the template group (multi-page)
      fill(processed, pendingLayerId.current, pendingReplaceFilled.current)
      pendingLayerId.current = null
      pendingReplaceFilled.current = false
    } else {
      const { src, srcOriginal, naturalW, naturalH, imgId } = await processImageFile(files[0])
      if (pendingLayerId.current) {
        const layer = curLayers.find(l => l.id === pendingLayerId.current)
        if (layer) {
          const gap = layer.cellGap ?? 0
          const fit = fitInCell(naturalW, naturalH, layer.w - gap, layer.h - gap)
          // imgId identifies this replacement image so undo restores it (and the
          // previous image) exactly — see the replace-undo fix in useStore.js.
          upd(pendingLayerId.current, { src, srcOriginal, imgId, naturalW, naturalH, ...fit })
        }
        pendingLayerId.current = null
      } else {
        addImg(src, srcOriginal, naturalW, naturalH, imgId, pendingSlideIdx.current ?? asi)
      }
    }
  }

  if (!view) return <div ref={containerRef} className="flex-1 w-full" />

  const vs = view.scale
  const activeLayer = layers.find(l => l.id === activeLayerId)

  // Show the floating quick-action toolbar for a selected free-floating element
  // (text/shape/standalone image) — not for template groups, cell sub-selection,
  // crop mode, text editing, or mid-gesture.
  const showQuickToolbar = activeLayer && !activeLayer.locked && !activeCellId &&
    !cropMode && textEditId !== activeLayerId && !gestureActive &&
    (activeLayer.type === 'text' || activeLayer.type === 'shape' || activeLayer.src)

  // Inline text editing overlay (WYSIWYG) — active when a text layer is in edit mode
  const editingTextLayer = (activeLayer?.type === 'text' && textEditId === activeLayerId && !gestureActive)
    ? activeLayer : null
  const finishTextEdit = () => {
    useStore.getState()._commitUndo()
    setTextEditId(null)
  }

  return (
    <div ref={containerRef} className="flex-1 w-full overflow-hidden relative">
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
            {slides.map((slide, i) => {
              const grad = slide.bgGradient ?? bgGradient
              if (grad) {
                const gp = linearGradientPoints(grad.angle, ratio.w, ratio.h)
                return (
                  <Rect key={slide.id} x={i * ratio.w} y={0} width={ratio.w} height={ratio.h}
                    fillLinearGradientStartPoint={{ x: gp.x1, y: gp.y1 }}
                    fillLinearGradientEndPoint={{ x: gp.x2, y: gp.y2 }}
                    fillLinearGradientColorStops={[0, grad.stops[0], 1, grad.stops[1]]}
                    listening={false} />
                )
              }
              return (
                <Rect key={slide.id} x={i * ratio.w} y={0} width={ratio.w} height={ratio.h}
                  fill={slide.bgColor ?? bgColor} listening={false} />
              )
            })}

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
              if (layer.type === 'text') {
                return <TextCell key={layer.id} layer={layer} isEditing={layer.id === textEditId} />
              }
              if (layer.type === 'shape') {
                return <ShapeCell key={layer.id} layer={layer} />
              }
              return layer.src ? (
                <FilledCell key={layer.id} layer={layer} vs={vs} />
              ) : (
                <EmptyCell key={layer.id} layer={layer} vs={vs}
                  onTap={() => {
                    const si = Math.floor(layer.x / ratio.w)
                    // If part of a template group, count empty cells across the
                    // whole group (across all pages) so multi-page templates can
                    // be filled in one pick.
                    const emptyInScope = layer.groupId
                      ? layers.filter(l => !l.src && l.groupId === layer.groupId)
                      : layers.filter(l => !l.src && Math.floor(l.x / ratio.w) === si)
                    openPickerRef2.current?.(layer.id, si, emptyInScope.length > 1)
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
              if (!activeLayer.src && activeLayer.type !== 'text' && activeLayer.type !== 'shape') return null
              return <SelectionOverlay layer={activeLayer} vs={vs} />
            })()}
          </Group>
        </Layer>
      </Stage>

      {showQuickToolbar && (
        <QuickToolbar layer={activeLayer} view={view} containerH={containerSize.h} />
      )}

      {editingTextLayer && (
        <InlineTextEditor
          key={editingTextLayer.id}
          layer={editingTextLayer}
          view={view}
          onDone={finishTextEdit}
        />
      )}
    </div>
  )
}

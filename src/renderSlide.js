// Canvas-based slide renderer. Single source of truth for any place that needs
// to draw a slide to a bitmap — export, slides panel thumbnails, project
// thumbnails (eventually). Renders text, shapes, images with crop/rotation/
// filters, gradient backgrounds, and free-rotation, identical to what the
// editor's Konva canvas shows.

import { dbGetBlob } from './db'
import { drawShapePath, STROKE_AWARE_SHAPES } from './shapes'
import { hasShadow, applyCanvasShadow, clearCanvasShadow } from './shadow'
import { layerTextArc, arcTextLine, curvedTextLayout, drawCurvedGlyphs } from './curvedText'
import { ensureLayerFontsLoaded } from './fonts'
import { buildFilterString, hasOverlay, drawAdjustmentOverlays } from './adjustments'

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

// Line width the way Konva's Text._getTextWidth measures it: raw glyph advance
// plus letterSpacing added once per UTF-16 code unit (including the trailing one).
// We never rely on ctx.letterSpacing here — it's unsupported on iOS Safari < 18.4,
// so all spacing is accounted for manually to stay cross-platform.
function measureLineWidth(ctx, text, letterSpacing) {
  return ctx.measureText(text).width + letterSpacing * text.length
}

// Faithful port of Konva Text._setTextData wrapping (wrap='word', ellipsis off).
// Splits into visual lines the same way the editor does — including the
// fixed-height behaviour where paragraphs that would overflow the box height are
// dropped — so exported line breaks match the editor even with letterSpacing ≠ 0.
function wrapTextLines(ctx, rawText, width, height, letterSpacing, lineHeightPx, wrapMode) {
  const lines = []
  const paragraphs = String(rawText).split('\n')
  const maxWidth = width
  const maxHeightPx = height
  const shouldWrap = wrapMode !== 'none'
  const wrapAtWord = wrapMode !== 'char' && shouldWrap
  const tw = (s) => measureLineWidth(ctx, s, letterSpacing)
  let currentHeightPx = 0

  for (let i = 0; i < paragraphs.length; i++) {
    let line = paragraphs[i]
    let lineWidth = tw(line)
    if (shouldWrap && lineWidth > maxWidth) {
      while (line.length > 0) {
        const arr = Array.from(line)
        let low = 0, high = arr.length, match = '', matchWidth = 0
        while (low < high) {
          const mid = (low + high) >>> 1
          const substr = arr.slice(0, mid + 1).join('')
          const substrWidth = tw(substr)
          if (substrWidth <= maxWidth) { low = mid + 1; match = substr; matchWidth = substrWidth }
          else high = mid
        }
        if (!match) break
        if (wrapAtWord) {
          const matchArr = Array.from(match)
          const nextChar = arr[matchArr.length]
          const nextIsSpaceOrDash = nextChar === ' ' || nextChar === '-'
          let wrapIndex
          if (nextIsSpaceOrDash && matchWidth <= maxWidth) {
            wrapIndex = matchArr.length
          } else {
            const lastSpace = matchArr.lastIndexOf(' ')
            const lastDash = matchArr.lastIndexOf('-')
            wrapIndex = Math.max(lastSpace, lastDash) + 1
          }
          if (wrapIndex > 0) {
            low = wrapIndex
            match = arr.slice(0, low).join('')
          }
        }
        lines.push(match.replace(/\s+$/, ''))
        currentHeightPx += lineHeightPx
        line = arr.slice(low).join('').replace(/^\s+/, '')
        if (line.length > 0) {
          lineWidth = tw(line)
          if (lineWidth <= maxWidth) {
            lines.push(line)
            currentHeightPx += lineHeightPx
            break
          }
        }
      }
    } else {
      lines.push(line)
      currentHeightPx += lineHeightPx
    }
    // Konva stops laying out further paragraphs once the box height is exceeded.
    if (currentHeightPx + lineHeightPx > maxHeightPx) break
  }
  return lines
}

// Parse a CSS color (hex #rgb/#rrggbb or rgb/rgba()) into {r,g,b,a}, mirroring
// Konva's Util.colorToRGBA for the cases our color inputs produce. Falls back to
// opaque black on anything unrecognized.
function colorToRGBA(color) {
  if (typeof color !== 'string') return { r: 0, g: 0, b: 0, a: 1 }
  const c = color.trim()
  if (c[0] === '#') {
    let hex = c.slice(1)
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('')
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      return { r, g, b, a }
    }
  }
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 }
  return { r: 0, g: 0, b: 0, a: 1 }
}

// Konva folds shadowOpacity into the shadow color's alpha (Shape._getShadowRGBA).
function shadowRGBA(color, shadowOpacity) {
  const { r, g, b, a } = colorToRGBA(color)
  return `rgba(${r},${g},${b},${a * (shadowOpacity ?? 1)})`
}

function renderTextLayer(ctx, layer, sliceStart, scale = 1) {
  const x = layer.x - sliceStart
  const y = layer.y
  const w = layer.w
  const h = layer.h

  if (layer.textBg) {
    ctx.save()
    ctx.globalAlpha = (layer.textBgOpacity ?? 1) * (layer.opacity ?? 1)
    ctx.fillStyle = layer.textBg
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }

  const raw = layer.text ?? ''
  if (!raw) return

  ctx.save()
  // Konva does NOT clip text to its box — overflowing text bleeds past the edges
  // in the editor, so we must not clip here either.
  ctx.globalAlpha = layer.opacity ?? 1

  const bold = layer.bold ? 'bold' : ''
  const italic = layer.italic ? 'italic' : ''
  const fontStyle = [italic, bold].filter(Boolean).join(' ') || 'normal'
  const fontSize = layer.fontSize ?? 72
  const fontFamily = layer.fontFamily ?? 'Inter'

  const fontString = `${fontStyle} ${fontSize}px "${fontFamily}"`
  ctx.font = fontString
  ctx.fillStyle = layer.color ?? '#000000'
  // Draw each line left-anchored and compute the align offset ourselves (Konva
  // keeps textAlign='left' and positions lines manually).
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const align = layer.align ?? 'center'
  const letterSpacing = layer.letterSpacing ?? 0
  const lineHeightPx = (layer.lineHeight ?? 1.2) * fontSize

  // Curved text (issue #92): a non-zero textArc bends the text along an arc and,
  // per the v1 constraints, renders it as ONE line — wrapping is skipped and
  // newlines collapse to spaces. textArc 0 falls through to the untouched
  // straight path below, so straight text is byte-identical to before.
  const arcDeg = layerTextArc(layer)
  const curved = arcDeg !== 0

  const lines = curved
    ? [arcTextLine(raw)]
    : wrapTextLines(ctx, raw, w, h, letterSpacing, lineHeightPx, 'word')

  // Vertical placement matches Konva's non-legacy text rendering: each line box is
  // fontSize*lineHeight tall and the alphabetic baseline sits at
  // (ascent-descent)/2 + lineHeightPx/2 within the box.
  const m = ctx.measureText('M')
  const sf = fontSize / 100
  const ascent = m.fontBoundingBoxAscent ?? (91 * sf)
  const descent = m.fontBoundingBoxDescent ?? (21 * sf)
  const translateY = (ascent - descent) / 2 + lineHeightPx / 2

  const va = layer.verticalAlign ?? 'middle'
  let alignY = 0
  if (va === 'middle') alignY = (h - lines.length * lineHeightPx) / 2
  else if (va === 'bottom') alignY = h - lines.length * lineHeightPx

  // ── Text effects (issue #62): outline (stroke) + drop shadow ──────────────
  // Outline: dedicated textStroke/textStrokeWidth. Konva strokeWidth scales with
  // the transform (strokeScaleEnabled default), so we set lineWidth in logical
  // units and let ctx.scale handle export scaling — no manual *scale here.
  const strokeWidth = layer.textStrokeWidth ?? 0
  const strokeColor = strokeWidth > 0 && layer.textStroke ? layer.textStroke : null
  // Shadow: matches Konva Text.hasShadow (shadowColor && shadowOpacity !== 0).
  const shadowOn = !!layer.shadowColor && (layer.shadowOpacity ?? 1) !== 0

  // Draw every line with the target ctx's current fill/stroke settings. Mirrors
  // Konva's fillAfterStrokeEnabled=true ordering (stroke first, fill on top) so
  // the outline sits behind the glyph. Letter-spaced text is drawn char-by-char
  // (iOS Safari < 18.4 ignores ctx.letterSpacing) — identical fillText/strokeText
  // calls to the non-spaced path, one per glyph, so shadow/outline apply per call
  // exactly as Konva's per-glyph _partialText rendering does.
  const drawLines = (tctx) => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineWidth = measureLineWidth(tctx, line, letterSpacing)
      let lineX = x
      if (align === 'right') lineX = x + w - lineWidth
      else if (align === 'center') lineX = x + (w - lineWidth) / 2
      const baseY = y + alignY + translateY + i * lineHeightPx

      if (letterSpacing !== 0) {
        let cx = lineX
        for (const ch of Array.from(line)) {
          if (strokeColor) tctx.strokeText(ch, cx, baseY)
          tctx.fillText(ch, cx, baseY)
          cx += tctx.measureText(ch).width + letterSpacing
        }
      } else {
        if (strokeColor) tctx.strokeText(line, lineX, baseY)
        tctx.fillText(line, lineX, baseY)
      }
    }
  }

  // Curved variant. Geometry + per-glyph placement come from the SHARED module
  // the editor's TextCell uses (src/curvedText.js), so the two renderers can't
  // drift; only the save/translate/rotate/fillText emission differs in ceremony.
  // Everything else — outline ordering, the shadow paths below, letterSpacing —
  // composes exactly as it does for straight text.
  const drawCurved = (tctx) => {
    // curveOrigin: the layer box origin in this context's space (the editor draws
    // the same glyphs at the Group-local origin 0,0). Also the anchor the parity
    // negative control perturbs — see INJECTIONS in test/parity/run.mjs.
    const curveOrigin = { x, y }
    const glyphs = curvedTextLayout(tctx, {
      text: raw, ox: curveOrigin.x, oy: curveOrigin.y, w, h,
      fontSize, lineHeight: layer.lineHeight ?? 1.2, letterSpacing,
      verticalAlign: va, arcDeg,
    })
    drawCurvedGlyphs(tctx, glyphs, { stroke: !!strokeColor })
  }

  const drawText = curved ? drawCurved : drawLines

  if (shadowOn && strokeColor) {
    // Konva renders fill+stroke text to a buffer canvas and casts a SINGLE shadow
    // from the composited shape (_useBufferCanvas: hasFill && hasStroke && hasShadow
    // && shadowForStrokeEnabled). Replicate that: draw the glyphs (no shadow) into a
    // device-sized buffer under the SAME transform, then composite once with the
    // shadow set in device space.
    // Curved text takes this same branch: TextCell's arc node is a Konva Shape
    // carrying the same fill/stroke/shadow attrs, so Konva applies the identical
    // buffer rule to it and the shadow is cast once from the whole curved word —
    // not once per glyph (which is what the non-buffer branch below does, in both
    // renderers, when there is a shadow but no outline).
    const buf = document.createElement('canvas')
    buf.width = ctx.canvas.width
    buf.height = ctx.canvas.height
    const bctx = buf.getContext('2d')
    bctx.setTransform(ctx.getTransform())
    bctx.font = fontString
    bctx.textAlign = 'left'
    bctx.textBaseline = 'alphabetic'
    bctx.fillStyle = layer.color ?? '#000000'
    bctx.strokeStyle = strokeColor
    bctx.lineWidth = strokeWidth
    bctx.lineJoin = 'round'
    drawText(bctx)

    ctx.save()
    // Canvas shadow params ignore the CTM, so they live in device pixels. Konva
    // pre-multiplies blur/offset by absoluteScale*pixelRatio; here the export
    // `scale` plays that role (pixelRatio is 1 on the export canvas). Composite
    // under an identity transform so drawImage is a 1:1 device blit.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.shadowColor = shadowRGBA(layer.shadowColor, layer.shadowOpacity)
    ctx.shadowBlur = (layer.shadowBlur ?? 0) * scale
    ctx.shadowOffsetX = (layer.shadowOffsetX ?? 0) * scale
    ctx.shadowOffsetY = (layer.shadowOffsetY ?? 0) * scale
    ctx.drawImage(buf, 0, 0)
    ctx.restore()
  } else {
    if (shadowOn) {
      ctx.shadowColor = shadowRGBA(layer.shadowColor, layer.shadowOpacity)
      ctx.shadowBlur = (layer.shadowBlur ?? 0) * scale
      ctx.shadowOffsetX = (layer.shadowOffsetX ?? 0) * scale
      ctx.shadowOffsetY = (layer.shadowOffsetY ?? 0) * scale
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.lineJoin = 'round'
    }
    drawText(ctx)
  }
  ctx.restore()
}

// Device-space (post-CTM) axis-aligned bounding box of a logical rect. Used to
// size the shadow buffer below: the CTM here can carry the export scale AND a
// free-rotation, so the box is derived from all four transformed corners.
// Snapped outwards to whole device pixels so the buffer can later be blitted at
// an integer offset (no resampling, identical antialiasing to a direct draw).
function deviceBounds(ctx, x, y, w, h) {
  const t = ctx.getTransform()
  const px = (cx, cy) => ({ x: t.a * cx + t.c * cy + t.e, y: t.b * cx + t.d * cy + t.f })
  const pts = [px(x, y), px(x + w, y), px(x, y + h), px(x + w, y + h)]
  const minX = Math.floor(Math.min(...pts.map(p => p.x)))
  const minY = Math.floor(Math.min(...pts.map(p => p.y)))
  const maxX = Math.ceil(Math.max(...pts.map(p => p.x)))
  const maxY = Math.ceil(Math.max(...pts.map(p => p.y)))
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY), t }
}

function renderShapeLayer(ctx, layer, sliceStart, scale = 1) {
  const x = layer.x - sliceStart, y = layer.y, w = layer.w, h = layer.h
  // Same drawShapePath as the editor's ShapeCell sceneFunc (Canvas.jsx) — the
  // single source of truth for every shape type. cornerRadius is gated to rect
  // inside drawShapePath; strokeWidth feeds the stroke-aware line/arrow geometry.
  const shapeType = layer.shapeType ?? 'rect'
  const sw = layer.strokeWidth ?? 0
  const cr = layer.cornerRadius ?? 0
  // Editor falls back to #000000 (fill ?? '#000000'); a null-fill shape is black
  // in the editor, so it must be black in export too.
  const fill = layer.fill ?? '#000000'
  // Outline pass matches ShapeCell: only when a stroke colour is actually set,
  // and never for the stroke-aware line/arrow — their strokeWidth is geometry
  // thickness, not an outline.
  const strokeColor = sw > 0 && layer.stroke && !STROKE_AWARE_SHAPES.has(shapeType)
    ? layer.stroke : null
  const shadowOn = hasShadow(layer)
  const path = (c) => {
    c.beginPath()
    drawShapePath(c, x, y, w, h, shapeType, cr, false, sw)
  }

  ctx.save()
  ctx.globalAlpha = layer.opacity ?? 1

  if (shadowOn && strokeColor) {
    // Konva renders a fill+stroke+shadow shape through a buffer canvas and casts
    // a SINGLE shadow from the COMPOSITE (fill ∪ stroke) silhouette
    // (Shape._useBufferCanvas: hasFill && hasStroke && hasShadow &&
    // shadowForStrokeEnabled). Shadowing the fill path alone loses half a stroke
    // width all round (issue #100). Replicate the buffer: draw fill+stroke with
    // NO shadow under the SAME transform, then composite once with the shadow —
    // the exact pattern renderTextLayer uses for outline+shadow text (#62).
    //
    // The buffer covers the shape's device-space bounds plus a stroke margin
    // (miter joins on sharp corners — star points — can reach well past sw/2, so
    // the margin is deliberately generous); no blur margin is needed because the
    // shadow is cast at composite time and is free to spill outside the image.
    const margin = sw * 5 + 2
    const b = deviceBounds(ctx, x - margin, y - margin, w + margin * 2, h + margin * 2)
    const buf = document.createElement('canvas')
    buf.width = b.w
    buf.height = b.h
    const bctx = buf.getContext('2d')
    // Same CTM as the slide canvas, shifted so the bounds origin lands at (0,0):
    // the shape is drawn in the very same logical coordinates, and the export
    // scale keeps flowing through the transform exactly as on the direct path.
    bctx.setTransform(b.t.a, b.t.b, b.t.c, b.t.d, b.t.e - b.x, b.t.f - b.y)
    bctx.fillStyle = fill
    path(bctx)
    bctx.fill()
    bctx.strokeStyle = strokeColor
    bctx.lineWidth = sw
    path(bctx)
    bctx.stroke()

    // Canvas shadow params ignore the CTM, so they live in device pixels —
    // applyCanvasShadow bakes in the export scale, matching Konva's
    // absoluteScale × pixelRatio. Composite under an identity transform at the
    // integer bounds origin so drawImage is a 1:1 device blit. globalAlpha
    // (layer opacity) is applied here on the composite, as Konva does.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    applyCanvasShadow(ctx, layer, scale)
    ctx.drawImage(buf, b.x, b.y)
  } else {
    // Unstroked (or stroke-aware) shapes: the fill path IS the whole silhouette,
    // so a direct shadowed fill is already pixel-identical to the editor.
    ctx.fillStyle = fill
    if (shadowOn) applyCanvasShadow(ctx, layer, scale)
    path(ctx)
    ctx.fill()
    if (shadowOn) clearCanvasShadow(ctx)
    if (strokeColor) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = sw
      path(ctx)
      ctx.stroke()
    }
  }
  ctx.restore()
}

const BLOB_REF_PREFIX = 'blob-ref://'

// Resolve a layer's source URL to something usable by an Image element.
// preferOriginal returns the full-res original when available: in-session it's a
// blob:/data: URL on layer.srcOriginal; after a reload it's a `blob-ref://` pointer
// into the IDB blobs store. If a persisted original is missing (older project, or
// GC'd), we transparently fall back to the preview `src` so the image still renders.
async function resolveLayerSrc(layer, preferOriginal) {
  if (preferOriginal && layer.srcOriginal) {
    const orig = layer.srcOriginal
    if (orig.startsWith(BLOB_REF_PREFIX)) {
      const resolved = await dbGetBlob(orig.slice(BLOB_REF_PREFIX.length)).catch(() => null)
      if (resolved) return resolved
      // fall through to preview src below
    } else {
      return orig
    }
  }
  const src = layer.src
  if (src?.startsWith(BLOB_REF_PREFIX)) {
    return await dbGetBlob(src.slice(BLOB_REF_PREFIX.length)).catch(() => null)
  }
  return src ?? null
}

// Load an image, with optional cache. Cache key is the resolved URL.
// The cache stores the *in-flight* decode promise (not just the resolved
// Image), so when several slides reference the same original within one export
// run it is fetched and decoded exactly once — concurrent callers await the
// same promise instead of each kicking off their own full-res decode. The
// caller owns the cache's lifetime (one Map per export run), so nothing is
// pinned in memory across runs.
function loadImage(src, imgCache) {
  if (imgCache && imgCache.has(src)) {
    // Value may be a pending promise or an already-resolved Image/null.
    return Promise.resolve(imgCache.get(src))
  }
  const promise = new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const p = img.decode ? img.decode() : Promise.resolve()
      p.catch(() => {}).then(() => resolve(img))
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
  // Cache the promise immediately (before it resolves) so simultaneous requests
  // for the same src dedupe onto this single decode.
  if (imgCache) imgCache.set(src, promise)
  return promise
}

/**
 * Render a single slide to an image data URL (JPEG by default, or PNG).
 * @param {number} slideIdx
 * @param {Object} args
 * @param {Array} args.slides
 * @param {Array} args.layers
 * @param {{w:number,h:number}} args.ratio
 * @param {string} args.bgColor
 * @param {Object} [args.bgGradient]
 * @param {number} [args.scale=1] - output pixel scale (e.g. 0.25 for thumbnails)
 * @param {'jpeg'|'png'} [args.format='jpeg'] - output encoding; PNG ignores quality
 * @param {number} [args.quality=0.95] - JPEG quality (0..1), ignored for PNG
 * @param {boolean} [args.preferOriginal=true] - use srcOriginal when available
 * @param {Map} [args.imgCache] - shared cache to reuse images across calls
 * @param {(layer:Object)=>void} [args.onImageError] - called for each image
 *   layer whose source can't be resolved or fails to decode (so callers can
 *   warn the user instead of silently exporting a slide with a photo missing)
 * @param {{src:string,naturalW:number,naturalH:number}} [args.stampLogo] - brand
 *   kit logo (issue #64) drawn as a post-draw overlay on every slide: bottom-
 *   right corner, ~18% of slide width, in logical coordinates so it respects
 *   the export scale exactly like every other element
 * @returns {Promise<string>} data URL
 */
export async function renderSlide(slideIdx, args) {
  const {
    slides, layers, ratio, bgColor, bgGradient,
    scale = 1, format = 'jpeg', quality = 0.95, preferOriginal = true, imgCache, onImageError,
    stampLogo,
  } = args

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(ratio.w * scale))
  canvas.height = Math.max(1, Math.round(ratio.h * scale))
  const ctx = canvas.getContext('2d')
  // Large originals downscaled into the output canvas look softer with default
  // smoothing — request the highest-quality resampling the browser offers.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // All subsequent drawing uses logical (ratio.w × ratio.h) coordinates.
  if (scale !== 1) ctx.scale(scale, scale)

  const grad = slides[slideIdx]?.bgGradient ?? bgGradient
  if (grad) {
    const { x1, y1, x2, y2 } = linearGradientPoints(grad.angle, ratio.w, ratio.h)
    const g = ctx.createLinearGradient(x1, y1, x2, y2)
    g.addColorStop(0, grad.stops[0])
    g.addColorStop(1, grad.stops[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = slides[slideIdx]?.bgColor ?? bgColor
  }
  ctx.fillRect(0, 0, ratio.w, ratio.h)

  const sliceStart = slideIdx * ratio.w
  const sliceEnd = (slideIdx + 1) * ratio.w

  const relevant = layers.filter(l => {
    if (!l.src && l.type !== 'text' && l.type !== 'shape') return false
    const fr = l.freeRotation ?? 0
    if (!fr) return l.x < sliceEnd && l.x + l.w > sliceStart
    const θ = Math.abs(fr) * Math.PI / 180
    const cx = l.x + l.w / 2
    const extHalfW = (Math.abs(l.w * Math.cos(θ)) + Math.abs(l.h * Math.sin(θ))) / 2
    return cx - extHalfW < sliceEnd && cx + extHalfW > sliceStart
  })

  // Resolve and load all image layers for this slide. Loads run concurrently,
  // but imgCache dedupes decodes so a src shared across slides is only decoded
  // once per export run. A layer whose source can't be resolved (e.g. an evicted
  // blob: URL or a failed IDB read) or that fails to decode is reported via
  // onImageError and then skipped, so the export completes but the caller can
  // warn the user rather than shipping a silently incomplete slide.
  const imgByLayer = new Map()
  await Promise.all(
    relevant.filter(l => l.src).map(async layer => {
      const src = await resolveLayerSrc(layer, preferOriginal)
      if (!src) { onImageError?.(layer); return }
      const img = await loadImage(src, imgCache)
      if (img) imgByLayer.set(layer.id, img)
      else onImageError?.(layer)
    })
  )

  // Inject + actually load the fonts this slice's text uses before rasterizing.
  // On a freshly-opened project the stylesheet may not have been injected yet
  // (or the FontFace is still downloading), so document.fonts.ready alone can
  // resolve while glyphs are still the fallback. ensureLayerFontsLoaded awaits
  // the used weight/style combos with an internal timeout so a hung fetch can't
  // hang the export.
  await ensureLayerFontsLoaded(relevant.filter(l => l.type === 'text'))
  await document.fonts.ready

  for (const layer of relevant) {
    const freeRot = layer.freeRotation ?? 0
    if (freeRot) {
      ctx.save()
      const cx = (layer.x - sliceStart) + layer.w / 2
      const cy = layer.y + layer.h / 2
      ctx.translate(cx, cy)
      ctx.rotate(freeRot * Math.PI / 180)
      ctx.translate(-cx, -cy)
    }

    if (layer.src) {
      const img = imgByLayer.get(layer.id)
      if (!img) {
        if (freeRot) ctx.restore()
        continue
      }

      const gap = layer.cellGap ?? 0
      const inset = gap / 2
      const cr  = layer.cornerRadius ?? 0
      const bw  = layer.borderWidth ?? 0
      const bc  = layer.borderColor ?? '#000000'
      const shape = layer.shape ?? 'rect'

      // The cellGap inset is measured from the cell's own frame edges, not from
      // the slide-boundary slice. The editor shows each slide as a viewport onto
      // the full canvas, so a cell spanning two slides bleeds edge-to-edge at the
      // seam with no gap there. We draw the full inset frame in slice-local coords
      // and let the slide-sized canvas clip the off-slide portion (the seam cut),
      // exactly like the editor viewport — instead of clamping to the slice and
      // wrongly re-adding the inset at the boundary.
      const clipX = (layer.x - sliceStart) + inset
      const clipW = layer.w - gap
      const clipY = layer.y + inset
      const clipH = layer.h - gap

      // Shape-following drop shadow: cast from a shadow-caster filled with the
      // shadow colour and drawn UNDER the image (the clip below covers its fill,
      // leaving only the offset shadow). Mirrors FilledCell's caster Shape in the
      // editor. Drawn at the layer opacity so a semi-transparent photo lets the
      // caster show through identically in editor and export (Konva applies group
      // opacity per child too).
      if (hasShadow(layer)) {
        ctx.save()
        ctx.globalAlpha = layer.opacity ?? 1
        applyCanvasShadow(ctx, layer, scale)
        ctx.fillStyle = layer.shadowColor ?? '#000000'
        ctx.beginPath()
        drawShapePath(ctx, clipX, clipY, clipW, clipH, shape, cr)
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      ctx.beginPath()
      drawShapePath(ctx, clipX, clipY, clipW, clipH, shape, cr)
      ctx.clip()
      ctx.globalAlpha = layer.opacity ?? 1

      // Same shared builder as the editor's useAdjustedImage — identical filter
      // string means identical pixels in editor and export (issue #61).
      const filter = buildFilterString(layer)
      if (filter) ctx.filter = filter

      const drawX = (layer.x - sliceStart) + (layer.imgX ?? 0) + inset
      const drawY = layer.y + (layer.imgY ?? 0) + inset
      const logW = layer.naturalW ?? img.naturalWidth
      const logH = layer.naturalH ?? img.naturalHeight
      const drawW = logW * (layer.imgScale ?? 1)
      const drawH = logH * (layer.imgScale ?? 1)
      const rotation = layer.rotation ?? 0
      const flipH = layer.flipH ?? false
      const flipV = layer.flipV ?? false
      if (rotation || flipH || flipV) {
        const frameCX = (layer.x - sliceStart) + layer.w / 2
        const frameCY = layer.y + layer.h / 2
        // Match Konva's Group transform order (translate → rotate → scale, with
        // scale innermost): the editor composes rotation OUTSIDE the flip, so we
        // must rotate before applying the flip scale here.
        ctx.translate(frameCX, frameCY)
        if (rotation) ctx.rotate(rotation * Math.PI / 180)
        if (flipH) ctx.scale(-1, 1)
        if (flipV) ctx.scale(1, -1)
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
          drawX - frameCX, drawY - frameCY, drawW, drawH)
      } else {
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
          drawX, drawY, drawW, drawH)
      }
      ctx.filter = 'none'
      ctx.restore()

      // Vignette + grain overlays, clipped to the cell shape and drawn via the
      // SAME drawAdjustmentOverlays the editor uses (issue #61 parity). Kept in a
      // separate save/clip block so they cover the cell rect regardless of image
      // pan/zoom, matching the editor's cell-aligned overlay Shape.
      if (hasOverlay(layer)) {
        ctx.save()
        ctx.beginPath()
        drawShapePath(ctx, clipX, clipY, clipW, clipH, shape, cr)
        ctx.clip()
        ctx.globalAlpha = layer.opacity ?? 1
        drawAdjustmentOverlays(ctx, clipX, clipY, clipW, clipH, layer)
        ctx.restore()
      }

      if (bw > 0) {
        ctx.save()
        ctx.strokeStyle = bc
        ctx.lineWidth = bw
        ctx.globalAlpha = layer.opacity ?? 1
        ctx.beginPath()
        drawShapePath(ctx, clipX, clipY, clipW, clipH, shape, cr)
        ctx.stroke()
        ctx.restore()
      }
    } else if (layer.type === 'text') {
      // No slice-based early-return here: the `relevant` filter above already
      // culls using rotated extents, so a rotated text overhanging a slide edge
      // is still drawn (the old unrotated bounds check dropped it).
      renderTextLayer(ctx, layer, sliceStart, scale)
    } else if (layer.type === 'shape') {
      renderShapeLayer(ctx, layer, sliceStart, scale)
    }

    if (freeRot) ctx.restore()
  }

  // Brand logo stamp (issue #64): a post-draw overlay ON TOP of every layer.
  // Drawn in logical (ratio.w × ratio.h) coordinates under the same ctx.scale as
  // everything else, so 1× and 2× exports place and size it identically. Sizing
  // matches the in-editor "Add logo" preset (18% width, 4% margin). The data URL
  // src goes through the shared imgCache, so it decodes once per export run. A
  // failed decode just skips the stamp — never fail the whole export over it.
  if (stampLogo?.src) {
    const logoImg = await loadImage(stampLogo.src, imgCache)
    if (logoImg) {
      const w = ratio.w * 0.18
      const h = w * ((stampLogo.naturalH ?? logoImg.naturalHeight) / (stampLogo.naturalW ?? logoImg.naturalWidth))
      const margin = ratio.w * 0.04
      ctx.drawImage(logoImg, ratio.w - w - margin, ratio.h - h - margin, w, h)
    }
  }

  // PNG is lossless and ignores the quality arg; JPEG honours it.
  return format === 'png'
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', quality)
}

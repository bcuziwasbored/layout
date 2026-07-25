// Curved / arc text (issue #92) — the SINGLE source of truth for arc geometry,
// shared verbatim by the editor (TextCell's Konva Shape sceneFunc in Canvas.jsx)
// and the exporter (renderTextLayer in renderSlide.js).
//
// Both renderers call curvedTextLayout() with the same layer values and then
// drawCurvedGlyphs() with the resulting placements, so a glyph lands on the same
// logical coordinate with the same rotation in both — parity by construction,
// exactly the way drawShapePath is shared for shapes.
//
// ─── ARC CONVENTION ────────────────────────────────────────────────────────────
// `layer.textArc` is the SPAN OF THE ARC IN DEGREES the text is bent around,
// clamped to ±TEXT_ARC_MAX. 0 means straight, and a straight layer never enters
// this module: both renderers keep their existing straight-text code path
// untouched, so textArc 0 stays byte-identical to pre-#92 output.
//
//   • radius R = arcLength / arcAngle, where arcLength is the text's straight
//     advance width INCLUDING letterSpacing (sum of the per-glyph advances plus
//     letterSpacing once per glyph — the same accounting the straight per-glyph
//     letterSpacing path uses) and arcAngle is |textArc| in radians. So the text
//     always spans exactly `textArc` degrees no matter how long it is.
//
//   • The APEX of the arc — the midpoint of the text — sits exactly where the
//     midpoint of the straight single-line baseline would be: horizontally at the
//     box centre (x + w/2, v1 is always centred along the arc, `align` is
//     ignored) and vertically at the straight baseline y for one line under the
//     layer's verticalAlign. The curve therefore grows continuously out of the
//     straight layout — nudging the slider off 0 does not make the text jump.
//
//   • SIGN: POSITIVE textArc puts the circle's centre BELOW the text, so the text
//     rides over the top of the circle and its ENDS FALL AWAY DOWNWARD from the
//     apex (a ∩ / rainbow arch — the "smile" end of the slider). NEGATIVE textArc
//     mirrors it: centre above, ENDS RISE UPWARD (a ∪ cup, the "frown" end).
//     In both cases the apex stays put and only the tails move, and the glyphs
//     always read left-to-right.
//
//   • Glyphs may overflow the layer box (a wide arc is taller than a straight
//     line). That matches the existing behaviour of overflowing straight text —
//     neither renderer clips text — and hit-testing stays on the layer's AABB.
//
// v1 constraints from the issue: SINGLE LINE (wrapping is ignored when curved;
// newlines collapse to spaces) and centred along the arc.

// Beyond this the text would wrap past itself into an unreadable full circle.
export const TEXT_ARC_MAX = 350

// Slider units (−100..100) → arc degrees. Kept here so the UI, the editor and the
// exporter can never disagree about what a slider position means.
export const TEXT_ARC_PER_UNIT = TEXT_ARC_MAX / 100

export function arcFromSlider(value) {
  const v = Number(value) || 0
  return Math.sign(v) * Math.round(Math.abs(v) * TEXT_ARC_PER_UNIT)
}

export function sliderFromArc(arcDeg) {
  const a = normalizeTextArc(arcDeg)
  return Math.sign(a) * Math.round(Math.abs(a) / TEXT_ARC_PER_UNIT)
}

// Clamp + sanitize a layer's textArc. Anything non-finite (or absent) is 0 =
// straight, which is what keeps old projects rendering exactly as before.
export function normalizeTextArc(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return 0
  return Math.max(-TEXT_ARC_MAX, Math.min(TEXT_ARC_MAX, n))
}

// The arc span for a layer, or 0 when it should render as straight text.
export function layerTextArc(layer) {
  return normalizeTextArc(layer?.textArc)
}

// v1 is single-line: newlines collapse to spaces rather than wrapping, so the
// whole string bends along one arc.
export function arcTextLine(raw) {
  return String(raw ?? '').split('\n').join(' ')
}

// Per-glyph placements for a curved text layer.
//
// `ctx` must be a 2D context whose `font` is ALREADY set to the layer's font —
// every measurement (glyph advances and the ascent/descent that positions the
// baseline) comes from it, so the editor and the exporter measure identically.
//
// (ox, oy) is the origin of the layer box in the target context's coordinate
// space: (0, 0) in the editor (TextCell draws inside a Group placed at the
// layer) and (layer.x − sliceStart, layer.y) in the exporter.
//
// Returns [{ ch, tx, ty, rot, dx }] — draw each as
//   save(); translate(tx, ty); rotate(rot); fillText(ch, dx, 0); restore()
// which is exactly what drawCurvedGlyphs below does.
export function curvedTextLayout(ctx, {
  text, ox = 0, oy = 0, w, h,
  fontSize = 72, lineHeight = 1.2, letterSpacing = 0,
  verticalAlign = 'middle', arcDeg,
}) {
  const arc = normalizeTextArc(arcDeg)
  const chars = Array.from(arcTextLine(text))
  if (!arc || !chars.length) return []

  // Advance of each glyph, and the total arc length. letterSpacing is added once
  // per glyph (including after the last one) — the same accounting as
  // measureLineWidth/Konva's _getTextWidth, so a curved line spans the same
  // length of baseline that the straight line would have occupied.
  const advances = chars.map(ch => ctx.measureText(ch).width)
  let arcLength = letterSpacing * chars.length
  for (const a of advances) arcLength += a
  if (!(arcLength > 0)) return []

  const radius = arcLength / (Math.abs(arc) * Math.PI / 180)
  const sign = arc > 0 ? 1 : -1

  // Baseline of the (single) line, identical to the straight renderer's math:
  // each line box is fontSize*lineHeight tall and the alphabetic baseline sits at
  // (ascent-descent)/2 + lineHeight/2 within it.
  const lineHeightPx = lineHeight * fontSize
  const m = ctx.measureText('M')
  const sf = fontSize / 100
  const ascent = m.fontBoundingBoxAscent ?? (91 * sf)
  const descent = m.fontBoundingBoxDescent ?? (21 * sf)
  const translateY = (ascent - descent) / 2 + lineHeightPx / 2
  let alignY = 0
  if (verticalAlign === 'middle') alignY = (h - lineHeightPx) / 2
  else if (verticalAlign === 'bottom') alignY = h - lineHeightPx

  const apexX = ox + w / 2
  const apexY = oy + alignY + translateY

  const out = []
  let dist = 0
  for (let i = 0; i < chars.length; i++) {
    const adv = advances[i]
    // Angle of this glyph's centre, measured from the apex. Using the glyph's own
    // advance (not its letterSpaced slot) keeps the glyph in the same relative
    // position it holds in the straight line, so arc → 0 converges on straight.
    const phi = (dist + adv / 2 - arcLength / 2) / radius
    out.push({
      ch: chars[i],
      tx: apexX + radius * Math.sin(phi),
      ty: apexY + sign * radius * (1 - Math.cos(phi)),
      rot: sign * phi,
      dx: -adv / 2,
    })
    dist += adv + letterSpacing
  }
  return out
}

// Paint the placements. `stroke` draws the outline first so the fill lands on top
// of it — Konva's fillAfterStrokeEnabled=true ordering, matching the straight
// text path. The caller owns font/fillStyle/strokeStyle/lineWidth/lineJoin and
// (where applicable) the shadow, so this is the one and only glyph-emitting loop.
export function drawCurvedGlyphs(ctx, glyphs, { stroke = false } = {}) {
  for (const g of glyphs) {
    ctx.save()
    ctx.translate(g.tx, g.ty)
    ctx.rotate(g.rot)
    if (stroke) ctx.strokeText(g.ch, g.dx, 0)
    ctx.fillText(g.ch, g.dx, 0)
    ctx.restore()
  }
}

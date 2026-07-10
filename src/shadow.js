// Drop-shadow model shared by the editor (Konva), the canvas exporter
// (renderSlide), and the shape/image style panels. Issue #69.
//
// A shadow is a set of plain layer props (shadowEnabled/shadowColor/…) so it
// serializes through save/reload untouched — projectStorage.serializeLayers and
// the history snapshot both spread the layer object verbatim, no allow-list.
//
// ─── PARITY / COORDINATE-SPACE CHOICE ───────────────────────────────────────────
// Both the editor and the exporter cast the shadow with the SAME native canvas2d
// shadow primitive. Konva calls it under the hood (Context._applyShadow) and the
// exporter sets ctx.shadow* directly. Native canvas shadows IGNORE the current
// transformation matrix, which fixes two things by construction:
//
//   • ROTATION: the shadow OFFSET is in SCREEN/output space, axis-aligned — it
//     does NOT rotate with a rotated layer. Konva only multiplies the offset by
//     the node's absolute SCALE (never its rotation), and the exporter draws the
//     offset in output space too, so a rotated shape casts the same screen-space
//     shadow in both. This matches Canva/Figma, where X/Y offset is screen-space.
//
//   • SCALE: blur + offset scale with the OUTPUT resolution. Konva multiplies
//     them by absoluteScale × pixelRatio; the exporter multiplies them by the
//     export `scale`. Feeding identical LOGICAL numbers to both therefore yields
//     a pixel-proportional match at any editor zoom and at 1× or 2× export.
//
// Shaped images (a star photo, etc.) can't get a shape-following shadow from a
// shadow on the clipped group — Konva shadows the clip's bounding box, not its
// outline. So both engines draw a separate shadow-CASTER: the same drawShapePath
// filled with the shadow colour and shadowed, painted UNDER the clipped image.
// The caster's own fill is hidden by the opaque image on top; only its offset,
// shape-following shadow bleeds out. The exporter mirrors this exactly.

export const SHADOW_PROPS = [
  'shadowEnabled', 'shadowColor', 'shadowOpacity',
  'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
]

// A shadow only paints when it's enabled, has non-zero alpha, and has some blur
// or offset (a zero-blur zero-offset shadow is invisible — Konva agrees).
export function hasShadow(layer) {
  return !!layer?.shadowEnabled &&
    (layer.shadowOpacity ?? 1) > 0 &&
    ((layer.shadowBlur ?? 0) > 0 ||
     (layer.shadowOffsetX ?? 0) !== 0 ||
     (layer.shadowOffsetY ?? 0) !== 0)
}

// Combine shadowColor (#rgb / #rrggbb) + shadowOpacity into an rgba() string,
// matching Konva.getShadowRGBA (rgba.a × shadowOpacity). Used by the exporter.
export function shadowRGBA(color = '#000000', opacity = 1) {
  let r = 0, g = 0, b = 0
  const hex = String(color).replace('#', '')
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else if (hex.length >= 6) {
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  }
  return `rgba(${r},${g},${b},${opacity})`
}

// Konva props for a shadowed editor node. Returns { shadowEnabled: false } when
// the layer has no active shadow so the node explicitly casts nothing.
export function konvaShadowProps(layer) {
  if (!hasShadow(layer)) return { shadowEnabled: false }
  return {
    shadowEnabled: true,
    shadowColor: layer.shadowColor ?? '#000000',
    shadowOpacity: layer.shadowOpacity ?? 1,
    shadowBlur: layer.shadowBlur ?? 0,
    shadowOffsetX: layer.shadowOffsetX ?? 0,
    shadowOffsetY: layer.shadowOffsetY ?? 0,
  }
}

// Apply a layer's drop shadow to a 2D context for the exporter. `scale` is the
// export output scale (renderSlide's ctx.scale factor). Native canvas shadows
// ignore the CTM, so we bake the output scale into blur+offset ourselves — this
// is exactly what Konva does with absoluteScale × pixelRatio, so editor==export.
export function applyCanvasShadow(ctx, layer, scale = 1) {
  ctx.shadowColor = shadowRGBA(layer.shadowColor ?? '#000000', layer.shadowOpacity ?? 1)
  ctx.shadowBlur = (layer.shadowBlur ?? 0) * scale
  ctx.shadowOffsetX = (layer.shadowOffsetX ?? 0) * scale
  ctx.shadowOffsetY = (layer.shadowOffsetY ?? 0) * scale
}

export function clearCanvasShadow(ctx) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

// Discrete one-tap looks. Offsets/blur are in logical canvas units (the slide is
// 1080px wide), sized to read well on typical shape/photo layers.
export const SHADOW_PRESETS = [
  { id: 'none',   name: 'None',   adjust: { shadowEnabled: false } },
  { id: 'soft',   name: 'Soft',   adjust: { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 0.30, shadowBlur: 28, shadowOffsetX: 0,  shadowOffsetY: 10 } },
  { id: 'lifted', name: 'Lifted', adjust: { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 0.28, shadowBlur: 48, shadowOffsetX: 0,  shadowOffsetY: 30 } },
  { id: 'hard',   name: 'Hard',   adjust: { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 0.45, shadowBlur: 0,  shadowOffsetX: 16, shadowOffsetY: 16 } },
]

// True when the layer's shadow props equal a preset's — drives the active chip.
export function shadowPresetMatches(layer, preset) {
  const a = preset.adjust
  if (!a.shadowEnabled) return !layer?.shadowEnabled
  if (!layer?.shadowEnabled) return false
  return (layer.shadowColor ?? '#000000') === a.shadowColor &&
    Math.abs((layer.shadowOpacity ?? 1) - a.shadowOpacity) < 0.001 &&
    (layer.shadowBlur ?? 0) === a.shadowBlur &&
    (layer.shadowOffsetX ?? 0) === a.shadowOffsetX &&
    (layer.shadowOffsetY ?? 0) === a.shadowOffsetY
}

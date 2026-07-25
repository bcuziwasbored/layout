// Template CORE — the small, always-needed half of the template system: the
// ratio list, the category tabs, and the pure functions that turn a template
// OBJECT into layers. It deliberately contains NO template data.
//
// The 117 template definitions live in ./templatesData.js and are loaded with a
// dynamic import() by the surfaces that browse or seed from them (issue #87), so
// the app shell, the store and the editor never pull ~60KB of template JSON into
// the initial bundle. Nothing here imports that data — applyTemplate/startProject
// in useStore take a template object as an ARGUMENT, and instantiateTemplate
// below works on whatever object it's handed.

// Category tabs for the template browser. 'all' shows everything; 'grids' is the
// bare photo grids (templates with no explicit category); the rest map to the
// styled-template niches in ./templatesData.js.
export const TEMPLATE_CATEGORIES = [
  { id: 'all',         label: 'All' },
  { id: 'grids',       label: 'Grids' },
  { id: 'quotes',      label: 'Quotes' },
  { id: 'tips',        label: 'Tips' },
  { id: 'promo',       label: 'Promo' },
  { id: 'photo',       label: 'Photo' },
  { id: 'beforeafter', label: 'Before/After' },
  { id: 'announce',    label: 'Launch' },
]

// A template's niche. Bare grids carry no `category`, so they fall under 'grids'.
export function templateCategory(t) {
  return t.category ?? 'grids'
}

// True when a template carries designed content (text/shapes/background) beyond a
// bare photo grid. Drives whether the browser renders a live canvas preview
// (styled) or the cheap div-grid thumbnail (bare grid).
export function isStyledTemplate(t) {
  return !!(t.category || t.textLayers?.length || t.shapeLayers?.length || t.bg)
}

// Resolve a template's background for page `pageIdx` (0-based within the template)
// into a { bgColor } or { bgGradient } patch for that slide, or null if the
// template sets no background for that page. A single `bg` applies to all pages;
// an array indexes per page.
export function templatePageBg(template, pageIdx) {
  const bg = template.bg
  if (!bg) return null
  const entry = Array.isArray(bg) ? bg[pageIdx] : bg
  if (!entry) return null
  if (entry.gradient) return { bgGradient: entry.gradient, bgColor: undefined }
  if (entry.color) return { bgColor: entry.color, bgGradient: undefined }
  return null
}

// Convert a template's fractional definition into concrete global-space layers,
// mirroring the coordinate math applyTemplate/startProject use for grid cells:
// x is offset by `offsetX` (the starting slide's left edge) and scaled by page
// width; y/h by page height; text size/tracking and shape stroke/radius (stored
// as height fractions) by page height. Image cells share one `groupId` so photo
// fill spans every page of a multi-page template; text and shapes are free,
// individually-editable layers. Layer order (back→front): image cells, shapes,
// text. `mkId` mints ids (the store passes its own uid); `placeholderFill`, when
// set, emits image cells as filled gray rects instead of empty image cells (used
// by the browser preview, where renderSlide can't draw a src-less cell).
export function instantiateTemplate(template, ratio, offsetX, mkId, placeholderFill = null) {
  const layers = []
  const gx = f => Math.round(offsetX + f * ratio.w)
  const gy = f => Math.round(f * ratio.h)
  const gw = f => Math.round(f * ratio.w)
  const gh = f => Math.round(f * ratio.h)
  // Optional `rotation` (degrees) on any cell/shape/text maps to the app's
  // freeRotation prop; both app and source pivot about the layer centre, so the
  // mapping is direct. Emitted only when rotated so unrotated layers are unchanged.
  const rot = deg => (deg ? { freeRotation: deg } : {})

  const pushShape = sh => {
    layers.push({
      id: mkId(), type: 'shape', shapeType: sh.shapeType ?? 'rect',
      x: gx(sh.x), y: gy(sh.y), w: gw(sh.w), h: gh(sh.h),
      fill: sh.fill ?? '#000000',
      stroke: sh.stroke ?? null,
      strokeWidth: sh.strokeWidth ? Math.round(sh.strokeWidth * ratio.h) : 0,
      cornerRadius: sh.cornerRadius ? Math.round(sh.cornerRadius * ratio.h) : 0,
      opacity: sh.opacity ?? 1,
      ...rot(sh.rotation),
    })
  }

  // A shape may set `behind: true` to render UNDER the image cells (e.g. a
  // polaroid frame beneath its photo). Back-to-front order: behind shapes, image
  // cells, front shapes, text. Default (no `behind`) keeps shapes in front.
  const shapeLayers = template.shapeLayers ?? []
  for (const sh of shapeLayers) if (sh.behind) pushShape(sh)

  const groupId = mkId()
  for (const cell of template.cells ?? []) {
    // Optional per-cell crop shape (rect/circle/blob/…) and cornerRadius. Unlike
    // shapeLayers (whose radius is a HEIGHT fraction), a cell's cornerRadius is a
    // WIDTH fraction — matching how CropControls stores it on real image layers —
    // so it scales by page width, and shape maps straight onto layer.shape, which
    // the image render path already honours for shaped/rounded crops.
    const shape = cell.shape ?? 'rect'
    const cornerRadius = cell.cornerRadius ? Math.round(cell.cornerRadius * ratio.w) : 0
    if (placeholderFill) {
      layers.push({
        id: mkId(), type: 'shape', shapeType: shape,
        x: gx(cell.x), y: gy(cell.y), w: gw(cell.w), h: gh(cell.h),
        fill: placeholderFill, stroke: null, strokeWidth: 0, cornerRadius, opacity: 1,
        ...rot(cell.rotation),
      })
    } else {
      layers.push({
        id: mkId(), type: 'image', locked: true, groupId, src: null,
        x: gx(cell.x), y: gy(cell.y), w: gw(cell.w), h: gh(cell.h),
        imgX: 0, imgY: 0, imgScale: 1, opacity: 1, naturalW: null, naturalH: null, cellGap: 0,
        ...(shape !== 'rect' ? { shape } : {}),
        ...(cornerRadius ? { cornerRadius } : {}),
        ...rot(cell.rotation),
      })
    }
  }

  for (const sh of shapeLayers) if (!sh.behind) pushShape(sh)

  for (const t of template.textLayers ?? []) {
    layers.push({
      id: mkId(), type: 'text',
      x: gx(t.x), y: gy(t.y), w: gw(t.w), h: gh(t.h),
      text: t.text ?? '',
      fontFamily: t.font ?? 'Inter',
      fontSize: Math.max(1, Math.round((t.size ?? 0.06) * ratio.h)),
      bold: t.bold ?? false,
      italic: t.italic ?? false,
      color: t.color ?? '#000000',
      align: t.align ?? 'center',
      verticalAlign: t.valign ?? 'middle',
      lineHeight: t.lineHeight ?? 1.2,
      letterSpacing: t.tracking ? Math.round(t.tracking * ratio.h) : 0,
      opacity: t.opacity ?? 1,
      ...(t.textBg ? { textBg: t.textBg, textBgOpacity: t.textBgOpacity ?? 1 } : {}),
      ...rot(t.rotation),
    })
  }

  return { layers, groupId }
}

// Distinct font families a template's text layers reference — for preloading the
// web fonts on apply so the styled text renders in its real face immediately.
export function templateFontFamilies(template) {
  const fams = new Set()
  for (const t of template.textLayers ?? []) if (t.font) fams.add(t.font)
  return [...fams]
}

export const RATIOS = [
  { label: 'Portrait', value: '4:5',    w: 1080, h: 1350 },
  { label: 'Portrait', value: '3:4',    w: 1080, h: 1440 },
  { label: 'Square',   value: '1:1',    w: 1080, h: 1080 },
  { label: 'Story',    value: '9:16',   w: 1080, h: 1920 },
  { label: 'Landscape',value: '1.91:1', w: 1080, h: 566  },
]

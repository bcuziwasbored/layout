// Shape path-drawing functions for image crop masks.
// Each function draws a closed path on a Canvas2D-like context (Konva's wrapped
// context works too — same API). Caller is responsible for beginPath() / fill /
// stroke / clip. The `reverse` arg draws the path with reversed winding so it
// can be subtracted from an outer rect via the non-zero fill rule (used for
// the dimmed crop-preview overlay).

function rectPath(ctx, x, y, w, h, cornerRadius = 0) {
  const cr = Math.min(cornerRadius, w / 2, h / 2)
  if (cr <= 0) { ctx.rect(x, y, w, h); return }
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, cr); return }
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y); ctx.arcTo(x + w, y, x + w, y + cr, cr)
  ctx.lineTo(x + w, y + h - cr); ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr)
  ctx.lineTo(x + cr, y + h); ctx.arcTo(x, y + h, x, y + h - cr, cr)
  ctx.lineTo(x, y + cr); ctx.arcTo(x, y, x + cr, y, cr)
  ctx.closePath()
}

function circlePath(ctx, x, y, w, h, reverse = false) {
  const cx = x + w / 2, cy = y + h / 2
  const rx = w / 2,     ry = h / 2
  ctx.moveTo(cx + rx, cy)
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, reverse)
}

function diamondPath(ctx, x, y, w, h, reverse = false) {
  const cx = x + w / 2, cy = y + h / 2
  if (reverse) {
    ctx.moveTo(cx, y)
    ctx.lineTo(x, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x + w, cy)
  } else {
    ctx.moveTo(cx, y)
    ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy)
  }
  ctx.closePath()
}

function starPath(ctx, x, y, w, h, reverse = false) {
  const cx = x + w / 2, cy = y + h / 2
  const outerR = Math.min(w, h) / 2
  const innerR = outerR * 0.4
  const POINTS = 5
  const total = POINTS * 2
  for (let i = 0; i < total; i++) {
    const idx = reverse ? (total - i) % total : i
    const angle = (Math.PI / POINTS) * idx - Math.PI / 2
    const r = idx % 2 === 0 ? outerR : innerR
    const px = cx + Math.cos(angle) * r
    const py = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function heartPath(ctx, x, y, w, h, reverse = false) {
  const cx = x + w / 2
  // 4 bezier segments forming a heart inside the bounding box.
  // Parameters tuned so the heart fills the frame snugly.
  const segs = [
    // [c1x, c1y, c2x, c2y, ex, ey]
    [0.40, 0.05, 0.05, 0.05, 0.05, 0.30], // left top → left bump → left mid
    [0.05, 0.50, 0.25, 0.70, 0.50, 1.00], // left mid → bottom tip
    [0.75, 0.70, 0.95, 0.50, 0.95, 0.30], // bottom tip → right mid
    [0.95, 0.05, 0.60, 0.05, 0.50, 0.25], // right mid → right bump → top dip
  ]
  const startX = cx
  const startY = y + 0.25 * h
  ctx.moveTo(startX, startY)
  const seq = reverse ? [...segs].reverse() : segs
  // For reverse, also swap each segment's control points and end point
  // (each prev segment's end becomes start; control points reverse order)
  let curX = startX, curY = startY
  for (let i = 0; i < seq.length; i++) {
    const [c1x, c1y, c2x, c2y, ex, ey] = seq[i]
    if (reverse) {
      // Find the end point of the next "previous" segment (which becomes our target)
      const prevIdx = (segs.length - 1 - i) - 1
      const prev = prevIdx >= 0 ? segs[prevIdx] : null
      const targetX = prev ? x + prev[4] * w : startX
      const targetY = prev ? y + prev[5] * h : startY
      // Swap control points (drawing the same curve backwards)
      ctx.bezierCurveTo(
        x + c2x * w, y + c2y * h,
        x + c1x * w, y + c1y * h,
        targetX, targetY,
      )
      curX = targetX; curY = targetY
    } else {
      ctx.bezierCurveTo(
        x + c1x * w, y + c1y * h,
        x + c2x * w, y + c2y * h,
        x + ex * w,  y + ey * h,
      )
      curX = x + ex * w; curY = y + ey * h
    }
  }
  ctx.closePath()
}

function blobPath(ctx, x, y, w, h, reverse = false) {
  // Organic blob — 7 fixed anchor points, smoothed with quadratic curves
  // using the midpoint trick (lineTo to midpoint, curve through anchor)
  const pts = [
    { x: 0.50, y: 0.02 },
    { x: 0.92, y: 0.15 },
    { x: 0.95, y: 0.55 },
    { x: 0.72, y: 0.98 },
    { x: 0.25, y: 0.95 },
    { x: 0.05, y: 0.60 },
    { x: 0.10, y: 0.15 },
  ].map(p => ({ x: x + p.x * w, y: y + p.y * h }))
  const seq = reverse ? [...pts].reverse() : pts
  const first = seq[0]
  const last = seq[seq.length - 1]
  ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2)
  for (let i = 0; i < seq.length; i++) {
    const p = seq[i]
    const next = seq[(i + 1) % seq.length]
    const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 }
    ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y)
  }
  ctx.closePath()
}

const PATHS = {
  rect:    rectPath,
  circle:  circlePath,
  diamond: diamondPath,
  star:    starPath,
  heart:   heartPath,
  blob:    blobPath,
}

export function drawShapePath(ctx, x, y, w, h, shape = 'rect', cornerRadius = 0, reverse = false) {
  const fn = PATHS[shape] ?? PATHS.rect
  if (shape === 'rect') return fn(ctx, x, y, w, h, cornerRadius)
  return fn(ctx, x, y, w, h, reverse)
}

// Shapes that look bad on non-square frames — snap to a square when selected.
// Rectangular shapes like rect, diamond, blob look fine on any aspect ratio.
export const SQUARE_SHAPES = new Set(['circle', 'star', 'heart'])

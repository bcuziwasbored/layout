import { useRef, useEffect } from 'react'
import { drawShapePath } from '../shapes'

// Tiny canvas preview of a shape-layer type, drawn with the same drawShapePath
// used by the editor and export — the preview is guaranteed to match what gets
// added. Used by the add-shape grid (AddPanel) and the shape-type picker
// (ShapeStylePanel).
export default function ShapePreview({ type, size = 40, color = 'rgba(255,255,255,0.85)' }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = color
    ctx.beginPath()
    // Slight inset so strokes/points don't clip; rect gets a small corner
    // radius so it reads as the rounded-rect it usually becomes.
    const inset = 2
    drawShapePath(ctx, inset, inset, size - inset * 2, size - inset * 2, type,
      type === 'rect' ? size * 0.12 : 0)
    ctx.fill()
  }, [type, size, color])
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />
}

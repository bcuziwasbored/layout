// Pure ratio-migration math, shared by two callers so there is exactly ONE
// implementation:
//   • useStore.setRatio  — retargets the open project in the editor (#13/#35).
//   • projectStorage.duplicateProjectInFormat — the home-screen
//     "Duplicate in another format" action, run against a duplicated record
//     WITHOUT opening it in the editor (#68).
// Because both go through migrateLayers, a duplicated-and-retargeted project
// lays out identically to changing the ratio inside the editor.

// Cover-fit an image of natural size (naturalW×naturalH) into a cellW×cellH box,
// centered. Returns the layer's imgScale/imgX/imgY. Kept here (rather than in
// useStore) so migrateLayers has no store dependency; useStore re-exports it for
// its many in-editor callers.
export function fitInCell(naturalW, naturalH, cellW, cellH) {
  const scale = Math.max(cellW / naturalW, cellH / naturalH)
  const imgW = naturalW * scale
  const imgH = naturalH * scale
  return {
    imgScale: scale,
    imgX: (cellW - imgW) / 2,
    imgY: (cellH - imgH) / 2,
  }
}

// Migrate every layer from oldRatio to newRatio. Each layer keeps its slide index
// and its intra-slide position/size as fractions of the slide box, re-expressed
// under the new ratio. Text scales proportionally by the height ratio; cell images
// refit to the new cell box (minus gap) so photos still cover their cells. Pure —
// no store access — so it can run against a persisted record's layers off-editor.
// See the extended derivation comment on useStore.setRatio.
export function migrateLayers(layers, oldRatio, newRatio) {
  return (layers ?? []).map(l => {
    // Slide ownership by the layer's left edge under the OLD ratio.
    const si = Math.floor(l.x / oldRatio.w)
    // Intra-slide geometry as fractions of the old slide box.
    const fracX = (l.x - si * oldRatio.w) / oldRatio.w
    const fracY = l.y / oldRatio.h
    const fracW = l.w / oldRatio.w
    const fracH = l.h / oldRatio.h
    // Recreate at the same fractions under the NEW ratio.
    const x = Math.round(si * newRatio.w + fracX * newRatio.w)
    const y = Math.round(fracY * newRatio.h)
    const w = Math.round(fracW * newRatio.w)
    const h = Math.round(fracH * newRatio.h)
    const next = { ...l, x, y, w, h }

    // Scale text proportionally by the height ratio so it keeps relative size.
    if (l.type === 'text' && typeof l.fontSize === 'number') {
      next.fontSize = Math.round(l.fontSize * (newRatio.h / oldRatio.h))
    }

    // Refit cell images to the new cell box (minus gap) so photos still cover
    // their cells. Preserves src/srcOriginal/imgId/naturalW/naturalH.
    if (l.type === 'image' && l.src && l.naturalW && l.naturalH) {
      const gap = l.cellGap ?? 0
      const fit = fitInCell(l.naturalW, l.naturalH, w - gap, h - gap)
      next.imgScale = fit.imgScale
      next.imgX = fit.imgX
      next.imgY = fit.imgY
    }
    return next
  })
}

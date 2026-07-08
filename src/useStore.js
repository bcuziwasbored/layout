import { create } from 'zustand'
import { RATIOS } from './templates'
import { preloadLayerFonts } from './fonts'

const uid = () => Math.random().toString(36).slice(2)

// Layer x coords are in GLOBAL space: slide N occupies x ∈ [N*ratio.w, (N+1)*ratio.w]
// A cross-slide image can have x < N*ratio.w and x+w > N*ratio.w

function layersInSlide(layers, idx, ratio) {
  const start = idx * ratio.w
  const end = (idx + 1) * ratio.w
  return layers.filter(l => l.x < end && l.x + l.w > start)
}

// Width of a layer that lies inside slide `idx`'s column (0 if it doesn't reach it).
function overlapWidth(layer, idx, ratio) {
  const start = idx * ratio.w
  const end = (idx + 1) * ratio.w
  return Math.max(0, Math.min(layer.x + layer.w, end) - Math.max(layer.x, start))
}

// Inclusive range of slide indices a layer overlaps, using the same strict-overlap
// semantics as layersInSlide. `first` may be negative for a layer dragged past the
// left edge; callers that need an ownership index clamp via ownerSlide.
function slideSpan(layer, ratio) {
  const first = Math.floor(layer.x / ratio.w)
  const last = Math.ceil((layer.x + layer.w) / ratio.w) - 1
  return { first, last: Math.max(first, last) }
}

// The slide that OWNS a layer: the one holding the majority of the layer's width
// (ties → leftmost, matching layersInSlide's left-bias). Cross-slide "Width 2×"
// images are exactly 50/50, so the tie makes their left slide the owner. Clamped
// to >= 0 so a layer dragged to x < 0 is owned by slide 0 rather than index -1.
function ownerSlide(layer, ratio) {
  const { first, last } = slideSpan(layer, ratio)
  let best = first
  let bestOverlap = -Infinity
  for (let i = first; i <= last; i++) {
    const overlap = overlapWidth(layer, i, ratio)
    if (overlap > bestOverlap) { bestOverlap = overlap; best = i }
  }
  return Math.max(0, best)
}

function fitInCell(naturalW, naturalH, cellW, cellH) {
  const scale = Math.max(cellW / naturalW, cellH / naturalH)
  const imgW = naturalW * scale
  const imgH = naturalH * scale
  return {
    imgScale: scale,
    imgX: (cellW - imgW) / 2,
    imgY: (cellH - imgH) / 2,
  }
}

// Session-wide registry of imgId → { src, srcOriginal }, where imgId is a stable
// CONTENT id minted whenever a new image enters a layer. Keying by content (not
// layer id) means undo can restore the exact image a snapshot saw even after the
// layer's image was replaced (A → B): each version keeps its own imgId, so the
// snapshot taken before the replace still points at A. Survives layer deletes so
// undoing a "delete layer with image" can restore the image. The strings stored
// here are the same references the layers hold, so this doesn't duplicate data —
// it's just a separate index keyed by content id. Session-only (not persisted).
const imageSrcRegistry = new Map()

export const useStore = create((set, get) => ({
  screen: 'home',
  ratio: RATIOS[0],
  bgColor: '#ffffff',
  bgGradient: null,
  slides: [{ id: uid() }],
  layers: [],           // global coordinate space
  activeSlideIdx: 0,
  activeLayerId: null,
  activeCellId: null,   // sub-selected cell within a locked group (for image pan)
  textEditId: null,     // id of text layer currently being edited
  panel: null,
  elementPanel: null,
  cropMode: false,
  cropAspect: null,   // null = free, number = w/h ratio for constrained crop
  history: [],
  future: [],
  _undoSnap: null,   // pre-gesture snapshot waiting to be committed
  currentProjectId: null,
  projectName: 'Untitled',
  recentColors: [],
  savedAt: 0,
  // 'idle' | 'saving' | 'saved' | 'error' — drives the TopBar save indicator
  saveStatus: 'idle',
  // Monotonic counter bumped by every change that should persist (history
  // pushes, undo/redo, rename, ratio). The autosave effect keys on this so
  // edits that don't push undo history (rename, ratio) still trigger a save.
  dirtyCounter: 0,
  // Monotonic counter bumped whenever a batch of web fonts finishes loading.
  // Konva rasterizes text immediately with whatever font is available, so text
  // drawn before its font arrives stays in the fallback until something forces a
  // redraw. Components that render text subscribe to this so a bump re-renders
  // (and re-rasterizes) them. Fed by the document.fonts 'loadingdone' listener
  // wired via initFontReloader().
  fontsVersion: 0,

  bumpFontsVersion() {
    set(s => ({ fontsVersion: s.fontsVersion + 1 }))
  },

  _snapshot() {
    const s = get()
    // Strip src/srcOriginal from layers to keep snapshots small — data URLs can be
    // 500KB+ each, and a 30-entry history with 15 images would otherwise use ~225MB.
    // The layer keeps its `imgId` (a stable content id), which _restoreSrcs resolves
    // through imageSrcRegistry to reattach the exact image this snapshot saw — even
    // if the layer's image was later replaced. Cells with no image have no imgId.
    const layers = s.layers.map(l => {
      const rest = { ...l }
      delete rest.src
      delete rest.srcOriginal
      return rest
    })
    // `ratio` is captured so undo/redo across a setRatio migration restore the
    // canvas dimensions together with the (fraction-preserved) layer geometry —
    // restoring migrated layers against the wrong ratio would corrupt slide math.
    return JSON.stringify({ slides: s.slides, layers, bgColor: s.bgColor, bgGradient: s.bgGradient, ratio: s.ratio })
  },

  // Reattach image srcs to snapshot-restored layers by resolving each layer's
  // stable imgId through imageSrcRegistry. Because imgId identifies the image
  // CONTENT (not the layer), this restores the exact image the snapshot captured,
  // with the matching crop/fit params also stored in the snapshot. A layer with
  // no imgId, or an imgId the session registry never saw (e.g. project reopened —
  // the registry only spans the session), falls back to src:null.
  _restoreSrcs(parsedLayers) {
    return parsedLayers.map(l => {
      if (!l.imgId) return { ...l, src: null, srcOriginal: null }
      const tracked = imageSrcRegistry.get(l.imgId)
      return tracked?.src
        ? { ...l, src: tracked.src, srcOriginal: tracked.srcOriginal }
        : { ...l, src: null, srcOriginal: null }
    })
  },

  _pushHistory() {
    const snap = get()._snapshot()
    set(s => ({ history: [...s.history.slice(-30), snap], future: [], dirtyCounter: s.dirtyCounter + 1 }))
  },

  // Capture the current state BEFORE a gesture/slider begins
  _captureUndo() {
    set({ _undoSnap: get()._snapshot() })
  },

  // Commit the captured pre-gesture snapshot to history
  _commitUndo() {
    const snap = get()._undoSnap
    if (!snap) return
    set(s => ({ history: [...s.history.slice(-30), snap], future: [], _undoSnap: null, dirtyCounter: s.dirtyCounter + 1 }))
  },

  // Discard a captured snapshot (gesture cancelled or didn't actually move)
  _discardUndo() {
    set({ _undoSnap: null })
  },

  undo() {
    const { history } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    const parsed = JSON.parse(prev)
    set(s => ({
      history: s.history.slice(0, -1),
      future: [s._snapshot(), ...s.future.slice(0, 30)],
      textEditId: null,
      ...parsed,
      // Fall back to the current ratio for snapshots taken before ratio was
      // captured (robustness only — history is in-memory, so this is belt-and-braces).
      ratio: parsed.ratio ?? s.ratio,
      layers: s._restoreSrcs(parsed.layers),
      dirtyCounter: s.dirtyCounter + 1,
    }))
  },

  redo() {
    const { future } = get()
    if (!future.length) return
    const next = future[0]
    const parsed = JSON.parse(next)
    set(s => ({
      future: s.future.slice(1),
      history: [...s.history.slice(-30), s._snapshot()],
      textEditId: null,
      ...parsed,
      ratio: parsed.ratio ?? s.ratio,
      layers: s._restoreSrcs(parsed.layers),
      dirtyCounter: s.dirtyCounter + 1,
    }))
  },

  startProject(ratio, template) {
    const pageSpan = template?.pageSpan ?? 1
    const slides = Array.from({ length: Math.max(1, pageSpan) }, () => ({ id: uid() }))

    let layers = []
    if (template && template.cells.length > 0) {
      const groupId = uid()
      layers = template.cells.map(cell => ({
        id: uid(),
        type: 'image',
        locked: true,
        groupId,
        src: null,
        x: Math.round(cell.x * ratio.w),
        y: Math.round(cell.y * ratio.h),
        w: Math.round(cell.w * ratio.w),
        h: Math.round(cell.h * ratio.h),
        imgX: 0, imgY: 0, imgScale: 1, opacity: 1, naturalW: null, naturalH: null, cellGap: 0,
      }))
    }

    const projectId = Math.random().toString(36).slice(2)
    const projectName = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    set({
      screen: 'editor',
      ratio,
      bgColor: '#ffffff',
      bgGradient: null,
      slides,
      layers,
      activeSlideIdx: 0,
      activeLayerId: null,
      activeCellId: null,
      textEditId: null,
      panel: null,
      elementPanel: null,
      cropMode: false,
      cropAspect: null,
      history: [],
      future: [],
      currentProjectId: projectId,
      projectName,
    })
    // Harmless for fresh templates (image-only), but keeps behaviour uniform if
    // a starting template ever ships with text.
    preloadLayerFonts(layers)
  },

  openProject(savedState) {
    // Layers loaded from disk carry a src but predate imgId (or come from a save
    // written before this field existed). Mint a fresh imgId for every image-
    // bearing layer so the session registry can track it from here on, letting
    // undo/redo restore images edited during this session. imgId is session-scoped
    // for restore purposes; persisting it is harmless but not relied upon.
    const layers = savedState.layers.map(l =>
      l.src && !l.imgId ? { ...l, imgId: uid() } : l
    )
    set({
      screen: 'editor',
      ratio: savedState.ratio,
      bgColor: savedState.bgColor,
      bgGradient: savedState.bgGradient ?? null,
      slides: savedState.slides,
      layers,
      activeSlideIdx: 0,
      activeLayerId: null,
      activeCellId: null,
      textEditId: null,
      panel: null,
      elementPanel: null,
      cropMode: false,
      cropAspect: null,
      history: [],
      future: [],
      _undoSnap: null,
      currentProjectId: savedState.projectId,
      projectName: savedState.projectName,
    })
    // Inject the Google Fonts stylesheets for every family used by this
    // project's text layers. Without this, reopened projects render (and
    // export) in the fallback font until the user opens the font picker.
    preloadLayerFonts(savedState.layers)
  },

  setProjectName(name) {
    set(s => ({ projectName: name, dirtyCounter: s.dirtyCounter + 1 }))
  },

  setPanel(panel) {
    set(s => ({ panel: s.panel === panel ? null : panel, elementPanel: null, cropMode: false }))
  },

  setElementPanel(ep) {
    set(s => ({ elementPanel: s.elementPanel === ep ? null : ep }))
  },

  setActiveSlide(idx) {
    set({ activeSlideIdx: idx, activeLayerId: null, activeCellId: null, panel: null, elementPanel: null, cropMode: false })
  },

  setTextEditId(id) {
    set({ textEditId: id })
  },

  addTextLayer(slideIdx) {
    get()._pushHistory()
    const { ratio, activeSlideIdx } = get()
    const si = slideIdx ?? activeSlideIdx
    const offsetX = si * ratio.w
    const w = Math.round(ratio.w * 0.82)
    const h = Math.round(ratio.h * 0.22)
    const layer = {
      id: uid(),
      type: 'text',
      x: offsetX + Math.round((ratio.w - w) / 2),
      y: Math.round((ratio.h - h) / 2),
      w, h,
      text: '',
      fontFamily: 'Inter',
      fontSize: Math.round(ratio.h * 0.075),
      bold: false,
      italic: false,
      color: '#000000',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.2,
      letterSpacing: 0,
      opacity: 1,
    }
    set(s => ({
      layers: [...s.layers, layer],
      activeLayerId: layer.id,
      textEditId: layer.id,
      panel: null,
      elementPanel: null,
    }))
  },

  addShapeLayer(shapeType = 'rect') {
    get()._pushHistory()
    const { ratio, activeSlideIdx } = get()
    const si = activeSlideIdx
    const w = Math.round(ratio.w * 0.5)
    const h = Math.round(ratio.h * 0.25)
    const layer = {
      id: uid(), type: 'shape', shapeType,
      x: si * ratio.w + Math.round((ratio.w - w) / 2),
      y: Math.round((ratio.h - h) / 2),
      w, h, fill: '#3b82f6', stroke: null, strokeWidth: 0, cornerRadius: 0, opacity: 1,
    }
    set(s => ({ layers: [...s.layers, layer], activeLayerId: layer.id, panel: null, elementPanel: null }))
  },

  setActiveLayer(id) {
    if (!id) {
      set({ activeLayerId: null, activeCellId: null, textEditId: null, panel: null, elementPanel: null, cropMode: false })
      return
    }
    set({ activeLayerId: id, activeCellId: null, textEditId: null, panel: null, elementPanel: null, cropMode: false })
  },

  setActiveCellId(id) {
    set({ activeCellId: id })
  },

  setCropMode(on) {
    set({ cropMode: on, cropAspect: null, panel: null, elementPanel: null })
  },

  setCropAspect(aspect) {
    set({ cropAspect: aspect })
  },

  setBgColor(color) {
    get()._pushHistory()
    set({ bgColor: color })
  },

  setSlideBgColor(idx, color) {
    get()._pushHistory()
    set(s => ({ slides: s.slides.map((sl, i) => i === idx ? { ...sl, bgColor: color } : sl) }))
  },

  // Live (no-history) variants for continuous scrubbing of the color picker /
  // gradient controls. Pair with _captureUndo on interaction start and
  // _commitUndo (or _discardUndo if unchanged) on release. See BackgroundPanel.
  setBgColorLive(color) {
    set({ bgColor: color })
  },

  setSlideBgColorLive(idx, color) {
    set(s => ({ slides: s.slides.map((sl, i) => i === idx ? { ...sl, bgColor: color } : sl) }))
  },

  setBgGradientLive(gradient) {
    set({ bgGradient: gradient })
  },

  setSlideBgGradientLive(idx, gradient) {
    set(s => ({ slides: s.slides.map((sl, i) => i === idx ? { ...sl, bgGradient: gradient } : sl) }))
  },

  clearSlideBgColor(idx) {
    get()._pushHistory()
    set(s => ({ slides: s.slides.map((sl, i) => i === idx ? { ...sl, bgColor: undefined } : sl) }))
  },

  setBgGradient(gradient) {
    get()._pushHistory()
    set({ bgGradient: gradient })
  },

  clearBgGradient() {
    get()._pushHistory()
    set({ bgGradient: null })
  },

  setSlideBgGradient(idx, gradient) {
    get()._pushHistory()
    set(s => ({ slides: s.slides.map((sl, i) => i === idx ? { ...sl, bgGradient: gradient } : sl) }))
  },

  clearSlideBgGradient(idx) {
    get()._pushHistory()
    set(s => ({ slides: s.slides.map((sl, i) => { const next = { ...sl }; delete next.bgGradient; return i === idx ? next : sl }) }))
  },

  addRecentColor(color) {
    set(s => ({
      recentColors: [color, ...s.recentColors.filter(c => c !== color)].slice(0, 8)
    }))
  },

  setRatio(newRatio) {
    const oldRatio = get().ratio
    // No-op when the ratio is unchanged — avoids a spurious history entry.
    if (newRatio.value === oldRatio.value) return

    // Push history BEFORE migrating so undo restores the pre-change geometry AND
    // ratio together (see _snapshot / undo). _pushHistory also bumps dirtyCounter.
    get()._pushHistory()

    // Migrate every layer: each keeps its slide index and its intra-slide
    // position/size as fractions of the slide box, re-expressed under the new
    // ratio. Without this, layers keep absolute global coords while slide width
    // changes, so slide N's boundary (N*w) moves and every layer past slide 0
    // lands mid-slide or is reassigned to the wrong slide by floor(x/ratio.w).
    const migrated = get().layers.map(l => {
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

    set(s => ({ ratio: newRatio, layers: migrated, panel: null, dirtyCounter: s.dirtyCounter + 1 }))
  },

  addSlide() {
    get()._pushHistory()
    const slide = { id: uid() }
    set(s => ({ slides: [...s.slides, slide], activeSlideIdx: s.slides.length, panel: null }))
  },

  insertSlide(atIdx) {
    get()._pushHistory()
    const { ratio, slides, layers } = get()
    const newSlide = { id: uid() }
    const newSlides = [...slides]
    newSlides.splice(atIdx, 0, newSlide)
    // Shift layers owned by slides at/after the insertion point; owners are floored
    // at 0 so a layer dragged to x < 0 shifts with slide 0 instead of being skipped.
    // A negative-x result is then clamped into slide 0's range (ownership floor).
    const newLayers = layers.map(l => {
      let nx = ownerSlide(l, ratio) >= atIdx ? l.x + ratio.w : l.x
      if (nx < 0) nx = 0
      return nx === l.x ? l : { ...l, x: nx }
    })
    set({ slides: newSlides, layers: newLayers, activeSlideIdx: atIdx, panel: null })
  },

  moveSlide(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    get()._pushHistory()
    const { ratio, slides, layers, activeSlideIdx } = get()
    const newSlides = [...slides]
    const [moved] = newSlides.splice(fromIdx, 1)
    newSlides.splice(toIdx, 0, moved)
    // Ownership decides which layers travel with the moved slide. A layer keeps its
    // intra-slide offset (may still span two slides after the move — acceptable and
    // consistent with the cross-slide model).
    const newLayers = layers.map(l => {
      const si = ownerSlide(l, ratio)
      if (si === fromIdx) return { ...l, x: l.x + (toIdx - fromIdx) * ratio.w }
      if (fromIdx < toIdx && si > fromIdx && si <= toIdx) return { ...l, x: l.x - ratio.w }
      if (fromIdx > toIdx && si >= toIdx && si < fromIdx) return { ...l, x: l.x + ratio.w }
      return l
    })
    let newActive = activeSlideIdx
    if (activeSlideIdx === fromIdx) newActive = toIdx
    else if (fromIdx < toIdx && activeSlideIdx > fromIdx && activeSlideIdx <= toIdx) newActive = activeSlideIdx - 1
    else if (fromIdx > toIdx && activeSlideIdx >= toIdx && activeSlideIdx < fromIdx) newActive = activeSlideIdx + 1
    set({ slides: newSlides, layers: newLayers, activeSlideIdx: newActive })
  },

  duplicateSlide(idx) {
    get()._pushHistory()
    const { ratio, slides, layers } = get()
    const newSlide = { id: uid() }
    const newSlideIdx = idx + 1

    // Shift layers OWNED by the new slot (or later) up by one slide width.
    const shiftedLayers = layers.map(l => {
      if (ownerSlide(l, ratio) >= newSlideIdx) return { ...l, x: l.x + ratio.w }
      return l
    })

    // Copy layers owned by idx into newSlideIdx, remapping each distinct groupId
    // to a fresh id so the duplicated grid(s) don't merge with the original. A
    // spanning layer copies with its intra-slide offset preserved (x + ratio.w).
    const groupIdMap = {}
    const copiedLayers = layers
      .filter(l => ownerSlide(l, ratio) === idx)
      .map(l => {
        const copy = { ...l, id: uid(), x: l.x + ratio.w }
        if (l.groupId != null) {
          if (!groupIdMap[l.groupId]) groupIdMap[l.groupId] = uid()
          copy.groupId = groupIdMap[l.groupId]
        }
        return copy
      })

    const newSlides = [...slides]
    newSlides.splice(newSlideIdx, 0, newSlide)

    set({ slides: newSlides, layers: [...shiftedLayers, ...copiedLayers], activeSlideIdx: newSlideIdx })
  },

  deleteSlide(idx) {
    get()._pushHistory()
    const { ratio, slides, layers, activeSlideIdx } = get()
    const newSlides = slides.filter((_, i) => i !== idx)
    if (!newSlides.length) {
      const fresh = { id: uid() }
      set({ slides: [fresh], layers: [], activeSlideIdx: 0 })
      return
    }
    // Remove a layer only when the MAJORITY of its width sits in the deleted slide
    // (a wholly-contained layer is the full-majority case). A cross-slide "Width 2×"
    // image is exactly 50/50, so it is NOT majority-owned by either slide and is kept
    // — deleting one of its slides must not delete its other half.
    const dl = idx * ratio.w
    const dr = (idx + 1) * ratio.w
    const newLayers = layers
      .filter(l => overlapWidth(l, idx, ratio) <= l.w / 2)
      .map(l => {
        if (l.x + l.w <= dl) return l              // entirely left of the deleted column
        if (l.x >= dr) return { ...l, x: l.x - ratio.w }  // entirely right — shift to close the gap
        // Spans the deleted column: drop the deleted portion and close the gap so no
        // overlap results. The surviving side(s) collapse into a single rectangle.
        const leftKeep = Math.max(0, dl - l.x)
        const rightKeep = Math.max(0, (l.x + l.w) - dr)
        const newX = leftKeep > 0 ? l.x : dl
        return { ...l, x: newX, w: leftKeep + rightKeep }
      })
    set({
      slides: newSlides,
      layers: newLayers,
      activeSlideIdx: Math.min(activeSlideIdx, newSlides.length - 1),
      activeLayerId: null,
    })
  },

  applyTemplate(template) {
    get()._pushHistory()
    const { ratio, activeSlideIdx, layers, slides } = get()
    const offsetX = activeSlideIdx * ratio.w
    const pageSpan = template.pageSpan ?? 1

    // Ensure enough slides exist for this template
    let newSlides = slides
    if (slides.length < activeSlideIdx + pageSpan) {
      newSlides = [...slides]
      while (newSlides.length < activeSlideIdx + pageSpan) newSlides.push({ id: uid() })
    }

    // Remove existing layers from ALL affected slide indices
    const kept = layers.filter(l => {
      const si = Math.floor(l.x / ratio.w)
      return si < activeSlideIdx || si >= activeSlideIdx + pageSpan
    })

    const groupId = uid()
    const newLayers = template.cells.map(cell => ({
      id: uid(),
      type: 'image',
      locked: true,
      groupId,
      src: null,
      x: Math.round(offsetX + cell.x * ratio.w),
      y: Math.round(cell.y * ratio.h),
      w: Math.round(cell.w * ratio.w),
      h: Math.round(cell.h * ratio.h),
      imgX: 0, imgY: 0, imgScale: 1, opacity: 1, naturalW: null, naturalH: null, cellGap: 0,
    }))

    set({ slides: newSlides, layers: [...kept, ...newLayers], panel: null })
  },

  addImageLayer(src, srcOriginal, naturalW, naturalH, imgId, slideIdx) {
    get()._pushHistory()
    const { ratio, activeSlideIdx } = get()
    const si = slideIdx ?? activeSlideIdx
    const offsetX = si * ratio.w
    const { imgScale, imgX, imgY } = fitInCell(naturalW, naturalH, ratio.w, ratio.h)
    const layer = {
      id: uid(), type: 'image', src, srcOriginal: srcOriginal ?? src, imgId: imgId ?? uid(),
      x: offsetX, y: 0, w: ratio.w, h: ratio.h,
      imgX, imgY, imgScale, opacity: 1, naturalW, naturalH,
    }
    set(s => ({ layers: [...s.layers, layer], activeLayerId: layer.id, panel: null }))
  },

  fillCells(processedImages, contextLayerId = null, replaceFilled = false) {
    // Fill cells with pre-processed images [{src, naturalW, naturalH}].
    // Scope: if the context layer belongs to a template group, fills cells across
    // the whole group (all pages of a multi-page template). Otherwise falls back
    // to cells in the active slide.
    // replaceFilled: if true, also replaces already-filled cells (used by "Replace All").
    get()._pushHistory()
    const { ratio, activeSlideIdx, layers } = get()
    const contextLayer = contextLayerId ? layers.find(l => l.id === contextLayerId) : null

    const scopeCells = contextLayer?.groupId
      ? layers.filter(l => l.groupId === contextLayer.groupId)
      : layers.filter(l => Math.floor(l.x / ratio.w) === activeSlideIdx)

    const targetCells = (replaceFilled ? scopeCells : scopeCells.filter(l => !l.src))
      // Row-major (reading order): top-to-bottom, then left-to-right within a row.
      .sort((a, b) => a.y - b.y || a.x - b.x)

    processedImages.forEach(({ src, srcOriginal, naturalW, naturalH, imgId }, i) => {
      if (i >= targetCells.length) return
      const cell = targetCells[i]
      const gap = cell.cellGap ?? 0
      const fit = fitInCell(naturalW, naturalH, cell.w - gap, cell.h - gap)
      // imgId is a stable content id for this imported image; a fresh one is
      // minted per image so undo can distinguish it from whatever the cell held.
      useStore.getState().updateLayer(cell.id, { src, srcOriginal: srcOriginal ?? src, imgId: imgId ?? uid(), naturalW, naturalH, ...fit })
    })
  },

  updateLayer(id, props) {
    set(s => ({
      layers: s.layers.map(l => l.id === id ? { ...l, ...props } : l),
    }))
  },

  updateLayerWithHistory(id, props) {
    get()._pushHistory()
    get().updateLayer(id, props)
  },

  deleteLayer(id) {
    get()._pushHistory()
    set(s => ({
      layers: s.layers.filter(l => l.id !== id),
      activeLayerId: null,
      activeCellId: null,
      textEditId: null,
      elementPanel: null,
      cropMode: false,
    }))
  },

  deleteGroup(groupId) {
    get()._pushHistory()
    set(s => ({
      layers: s.layers.filter(l => l.groupId !== groupId),
      activeLayerId: null,
      activeCellId: null,
      elementPanel: null,
      cropMode: false,
    }))
  },

  duplicateLayer(id) {
    get()._pushHistory()
    set(s => {
      const idx = s.layers.findIndex(l => l.id === id)
      if (idx === -1) return {}
      const src = s.layers[idx]
      // Offset the copy by +20,+20, but clamp it to the source slide's bounds so a
      // layer near the right/bottom edge doesn't spill onto the next slide (x is in
      // global space: slide si occupies [si*ratio.w, (si+1)*ratio.w]).
      const ratio = s.ratio
      const si = Math.floor(src.x / ratio.w)
      const minX = si * ratio.w
      const maxX = (si + 1) * ratio.w - src.w
      const maxY = ratio.h - src.h
      // For a layer wider/taller than the slide, the clamp range is empty; keep the
      // source origin rather than clamping to an inverted range.
      const cx = maxX >= minX ? Math.max(minX, Math.min(maxX, src.x + 20)) : src.x
      const cy = maxY >= 0 ? Math.max(0, Math.min(maxY, src.y + 20)) : src.y
      const copy = { ...src, id: uid(), x: cx, y: cy }
      const next = [...s.layers]
      next.splice(idx + 1, 0, copy)
      return { layers: next }
    })
  },

  reorderLayer(id, direction) {
    get()._pushHistory()
    set(s => {
      const layers = [...s.layers]
      const idx = layers.findIndex(l => l.id === id)
      if (idx === -1) return {}
      // Slide a layer belongs to, by its left edge — matches the floor idiom used
      // elsewhere for slide assignment.
      const ratio = s.ratio
      const slideOf = l => Math.floor(l.x / ratio.w)
      const si = slideOf(layers[idx])
      if (direction === 'front') { const [l] = layers.splice(idx, 1); layers.push(l) }
      else if (direction === 'back') { const [l] = layers.splice(idx, 1); layers.unshift(l) }
      else if (direction === 'forward') {
        // Swap with the next layer ON THE SAME SLIDE. Z-order only matters within a
        // slide's stacking context; layers on other slides can't overlap this one,
        // so skipping past them (a global swap) would appear to do nothing.
        let j = idx + 1
        while (j < layers.length && slideOf(layers[j]) !== si) j++
        if (j < layers.length) [layers[idx], layers[j]] = [layers[j], layers[idx]]
      } else if (direction === 'backward') {
        let j = idx - 1
        while (j >= 0 && slideOf(layers[j]) !== si) j--
        if (j >= 0) [layers[idx], layers[j]] = [layers[j], layers[idx]]
      }
      return { layers }
    })
  },

  goHome() {
    set({ screen: 'home', panel: null, elementPanel: null, cropMode: false })
  },
}))

// Keep imageSrcRegistry in sync with whatever srcs are currently on layers,
// keyed by the layer's stable content id (imgId). Runs on every state change —
// cheap (just iterating layers + Map.set on string refs). The registry never
// evicts entries during a session, so undo/redo can resolve any imgId a snapshot
// captured — including images that were later replaced or whose layer was deleted.
useStore.subscribe(state => {
  for (const l of state.layers) {
    if (l.src && l.imgId) imageSrcRegistry.set(l.imgId, { src: l.src, srcOriginal: l.srcOriginal })
  }
})

export { fitInCell }

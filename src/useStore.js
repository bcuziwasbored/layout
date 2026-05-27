import { create } from 'zustand'
import { RATIOS } from './templates'

const uid = () => Math.random().toString(36).slice(2)

// Layer x coords are in GLOBAL space: slide N occupies x ∈ [N*ratio.w, (N+1)*ratio.w]
// A cross-slide image can have x < N*ratio.w and x+w > N*ratio.w

function layersInSlide(layers, idx, ratio) {
  const start = idx * ratio.w
  const end = (idx + 1) * ratio.w
  return layers.filter(l => l.x < end && l.x + l.w > start)
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

// Session-wide registry of layer-id → { src, srcOriginal }. Survives layer
// deletes so undoing a "delete layer with image" can restore the image. The
// strings stored here are the same references the layers hold, so this doesn't
// duplicate any data — it just keeps a separate index keyed by layer id.
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

  _snapshot() {
    const s = get()
    // Strip src/srcOriginal from layers to keep snapshots small — data URLs can be
    // 500KB+ each, and a 30-entry history with 15 images would otherwise use ~225MB.
    // We mark whether each layer had a src at snapshot time so undo can correctly
    // restore "image was null" vs "image was set" states from the current store.
    const layers = s.layers.map(l => {
      const { src, srcOriginal, ...rest } = l
      return { ...rest, _hadSrc: !!src }
    })
    return JSON.stringify({ slides: s.slides, layers, bgColor: s.bgColor, bgGradient: s.bgGradient })
  },

  // Merge srcs from current store back into snapshot-restored layers.
  // Falls back to imageSrcRegistry for layers that were deleted then undone —
  // those won't be in currentLayers but the registry remembers their src.
  _restoreSrcs(parsedLayers, currentLayers) {
    const srcByLayerId = new Map()
    currentLayers.forEach(l => {
      if (l.src) srcByLayerId.set(l.id, { src: l.src, srcOriginal: l.srcOriginal })
    })
    return parsedLayers.map(l => {
      const { _hadSrc, ...layerData } = l
      if (!_hadSrc) return { ...layerData, src: null }
      const tracked = srcByLayerId.get(l.id) ?? imageSrcRegistry.get(l.id)
      return tracked?.src ? { ...layerData, ...tracked } : { ...layerData, src: null }
    })
  },

  _pushHistory() {
    const snap = get()._snapshot()
    set(s => ({ history: [...s.history.slice(-30), snap], future: [] }))
  },

  // Capture the current state BEFORE a gesture/slider begins
  _captureUndo() {
    set({ _undoSnap: get()._snapshot() })
  },

  // Commit the captured pre-gesture snapshot to history
  _commitUndo() {
    const snap = get()._undoSnap
    if (!snap) return
    set(s => ({ history: [...s.history.slice(-30), snap], future: [], _undoSnap: null }))
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
      layers: s._restoreSrcs(parsed.layers, s.layers),
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
      layers: s._restoreSrcs(parsed.layers, s.layers),
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
  },

  openProject(savedState) {
    set({
      screen: 'editor',
      ratio: savedState.ratio,
      bgColor: savedState.bgColor,
      slides: savedState.slides,
      layers: savedState.layers,
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
  },

  setProjectName(name) {
    set({ projectName: name })
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

  setRatio(ratio) {
    set({ ratio, panel: null })
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
    const newLayers = layers.map(l => {
      const si = Math.floor(l.x / ratio.w)
      if (si >= atIdx) return { ...l, x: l.x + ratio.w }
      return l
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
    const newLayers = layers.map(l => {
      const si = Math.floor(l.x / ratio.w)
      if (si === fromIdx) return { ...l, x: toIdx * ratio.w + (l.x - fromIdx * ratio.w) }
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
    const offsetX = newSlideIdx * ratio.w

    // Shift all layers after idx up by one slide width
    const shiftedLayers = layers.map(l => {
      const lSlide = Math.floor(l.x / ratio.w)
      if (lSlide >= newSlideIdx) return { ...l, x: l.x + ratio.w }
      return l
    })

    // Copy layers from idx into newSlideIdx
    const srcStart = idx * ratio.w
    const copiedLayers = layers
      .filter(l => Math.floor(l.x / ratio.w) === idx)
      .map(l => ({ ...l, id: uid(), x: l.x + ratio.w }))

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
    // Remove layers in deleted slide, shift layers after it down
    const newLayers = layers
      .filter(l => Math.floor(l.x / ratio.w) !== idx)
      .map(l => {
        const lSlide = Math.floor(l.x / ratio.w)
        if (lSlide > idx) return { ...l, x: l.x - ratio.w }
        return l
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

  addImageLayer(src, srcOriginal, naturalW, naturalH, slideIdx) {
    get()._pushHistory()
    const { ratio, activeSlideIdx } = get()
    const si = slideIdx ?? activeSlideIdx
    const offsetX = si * ratio.w
    const { imgScale, imgX, imgY } = fitInCell(naturalW, naturalH, ratio.w, ratio.h)
    const layer = {
      id: uid(), type: 'image', src, srcOriginal: srcOriginal ?? src,
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
      .sort((a, b) => a.x - b.x || a.y - b.y)

    processedImages.forEach(({ src, srcOriginal, naturalW, naturalH }, i) => {
      if (i >= targetCells.length) return
      const cell = targetCells[i]
      const gap = cell.cellGap ?? 0
      const fit = fitInCell(naturalW, naturalH, cell.w - gap, cell.h - gap)
      useStore.getState().updateLayer(cell.id, { src, srcOriginal: srcOriginal ?? src, naturalW, naturalH, ...fit })
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
      const copy = { ...s.layers[idx], id: uid(), x: s.layers[idx].x + 20, y: s.layers[idx].y + 20 }
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
      if (direction === 'front') { const [l] = layers.splice(idx, 1); layers.push(l) }
      else if (direction === 'back') { const [l] = layers.splice(idx, 1); layers.unshift(l) }
      else if (direction === 'forward' && idx < layers.length - 1) {
        [layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]]
      } else if (direction === 'backward' && idx > 0) {
        [layers[idx], layers[idx - 1]] = [layers[idx - 1], layers[idx]]
      }
      return { layers }
    })
  },

  goHome() {
    set({ screen: 'home', panel: null, elementPanel: null, cropMode: false })
  },
}))

// Keep imageSrcRegistry in sync with whatever srcs are currently on layers.
// Runs on every state change — cheap (just iterating layers + Map.set on string
// refs). The registry never evicts entries during a session so undo can restore
// images even for layers that were deleted.
useStore.subscribe(state => {
  for (const l of state.layers) {
    if (l.src) imageSrcRegistry.set(l.id, { src: l.src, srcOriginal: l.srcOriginal })
  }
})

export { fitInCell }

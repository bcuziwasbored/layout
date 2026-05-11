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

export const useStore = create((set, get) => ({
  screen: 'home',
  ratio: RATIOS[0],
  bgColor: '#ffffff',
  slides: [{ id: uid() }],
  layers: [],           // global coordinate space
  activeSlideIdx: 0,
  activeLayerId: null,
  activeCellId: null,   // sub-selected cell within a locked group (for image pan)
  panel: null,
  elementPanel: null,
  cropMode: false,
  cropAspect: null,   // null = free, number = w/h ratio for constrained crop
  history: [],
  future: [],

  _snapshot() {
    const s = get()
    return JSON.stringify({ slides: s.slides, layers: s.layers, bgColor: s.bgColor })
  },

  _pushHistory() {
    const snap = get()._snapshot()
    set(s => ({ history: [...s.history.slice(-30), snap], future: [] }))
  },

  undo() {
    const { history, _snapshot } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    const parsed = JSON.parse(prev)
    set(s => ({
      history: s.history.slice(0, -1),
      future: [s._snapshot(), ...s.future.slice(0, 30)],
      ...parsed,
    }))
  },

  redo() {
    const { future, _snapshot } = get()
    if (!future.length) return
    const next = future[0]
    const parsed = JSON.parse(next)
    set(s => ({
      future: s.future.slice(1),
      history: [...s.history.slice(-30), s._snapshot()],
      ...parsed,
    }))
  },

  startProject(ratio) {
    const firstSlide = { id: uid() }
    set({
      screen: 'editor',
      ratio,
      bgColor: '#ffffff',
      slides: [firstSlide],
      layers: [],
      activeSlideIdx: 0,
      activeLayerId: null,
      activeCellId: null,
      panel: null,
      elementPanel: null,
      cropMode: false,
      cropAspect: null,
      history: [],
      future: [],
    })
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

  setActiveLayer(id) {
    if (!id) {
      set({ activeLayerId: null, activeCellId: null, panel: null, elementPanel: null, cropMode: false })
      return
    }
    set({ activeLayerId: id, activeCellId: null, panel: null, elementPanel: null, cropMode: false })
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

  setRatio(ratio) {
    set({ ratio, panel: null })
  },

  addSlide() {
    get()._pushHistory()
    const slide = { id: uid() }
    set(s => ({ slides: [...s.slides, slide], activeSlideIdx: s.slides.length, panel: null }))
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

  addImageLayer(src, naturalW, naturalH, slideIdx) {
    get()._pushHistory()
    const { ratio, activeSlideIdx } = get()
    const si = slideIdx ?? activeSlideIdx
    const offsetX = si * ratio.w
    const { imgScale, imgX, imgY } = fitInCell(naturalW, naturalH, ratio.w, ratio.h)
    const layer = {
      id: uid(), type: 'image', src,
      x: offsetX, y: 0, w: ratio.w, h: ratio.h,
      imgX, imgY, imgScale, opacity: 1, naturalW, naturalH,
    }
    set(s => ({ layers: [...s.layers, layer], activeLayerId: layer.id, panel: null }))
  },

  fillCells(files) {
    // Fill empty cells in active slide with multiple images
    get()._pushHistory()
    const { ratio, activeSlideIdx, layers } = get()
    const emptyCells = layers
      .filter(l => !l.src && Math.floor(l.x / ratio.w) === activeSlideIdx)
      .sort((a, b) => a.x - b.x || a.y - b.y)

    const updates = {}
    files.forEach((file, i) => {
      if (i >= emptyCells.length) return
      const cell = emptyCells[i]
      const url = URL.createObjectURL(file)
      // We'll update asynchronously as images load; use a helper
      const img = new Image()
      img.onload = () => {
        const gap = cell.cellGap ?? 0
        const fit = fitInCell(img.naturalWidth, img.naturalHeight, cell.w - gap, cell.h - gap)
        useStore.getState().updateLayer(cell.id, {
          src: url, naturalW: img.naturalWidth, naturalH: img.naturalHeight, ...fit,
        })
      }
      img.src = url
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

export { fitInCell }

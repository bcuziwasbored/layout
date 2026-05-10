import { create } from 'zustand'
import { RATIOS } from './templates'

const uid = () => Math.random().toString(36).slice(2)

const makeSlide = () => ({
  id: uid(),
  layers: [],
})

export const useStore = create((set, get) => ({
  // null = home screen, 'editor' = in editor
  screen: 'home',

  ratio: RATIOS[0],
  bgColor: '#ffffff',
  slides: [makeSlide()],
  activeSlideId: null,
  activeLayerId: null,

  // bottom panel: null | 'layers' | 'background' | 'slides' | 'add' | 'ratio'
  panel: null,

  // element panel: null | 'position' | 'crop' | 'style'
  elementPanel: null,

  history: [],
  future: [],

  _snapshot() {
    return JSON.stringify({ slides: get().slides, bgColor: get().bgColor })
  },

  _pushHistory() {
    const snap = get()._snapshot()
    set(s => ({ history: [...s.history.slice(-30), snap], future: [] }))
  },

  undo() {
    const { history, future, _snapshot } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    const current = _snapshot()
    const parsed = JSON.parse(prev)
    set(s => ({
      history: s.history.slice(0, -1),
      future: [current, ...s.future.slice(0, 30)],
      slides: parsed.slides,
      bgColor: parsed.bgColor,
    }))
  },

  redo() {
    const { future, _snapshot } = get()
    if (!future.length) return
    const next = future[0]
    const current = _snapshot()
    const parsed = JSON.parse(next)
    set(s => ({
      future: s.future.slice(1),
      history: [...s.history.slice(-30), current],
      slides: parsed.slides,
      bgColor: parsed.bgColor,
    }))
  },

  startProject(ratio) {
    set({
      ratio,
      bgColor: '#ffffff',
      slides: [makeSlide()],
      activeSlideId: makeSlide().id, // will be overwritten
      activeLayerId: null,
      panel: null,
      elementPanel: null,
      history: [],
      future: [],
    })
    // set activeSlideId to the actual first slide
    set(s => ({ screen: 'editor', activeSlideId: s.slides[0].id }))
  },

  setPanel(panel) {
    set(s => ({ panel: s.panel === panel ? null : panel, elementPanel: null }))
  },

  setElementPanel(ep) {
    set(s => ({ elementPanel: s.elementPanel === ep ? null : ep }))
  },

  setActiveSlide(id) {
    set({ activeSlideId: id, activeLayerId: null, panel: null, elementPanel: null })
  },

  setActiveLayer(id) {
    set({ activeLayerId: id, panel: null, elementPanel: null })
  },

  setBgColor(color) {
    get()._pushHistory()
    set({ bgColor: color })
  },

  addSlide() {
    get()._pushHistory()
    const slide = makeSlide()
    set(s => ({ slides: [...s.slides, slide], activeSlideId: slide.id, panel: null }))
  },

  duplicateSlide(id) {
    get()._pushHistory()
    const slide = get().slides.find(s => s.id === id)
    const copy = { ...slide, id: uid(), layers: slide.layers.map(l => ({ ...l, id: uid() })) }
    set(s => {
      const idx = s.slides.findIndex(sl => sl.id === id)
      const next = [...s.slides]
      next.splice(idx + 1, 0, copy)
      return { slides: next, activeSlideId: copy.id }
    })
  },

  deleteSlide(id) {
    get()._pushHistory()
    set(s => {
      const next = s.slides.filter(sl => sl.id !== id)
      if (!next.length) {
        const fresh = makeSlide()
        return { slides: [fresh], activeSlideId: fresh.id }
      }
      const wasActive = s.activeSlideId === id
      return {
        slides: next,
        activeSlideId: wasActive ? next[0].id : s.activeSlideId,
      }
    })
  },

  moveSlide(fromIdx, toIdx) {
    get()._pushHistory()
    set(s => {
      const next = [...s.slides]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return { slides: next }
    })
  },

  applyTemplate(template) {
    get()._pushHistory()
    const { ratio, activeSlideId } = get()
    const GAP = 6 // px gap between cells in export space
    const layers = template.cells.map(cell => ({
      id: uid(),
      type: 'image',
      src: null,
      x: Math.round(cell.x * ratio.w + (cell.x > 0 ? GAP / 2 : 0)),
      y: Math.round(cell.y * ratio.h + (cell.y > 0 ? GAP / 2 : 0)),
      w: Math.round(cell.w * ratio.w - (cell.x > 0 ? GAP / 2 : 0) - (cell.x + cell.w < 1 ? GAP / 2 : 0)),
      h: Math.round(cell.h * ratio.h - (cell.y > 0 ? GAP / 2 : 0) - (cell.y + cell.h < 1 ? GAP / 2 : 0)),
      imgX: 0,
      imgY: 0,
      imgScale: 1,
      rotation: 0,
      opacity: 1,
    }))
    set(s => ({
      slides: s.slides.map(sl =>
        sl.id === activeSlideId ? { ...sl, layers } : sl
      ),
      panel: null,
    }))
  },

  addImageLayer(src, naturalW, naturalH) {
    get()._pushHistory()
    const { ratio, activeSlideId } = get()
    const layer = {
      id: uid(),
      type: 'image',
      src,
      x: ratio.w * 0.1,
      y: ratio.h * 0.1,
      w: ratio.w * 0.8,
      h: ratio.h * 0.8,
      imgX: 0,
      imgY: 0,
      imgScale: 1,
      rotation: 0,
      opacity: 1,
      naturalW,
      naturalH,
    }
    set(s => ({
      slides: s.slides.map(sl =>
        sl.id === activeSlideId ? { ...sl, layers: [...sl.layers, layer] } : sl
      ),
      activeLayerId: layer.id,
      panel: null,
    }))
  },

  updateLayer(id, props) {
    const { activeSlideId } = get()
    set(s => ({
      slides: s.slides.map(sl =>
        sl.id === activeSlideId
          ? { ...sl, layers: sl.layers.map(l => l.id === id ? { ...l, ...props } : l) }
          : sl
      ),
    }))
  },

  updateLayerWithHistory(id, props) {
    get()._pushHistory()
    get().updateLayer(id, props)
  },

  deleteLayer(id) {
    get()._pushHistory()
    const { activeSlideId } = get()
    set(s => ({
      slides: s.slides.map(sl =>
        sl.id === activeSlideId
          ? { ...sl, layers: sl.layers.filter(l => l.id !== id) }
          : sl
      ),
      activeLayerId: null,
      elementPanel: null,
    }))
  },

  duplicateLayer(id) {
    get()._pushHistory()
    const { activeSlideId } = get()
    set(s => ({
      slides: s.slides.map(sl => {
        if (sl.id !== activeSlideId) return sl
        const idx = sl.layers.findIndex(l => l.id === id)
        const copy = { ...sl.layers[idx], id: uid(), x: sl.layers[idx].x + 20, y: sl.layers[idx].y + 20 }
        const next = [...sl.layers]
        next.splice(idx + 1, 0, copy)
        return { ...sl, layers: next }
      }),
    }))
  },

  reorderLayer(id, direction) {
    get()._pushHistory()
    const { activeSlideId } = get()
    set(s => ({
      slides: s.slides.map(sl => {
        if (sl.id !== activeSlideId) return sl
        const layers = [...sl.layers]
        const idx = layers.findIndex(l => l.id === id)
        if (direction === 'front') { const [l] = layers.splice(idx, 1); layers.push(l) }
        else if (direction === 'back') { const [l] = layers.splice(idx, 1); layers.unshift(l) }
        else if (direction === 'forward' && idx < layers.length - 1) {
          [layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]]
        } else if (direction === 'backward' && idx > 0) {
          [layers[idx], layers[idx - 1]] = [layers[idx - 1], layers[idx]]
        }
        return { ...sl, layers }
      }),
    }))
  },

  setRatio(ratio) {
    set({ ratio, panel: null })
  },

  goHome() {
    set({ screen: 'home', panel: null, elementPanel: null })
  },
}))

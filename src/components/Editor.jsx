import { useRef, useEffect, useState } from 'react'
import { useStore } from '../useStore'
import { CanvasContext } from '../CanvasContext'
import { saveProject } from '../projectStorage'
import TopBar from './TopBar'
import Canvas from './Canvas'
import BottomBar from './BottomBar'
import LayerToolbar from './panels/LayerToolbar'
import AddPanel from './panels/AddPanel'
import SlidesPanel from './panels/SlidesPanel'
import BackgroundPanel from './panels/BackgroundPanel'
import RatioPanel from './panels/RatioPanel'
import CropControls from './panels/CropControls'
import LayersPanel from './panels/LayersPanel'

export default function Editor() {
  const openPickerRef = useRef(null)
  const panel = useStore(s => s.panel)
  const activeLayerId = useStore(s => s.activeLayerId)
  const cropMode = useStore(s => s.cropMode)
  const setPanel = useStore(s => s.setPanel)
  const dirtyCounter = useStore(s => s.dirtyCounter)
  const currentProjectId = useStore(s => s.currentProjectId)
  const layers = useStore(s => s.layers)
  const saveTimerRef = useRef(null)
  const savingRef = useRef(false)

  // Persist the current project immediately, reading fresh state from the store.
  // Guarded so overlapping saves (e.g. a debounce firing while a lifecycle flush
  // is mid-write) can't clobber each other. Stable identity via useRef so the
  // lifecycle listeners below never need to re-bind.
  const saveNowRef = useRef(async () => {
    if (savingRef.current) return
    const state = useStore.getState()
    if (!state.currentProjectId) return
    savingRef.current = true
    useStore.setState({ saveStatus: 'saving' })
    try {
      await saveProject(state.currentProjectId, state.projectName, state)
      useStore.setState({ savedAt: Date.now(), saveStatus: 'saved' })
    } catch (err) {
      console.error('Save failed:', err)
      useStore.setState({ saveStatus: 'error' })
    } finally {
      savingRef.current = false
    }
  })

  // First-use hint: show when there are empty template cells and no layer is selected
  const [hint, setHint] = useState(false)
  const hintShownRef = useRef(false)
  useEffect(() => {
    if (hintShownRef.current) return
    const hasEmptyCells = layers.some(l => !l.src && l.type !== 'text' && l.type !== 'shape')
    if (hasEmptyCells) {
      hintShownRef.current = true
      setHint(true)
      const t = setTimeout(() => setHint(false), 4000)
      return () => clearTimeout(t)
    }
  }, []) // only on mount

  useEffect(() => {
    if (!currentProjectId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    // Show "Saving…" immediately so the user knows their work isn't yet
    // persisted (the 2s debounce is invisible to them).
    useStore.setState({ saveStatus: 'saving' })
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      saveNowRef.current()
    }, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // Keyed on dirtyCounter (not history) so rename/ratio-only changes — which
    // push no undo history — still schedule a save.
  }, [dirtyCounter, currentProjectId])

  // Desktop keyboard shortcuts: Cmd/Ctrl+C copies the selected layer, Cmd/Ctrl+V
  // pastes onto the active slide (issue #48). Guarded so it never hijacks a real
  // text/clipboard interaction: skip while editing a text layer (textEditId) or
  // when focus is in an input/textarea/contenteditable, and let the browser handle
  // the event when there's a live text selection (user is copying actual text).
  useEffect(() => {
    const isEditableTarget = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key !== 'c' && key !== 'v') return
      const s = useStore.getState()
      if (s.screen !== 'editor' || s.textEditId != null || isEditableTarget()) return
      if (key === 'c') {
        // Don't steal a genuine text selection copy.
        if (!window.getSelection?.().isCollapsed) return
        if (!s.activeLayerId) return
        e.preventDefault()
        s.copyLayer(s.activeLayerId)
      } else {
        if (!s.clipboard) return
        e.preventDefault()
        s.pasteLayer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Lifecycle flush: iOS can kill a backgrounded PWA inside the 2s debounce
  // window, silently dropping edits. On pagehide / tab-hidden, cancel the
  // pending debounce and persist immediately (fire-and-forget — a queued IDB
  // transaction survives page teardown).
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      saveNowRef.current()
    }
    const onVisibility = () => { if (document.hidden) flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <CanvasContext.Provider value={openPickerRef}>
      <div className="flex flex-col h-full bg-black overflow-hidden">
        <TopBar />

        <div
          className="flex-1 flex overflow-hidden relative min-h-0"
          onClick={panel ? () => setPanel(null) : undefined}
        >
          <Canvas openPickerRef={openPickerRef} />

          {/* First-use hint banner */}
          {hint && (
            <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none z-30">
              <div className="flex items-center gap-2 bg-black/75 text-white text-sm px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm">
                <span>📷</span>
                <span>Tap any cell to add your photos</span>
              </div>
            </div>
          )}
        </div>

        <div>
          {cropMode && activeLayerId ? (
            <CropControls />
          ) : activeLayerId && !panel ? (
            <LayerToolbar />
          ) : (
            <>
              {panel === 'add' && <AddPanel />}
              {panel === 'slides' && <SlidesPanel />}
              {panel === 'background' && <BackgroundPanel />}
              {panel === 'ratio' && <RatioPanel />}
              {panel === 'layers' && <LayersPanel />}
              <BottomBar />
            </>
          )}
        </div>
      </div>
    </CanvasContext.Provider>
  )
}

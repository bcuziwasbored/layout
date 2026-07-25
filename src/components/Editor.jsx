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
      // one-shot first-use hint; it exists only as a post-mount side effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Desktop keyboard shortcuts (issues #48, #86). One guarded window handler for
  // everything: Cmd/Ctrl+C/V (copy/paste), Cmd/Ctrl+Z + Shift/Ctrl+Y (undo/redo),
  // Cmd/Ctrl+D (duplicate), Delete/Backspace, arrow-key nudge and Escape.
  //
  // The guard is shared by every shortcut so none of them can hijack a real
  // text/clipboard interaction: skip unless we're on the editor screen, skip while
  // editing a text layer (textEditId) or when focus is in an input/textarea/
  // contenteditable (e.g. the caption sheet or the project-name field), and for
  // copy let the browser handle it when there's a live text selection.
  //
  // Touch behaviour is untouched — this only listens for key events.
  useEffect(() => {
    const isEditableTarget = () => {
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }

    // Arrow-key nudge, in GLOBAL layer coordinates (layer.x already includes the
    // slide offset, so a plain add is all that's needed — same space the canvas
    // drag writes). A nudge BURST is ONE history entry: _captureUndo on the first
    // keydown, _commitUndo once the burst ends. The burst ends on ~600ms of arrow
    // idle rather than on key-up, so a run of individual taps coalesces the same
    // way a held key (auto-repeat) does — plus an immediate flush on any other
    // key, on a pointer gesture (which would otherwise overwrite _undoSnap), on
    // window blur and on unmount, so undo never sees an uncommitted burst. The
    // no-op suppression in _commitUndo (issue #14) throws away a burst that didn't
    // actually move anything.
    const NUDGE = {
      ArrowLeft:  [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp:    [0, -1],
      ArrowDown:  [0, 1],
    }
    const NUDGE_IDLE_MS = 600
    let nudging = false
    let nudgeTimer = null
    const endNudge = () => {
      if (nudgeTimer) { clearTimeout(nudgeTimer); nudgeTimer = null }
      if (!nudging) return
      nudging = false
      useStore.getState()._commitUndo()
    }

    const onKeyDown = (e) => {
      const s = useStore.getState()
      if (s.screen !== 'editor' || s.textEditId != null || isEditableTarget()) return
      const key = e.key
      // Any non-arrow key ends the current nudge burst before it runs, so e.g.
      // nudge-then-undo commits the burst first and undo reverts exactly it.
      if (!NUDGE[key]) endNudge()

      // ── Modifier shortcuts ──────────────────────────────────────────────────
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const k = key.toLowerCase()
        if (k === 'c') {
          // Don't steal a genuine text selection copy.
          if (!window.getSelection?.().isCollapsed) return
          if (!s.activeLayerId) return
          e.preventDefault()
          s.copyLayer(s.activeLayerId)
        } else if (k === 'v') {
          if (!s.clipboard) return
          e.preventDefault()
          s.pasteLayer()
        } else if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) s.redo(); else s.undo()
        } else if (k === 'y' && e.ctrlKey && !e.metaKey) {
          // Windows-style redo.
          e.preventDefault()
          s.redo()
        } else if (k === 'd') {
          if (!s.activeLayerId) return
          e.preventDefault()
          s.duplicateLayer(s.activeLayerId)
        }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // ── Delete / Backspace ──────────────────────────────────────────────────
      if (key === 'Delete' || key === 'Backspace') {
        const layer = s.layers.find(l => l.id === s.activeLayerId)
        if (!layer || layer.userLocked) return
        // Template-grid cells are deliberately NOT deletable from the keyboard:
        // deleting one means deleting the whole grid, which issue #46 guards with
        // a confirmation dialog that lives as local state inside LayerToolbar /
        // LayersPanel. Rather than duplicate the dialog or bypass it (a silent
        // deleteGroup would wipe a whole collage on one keypress), the shortcut
        // no-ops here and the user goes through the toolbar's Delete button.
        if (layer.locked || layer.groupId) return
        e.preventDefault()
        s.deleteLayer(layer.id)
        return
      }

      // ── Arrow nudge ─────────────────────────────────────────────────────────
      const delta = NUDGE[key]
      if (delta) {
        const layer = s.layers.find(l => l.id === s.activeLayerId)
        // Locked template cells move with their grid, not on their own; userLocked
        // layers are inert everywhere else too.
        if (!layer || layer.locked || layer.userLocked) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        if (!nudging) { nudging = true; s._captureUndo() }
        s.updateLayer(layer.id, { x: layer.x + delta[0] * step, y: layer.y + delta[1] * step })
        if (nudgeTimer) clearTimeout(nudgeTimer)
        nudgeTimer = setTimeout(endNudge, NUDGE_IDLE_MS)
        return
      }

      // ── Escape: close the innermost thing that's open, else deselect ─────────
      // (textEditId is handled by the text editor itself and already returned above.)
      if (key === 'Escape') {
        if (s.cropMode) { s.setCropMode(false); return }
        if (s.elementPanel) { s.setElementPanel(null); return }
        if (s.panel) { s.setPanel(null); return }
        if (s.activeCellId) { s.setActiveCellId(null); return }
        if (s.activeLayerId) s.setActiveLayer(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', endNudge, true)
    window.addEventListener('blur', endNudge)
    return () => {
      endNudge()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', endNudge, true)
      window.removeEventListener('blur', endNudge)
    }
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

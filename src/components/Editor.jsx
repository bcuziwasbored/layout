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
  const history = useStore(s => s.history)
  const currentProjectId = useStore(s => s.currentProjectId)
  const layers = useStore(s => s.layers)
  const saveTimerRef = useRef(null)

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
    saveTimerRef.current = setTimeout(async () => {
      const state = useStore.getState()
      try {
        await saveProject(state.currentProjectId, state.projectName, state)
        useStore.setState({ savedAt: Date.now(), saveStatus: 'saved' })
      } catch (err) {
        console.error('Save failed:', err)
        useStore.setState({ saveStatus: 'error' })
      }
    }, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [history, currentProjectId])

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

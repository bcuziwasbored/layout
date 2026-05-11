import { useRef, useEffect } from 'react'
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
  const saveTimerRef = useRef(null)

  useEffect(() => {
    if (!currentProjectId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const state = useStore.getState()
      await saveProject(state.currentProjectId, state.projectName, state)
      useStore.setState({ savedAt: Date.now() })
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

import { useRef } from 'react'
import { useStore } from '../useStore'
import { CanvasContext } from '../CanvasContext'
import TopBar from './TopBar'
import Canvas from './Canvas'
import BottomBar from './BottomBar'
import LayerToolbar from './panels/LayerToolbar'
import AddPanel from './panels/AddPanel'
import SlidesPanel from './panels/SlidesPanel'
import BackgroundPanel from './panels/BackgroundPanel'
import RatioPanel from './panels/RatioPanel'

export default function Editor() {
  const openPickerRef = useRef(null)
  const panel = useStore(s => s.panel)
  const activeLayerId = useStore(s => s.activeLayerId)
  const setPanel = useStore(s => s.setPanel)

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
          {activeLayerId && !panel ? (
            <LayerToolbar />
          ) : (
            <>
              {panel === 'add' && <AddPanel />}
              {panel === 'slides' && <SlidesPanel />}
              {panel === 'background' && <BackgroundPanel />}
              {panel === 'ratio' && <RatioPanel />}
              {panel === 'layers' && (
                <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold">Layers</span>
                    <button onClick={() => setPanel(null)} className="text-white/40 text-2xl leading-none">&times;</button>
                  </div>
                  <p className="text-white/40 text-sm">Tap a layer on the canvas to select it.</p>
                </div>
              )}
              <BottomBar />
            </>
          )}
        </div>
      </div>
    </CanvasContext.Provider>
  )
}

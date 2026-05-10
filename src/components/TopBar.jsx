import { useState } from 'react'
import { useStore } from '../useStore'
import ExportScreen from './ExportScreen'
import { IconUndo, IconRedo } from './icons'

export default function TopBar() {
  const goHome = useStore(s => s.goHome)
  const undo = useStore(s => s.undo)
  const redo = useStore(s => s.redo)
  const history = useStore(s => s.history)
  const future = useStore(s => s.future)
  const [exporting, setExporting] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-3 bg-black" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={goHome} className="text-white/60 text-sm active:text-white">
          ‹ Back
        </button>
        <div className="flex gap-4">
          <button
            onClick={undo}
            disabled={!history.length}
            className={`${history.length ? 'text-white/70 active:text-white' : 'text-white/20'}`}
          >
            <IconUndo size={22} />
          </button>
          <button
            onClick={redo}
            disabled={!future.length}
            className={`${future.length ? 'text-white/70 active:text-white' : 'text-white/20'}`}
          >
            <IconRedo size={22} />
          </button>
        </div>
        <button
          onClick={() => setExporting(true)}
          className="bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
        >
          Export
        </button>
      </div>
      {exporting && <ExportScreen onClose={() => setExporting(false)} />}
    </>
  )
}

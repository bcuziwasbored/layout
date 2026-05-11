import { useState, useRef } from 'react'
import { useStore } from '../useStore'
import ExportScreen from './ExportScreen'
import { IconUndo, IconRedo } from './icons'
import { saveProject } from '../projectStorage'

export default function TopBar() {
  const goHome = useStore(s => s.goHome)
  const undo = useStore(s => s.undo)
  const redo = useStore(s => s.redo)
  const history = useStore(s => s.history)
  const future = useStore(s => s.future)
  const projectName = useStore(s => s.projectName)
  const setProjectName = useStore(s => s.setProjectName)
  const currentProjectId = useStore(s => s.currentProjectId)
  const [exporting, setExporting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef(null)

  const handleBackClick = () => {
    if (currentProjectId) {
      const state = useStore.getState()
      saveProject(state.currentProjectId, state.projectName, state)
    }
    goHome()
  }

  const handleNameTap = () => {
    setNameInput(projectName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const handleNameCommit = () => {
    const trimmed = nameInput.trim()
    if (trimmed) setProjectName(trimmed)
    setEditingName(false)
  }

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleNameCommit()
    if (e.key === 'Escape') setEditingName(false)
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-3 bg-black" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={handleBackClick} className="text-white/60 text-sm active:text-white w-14">
          ‹ Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={undo}
            disabled={!history.length}
            className={`${history.length ? 'text-white/70 active:text-white' : 'text-white/20'}`}
          >
            <IconUndo size={22} />
          </button>

          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={handleNameKeyDown}
              className="bg-white/10 text-white text-sm text-center rounded-lg px-2 py-1 outline-none w-28"
              style={{ minWidth: 80 }}
            />
          ) : (
            <button
              onClick={handleNameTap}
              className="text-white/60 text-sm active:text-white/90 px-1 truncate max-w-[100px]"
            >
              {projectName}
            </button>
          )}

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

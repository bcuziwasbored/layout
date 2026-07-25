import { useState, useRef, useEffect } from 'react'
import { useStore } from '../useStore'
import ExportScreen from './ExportScreen'
import CaptionSheet from './CaptionSheet'
import { IconUndo, IconRedo, IconCaption } from './icons'
import { saveProject } from '../projectStorage'

// ─── Save indicator ───────────────────────────────────────────────────────────

function formatRelative(ms) {
  const s = Math.round(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

function SaveIndicator() {
  const saveStatus = useStore(s => s.saveStatus)
  const savedAt    = useStore(s => s.savedAt)

  // Re-render every 10s so relative time stays current
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), 10000)
    return () => clearInterval(t)
  }, [])

  if (saveStatus === 'saving') {
    return <span className="text-[10px] text-white/40 leading-none">Saving…</span>
  }
  if (saveStatus === 'error') {
    return <span className="text-[10px] text-red-400 leading-none">Save failed · tap to retry</span>
  }
  if ((saveStatus === 'saved' || saveStatus === 'idle') && savedAt) {
    // this label IS the current time relative to the last save; the component re-renders
    // on a 1s interval.
    // eslint-disable-next-line react-hooks/purity
    const ago = Date.now() - savedAt
    const label = ago < 5000 ? 'Saved' : `Saved ${formatRelative(ago)}`
    return <span className="text-[10px] text-white/40 leading-none">{label}</span>
  }
  // 'idle' with no prior save — a freshly opened project (already saved on disk) or
  // a brand-new one. Show nothing rather than a misleading "Unsaved"; the indicator
  // switches to "Saving…"/"Saved" as soon as the first autosave runs.
  return null
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

export default function TopBar() {
  const goHome = useStore(s => s.goHome)
  const undo = useStore(s => s.undo)
  const redo = useStore(s => s.redo)
  const history = useStore(s => s.history)
  const future = useStore(s => s.future)
  const projectName = useStore(s => s.projectName)
  const setProjectName = useStore(s => s.setProjectName)
  const currentProjectId = useStore(s => s.currentProjectId)
  const caption = useStore(s => s.caption)
  const saveStatus = useStore(s => s.saveStatus)
  const [exporting, setExporting] = useState(false)
  const [captionOpen, setCaptionOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef(null)

  const handleBackClick = async () => {
    if (currentProjectId) {
      const state = useStore.getState()
      useStore.setState({ saveStatus: 'saving' })
      try {
        await saveProject(state.currentProjectId, state.projectName, state)
        useStore.setState({ savedAt: Date.now(), saveStatus: 'saved' })
      } catch {
        // Save failed — stay in the editor and keep the "Save failed · tap to
        // retry" indicator visible instead of navigating away and silently
        // discarding edits made since the last successful save.
        useStore.setState({ saveStatus: 'error' })
        return
      }
    }
    goHome()
  }

  // Tap the indicator/name area to force a save if last attempt errored
  const handleStatusTap = async () => {
    if (saveStatus !== 'error') return
    const state = useStore.getState()
    useStore.setState({ saveStatus: 'saving' })
    try {
      await saveProject(state.currentProjectId, state.projectName, state)
      useStore.setState({ savedAt: Date.now(), saveStatus: 'saved' })
    } catch {
      useStore.setState({ saveStatus: 'error' })
    }
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

        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={undo}
            disabled={!history.length}
            className={`${history.length ? 'text-white/70 active:text-white' : 'text-white/20'}`}
          >
            <IconUndo size={22} />
          </button>

          <div className="flex flex-col items-center min-w-0" onClick={handleStatusTap}>
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={handleNameCommit}
                onKeyDown={handleNameKeyDown}
                className="bg-white/10 text-white text-sm text-center rounded-lg px-2 py-0.5 outline-none w-28"
                style={{ minWidth: 80 }}
              />
            ) : (
              <button
                onClick={handleNameTap}
                className="text-white/70 text-sm active:text-white/95 px-1 truncate max-w-[140px] leading-tight"
              >
                {projectName}
              </button>
            )}
            <SaveIndicator />
          </div>

          <button
            onClick={redo}
            disabled={!future.length}
            className={`${future.length ? 'text-white/70 active:text-white' : 'text-white/20'}`}
          >
            <IconRedo size={22} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCaptionOpen(true)}
            aria-label="Caption"
            className="relative text-white/60 active:text-white p-1"
          >
            <IconCaption size={22} />
            {caption.trim() && (
              <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>
          <button
            onClick={() => setExporting(true)}
            className="bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            Export
          </button>
        </div>
      </div>
      {captionOpen && <CaptionSheet onClose={() => setCaptionOpen(false)} />}
      {exporting && <ExportScreen onClose={() => setExporting(false)} />}
    </>
  )
}

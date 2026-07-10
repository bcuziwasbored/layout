import { useState, useEffect, useRef } from 'react'
import { useStore } from '../useStore'
import { RATIOS, TEMPLATES, TEMPLATE_CATEGORIES, templateCategory, isStyledTemplate } from '../templates'
import { IconClose } from './icons'
import TemplatePreview from './TemplatePreview'
import {
  listProjects, loadProject, deleteProject, renameProject, duplicateProject,
  exportProject, backupAllProjects, importProjectFile, duplicateProjectInFormat,
} from '../projectStorage'

// ─── File delivery ──────────────────────────────────────────────────────────────
// Same channel logic as ExportScreen: share a File via the OS share sheet when the
// Web Share API can take files (iOS standalone PWA / Android Chrome), otherwise an
// <a download> (desktop / in-browser). Implemented locally per the #68 scope.
async function deliverFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  if (canShare) {
    try { await navigator.share({ files: [file], title: filename }) }
    catch { /* user cancelled or share failed — ignore */ }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const hours = diff / (1000 * 60 * 60)
  if (hours < 24) {
    const h = Math.floor(hours)
    if (h < 1) {
      const m = Math.floor(diff / (1000 * 60))
      if (m < 1) return 'just now'
      return `${m}m ago`
    }
    return `${h}h ago`
  }
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

function ResizeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="10" height="14" rx="1.5" />
      <path d="M15 9h6v12h-8v-4" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

// ─── Template tile (used in picker) ───────────────────────────────────────────

function TemplateTile({ template, ratio, onClick }) {
  const ps = template.pageSpan ?? 1
  const styled = isStyledTemplate(template)
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:opacity-60">
      <div
        className="w-full relative bg-white/8 rounded-xl overflow-hidden border border-white/12"
        style={{ aspectRatio: `${ratio.w * ps} / ${ratio.h}` }}
      >
        {styled ? (
          // Live canvas preview (real fonts/colors/shapes) for styled templates.
          <TemplatePreview template={template} ratio={ratio} />
        ) : (
          <>
            {ps > 1 && Array.from({ length: ps - 1 }, (_, i) => (
              <div key={`pd${i}`} className="absolute top-0 bottom-0 w-px bg-white/30"
                style={{ left: `${(i + 1) * 100 / ps}%` }} />
            ))}
            {template.cells.length === 0 ? (
              <div className="absolute inset-0" />
            ) : (
              template.cells.map((c, i) => (
                <div key={i} className="absolute bg-white/20 border border-white/15"
                  style={{
                    left:   `${c.x * 100 / ps}%`,
                    top:    `${c.y * 100}%`,
                    width:  `${c.w * 100 / ps}%`,
                    height: `${c.h * 100}%`,
                  }} />
              ))
            )}
          </>
        )}
        {ps > 1 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-none">
            ×{ps}
          </div>
        )}
      </div>
      <span className="text-[11px] text-white/50 leading-none">{template.label}</span>
    </button>
  )
}

// ─── Photo cell helper ────────────────────────────────────────────────────────
// Renders an absolutely-positioned photo cell inside a slide preview

function PhotoCell({ x, y, w, h, src, pos = 'center center', gap = 3, total = 1 }) {
  const G = gap
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left:   `calc(${x * 100}% + ${x > 0 ? G / 2 : 0}px)`,
        top:    `calc(${y * 100}% + ${y > 0 ? G / 2 : 0}px)`,
        width:  `calc(${w * 100}% - ${x > 0 ? G / 2 : 0}px - ${x + w < 1 ? G / 2 : 0}px)`,
        height: `calc(${h * 100}% - ${y > 0 ? G / 2 : 0}px - ${y + h < 1 ? G / 2 : 0}px)`,
      }}
    >
      <img
        src={src}
        className="w-full h-full object-cover"
        style={{ objectPosition: pos }}
        draggable={false}
      />
    </div>
  )
}

// ─── Sample carousel previews ─────────────────────────────────────────────────
// Hard-coded layouts using the two sample photos

const B = import.meta.env.BASE_URL + 'samples/'
// Individual photos (short aliases)
// a=yellow Lambo frontal, b=pink Porsche frontal, c=gold BBS wheel
// d=Subaru WRX nose, e=BMW M4 nose, f=driver in Lambo w/ toy car
// g=guy leaning on Lambo, h=blue BMW Z4, i=two white BMWs, j=guy in Lambo cockpit
const P = {
  a: B+'a.jpg', b: B+'b.jpg', c: B+'c.jpg', d: B+'d.jpg', e: B+'e.jpg',
  f: B+'f.jpg', g: B+'g.jpg', h: B+'h.jpg', i: B+'i.jpg', j: B+'j.jpg',
}

const SAMPLE_CAROUSELS = [
  // Carousel A: full bleed Lambo → pink Porsche + BBS wheel side-by-side
  {
    slides: [
      [{ x:0, y:0, w:1, h:1, src:P.a, pos:'center 60%' }],
      [
        { x:0,    y:0, w:0.49, h:1, src:P.b, pos:'center 50%' },
        { x:0.51, y:0, w:0.49, h:1, src:P.c, pos:'center center' },
      ],
    ],
  },
  // Carousel B: Subaru top + two detail cells → full-width twin BMWs
  {
    slides: [
      [
        { x:0,    y:0,    w:1,    h:0.57, src:P.d, pos:'center 40%' },
        { x:0,    y:0.58, w:0.49, h:0.42, src:P.e, pos:'center 50%' },
        { x:0.51, y:0.58, w:0.49, h:0.42, src:P.c, pos:'center center' },
      ],
      [{ x:0, y:0, w:1, h:1, src:P.i, pos:'center 40%' }],
    ],
  },
  // Carousel C: tall portrait + 2 stacked right → cinematic cockpit shot
  {
    slides: [
      [
        { x:0,    y:0,    w:0.49, h:1,    src:P.g, pos:'center 35%' },
        { x:0.51, y:0,    w:0.49, h:0.49, src:P.h, pos:'center 50%' },
        { x:0.51, y:0.51, w:0.49, h:0.49, src:P.j, pos:'center 30%' },
      ],
      [{ x:0, y:0, w:1, h:1, src:P.f, pos:'center 40%' }],
    ],
  },
]

function SampleCarousel({ carousel, slideW, slideH }) {
  const SLIDE_GAP = 5
  const totalW = carousel.slides.length * slideW + (carousel.slides.length - 1) * SLIDE_GAP

  return (
    <div className="shrink-0 flex shadow-2xl" style={{ width: totalW, gap: SLIDE_GAP }}>
      {carousel.slides.map((cells, si) => (
        <div
          key={si}
          className="relative shrink-0 bg-zinc-900 overflow-hidden"
          style={{
            width: slideW,
            height: slideH,
            borderRadius: si === 0 ? '14px 6px 6px 14px' : si === carousel.slides.length - 1 ? '6px 14px 14px 6px' : 6,
          }}
        >
          {cells.map((cell, ci) => (
            <PhotoCell key={ci} {...cell} gap={3} />
          ))}
          {/* pagination dots on first slide */}
          {si === 0 && carousel.slides.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
              {carousel.slides.map((_, di) => (
                <div key={di} className={`rounded-full ${
                  di === 0 ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                }`} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Onboarding hero ──────────────────────────────────────────────────────────

function OnboardingScreen({ onStart, onImportFile }) {
  const SLIDE_W = 136
  const SLIDE_H = 170
  const importRef = useRef(null)

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Top chrome */}
      <div
        className="shrink-0 flex items-center justify-between px-5"
        style={{ paddingTop: 'max(52px, env(safe-area-inset-top))', paddingBottom: 0 }}
      >
        <span className="text-lg font-bold tracking-tight">Layout</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Hero text */}
        <div className="px-5 pt-6 pb-5">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">
            Make carousels that<br />
            <span className="text-white/40">stop the scroll.</span>
          </h1>
          <p className="mt-2 text-sm text-white/45 leading-relaxed">
            Design multi-slide Instagram carousels and photo collages — right from your phone.
          </p>
        </div>

        {/* Carousel examples — horizontally scrollable */}
        <div className="overflow-x-auto flex gap-3 px-5 pb-5 scrollbar-hide">
          {SAMPLE_CAROUSELS.map((c, i) => (
            <SampleCarousel key={i} carousel={c} slideW={SLIDE_W} slideH={SLIDE_H} />
          ))}
        </div>

        {/* Feature pills */}
        <div className="flex gap-2 px-5 pb-6 overflow-x-auto scrollbar-hide">
          {['Grids & collages', 'Multi-slide carousels', 'Text & shapes', 'Export to IG'].map(f => (
            <div key={f} className="shrink-0 text-xs text-white/50 bg-white/8 rounded-full px-3 py-1.5 border border-white/10">
              {f}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-4">
          <button
            onClick={onStart}
            className="w-full bg-white text-black font-semibold text-[15px] py-4 rounded-2xl active:scale-[0.98] transition-transform"
          >
            Start creating
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="w-full text-white/50 text-sm mt-3 py-2 active:text-white/80"
          >
            Have a backup? Import a project file
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".layout,.zip,application/zip"
            onChange={onImportFile}
            className="hidden"
          />
          <p className="text-center text-white/20 text-xs mt-2">Free · No account needed · Works offline</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main home screen ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const startProject = useStore(s => s.startProject)
  const openProject  = useStore(s => s.openProject)

  const [step, setStep]                   = useState(null)
  const [selectedRatio, setSelectedRatio] = useState(null)
  const [templateCat, setTemplateCat]     = useState('all')
  const [projects, setProjects]           = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState(false)

  // Per-card action sheet / dialogs. Each holds the target project (or null).
  const [menuProject, setMenuProject]       = useState(null)  // "…" action sheet
  const [confirmDelete, setConfirmDelete]   = useState(null)  // delete confirmation
  const [renameTarget, setRenameTarget]     = useState(null)  // rename sheet
  const [renameValue, setRenameValue]       = useState('')
  const [errorToast, setErrorToast]         = useState(null)  // transient error banner
  const [infoToast, setInfoToast]           = useState(null)  // transient success banner
  const [globalMenu, setGlobalMenu]         = useState(false) // header overflow (import / back up all)
  const [formatTarget, setFormatTarget]     = useState(null)  // project being duplicated to another ratio
  const [busy, setBusy]                     = useState(null)  // blocking-op label (export / backup / import)
  const importInputRef = useRef(null)

  // Fetch the project list. State updates happen only in async callbacks, so this
  // is safe to call from an effect body without triggering a synchronous cascade.
  const fetchProjects = () => listProjects()
    .then(list => { setProjects(list); setProjectsError(false) })
    .catch(err => { console.error('Failed to list projects', err); setProjectsError(true) })
    .finally(() => setProjectsLoading(false))

  // Retry entry point for the error state — shows the loading skeleton again.
  const retryLoadProjects = () => {
    setProjectsLoading(true)
    setProjectsError(false)
    fetchProjects()
  }

  useEffect(() => { fetchProjects() }, [])

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (!errorToast) return
    const t = setTimeout(() => setErrorToast(null), 3500)
    return () => clearTimeout(t)
  }, [errorToast])

  // Auto-dismiss the success toast.
  useEffect(() => {
    if (!infoToast) return
    const t = setTimeout(() => setInfoToast(null), 3000)
    return () => clearTimeout(t)
  }, [infoToast])

  const handleOpenProject = async (id) => {
    try {
      const savedState = await loadProject(id)
      if (savedState) openProject(savedState)
      else setErrorToast("Couldn't open this project — it may have been deleted.")
    } catch (err) {
      console.error('Failed to load project', err)
      setErrorToast("Couldn't open this project. Please try again.")
    }
  }

  const handleDeleteConfirmed = async () => {
    const target = confirmDelete
    setConfirmDelete(null)
    if (!target) return
    try {
      await deleteProject(target.id)
      setProjects(prev => prev.filter(p => p.id !== target.id))
    } catch (err) {
      console.error('Failed to delete project', err)
      setErrorToast("Couldn't delete this project. Please try again.")
    }
  }

  const startRename = (project) => {
    setMenuProject(null)
    setRenameValue(project.name ?? '')
    setRenameTarget(project)
  }

  const handleRenameSave = async () => {
    const target = renameTarget
    const name = renameValue.trim()
    if (!target || !name) return
    setRenameTarget(null)
    // Optimistically reflect the new name; the card keeps its list position.
    setProjects(prev => prev.map(p => p.id === target.id ? { ...p, name } : p))
    try {
      await renameProject(target.id, name)
    } catch (err) {
      console.error('Failed to rename project', err)
      setErrorToast("Couldn't rename this project. Please try again.")
      fetchProjects()  // resync from IDB on failure
    }
  }

  const handleDuplicate = async (project) => {
    setMenuProject(null)
    try {
      const dup = await duplicateProject(project.id)
      if (dup) setProjects(prev => [dup, ...prev].sort((a, b) => b.updatedAt - a.updatedAt))
    } catch (err) {
      console.error('Failed to duplicate project', err)
      setErrorToast("Couldn't duplicate this project. Please try again.")
    }
  }

  // Export one project to a portable .layout file via the share sheet / download.
  const handleExport = async (project) => {
    setMenuProject(null)
    setBusy('Preparing file…')
    try {
      const { blob, filename } = await exportProject(project.id)
      await deliverFile(blob, filename)
    } catch (err) {
      console.error('Failed to export project', err)
      setErrorToast("Couldn't export this project. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  // Back up every project into one archive.
  const handleBackupAll = async () => {
    setGlobalMenu(false)
    if (!projects.length) { setErrorToast('No projects to back up yet.'); return }
    setBusy('Building backup…')
    try {
      const { blob, filename } = await backupAllProjects()
      await deliverFile(blob, filename)
    } catch (err) {
      console.error('Failed to back up projects', err)
      setErrorToast("Couldn't create a backup. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  // Import a .layout file picked from disk / Files.
  const handleImportPick = () => {
    setGlobalMenu(false)
    importInputRef.current?.click()
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''  // reset so re-picking the same file fires change again
    if (!file) return
    setBusy('Importing…')
    try {
      const buffer = await file.arrayBuffer()
      const created = await importProjectFile(buffer)
      if (created?.length) {
        setProjects(prev => {
          const incoming = new Set(created.map(p => p.id))
          return [...created, ...prev.filter(p => !incoming.has(p.id))]
            .sort((a, b) => b.updatedAt - a.updatedAt)
        })
        setInfoToast(created.length > 1 ? `Imported ${created.length} projects.` : 'Project imported.')
      }
    } catch (err) {
      console.error('Failed to import file', err)
      setErrorToast(err?.message || "Couldn't import this file.")
    } finally {
      setBusy(null)
    }
  }

  // Duplicate a project into a different ratio (Magic-Resize lite).
  const openFormatPicker = (project) => {
    setMenuProject(null)
    setFormatTarget(project)
  }

  const handleFormatRatio = async (r) => {
    const target = formatTarget
    setFormatTarget(null)
    if (!target) return
    setBusy('Resizing…')
    try {
      const dup = await duplicateProjectInFormat(target.id, r)
      if (dup) {
        setProjects(prev => [dup, ...prev].sort((a, b) => b.updatedAt - a.updatedAt))
        setInfoToast(`Created a ${r.value} copy.`)
      }
    } catch (err) {
      console.error('Failed to duplicate in format', err)
      setErrorToast("Couldn't create that copy. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  const handleRatio = (r) => {
    setSelectedRatio(r)
    setStep('template')
  }

  const handleTemplate = (template) => {
    startProject(selectedRatio, template.id === 'blank' ? null : template)
    setStep(null)
    setSelectedRatio(null)
  }

  const handleClose = () => {
    setStep(null)
    setSelectedRatio(null)
  }

  const visibleTemplates = TEMPLATES.filter(t =>
    t.id !== 'blank' && t.id !== 'single' &&
    (templateCat === 'all' || templateCategory(t) === templateCat))
  const singlePageTemplates = visibleTemplates.filter(t => !t.pageSpan || t.pageSpan === 1)
  const multiPageTemplates  = visibleTemplates.filter(t => t.pageSpan && t.pageSpan > 1)

  const isFirstTime = !projectsLoading && !projectsError && projects.length === 0

  if (isFirstTime && step === null) {
    return (
      <>
        <OnboardingScreen onStart={() => setStep('ratio')} onImportFile={handleImportFile} />
        {busy && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80]" role="status" aria-live="polite">
            <div className="bg-[#1c1c1c] rounded-2xl px-6 py-5 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span className="text-sm text-white/80">{busy}</span>
            </div>
          </div>
        )}
        {errorToast && (
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[70] bg-red-500/95 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90%] text-center"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            role="alert"
          >
            {errorToast}
          </div>
        )}
      </>
    )
  }

  // ── Returning user home ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-black text-white overflow-y-auto">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-5 pb-4"
        style={{ paddingTop: 'max(52px, env(safe-area-inset-top))' }}
      >
        <span className="text-lg font-bold tracking-tight">Layout</span>
        <div className="flex items-center gap-2">
          <button
            aria-label="Backup & import"
            onClick={() => setGlobalMenu(true)}
            className="text-white/70 bg-white/8 rounded-xl p-2 active:bg-white/15 active:text-white"
          >
            <DotsIcon />
          </button>
          <button
            onClick={() => setStep('ratio')}
            className="bg-white text-black font-semibold text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform"
          >
            + New
          </button>
        </div>
      </div>

      {/* Hidden file input for importing .layout files */}
      <input
        ref={importInputRef}
        type="file"
        accept=".layout,.zip,application/zip"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Projects */}
      <div className="flex-1 px-5 pb-10">
        {projectsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-white/6 animate-pulse" style={{ aspectRatio: '1/1.25' }} />
            ))}
          </div>
        ) : projectsError ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="text-sm font-semibold text-white">Couldn't load your projects</div>
            <div className="text-[13px] text-white/45 mt-1.5 leading-relaxed">
              Something went wrong reading your saved projects. Your data is still safe.
            </div>
            <button
              onClick={retryLoadProjects}
              className="mt-5 bg-white/10 text-white font-medium text-sm px-5 py-2.5 rounded-xl active:bg-white/15"
            >
              Try again
            </button>
          </div>
        ) : projects.length > 0 ? (
          <>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Recent</div>
            <div className="grid grid-cols-2 gap-3">
              {projects.map(project => (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenProject(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleOpenProject(project.id)
                    }
                  }}
                  className="relative text-left rounded-2xl overflow-hidden bg-white/6 cursor-pointer active:opacity-70 transition-opacity"
                >
                  <div
                    className="w-full bg-zinc-900"
                    style={{ aspectRatio: project.ratio ? `${project.ratio.w} / ${project.ratio.h}` : '1/1' }}
                  >
                    {project.thumbnail ? (
                      <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-white/10" />
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-xs font-medium text-white truncate">{project.name}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{formatRelativeTime(project.updatedAt)}</div>
                  </div>
                  <button
                    aria-label="Project options"
                    onClick={(e) => { e.stopPropagation(); setMenuProject(project) }}
                    className="absolute top-2 right-2 bg-black/60 text-white/70 rounded-full p-1.5 active:text-white"
                  >
                    <DotsIcon />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* ── Step 1: Ratio picker ──────────────────────────────────────────────── */}
      {step === 'ratio' && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={handleClose}>
          <div
            className="w-full bg-[#161616] rounded-t-2xl p-6"
            style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-base font-semibold">Choose Format</span>
              <button onClick={handleClose} className="text-white/40"><IconClose size={18} /></button>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-1 scrollbar-hide">
              {RATIOS.map(r => {
                const previewH = 80
                const previewW = Math.round(previewH * (r.w / r.h))
                return (
                  <button
                    key={r.value}
                    onClick={() => handleRatio(r)}
                    className="flex flex-col items-center gap-2.5 shrink-0 active:opacity-60"
                  >
                    <div className="bg-white rounded-xl shadow-lg" style={{ width: previewW, height: previewH }} />
                    <div className="text-xs text-white/70 font-medium">{r.label}</div>
                    <div className="text-[11px] text-white/35">{r.value}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Template gallery ──────────────────────────────────────────── */}
      {step === 'template' && selectedRatio && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div
            className="flex items-center justify-between px-5 pb-4 shrink-0"
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
          >
            <button onClick={() => setStep('ratio')} className="text-white/60 text-sm active:text-white">
              ‹ Format
            </button>
            <span className="font-semibold text-base">Choose Template</span>
            <button onClick={handleClose} className="text-white/40">
              <IconClose size={18} />
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
            {TEMPLATE_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setTemplateCat(c.id)}
                className={`shrink-0 text-xs px-3.5 py-1.5 rounded-full border transition-colors ${
                  templateCat === c.id
                    ? 'bg-white text-black border-white font-semibold'
                    : 'bg-white/8 text-white/60 border-white/10 active:bg-white/15'}`}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-10">
            {/* Blank option */}
            <button
              onClick={() => handleTemplate({ id: 'blank', label: 'Blank', cells: [] })}
              className="w-full mb-6 flex items-center gap-4 bg-white/6 rounded-2xl px-5 py-4 active:bg-white/12"
            >
              <div
                className="rounded-lg bg-white/10 border border-white/15 shrink-0"
                style={{
                  width: Math.round(52 * selectedRatio.w / selectedRatio.h),
                  height: 52,
                }}
              />
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Blank</div>
                <div className="text-xs text-white/40 mt-0.5">Start from scratch</div>
              </div>
            </button>

            {singlePageTemplates.length > 0 && (
              <>
                <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Single Page</div>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {singlePageTemplates.map(t => (
                    <TemplateTile key={t.id} template={t} ratio={selectedRatio} onClick={() => handleTemplate(t)} />
                  ))}
                </div>
              </>
            )}

            {multiPageTemplates.length > 0 && (
              <>
                <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Multi-Page</div>
                <div className="grid grid-cols-3 gap-3">
                  {multiPageTemplates.map(t => (
                    <TemplateTile key={t.id} template={t} ratio={selectedRatio} onClick={() => handleTemplate(t)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Per-card "…" action sheet ──────────────────────────────────────────── */}
      {menuProject && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={() => setMenuProject(null)}>
          <div
            className="w-full bg-[#161616] rounded-t-2xl p-3"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 pt-1 pb-2 text-xs text-white/40 truncate">{menuProject.name}</div>
            <button
              onClick={() => startRename(menuProject)}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-white active:bg-white/10"
            >
              <PencilIcon /> Rename
            </button>
            <button
              onClick={() => handleDuplicate(menuProject)}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-white active:bg-white/10"
            >
              <CopyIcon /> Duplicate
            </button>
            <button
              onClick={() => openFormatPicker(menuProject)}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-white active:bg-white/10"
            >
              <ResizeIcon /> Duplicate in another format
            </button>
            <button
              onClick={() => handleExport(menuProject)}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-white active:bg-white/10"
            >
              <ShareIcon /> Export file
            </button>
            <button
              onClick={() => { const p = menuProject; setMenuProject(null); setConfirmDelete(p) }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-red-400 active:bg-white/10"
            >
              <TrashIcon /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Rename sheet ───────────────────────────────────────────────────────── */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-[60]" onClick={() => setRenameTarget(null)}>
          <div
            className="w-full bg-[#161616] rounded-t-2xl p-6"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-base font-semibold mb-4">Rename project</div>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSave() }}
              className="w-full bg-white/8 border border-white/12 rounded-xl px-4 py-3 text-white text-[15px] outline-none focus:border-white/30"
              placeholder="Project name"
            />
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setRenameTarget(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium text-sm active:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSave}
                disabled={!renameValue.trim()}
                className="flex-1 py-3 rounded-xl bg-white text-black font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] px-8" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-xs bg-[#1c1c1c] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-white">Delete “{confirmDelete.name}”?</div>
            <div className="text-sm text-white/50 mt-1.5">This can’t be undone.</div>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium text-sm active:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm active:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header overflow: import / back up all ──────────────────────────────── */}
      {globalMenu && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={() => setGlobalMenu(false)}>
          <div
            className="w-full bg-[#161616] rounded-t-2xl p-3"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 pt-1 pb-2 text-xs text-white/40">Backup & transfer</div>
            <button
              onClick={handleImportPick}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-white active:bg-white/10"
            >
              <ImportIcon /> Import project file…
            </button>
            <button
              onClick={handleBackupAll}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-[15px] text-white active:bg-white/10"
            >
              <ArchiveIcon /> Back up all projects
            </button>
          </div>
        </div>
      )}

      {/* ── Duplicate in another format: ratio picker ──────────────────────────── */}
      {formatTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-[60]" onClick={() => setFormatTarget(null)}>
          <div
            className="w-full bg-[#161616] rounded-t-2xl p-6"
            style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-base font-semibold">Duplicate as…</span>
              <button onClick={() => setFormatTarget(null)} className="text-white/40"><IconClose size={18} /></button>
            </div>
            <div className="text-xs text-white/40 mb-5 truncate">
              A resized copy of “{formatTarget.name}” — the original stays untouched.
            </div>
            <div className="flex gap-5 overflow-x-auto pb-1 scrollbar-hide">
              {RATIOS.map(r => {
                const previewH = 80
                const previewW = Math.round(previewH * (r.w / r.h))
                const isCurrent = formatTarget.ratio?.value === r.value
                return (
                  <button
                    key={r.value}
                    onClick={() => handleFormatRatio(r)}
                    className="flex flex-col items-center gap-2.5 shrink-0 active:opacity-60"
                  >
                    <div className="bg-white rounded-xl shadow-lg" style={{ width: previewW, height: previewH }} />
                    <div className="text-xs text-white/70 font-medium">{r.label}</div>
                    <div className="text-[11px] text-white/35">{r.value}{isCurrent ? ' · current' : ''}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Blocking-op overlay (export / backup / import / resize) ─────────────── */}
      {busy && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80]" role="status" aria-live="polite">
          <div className="bg-[#1c1c1c] rounded-2xl px-6 py-5 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <span className="text-sm text-white/80">{busy}</span>
          </div>
        </div>
      )}

      {/* ── Transient success toast ────────────────────────────────────────────── */}
      {infoToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[70] bg-white/95 text-black text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90%] text-center"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          role="status"
        >
          {infoToast}
        </div>
      )}

      {/* ── Transient error toast ──────────────────────────────────────────────── */}
      {errorToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[70] bg-red-500/95 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90%] text-center"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          role="alert"
        >
          {errorToast}
        </div>
      )}
    </div>
  )
}

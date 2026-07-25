import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { useStore } from '../useStore'
import { RATIOS } from '../templates'
import {
  IconClose, IconPlus, IconMoreH, IconImportTray, IconExportTray, IconRename,
  IconDuplicate, IconFormat, IconTrash2, IconBackup, IconEmptyFrames,
  IconAlertTriangle, IconRetry,
} from './icons'
import BrandMark from './home/BrandMark'
import WelcomeHero from './home/WelcomeHero'
import ProjectCard from './home/ProjectCard'
import SearchField from './SearchField'
import {
  listProjects, loadProject, deleteProject, renameProject, duplicateProject,
  duplicateProjectInFormat,
} from '../projectStorage'
import { checkStorageHealth, markNudgeSeen, formatBytes } from '../storageHealth'
import { ShelfFallback, ScreenFallback } from './LazyFallback'

// Both template surfaces pull the 117 template definitions plus the canvas
// preview renderer, so they load on demand (issue #87). The shelf is rendered
// as soon as the project list has content, so its chunk starts fetching right
// away — the ShelfFallback below holds its exact box meanwhile.
const TemplateShelf   = lazy(() => import('./home/TemplateShelf'))
const TemplateBrowser = lazy(() => import('./TemplateBrowser'))

// The .layout archive reader/writer (and fflate with it) is only needed when the
// user actually exports, backs up or imports — a menu action, never boot. It is
// pulled in with a dynamic import at the call sites below.
const archive = () => import('../projectArchive')

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

// Card meta line — "edited 2h ago · 4:5" (mockup frame 02).
function cardMeta(p) {
  const rel = formatRelativeTime(p.updatedAt)
  return p.ratio?.value ? `edited ${rel} · ${p.ratio.value}` : `edited ${rel}`
}

// Project-menu header meta — "4:5 · 3 pages · edited 2h ago" (mockup frame 07).
function sheetMeta(p) {
  const parts = []
  if (p.ratio?.value) parts.push(p.ratio.value)
  if (p.slideCount > 1) parts.push(`${p.slideCount} pages`)
  parts.push(`edited ${formatRelativeTime(p.updatedAt)}`)
  return parts.join(' · ')
}

const RATIO_4x5 = RATIOS.find(r => r.value === '4:5') ?? RATIOS[0]

// ─── Project search & sort (issue #91) ──────────────────────────────────────────
// The controls are a scale affordance, not a fixture: below this many projects
// the grid is scannable on its own and the header stays completely bare.
const CONTROLS_MIN_PROJECTS = 8

const SORTS = [
  { id: 'recent', label: 'Recent', heading: 'Recent' },
  { id: 'name',   label: 'Name',   heading: 'By name' },
  { id: 'ratio',  label: 'Ratio',  heading: 'By format' },
]
const SORT_IDS = new Set(SORTS.map(s => s.id))
const SORT_KEY = 'layout.homeSort'

function readStoredSort() {
  try {
    const stored = localStorage.getItem(SORT_KEY)
    return SORT_IDS.has(stored) ? stored : 'recent'
  } catch { return 'recent' }
}

// Format order follows the ratio picker (portrait → square → story → landscape)
// rather than alphabetical, so "Ratio" reads the same way the format sheet does.
const RATIO_ORDER = new Map(RATIOS.map((r, i) => [r.value, i]))
const ratioRank = p => RATIO_ORDER.get(p.ratio?.value) ?? RATIOS.length

const byRecent = (a, b) => b.updatedAt - a.updatedAt

// Sort comparators. Everything falls back to recency so equal keys keep the
// familiar newest-first order inside their group.
const COMPARATORS = {
  recent: byRecent,
  name: (a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base', numeric: true })
    || byRecent(a, b),
  ratio: (a, b) => ratioRank(a) - ratioRank(b) || byRecent(a, b),
}

// Case-insensitive substring over the project name.
function filterAndSortProjects(projects, query, sort) {
  const needle = query.trim().toLowerCase()
  const matched = needle
    ? projects.filter(p => (p.name ?? '').toLowerCase().includes(needle))
    : projects
  return [...matched].sort(COMPARATORS[sort] ?? byRecent)
}

// Skeleton aspect ratios — a deliberate mix so the shimmer masonry reads like a
// real feed of portrait / square / story cards (mockup frame 05).
const SKELETON_ASPECTS = ['4 / 5', '1 / 1', '9 / 16', '4 / 5']

// ─── Main home screen ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const startProject = useStore(s => s.startProject)
  const openProject  = useStore(s => s.openProject)

  const [step, setStep]                   = useState(null)
  const [selectedRatio, setSelectedRatio] = useState(null)
  const [projects, setProjects]           = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState(false)

  // Project search & sort (issue #91). The query is session-only — a stale filter
  // hiding your projects on next launch would read as data loss — while the sort
  // choice is a preference and persists.
  const [query, setQuery] = useState('')
  const [sort, setSort]   = useState(readStoredSort)
  const chooseSort = (id) => {
    setSort(id)
    try { localStorage.setItem(SORT_KEY, id) } catch { /* private mode — ignore */ }
  }

  // Whether the user has ever gotten past the first-run welcome. Persisted so an
  // empty list from a returning user shows the "no projects yet" state (frame 03),
  // not the first-run welcome (frame 01).
  const [onboarded, setOnboarded] = useState(() => {
    try { return localStorage.getItem('layout.onboarded') === '1' } catch { return false }
  })
  const markOnboarded = () => {
    setOnboarded(true)
    try { localStorage.setItem('layout.onboarded', '1') } catch { /* private mode — ignore */ }
  }

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

  // Storage health banner (#84): { kind: 'pressure' | 'nudge', estimate } or null.
  // Checked once per home-screen mount, after the project list settles (the nudge
  // rule needs the project count). Dismissal is session-local: real pressure is
  // worth re-raising next launch, while the nudge is flagged one-time in
  // localStorage the moment it's shown.
  const [storageBanner, setStorageBanner]   = useState(null)
  const storageChecked = useRef(false)

  // Fetch the project list. State updates happen only in async callbacks, so this
  // is safe to call from an effect body without triggering a synchronous cascade.
  const fetchProjects = () => listProjects()
    .then(list => {
      setProjects(list)
      setProjectsError(false)
      if (list.length > 0) markOnboarded()
    })
    .catch(err => { console.error('Failed to list projects', err); setProjectsError(true) })
    .finally(() => setProjectsLoading(false))

  // Retry entry point for the error state — shows the loading skeleton again.
  const retryLoadProjects = () => {
    setProjectsLoading(true)
    setProjectsError(false)
    fetchProjects()
  }

  useEffect(() => { fetchProjects() }, [])

  // Ask the browser how healthy local storage is, once the list has loaded.
  // checkStorageHealth is fully feature-detected and never rejects — on a browser
  // with partial Storage API support it resolves to no banner at all.
  useEffect(() => {
    if (projectsLoading || projectsError || storageChecked.current) return
    storageChecked.current = true
    checkStorageHealth(projects.length).then(result => {
      if (!result.kind) return
      if (result.kind === 'nudge') markNudgeSeen()
      setStorageBanner(result)
    })
  }, [projectsLoading, projectsError, projects.length])

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
      const { exportProject } = await archive()
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
      const { backupAllProjects } = await archive()
      const { blob, filename } = await backupAllProjects()
      await deliverFile(blob, filename)
    } catch (err) {
      console.error('Failed to back up projects', err)
      setErrorToast("Couldn't create a backup. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  // Storage-banner CTA — the same "Back up all" flow the header menu runs. Once a
  // backup exists the gentle nudge has done its job; a pressure warning stays put
  // because the device is still short on space.
  const handleBannerBackup = async () => {
    const kind = storageBanner?.kind
    await handleBackupAll()
    if (kind === 'nudge') setStorageBanner(null)
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
      const { importProjectFile } = await archive()
      const created = await importProjectFile(buffer)
      if (created?.length) {
        markOnboarded()
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
    markOnboarded()
    startProject(selectedRatio, template.id === 'blank' ? null : template)
    setStep(null)
    setSelectedRatio(null)
  }

  const handleClose = () => {
    setStep(null)
    setSelectedRatio(null)
  }

  // New project from the top gold pill / welcome CTA / empty-state CTA.
  const startNewProject = () => { markOnboarded(); setStep('ratio') }

  // Template-shelf tile → new 4:5 project seeded with that styled template.
  const startFromTemplate = (template) => {
    markOnboarded()
    startProject(RATIO_4x5, template)
  }

  // "See all ›" on the shelf → open the full template picker at 4:5.
  const openTemplatePicker = () => {
    setSelectedRatio(RATIO_4x5)
    setStep('template')
  }

  const showWelcome = !projectsLoading && !projectsError && projects.length === 0 && !onboarded && step === null

  // Search/sort chrome earns its place only once the grid is long enough to get
  // away from you; a handful of projects needs no help being scanned.
  const showListControls = projects.length > CONTROLS_MIN_PROJECTS
  const searching = showListControls && query.trim().length > 0
  const visibleProjects = useMemo(
    () => showListControls
      ? filterAndSortProjects(projects, query, sort)
      : projects,
    [projects, query, sort, showListControls],
  )
  const listHeading = showListControls
    ? (SORTS.find(s => s.id === sort)?.heading ?? 'Recent')
    : 'Recent'

  // Reusable pieces ────────────────────────────────────────────────────────────
  const NewProjectButton = (
    <div className="px-5 pt-4">
      <button
        onClick={startNewProject}
        className="w-full h-[52px] rounded-full bg-[#C6A052] text-[#171205] text-[16px] font-semibold flex items-center justify-center gap-2 active:translate-y-px active:brightness-95 transition"
      >
        <IconPlus size={19} /> New project
      </button>
    </div>
  )

  const sectionLabel = 'text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67666C]'

  return (
    <div className="font-inter flex flex-col h-full bg-[#0A0A0B] text-[#F5F4F1] overflow-hidden">
      {/* Hidden file input for header-menu imports */}
      <input
        ref={importInputRef}
        type="file"
        accept=".layout,.zip,application/zip"
        onChange={handleImportFile}
        className="hidden"
      />

      {showWelcome ? (
        <WelcomeHero onStart={startNewProject} onImportFile={handleImportFile} />
      ) : (
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header */}
          <div
            className="shrink-0 flex items-center justify-between px-5"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 2 }}
          >
            <div className="flex items-center gap-[9px]">
              <BrandMark />
              <span className="text-[20px] font-bold tracking-[-0.01em]">Layout</span>
            </div>
            <button
              aria-label="Backup & import"
              onClick={() => setGlobalMenu(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#9C9BA1] active:bg-[#1C1D22] active:text-[#F5F4F1]"
            >
              <IconMoreH size={22} />
            </button>
          </div>

          {/* Storage health banner (#84) — pressure warning, else one-time nudge */}
          {storageBanner && !projectsLoading && !projectsError && (
            <StorageBanner
              kind={storageBanner.kind}
              estimate={storageBanner.estimate}
              onBackup={handleBannerBackup}
              onDismiss={() => setStorageBanner(null)}
            />
          )}

          {/* Body — one of: loading / error / list / empty */}
          {projectsLoading ? (
            <div className="pb-10">
              {NewProjectButton}
              <div className="px-5 pt-[26px]">
                <div className="animate-shimmer" style={{ width: 96, height: 11, borderRadius: 3, marginBottom: 16 }} />
                <div style={{ columnCount: 2, columnGap: 12 }}>
                  {SKELETON_ASPECTS.map((aspect, i) => (
                    <div key={i} className="overflow-hidden"
                      style={{ breakInside: 'avoid', marginBottom: 12, background: '#141518', border: '1px solid #26272C', borderRadius: 16 }}>
                      <div className="animate-shimmer w-full" style={{ aspectRatio: aspect }} />
                      <div style={{ padding: 12 }}>
                        <div className="animate-shimmer" style={{ width: '62%', height: 11, borderRadius: 3 }} />
                        <div className="animate-shimmer" style={{ width: '40%', height: 9, borderRadius: 3, marginTop: 8 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : projectsError ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-10 pb-16">
              <div
                className="flex items-center justify-center mb-6"
                style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(210,86,75,.14)', color: '#DE5A50' }}
              >
                <IconAlertTriangle size={34} />
              </div>
              <div className="text-[22px] font-bold tracking-[-0.01em] text-[#F5F4F1]">Couldn&apos;t load your projects</div>
              <div className="text-[15px] leading-[1.5] text-[#9C9BA1] mt-2.5 max-w-[270px]">
                Something went wrong reading local storage. Your projects are still safe on this device.
              </div>
              <button
                onClick={retryLoadProjects}
                className="mt-[26px] h-[50px] px-[26px] rounded-full border border-[#34353B] bg-[#1C1D22] text-[#F5F4F1] text-[15px] font-semibold flex items-center justify-center gap-[9px] active:bg-[#26272C] transition"
              >
                <IconRetry size={18} /> Try again
              </button>
              <button
                onClick={handleImportPick}
                className="mt-3.5 text-[13px] font-medium text-[#67666C] active:text-[#9C9BA1]"
              >
                Import a project instead
              </button>
            </div>
          ) : projects.length > 0 ? (
            <div className="pb-10">
              {NewProjectButton}
              <Suspense fallback={<ShelfFallback />}>
                <TemplateShelf ratio={RATIO_4x5} onPick={startFromTemplate} onSeeAll={openTemplatePicker} />
              </Suspense>
              <div className="px-5 pt-[26px]">
                <div className="flex items-baseline justify-between gap-3 mb-3.5">
                  <div className={sectionLabel}>{listHeading}</div>
                  {searching && (
                    <span className="text-[11px] font-medium tabular-nums text-[#67666C]">
                      {visibleProjects.length} of {projects.length}
                    </span>
                  )}
                </div>

                {/* Search + sort — only past CONTROLS_MIN_PROJECTS (issue #91) */}
                {showListControls && (
                  <div className="mb-[18px]">
                    <SearchField
                      value={query}
                      onChange={setQuery}
                      variant="home"
                      placeholder="Search projects"
                    />
                    <div className="flex gap-2 mt-2.5 overflow-x-auto scrollbar-hide">
                      {SORTS.map(s => (
                        <button
                          key={s.id}
                          onClick={() => chooseSort(s.id)}
                          aria-pressed={sort === s.id}
                          className={`shrink-0 text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                            sort === s.id
                              ? 'bg-[#C6A052] text-[#171205] border-[#C6A052] font-semibold'
                              : 'bg-transparent text-[#9C9BA1] border-[#2E2F36] active:bg-[#1C1D22]'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {visibleProjects.length === 0 ? (
                  <div className="text-[13px] text-[#67666C] text-center py-12">No matches</div>
                ) : (
                  <div style={{ columnCount: 2, columnGap: 12 }}>
                    {visibleProjects.map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        metaLabel={cardMeta(project)}
                        onOpen={() => handleOpenProject(project.id)}
                        onMenu={() => setMenuProject(project)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-10 pb-16">
              <div
                className="flex items-center justify-center mb-6"
                style={{ width: 76, height: 76, borderRadius: 20, border: '1px solid #2E2F36', background: '#141518', color: '#67666C' }}
              >
                <IconEmptyFrames size={34} />
              </div>
              <div className="text-[22px] font-bold tracking-[-0.01em] text-[#F5F4F1]">No projects yet</div>
              <div className="text-[15px] leading-[1.5] text-[#9C9BA1] mt-2.5 max-w-[262px]">
                Your projects live on this device. Make your first one, or import a backup.
              </div>
              <button
                onClick={startNewProject}
                className="mt-[26px] h-[50px] rounded-full bg-[#C6A052] text-[#171205] text-[15px] font-semibold flex items-center justify-center gap-2 active:translate-y-px active:brightness-95 transition"
                style={{ width: 220 }}
              >
                <IconPlus size={18} /> New project
              </button>
              <button
                onClick={handleImportPick}
                className="mt-3.5 text-[14px] font-semibold text-[#9C9BA1] flex items-center gap-[7px] active:text-[#F5F4F1]"
              >
                <IconImportTray size={18} /> Import a project
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Ratio picker (bottom sheet) ───────────────────────────────── */}
      {step === 'ratio' && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(6,6,8,.6)' }} onClick={handleClose}>
          <div
            className="w-full font-inter"
            style={{ background: '#16171B', borderTop: '1px solid #2E2F36', borderRadius: '24px 24px 0 0', paddingBottom: 'max(30px, env(safe-area-inset-bottom))', boxShadow: '0 -12px 44px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 mb-1.5" style={{ width: 36, height: 4, borderRadius: 2, background: '#34353B' }} />
            <div className="flex items-center justify-between px-6 pt-2 pb-4">
              <span className="text-[18px] font-bold tracking-[-0.01em]">Choose format</span>
              <button onClick={handleClose} className="text-[#9C9BA1] active:text-[#F5F4F1]"><IconClose size={18} /></button>
            </div>
            <div className="flex gap-5 overflow-x-auto px-6 pb-2 scrollbar-hide">
              {RATIOS.map(r => {
                const previewH = 80
                const previewW = Math.round(previewH * (r.w / r.h))
                return (
                  <button
                    key={r.value}
                    onClick={() => handleRatio(r)}
                    className="flex flex-col items-center gap-2.5 shrink-0 active:opacity-60"
                  >
                    <div className="rounded-xl shadow-lg" style={{ width: previewW, height: previewH, background: '#E7E4DD' }} />
                    <div className="text-[13px] font-semibold text-[#C9C8CE]">{r.label}</div>
                    <div className="text-[11px] text-[#67666C]">{r.value}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Template gallery (full screen, lazy — issue #87) ──────────── */}
      {step === 'template' && selectedRatio && (
        <Suspense fallback={<ScreenFallback label="Loading templates…" />}>
          <TemplateBrowser
            ratio={selectedRatio}
            onPick={handleTemplate}
            onBack={() => setStep('ratio')}
            onClose={handleClose}
          />
        </Suspense>
      )}

      {/* ── Per-card "…" action sheet (mockup frame 07) ───────────────────────── */}
      {menuProject && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(6,6,8,.6)' }} onClick={() => setMenuProject(null)}>
          <div
            className="w-full font-inter"
            style={{ background: '#16171B', borderTop: '1px solid #2E2F36', borderRadius: '24px 24px 0 0', padding: '8px 0 0', paddingBottom: 'max(30px, env(safe-area-inset-bottom))', boxShadow: '0 -12px 44px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 mb-1.5" style={{ width: 36, height: 4, borderRadius: 2, background: '#34353B' }} />
            {/* project header */}
            <div className="flex items-center gap-3 px-5" style={{ padding: '12px 20px 14px' }}>
              <div className="shrink-0 overflow-hidden" style={{ width: 40, height: 50, borderRadius: 8, background: 'linear-gradient(160deg,#4A3B2A,#2A2016)' }}>
                {menuProject.thumbnail && <img src={menuProject.thumbnail} className="w-full h-full object-cover" alt="" draggable={false} />}
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[#F5F4F1] truncate">{menuProject.name}</div>
                <div className="text-[12px] font-medium text-[#67666C] mt-0.5">{sheetMeta(menuProject)}</div>
              </div>
            </div>
            <div style={{ height: 1, background: '#26272C', margin: '0 0 6px' }} />

            <MenuRow icon={<IconRename size={20} />} label="Rename" onClick={() => startRename(menuProject)} />
            <MenuRow icon={<IconDuplicate size={20} />} label="Duplicate" onClick={() => handleDuplicate(menuProject)} />
            <MenuRow icon={<IconFormat size={20} />} label="Duplicate in another format" onClick={() => openFormatPicker(menuProject)} />
            <MenuRow icon={<IconExportTray size={20} />} label="Export file" onClick={() => handleExport(menuProject)} />

            <div style={{ height: 1, background: '#26272C', margin: '6px 0' }} />
            <MenuRow
              icon={<IconTrash2 size={20} />} label="Delete" destructive
              onClick={() => { const p = menuProject; setMenuProject(null); setConfirmDelete(p) }}
            />
          </div>
        </div>
      )}

      {/* ── Rename sheet ───────────────────────────────────────────────────────── */}
      {renameTarget && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(6,6,8,.66)' }} onClick={() => setRenameTarget(null)}>
          <div
            className="w-full font-inter"
            style={{ background: '#16171B', borderTop: '1px solid #2E2F36', borderRadius: '24px 24px 0 0', padding: '8px 24px 0', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', boxShadow: '0 -12px 44px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 mb-3" style={{ width: 36, height: 4, borderRadius: 2, background: '#34353B' }} />
            <div className="text-[18px] font-bold tracking-[-0.01em] mb-4">Rename project</div>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSave() }}
              className="w-full rounded-xl px-4 py-3 text-[15px] text-[#F5F4F1] outline-none bg-[#0E0F12] border border-[#2E2F36] focus:border-[#C6A052]"
              placeholder="Project name"
            />
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setRenameTarget(null)}
                className="flex-1 h-[48px] rounded-full border border-[#2E2F36] bg-transparent text-[#F5F4F1] text-[15px] font-semibold active:bg-[#1C1D22] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSave}
                disabled={!renameValue.trim()}
                className="flex-1 h-[48px] rounded-full bg-[#C6A052] text-[#171205] text-[15px] font-semibold active:translate-y-px active:brightness-95 transition disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation (mockup frame 06) ─────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-[34px]" style={{ background: 'rgba(6,6,8,.66)' }} onClick={() => setConfirmDelete(null)}>
          <div
            className="w-full font-inter"
            style={{ maxWidth: 308, background: '#16171B', border: '1px solid #2E2F36', borderRadius: 24, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.55)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[18px] font-bold tracking-[-0.01em] text-[#F5F4F1]">Delete this project?</div>
            <div className="text-[15px] leading-[1.45] text-[#9C9BA1] mt-2.5">
              “{confirmDelete.name}” will be removed from this device. This can&apos;t be undone.
            </div>
            <div className="flex gap-2.5 mt-[22px]">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-[48px] rounded-full border border-[#2E2F36] bg-transparent text-[#F5F4F1] text-[15px] font-semibold active:bg-[#1C1D22] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 h-[48px] rounded-full bg-[#DE5A50] text-white text-[15px] font-semibold active:brightness-95 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header overflow: popover (mockup frame 08) ────────────────────────── */}
      {globalMenu && (
        <div className="fixed inset-0 z-50" style={{ background: 'rgba(6,6,8,.5)' }} onClick={() => setGlobalMenu(false)}>
          <div
            className="absolute font-inter"
            style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 48px)', right: 20, width: 224, background: '#16171B', border: '1px solid #2E2F36', borderRadius: 16, padding: 6, boxShadow: '0 18px 44px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <PopoverRow icon={<IconImportTray size={18} />} label="Import project" onClick={handleImportPick} />
            <PopoverRow icon={<IconBackup size={18} />} label="Back up all" onClick={handleBackupAll} />
          </div>
        </div>
      )}

      {/* ── Duplicate in another format: ratio picker (bottom sheet) ───────────── */}
      {formatTarget && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(6,6,8,.6)' }} onClick={() => setFormatTarget(null)}>
          <div
            className="w-full font-inter"
            style={{ background: '#16171B', borderTop: '1px solid #2E2F36', borderRadius: '24px 24px 0 0', paddingBottom: 'max(30px, env(safe-area-inset-bottom))', boxShadow: '0 -12px 44px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 mb-1.5" style={{ width: 36, height: 4, borderRadius: 2, background: '#34353B' }} />
            <div className="flex items-center justify-between px-6 pt-2 pb-1">
              <span className="text-[18px] font-bold tracking-[-0.01em]">Duplicate as…</span>
              <button onClick={() => setFormatTarget(null)} className="text-[#9C9BA1] active:text-[#F5F4F1]"><IconClose size={18} /></button>
            </div>
            <div className="text-[12px] text-[#67666C] px-6 mb-4 truncate">
              A resized copy of “{formatTarget.name}” — the original stays untouched.
            </div>
            <div className="flex gap-5 overflow-x-auto px-6 pb-2 scrollbar-hide">
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
                    <div className="rounded-xl shadow-lg" style={{ width: previewW, height: previewH, background: '#E7E4DD' }} />
                    <div className="text-[13px] font-semibold text-[#C9C8CE]">{r.label}</div>
                    <div className="text-[11px] text-[#67666C]">{r.value}{isCurrent ? ' · current' : ''}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Blocking-op overlay (export / backup / import / resize) ────────────── */}
      {busy && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(6,6,8,.7)' }} role="status" aria-live="polite">
          <div className="font-inter flex items-center gap-3 rounded-2xl px-6 py-5" style={{ background: '#16171B', border: '1px solid #2E2F36' }}>
            <div className="w-4 h-4 rounded-full border-2 border-white/25 border-t-[#C6A052] animate-spin" />
            <span className="text-[14px] text-[#F5F4F1]">{busy}</span>
          </div>
        </div>
      )}

      {/* ── Transient success toast ────────────────────────────────────────────── */}
      {infoToast && (
        <div
          className="font-inter fixed left-1/2 -translate-x-1/2 bottom-8 z-[70] flex items-center gap-2 text-[14px] font-medium px-4 py-2.5 rounded-full shadow-lg max-w-[90%]"
          style={{ marginBottom: 'env(safe-area-inset-bottom)', background: '#16171B', border: '1px solid #2E2F36', color: '#F5F4F1' }}
          role="status"
        >
          <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6A052' }} />
          {infoToast}
        </div>
      )}

      {/* ── Transient error toast ──────────────────────────────────────────────── */}
      {errorToast && (
        <div
          className="font-inter fixed left-1/2 -translate-x-1/2 bottom-8 z-[70] text-[14px] font-medium px-4 py-2.5 rounded-full shadow-lg max-w-[90%] text-center"
          style={{ marginBottom: 'env(safe-area-inset-bottom)', background: '#DE5A50', color: '#fff' }}
          role="alert"
        >
          {errorToast}
        </div>
      )}
    </div>
  )
}

// ─── Storage health banner (#84) ────────────────────────────────────────────────
// One slot, two priorities. 'pressure' is the loud one: an amber-tinted card in
// the same language as the export screen's missing-photo warning (amber accent,
// never the red error state — nothing has actually failed). 'nudge' is the quiet
// one: the neutral home-screen card with an amber icon, shown at most once ever.
// Both route to the existing "Back up all" action and can be dismissed.
function StorageBanner({ kind, estimate, onBackup, onDismiss }) {
  const pressure = kind === 'pressure'
  const used = estimate ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)} used` : null

  return (
    <div className="px-5 pt-3.5">
      <div
        role="status"
        className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${
          pressure
            ? 'bg-amber-500/12 border border-amber-500/40'
            : 'bg-[#141518] border border-[#26272C]'}`}
      >
        <span className="shrink-0 flex text-amber-400 mt-px" aria-hidden>
          {pressure ? <IconAlertTriangle size={19} /> : <IconBackup size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-semibold ${pressure ? 'text-amber-200' : 'text-[#F5F4F1]'}`}>
            {pressure ? 'Storage is nearly full' : 'Keep a backup of your projects'}
          </div>
          <div className={`text-[12px] leading-[1.45] mt-1 ${pressure ? 'text-amber-200/75' : 'text-[#9C9BA1]'}`}>
            {pressure
              ? <>{used ? `${used} on this device. ` : ''}Back up your projects so nothing is lost if the browser clears space.</>
              : 'Your projects live only on this device, and the browser hasn’t guaranteed their storage. A backup file keeps them safe.'}
          </div>
          <button
            onClick={onBackup}
            className={`mt-2.5 h-8 px-3.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition ${
              pressure
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 active:bg-amber-500/30'
                : 'bg-[#1C1D22] text-[#F5F4F1] border border-[#34353B] active:bg-[#26272C]'}`}
          >
            <IconBackup size={15} /> Back up all
          </button>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className={`shrink-0 w-7 h-7 -mr-1 -mt-0.5 rounded-lg flex items-center justify-center ${
            pressure ? 'text-amber-200/60 active:text-amber-200' : 'text-[#67666C] active:text-[#F5F4F1]'}`}
        >
          <IconClose size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Bottom-sheet row (mockup frame 07) ─────────────────────────────────────────
function MenuRow({ icon, label, onClick, destructive }) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-[52px] flex items-center gap-[14px] px-5 transition-colors ${
        destructive ? 'active:bg-[rgba(210,86,75,.1)]' : 'active:bg-[#1C1D22]'}`}
    >
      <span className={`flex ${destructive ? 'text-[#DE5A50]' : 'text-[#9C9BA1]'}`}>{icon}</span>
      <span className={`text-[16px] font-medium ${destructive ? 'text-[#DE5A50]' : 'text-[#F5F4F1]'}`}>{label}</span>
    </button>
  )
}

// ─── Popover row (mockup frame 08) ──────────────────────────────────────────────
function PopoverRow({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-[44px] flex items-center gap-3 px-3 rounded-[10px] active:bg-[#1C1D22] transition-colors"
    >
      <span className="flex text-[#9C9BA1]">{icon}</span>
      <span className="text-[15px] font-medium text-[#F5F4F1]">{label}</span>
    </button>
  )
}

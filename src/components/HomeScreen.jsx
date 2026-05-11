import { useState, useEffect } from 'react'
import { useStore } from '../useStore'
import { RATIOS, TEMPLATES } from '../templates'
import { IconClose } from './icons'
import { listProjects, loadProject, deleteProject } from '../projectStorage'

// ─── Template tile (used in picker) ───────────────────────────────────────────

function TemplateTile({ template, ratio, onClick }) {
  const ps = template.pageSpan ?? 1
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:opacity-60">
      <div
        className="w-full relative bg-white/8 rounded-xl overflow-hidden border border-white/12"
        style={{ aspectRatio: `${ratio.w * ps} / ${ratio.h}` }}
      >
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

// ─── Onboarding: visual carousel preview ──────────────────────────────────────

// Shows a mini mockup of a multi-slide carousel so users immediately see
// what the app produces.
function CarouselPreview() {
  const SLIDES = [
    // slide 1: big image top, two cells bottom
    [
      { x: 0, y: 0, w: 1, h: 0.6, gradient: 'from-violet-500 to-purple-700' },
      { x: 0, y: 0.62, w: 0.48, h: 0.38, gradient: 'from-rose-400 to-pink-600' },
      { x: 0.52, y: 0.62, w: 0.48, h: 0.38, gradient: 'from-amber-400 to-orange-500' },
    ],
    // slide 2: side-by-side
    [
      { x: 0, y: 0, w: 0.48, h: 1, gradient: 'from-sky-400 to-blue-600' },
      { x: 0.52, y: 0, w: 0.48, h: 1, gradient: 'from-emerald-400 to-teal-600' },
    ],
    // slide 3: full + text overlay
    [
      { x: 0, y: 0, w: 1, h: 1, gradient: 'from-slate-700 to-slate-900' },
      { x: 0.1, y: 0.35, w: 0.8, h: 0.3, gradient: 'from-white/20 to-white/10', text: true },
    ],
  ]

  return (
    <div className="flex gap-2 items-center justify-center w-full px-2">
      {SLIDES.map((cells, si) => (
        <div
          key={si}
          className="relative rounded-xl overflow-hidden shrink-0 shadow-lg"
          style={{
            width: si === 0 ? 130 : 100,
            height: si === 0 ? 162 : 125,
            opacity: si === 0 ? 1 : si === 1 ? 0.75 : 0.45,
            transform: `scale(${si === 0 ? 1 : 0.95}) translateX(${si === 0 ? 0 : si === 1 ? -4 : -12}px)`,
          }}
        >
          <div className="absolute inset-0 bg-gray-800" />
          {cells.map((cell, ci) => (
            <div
              key={ci}
              className={`absolute bg-gradient-to-br ${cell.gradient} ${cell.text ? 'rounded-lg' : ''}`}
              style={{
                left:   `${cell.x * 100}%`,
                top:    `${cell.y * 100}%`,
                width:  `${cell.w * 100}%`,
                height: `${cell.h * 100}%`,
              }}
            >
              {cell.text && (
                <div className="flex flex-col items-center justify-center h-full gap-1 px-2">
                  <div className="w-3/4 h-1.5 bg-white/70 rounded-full" />
                  <div className="w-1/2 h-1 bg-white/40 rounded-full mt-0.5" />
                </div>
              )}
            </div>
          ))}
          {/* Slide number dot */}
          {si === 0 && (
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
              {SLIDES.map((_, di) => (
                <div key={di} className={`rounded-full ${di === 0 ? 'w-2 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      ))}
      {/* Faint "swipe" arrow */}
      <div className="text-white/20 text-xl ml-1 select-none">›</div>
    </div>
  )
}

// ─── Onboarding: first-time user screen ───────────────────────────────────────

function OnboardingScreen({ onStart }) {
  const steps = [
    {
      emoji: '🖼️',
      title: 'Pick a layout',
      desc: 'Choose from grids, splits, full-bleed, and multi-slide carousels.',
    },
    {
      emoji: '✏️',
      title: 'Add photos & text',
      desc: 'Tap any cell to drop in a photo. Layer text, shapes, and colors on top.',
    },
    {
      emoji: '📤',
      title: 'Export to Instagram',
      desc: 'Download all slides at once or share directly from the app.',
    },
  ]

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-y-auto">
      <div
        className="flex flex-col items-center px-6 gap-8"
        style={{ paddingTop: 'max(48px, env(safe-area-inset-top))', paddingBottom: 40 }}
      >
        {/* Logo */}
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight mb-1">Layout</div>
          <div className="text-white/40 text-sm">Make scroll-stopping Instagram carousels</div>
        </div>

        {/* Visual preview */}
        <CarouselPreview />

        {/* What it is */}
        <div className="text-center px-2">
          <p className="text-white/70 text-sm leading-relaxed">
            Layout lets you design <span className="text-white font-medium">multi-slide carousels</span> and <span className="text-white font-medium">photo collages</span> — the kind of posts that make people stop scrolling.
          </p>
        </div>

        {/* How it works */}
        <div className="w-full flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4 bg-white/5 rounded-2xl px-4 py-3.5">
              <div className="text-2xl leading-none mt-0.5">{step.emoji}</div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{step.title}</div>
                <div className="text-xs text-white/45 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          className="w-full bg-white text-black font-semibold text-base py-4 rounded-2xl active:scale-95 transition-transform"
        >
          Create your first carousel →
        </button>

        <p className="text-white/20 text-xs text-center -mt-4">
          No account needed · Works offline · Free
        </p>
      </div>
    </div>
  )
}

// ─── Main home screen ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const startProject = useStore(s => s.startProject)
  const openProject  = useStore(s => s.openProject)

  const [step, setStep]                   = useState(null)   // null | 'ratio' | 'template'
  const [selectedRatio, setSelectedRatio] = useState(null)
  const [projects, setProjects]           = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .finally(() => setProjectsLoading(false))
  }, [])

  const handleOpenProject = async (id) => {
    const savedState = await loadProject(id)
    if (savedState) openProject(savedState)
  }

  const handleDeleteProject = async (e, id) => {
    e.stopPropagation()
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
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

  const singlePageTemplates = TEMPLATES.filter(t => !t.pageSpan || t.pageSpan === 1)
  const multiPageTemplates  = TEMPLATES.filter(t => t.pageSpan && t.pageSpan > 1)

  // Show onboarding for new users once loading is done
  const isFirstTime = !projectsLoading && projects.length === 0

  if (isFirstTime && step === null) {
    return <OnboardingScreen onStart={() => setStep('ratio')} />
  }

  // ── Returning user home ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-black text-white overflow-y-auto">
      <div
        className="flex flex-col items-center px-6 pb-8 gap-6"
        style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}
      >
        <div className="w-full flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">Layout</div>
          <button
            onClick={() => setStep('ratio')}
            className="bg-white text-black font-semibold text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform"
          >
            + New
          </button>
        </div>

        {/* Saved projects */}
        {projectsLoading ? (
          <div className="w-full grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-white/6 animate-pulse" style={{ aspectRatio: '1/1.1' }} />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="w-full">
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Recent Projects</div>
            <div className="grid grid-cols-2 gap-3">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleOpenProject(project.id)}
                  className="relative text-left rounded-2xl overflow-hidden bg-white/6 active:opacity-70 transition-opacity"
                >
                  <div
                    className="w-full"
                    style={{
                      aspectRatio: project.ratio ? `${project.ratio.w} / ${project.ratio.h}` : '1/1',
                      background: '#1a1a1a',
                    }}
                  >
                    {project.thumbnail ? (
                      <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-white/10" />
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-xs font-medium text-white truncate">{project.name}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{formatRelativeTime(project.updatedAt)}</div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    className="absolute top-2 right-2 bg-black/60 text-white/70 rounded-full p-1.5 active:text-white"
                  >
                    <TrashIcon />
                  </button>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Step 1: Ratio picker ──────────────────────────────────────────────── */}
      {step === 'ratio' && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50" onClick={handleClose}>
          <div
            className="w-full bg-[#1a1a1a] rounded-t-2xl p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-base font-semibold">Choose Format</span>
              <button onClick={handleClose} className="text-white/50"><IconClose size={18} /></button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {RATIOS.map(r => {
                const previewH = 80
                const previewW = Math.round(previewH * (r.w / r.h))
                return (
                  <button
                    key={r.value}
                    onClick={() => handleRatio(r)}
                    className="flex flex-col items-center gap-2 shrink-0 active:opacity-70"
                  >
                    <div className="bg-white rounded-lg" style={{ width: previewW, height: previewH }} />
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

          <div className="flex-1 overflow-y-auto px-5 pb-10">
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

            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Single Page</div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {singlePageTemplates
                .filter(t => t.id !== 'blank' && t.id !== 'single')
                .map(t => (
                  <TemplateTile key={t.id} template={t} ratio={selectedRatio} onClick={() => handleTemplate(t)} />
                ))}
            </div>

            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Multi-Page</div>
            <div className="grid grid-cols-3 gap-3">
              {multiPageTemplates.map(t => (
                <TemplateTile key={t.id} template={t} ratio={selectedRatio} onClick={() => handleTemplate(t)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

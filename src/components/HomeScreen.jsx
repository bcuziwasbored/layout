import { useState } from 'react'
import { useStore } from '../useStore'
import { RATIOS, TEMPLATES } from '../templates'
import { IconClose } from './icons'

// Thumbnail that renders a template preview at the page's actual aspect ratio
function TemplateTile({ template, ratio, onClick }) {
  const ps = template.pageSpan ?? 1
  // Thumbnail width in px — we'll use CSS to scale via aspect-ratio
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 active:opacity-60"
    >
      <div
        className="w-full relative bg-white/8 rounded-xl overflow-hidden border border-white/12"
        style={{ aspectRatio: `${ratio.w * ps} / ${ratio.h}` }}
      >
        {/* Page-divider lines */}
        {ps > 1 && Array.from({ length: ps - 1 }, (_, i) => (
          <div key={`pd${i}`} className="absolute top-0 bottom-0 w-px bg-white/30"
            style={{ left: `${(i + 1) * 100 / ps}%` }} />
        ))}

        {template.cells.length === 0 ? (
          // Blank: show faint canvas outline only
          <div className="absolute inset-0" />
        ) : (
          template.cells.map((c, i) => (
            <div key={i}
              className="absolute bg-white/20 border border-white/15"
              style={{
                left:   `${c.x * 100 / ps}%`,
                top:    `${c.y * 100}%`,
                width:  `${c.w * 100 / ps}%`,
                height: `${c.h * 100}%`,
              }} />
          ))
        )}

        {/* Multi-page badge */}
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

export default function HomeScreen() {
  const startProject = useStore(s => s.startProject)
  // step: null | 'ratio' | 'template'
  const [step, setStep] = useState(null)
  const [selectedRatio, setSelectedRatio] = useState(null)

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

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black text-white gap-8 px-6">
      <div className="text-center">
        <div className="text-4xl font-semibold tracking-tight mb-2">Layout</div>
        <div className="text-sm text-white/40">Instagram carousel & collage editor</div>
      </div>

      <button
        onClick={() => setStep('ratio')}
        className="bg-white text-black font-semibold text-base px-8 py-3 rounded-full active:scale-95 transition-transform"
      >
        New Project
      </button>

      {/* ── Step 1: Ratio picker ─────────────────────────────────── */}
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
                    <div
                      className="bg-white rounded-lg"
                      style={{ width: previewW, height: previewH }}
                    />
                    <div className="text-xs text-white/70 font-medium">{r.label}</div>
                    <div className="text-[11px] text-white/35">{r.value}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Template gallery ─────────────────────────────── */}
      {step === 'template' && selectedRatio && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 pb-4 shrink-0"
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
          >
            <button
              onClick={() => setStep('ratio')}
              className="text-white/60 text-sm active:text-white"
            >
              ‹ Format
            </button>
            <span className="font-semibold text-base">Choose Template</span>
            <button onClick={handleClose} className="text-white/40">
              <IconClose size={18} />
            </button>
          </div>

          {/* Scrollable template grid */}
          <div className="flex-1 overflow-y-auto px-5 pb-10">

            {/* Blank — full-width prominent option */}
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

            {/* Single-page templates */}
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">
              Single Page
            </div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {singlePageTemplates
                .filter(t => t.id !== 'blank' && t.id !== 'single')
                .map(t => (
                  <TemplateTile
                    key={t.id}
                    template={t}
                    ratio={selectedRatio}
                    onClick={() => handleTemplate(t)}
                  />
                ))}
            </div>

            {/* Multi-page templates */}
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">
              Multi-Page
            </div>
            <div className="grid grid-cols-3 gap-3">
              {multiPageTemplates.map(t => (
                <TemplateTile
                  key={t.id}
                  template={t}
                  ratio={selectedRatio}
                  onClick={() => handleTemplate(t)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

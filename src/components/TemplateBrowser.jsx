// Full-screen template gallery — step 2 of the home screen's new-project flow,
// split out of HomeScreen so the 117 template definitions (../templatesData) and
// the live preview renderer load only when the picker is opened (issue #87).
//
// Same UI as before: category tabs, a "Blank" row, then single-page and
// multi-page grids of tiles (live canvas previews for styled templates, cheap
// div schematics for bare grids).

import { useState } from 'react'
import { TEMPLATE_CATEGORIES, templateCategory, isStyledTemplate } from '../templates'
import { TEMPLATES } from '../templatesData'
import { IconClose } from './icons'
import TemplatePreview from './TemplatePreview'

const sectionLabel = 'text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67666C]'

function TemplateTile({ template, ratio, onClick }) {
  const ps = template.pageSpan ?? 1
  const styled = isStyledTemplate(template)
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:opacity-60">
      <div
        className="w-full relative rounded-xl overflow-hidden bg-[#141518] border border-[#26272C]"
        style={{ aspectRatio: `${ratio.w * ps} / ${ratio.h}` }}
      >
        {styled ? (
          <TemplatePreview template={template} ratio={ratio} />
        ) : (
          <>
            {ps > 1 && Array.from({ length: ps - 1 }, (_, i) => (
              <div key={`pd${i}`} className="absolute top-0 bottom-0 w-px bg-white/25"
                style={{ left: `${(i + 1) * 100 / ps}%` }} />
            ))}
            {template.cells.length === 0 ? (
              <div className="absolute inset-0" />
            ) : (
              template.cells.map((c, i) => (
                <div key={i} className="absolute bg-white/15 border border-white/10"
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
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-[#F5F4F1] text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-none">
            ×{ps}
          </div>
        )}
      </div>
      <span className="text-[11px] text-[#9C9BA1] leading-none">{template.label}</span>
    </button>
  )
}

export default function TemplateBrowser({ ratio, onPick, onBack, onClose }) {
  const [templateCat, setTemplateCat] = useState('all')

  const visibleTemplates = TEMPLATES.filter(t =>
    t.id !== 'blank' && t.id !== 'single' &&
    (templateCat === 'all' || templateCategory(t) === templateCat))
  const singlePageTemplates = visibleTemplates.filter(t => !t.pageSpan || t.pageSpan === 1)
  const multiPageTemplates  = visibleTemplates.filter(t => t.pageSpan && t.pageSpan > 1)

  return (
    <div className="fixed inset-0 z-50 flex flex-col font-inter bg-[#0A0A0B] text-[#F5F4F1]">
      <div
        className="flex items-center justify-between px-5 pb-4 shrink-0"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button onClick={onBack} className="text-[#9C9BA1] text-[15px] font-medium active:text-[#F5F4F1]">
          ‹ Format
        </button>
        <span className="font-bold text-[18px] tracking-[-0.01em]">Choose template</span>
        <button onClick={onClose} className="text-[#9C9BA1] active:text-[#F5F4F1]">
          <IconClose size={18} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
        {TEMPLATE_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setTemplateCat(c.id)}
            className={`shrink-0 text-[13px] px-3.5 py-1.5 rounded-full border transition-colors ${
              templateCat === c.id
                ? 'bg-[#C6A052] text-[#171205] border-[#C6A052] font-semibold'
                : 'bg-transparent text-[#9C9BA1] border-[#2E2F36] active:bg-[#1C1D22]'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {/* Blank option */}
        <button
          onClick={() => onPick({ id: 'blank', label: 'Blank', cells: [] })}
          className="w-full mb-6 flex items-center gap-4 rounded-2xl px-5 py-4 bg-[#141518] border border-[#26272C] active:bg-[#1C1D22]"
        >
          <div
            className="rounded-lg bg-white/8 border border-white/10 shrink-0"
            style={{ width: Math.round(52 * ratio.w / ratio.h), height: 52 }}
          />
          <div className="text-left">
            <div className="text-[15px] font-semibold text-[#F5F4F1]">Blank</div>
            <div className="text-[12px] text-[#67666C] mt-0.5">Start from scratch</div>
          </div>
        </button>

        {singlePageTemplates.length > 0 && (
          <>
            <div className={`${sectionLabel} mb-3`}>Single page</div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {singlePageTemplates.map(t => (
                <TemplateTile key={t.id} template={t} ratio={ratio} onClick={() => onPick(t)} />
              ))}
            </div>
          </>
        )}

        {multiPageTemplates.length > 0 && (
          <>
            <div className={`${sectionLabel} mb-3`}>Multi-page</div>
            <div className="grid grid-cols-3 gap-3">
              {multiPageTemplates.map(t => (
                <TemplateTile key={t.id} template={t} ratio={ratio} onClick={() => onPick(t)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

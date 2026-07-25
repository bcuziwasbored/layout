// In-editor template browser — the Add panel's "Templates" view, split out of
// AddPanel so the 117 template definitions (./templatesData) and the live
// preview renderer only load when this view is opened (issue #87).
//
// Behaviour is unchanged from the inline version: category tabs, single-page
// grid, multi-page grid, live canvas previews for styled templates and cheap
// div schematics for bare grids.

import { useState } from 'react'
import { TEMPLATE_CATEGORIES, templateCategory, isStyledTemplate } from '../../templates'
import { TEMPLATES } from '../../templatesData'
import { IconClose } from '../icons'
import TemplatePreview from '../TemplatePreview'

const TemplateThumb = ({ template, ratio, onClick }) => {
  const ps = template.pageSpan ?? 1
  const styled = isStyledTemplate(template)
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:opacity-60">
      <div
        className="w-full bg-white/10 rounded-xl relative overflow-hidden border border-white/15"
        style={{ aspectRatio: styled ? `${ratio.w * ps} / ${ratio.h}` : '1 / 1' }}
      >
        {styled ? (
          // Live canvas preview (real fonts/colors/shapes) for styled templates.
          <TemplatePreview template={template} ratio={ratio} />
        ) : (
          <>
            {/* Page divider lines for multi-page templates */}
            {ps > 1 && Array.from({ length: ps - 1 }, (_, i) => (
              <div key={`pd${i}`} className="absolute top-0 bottom-0 w-px bg-white/50"
                style={{ left: `${(i + 1) * 100 / ps}%` }} />
            ))}
            {template.cells.map((c, i) => (
              <div key={i} className="absolute bg-white/25 border border-white/20"
                style={{
                  left:   `${c.x * 100 / ps}%`,
                  top:    `${c.y * 100}%`,
                  width:  `${c.w * 100 / ps}%`,
                  height: `${c.h * 100}%`,
                }} />
            ))}
          </>
        )}
        {/* Multi-page badge */}
        {ps > 1 && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded font-medium leading-none">
            ×{ps}
          </div>
        )}
      </div>
      <span className="text-[10px] text-white/45 leading-none">{template.label}</span>
    </button>
  )
}

export default function TemplatesView({ ratio, onApply, onBack, onClose }) {
  const [category, setCategory] = useState('all')

  const visible = TEMPLATES.filter(t =>
    t.id !== 'blank' && t.id !== 'single' &&
    (category === 'all' || templateCategory(t) === category))
  const singlePage = visible.filter(t => !t.pageSpan || t.pageSpan === 1)
  const multiPage  = visible.filter(t => t.pageSpan && t.pageSpan > 1)

  return (
    <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <button onClick={onBack} className="text-white/50 text-sm active:text-white">‹ Back</button>
        <span className="font-semibold text-base">Templates</span>
        <button onClick={onClose} className="text-white/40"><IconClose size={18} /></button>
      </div>
      {/* Category tabs */}
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
        {TEMPLATE_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === c.id
                ? 'bg-white text-black border-white font-semibold'
                : 'bg-white/8 text-white/60 border-white/10 active:bg-white/15'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto px-5 pb-8 space-y-5">
        {singlePage.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {singlePage.map(t => (
              <TemplateThumb key={t.id} template={t} ratio={ratio} onClick={() => onApply(t)} />
            ))}
          </div>
        )}

        {multiPage.length > 0 && (
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Multi-page</div>
            <div className="grid grid-cols-2 gap-3">
              {multiPage.map(t => (
                <TemplateThumb key={t.id} template={t} ratio={ratio} onClick={() => onApply(t)} />
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 && (
          <div className="text-white/30 text-sm text-center py-10">No templates in this category</div>
        )}
      </div>
    </div>
  )
}

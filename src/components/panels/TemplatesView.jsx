// In-editor template browser — the Add panel's "Templates" view, split out of
// AddPanel so the 117 template definitions (./templatesData) and the live
// preview renderer only load when this view is opened (issue #87).
//
// Behaviour is unchanged from the inline version: category tabs, single-page
// grid, multi-page grid, live canvas previews for styled templates and cheap
// div schematics for bare grids.

import { useMemo, useState } from 'react'
import { TEMPLATE_CATEGORIES, templateCategory, isStyledTemplate } from '../../templates'
import { TEMPLATES } from '../../templatesData'
import { browsableTemplates, categoryCounts, searchTemplateGroups } from '../../templateSearch'
import { IconClose } from '../icons'
import SearchField from '../SearchField'
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
  const [query, setQuery] = useState('')

  const browsable = useMemo(() => browsableTemplates(TEMPLATES), [])
  const counts    = useMemo(() => categoryCounts(browsable), [browsable])

  // Shared with the home picker (issue #91): a live query searches every
  // category, so the tab row falls back to All while one is typed.
  const searching = query.trim().length > 0
  const groups = useMemo(() => searchTemplateGroups(browsable, query), [browsable, query])

  const handleQuery = (v) => { setQuery(v); if (v.trim()) setCategory('all') }
  const pickCategory = (id) => { setCategory(id); setQuery('') }

  const visible = browsable.filter(t => category === 'all' || templateCategory(t) === category)
  const singlePage = visible.filter(t => !t.pageSpan || t.pageSpan === 1)
  const multiPage  = visible.filter(t => t.pageSpan && t.pageSpan > 1)

  return (
    <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <button onClick={onBack} className="text-white/50 text-sm active:text-white">‹ Back</button>
        <span className="font-semibold text-base">Templates</span>
        <button onClick={onClose} className="text-white/40"><IconClose size={18} /></button>
      </div>
      {/* Search across every category (issue #91) */}
      <div className="px-5 pb-3 shrink-0">
        <SearchField value={query} onChange={handleQuery} variant="panel" />
      </div>
      {/* Category tabs, with low-contrast count badges */}
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
        {TEMPLATE_CATEGORIES.map(c => {
          const active = category === c.id && !searching
          return (
            <button key={c.id} onClick={() => pickCategory(c.id)}
              className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? 'bg-white text-black border-white font-semibold'
                  : 'bg-white/8 text-white/60 border-white/10 active:bg-white/15'}`}>
              {c.label}
              <span className={`text-[10px] tabular-nums ${active ? 'text-black/45' : 'text-white/30'}`}>
                {counts[c.id] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
      <div className="overflow-y-auto px-5 pb-8 space-y-5">
        {searching ? (
          groups.length === 0 ? (
            <div className="text-white/30 text-sm text-center py-10">No matches</div>
          ) : (
            groups.map(g => (
              <div key={g.id}>
                <div className="text-xs text-white/30 uppercase tracking-wider mb-3">{g.label}</div>
                <div className="grid grid-cols-3 gap-3">
                  {g.items.map(t => (
                    <TemplateThumb key={t.id} template={t} ratio={ratio} onClick={() => onApply(t)} />
                  ))}
                </div>
              </div>
            ))
          )
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}

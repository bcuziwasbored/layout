// Shared browse/filter logic for the two template pickers (issue #91).
//
// There are two template surfaces — the home flow's full-screen TemplateBrowser
// and the editor Add panel's TemplatesView — and they render very different
// chrome around the same 130 browsable templates. Rather than couple the two
// views, the *behaviour* they must agree on lives here: what counts as
// browsable, the per-category counts behind the tab badges, what a query
// matches, and how a search flattens across categories.
//
// Deliberately imports only ./templates (the small core). The 130 template
// DEFINITIONS stay behind the lazy chunks that already own them (issue #87), so
// pulling this module into a surface never drags templatesData with it.

import { TEMPLATE_CATEGORIES, templateCategory } from './templates'

// 'blank' and 'single' are flow entries, not browsable designs: 'blank' has its
// own row in the home browser and 'single' is the implicit one-cell layout.
export function browsableTemplates(templates) {
  return templates.filter(t => t.id !== 'blank' && t.id !== 'single')
}

const CATEGORY_LABELS = new Map(TEMPLATE_CATEGORIES.map(c => [c.id, c.label]))

export function categoryLabel(id) {
  return CATEGORY_LABELS.get(id) ?? id
}

// Counts behind the tab badges: every category id plus 'all'. Categories with no
// templates still get a 0 so a badge never renders as undefined.
export function categoryCounts(templates) {
  const counts = { all: templates.length }
  for (const c of TEMPLATE_CATEGORIES) if (c.id !== 'all') counts[c.id] = 0
  for (const t of templates) {
    const id = templateCategory(t)
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

// Case-insensitive substring over the template's own label and its category's
// label, so "quote" finds every Quotes template and "duo" finds Quote Duo.
export function matchesTemplateQuery(t, needle) {
  if (!needle) return true
  const label = (t.label ?? '').toLowerCase()
  if (label.includes(needle)) return true
  return categoryLabel(templateCategory(t)).toLowerCase().includes(needle)
}

export function normalizeQuery(query) {
  return query.trim().toLowerCase()
}

// A live search always spans EVERY category — narrowing to the selected tab
// would hide the match the user is typing towards. Results come back grouped in
// tab order so each view can print a quiet category caption above its slice.
// Returns [] for an empty query (the caller falls back to its category view).
export function searchTemplateGroups(templates, query) {
  const needle = normalizeQuery(query)
  if (!needle) return []
  const groups = []
  for (const c of TEMPLATE_CATEGORIES) {
    if (c.id === 'all') continue
    const items = templates.filter(
      t => templateCategory(t) === c.id && matchesTemplateQuery(t, needle),
    )
    if (items.length) groups.push({ id: c.id, label: c.label, items })
  }
  return groups
}

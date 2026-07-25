import { TEMPLATES } from '../../templatesData'
import TemplatePreview from '../TemplatePreview'
import { IconChevronRight } from '../icons'

// "Start from a template" shelf (mockup frame 02): a horizontal rail of category
// tiles. Each tile is a REAL TemplatePreview render of one representative styled
// template for that niche — tapping it starts a fresh 4:5 project seeded with
// that template. "See all ›" opens the full template picker.

// One good-looking representative per niche, shown at 4:5 (tile is 96×120 = 4:5).
const SHELF = [
  { label: 'Quotes',     templateId: 'quote-bold' },
  { label: 'Tips',       templateId: 'tips-number' },
  { label: 'Promo',      templateId: 'promo-sale' },
  { label: 'Photo dump', templateId: 'grid-moodboard' },
].map(s => ({ ...s, template: TEMPLATES.find(t => t.id === s.templateId) }))
  .filter(s => s.template)

export default function TemplateShelf({ ratio, onPick, onSeeAll }) {
  return (
    <div className="pt-[26px]">
      <div className="px-5 flex items-center justify-between mb-[13px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67666C]">
          Start from a template
        </span>
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-[12px] font-medium text-[#9C9BA1] active:text-[#F5F4F1]"
        >
          See all <IconChevronRight size={15} />
        </button>
      </div>
      <div className="flex gap-3 px-5 overflow-x-auto scrollbar-hide">
        {SHELF.map(({ label, template }) => (
          <button
            key={template.id}
            onClick={() => onPick(template)}
            className="shrink-0 flex flex-col active:opacity-70 transition-opacity"
            style={{ width: 96 }}
          >
            <div
              className="relative overflow-hidden"
              style={{ width: 96, height: 120, borderRadius: 12, border: '1px solid #26272C', background: '#141518' }}
            >
              <TemplatePreview template={template} ratio={ratio} />
            </div>
            <span className="mt-2 text-[12px] font-semibold text-[#C9C8CE] text-left">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

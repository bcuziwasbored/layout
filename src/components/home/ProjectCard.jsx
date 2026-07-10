import { IconMoreV, IconPages } from '../icons'

// Recent-projects card (mockup frame 02). Masonry item: the thumbnail keeps the
// project's native aspect ratio, a ×N badge marks multi-page carousels, and the
// meta row carries the name + "edited … · ratio" with a kebab that opens the
// per-project action sheet. Opening keeps the existing div[role=button] +
// Enter/Space keyboard affordance.

export default function ProjectCard({ project, metaLabel, onOpen, onMenu }) {
  const pages = project.slideCount > 1 ? project.slideCount : null
  const aspect = project.ratio ? `${project.ratio.w} / ${project.ratio.h}` : '1 / 1'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      }}
      className="relative text-left overflow-hidden cursor-pointer active:brightness-95 transition"
      style={{ breakInside: 'avoid', marginBottom: 12, background: '#141518', border: '1px solid #26272C', borderRadius: 16 }}
    >
      <div className="relative">
        <div className="w-full bg-[#0E0F12]" style={{ aspectRatio: aspect }}>
          {project.thumbnail
            ? <img src={project.thumbnail} className="w-full h-full object-cover" alt="" draggable={false} />
            : <div className="w-full h-full bg-white/5" />}
        </div>
        {pages && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-semibold text-[#F5F4F1]"
            style={{ height: 22, padding: '0 8px', borderRadius: 999, background: 'rgba(8,8,10,.72)' }}
          >
            <IconPages size={12} /> ×{pages}
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2" style={{ padding: '10px 12px' }}>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.01em] truncate">
            {project.name}
          </div>
          <div className="text-[12px] font-medium text-[#67666C] mt-[3px]">{metaLabel}</div>
        </div>
        <button
          aria-label="Project options"
          onClick={(e) => { e.stopPropagation(); onMenu() }}
          className="shrink-0 flex items-center justify-center text-[#67666C] active:text-[#F5F4F1]"
          style={{ width: 28, height: 28, margin: '-3px -4px 0 0', borderRadius: 8 }}
        >
          <IconMoreV size={18} />
        </button>
      </div>
    </div>
  )
}

import { useStore } from '../useStore'
import { IconBackground, IconLayers, IconRatio, IconSlides } from './icons'

const Icon = ({ icon: Ico, label, active, onClick, pressed }) => (
  <button
    onClick={onClick}
    // `pressed` marks a stateful toggle (Guides) rather than a panel opener, so
    // assistive tech reads it as on/off instead of "just another tab".
    aria-pressed={pressed}
    className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors active:opacity-60 ${active ? 'text-white' : 'text-white/40'}`}
  >
    <Ico size={22} />
    <span className="text-[10px] tracking-wide">{label}</span>
  </button>
)

// Safe-zone guides toggle (issue #88): a frame with a dashed inner frame — the
// same thing the overlay draws on the canvas.
const IconGuides = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2.5" y="2.5" width="17" height="17" rx="2" />
    <rect x="6" y="6" width="10" height="10" rx="1" strokeDasharray="2.5 2.5" />
  </svg>
)

export default function BottomBar() {
  const panel = useStore(s => s.panel)
  const setPanel = useStore(s => s.setPanel)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const safeZones = useStore(s => s.safeZones)
  const toggleSafeZones = useStore(s => s.toggleSafeZones)

  return (
    <div className="flex items-center bg-black border-t border-white/10">
      <div className="flex-1 flex justify-center py-2">
        <Icon icon={IconBackground} label="Background" active={panel === 'background'} onClick={() => setPanel('background')} />
      </div>
      <div className="flex-1 flex justify-center py-2">
        <Icon icon={IconLayers} label="Layers" active={panel === 'layers'} onClick={() => setPanel('layers')} />
      </div>
      <div className="flex-1 flex justify-center py-2">
        <button
          onClick={() => setPanel('add')}
          className="w-12 h-12 rounded-full bg-white text-black text-2xl font-light flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          +
        </button>
      </div>
      <div className="flex-1 flex justify-center py-2">
        <Icon icon={IconRatio} label="Ratio" active={panel === 'ratio'} onClick={() => setPanel('ratio')} />
      </div>
      {/* Sits next to Ratio because the zones it draws are per-ratio (issue #88).
          It's a view toggle, not a panel — it opens nothing and changes no
          document state. */}
      <div className="flex-1 flex justify-center py-2">
        <Icon icon={IconGuides} label="Guides" active={safeZones} pressed={safeZones} onClick={toggleSafeZones} />
      </div>
      <div className="flex-1 flex justify-center py-2">
        <button
          onClick={() => setPanel('slides')}
          className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors active:opacity-60 relative ${panel === 'slides' ? 'text-white' : 'text-white/40'}`}
        >
          <div className="relative">
            <IconSlides size={22} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-1">{activeSlideIdx + 1}</span>
          </div>
          <span className="text-[10px] tracking-wide">Slides</span>
        </button>
      </div>
    </div>
  )
}

import { useStore } from '../useStore'

const Icon = ({ children, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors active:opacity-60 ${active ? 'text-white' : 'text-white/40'}`}
  >
    <span className="text-xl leading-none">{children}</span>
    <span className="text-[10px] tracking-wide">{label}</span>
  </button>
)

export default function BottomBar() {
  const panel = useStore(s => s.panel)
  const setPanel = useStore(s => s.setPanel)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)

  return (
    <div className="flex items-center justify-between px-2 py-2 bg-black border-t border-white/10">
      <Icon label="Background" active={panel === 'background'} onClick={() => setPanel('background')}>◉</Icon>
      <Icon label="Layers" active={panel === 'layers'} onClick={() => setPanel('layers')}>⊞</Icon>

      <button
        onClick={() => setPanel('add')}
        className="w-12 h-12 rounded-full bg-white text-black text-2xl font-light flex items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        +
      </button>

      <Icon label="Ratio" active={panel === 'ratio'} onClick={() => setPanel('ratio')}>▭</Icon>
      <Icon label="Slides" active={panel === 'slides'} onClick={() => setPanel('slides')}>
        <span className="text-sm font-semibold">{activeSlideIdx + 1}</span>
      </Icon>
    </div>
  )
}

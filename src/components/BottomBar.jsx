import { useStore } from '../useStore'
import { IconBackground, IconLayers, IconRatio, IconSlides } from './icons'

const Icon = ({ icon: Ico, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 py-1 rounded-xl transition-colors active:opacity-60 ${active ? 'text-white' : 'text-white/40'}`}
  >
    <Ico size={22} />
    <span className="text-[10px] tracking-wide">{label}</span>
  </button>
)

export default function BottomBar() {
  const panel = useStore(s => s.panel)
  const setPanel = useStore(s => s.setPanel)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)

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

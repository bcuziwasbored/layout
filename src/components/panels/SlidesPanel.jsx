import { useStore } from '../../useStore'

export default function SlidesPanel() {
  const slides = useStore(s => s.slides)
  const layers = useStore(s => s.layers)
  const activeSlideIdx = useStore(s => s.activeSlideIdx)
  const setActiveSlide = useStore(s => s.setActiveSlide)
  const setPanel = useStore(s => s.setPanel)
  const addSlide = useStore(s => s.addSlide)
  const duplicateSlide = useStore(s => s.duplicateSlide)
  const deleteSlide = useStore(s => s.deleteSlide)
  const bgColor = useStore(s => s.bgColor)
  const ratio = useStore(s => s.ratio)

  const THUMB_H = 80
  const THUMB_W = Math.round(THUMB_H * (ratio.w / ratio.h))

  return (
    <div className="bg-[#111] rounded-t-2xl pb-8">
      <div className="flex items-center justify-between px-5 pt-5 mb-4">
        <span className="font-semibold text-base">Slides</span>
        <button onClick={() => setPanel(null)} className="text-white/40 text-2xl leading-none">&times;</button>
      </div>

      <div className="flex gap-3 px-5 overflow-x-auto pb-3">
        {slides.map((slide, idx) => {
          const slideLayers = layers.filter(l => Math.floor(l.x / ratio.w) === idx && l.src)
          return (
            <div key={slide.id} className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${idx === activeSlideIdx ? 'border-blue-500' : 'border-transparent'}`}
                style={{ width: THUMB_W, height: THUMB_H, background: bgColor }}
                onClick={() => { setActiveSlide(idx); setPanel(null) }}
              >
                {slideLayers.map(layer => (
                  <img
                    key={layer.id}
                    src={layer.src}
                    className="absolute object-cover"
                    style={{
                      left: `${((layer.x - idx * ratio.w) / ratio.w) * 100}%`,
                      top: `${(layer.y / ratio.h) * 100}%`,
                      width: `${(layer.w / ratio.w) * 100}%`,
                      height: `${(layer.h / ratio.h) * 100}%`,
                    }}
                    alt=""
                  />
                ))}
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded font-medium">
                  {idx + 1}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => duplicateSlide(idx)} className="text-[10px] text-white/40 active:text-white">Copy</button>
                {slides.length > 1 && (
                  <button onClick={() => deleteSlide(idx)} className="text-[10px] text-red-400 active:text-red-300">Del</button>
                )}
              </div>
            </div>
          )
        })}

        <button
          onClick={addSlide}
          className="shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-white/20 text-white/40 text-2xl active:border-white/40"
          style={{ width: THUMB_W, height: THUMB_H }}
        >
          +
        </button>
      </div>
    </div>
  )
}

import { useStore } from '../../useStore'
import { RATIOS } from '../../templates'
import { IconClose } from '../icons'

export default function RatioPanel() {
  const ratio = useStore(s => s.ratio)
  const setRatio = useStore(s => s.setRatio)
  const setPanel = useStore(s => s.setPanel)

  return (
    <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
      <div className="flex items-center justify-between mb-5">
        <span className="font-semibold text-base">Ratio</span>
        <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {RATIOS.map(r => {
          const THUMB_H = 64
          const THUMB_W = Math.max(28, Math.round(THUMB_H * (r.w / r.h)))
          const active = ratio.value === r.value
          return (
            <button
              key={r.value}
              onClick={() => { setRatio(r); setPanel(null) }}
              className="flex flex-col items-center gap-2 shrink-0 active:opacity-60"
            >
              <div
                className="rounded-lg border-2 transition-colors"
                style={{
                  width: THUMB_W,
                  height: THUMB_H,
                  background: active ? 'white' : 'rgba(255,255,255,0.15)',
                  borderColor: active ? 'white' : 'transparent',
                }}
              />
              <span className={`text-xs ${active ? 'text-white' : 'text-white/40'}`}>{r.label}</span>
              <span className={`text-[11px] ${active ? 'text-white/60' : 'text-white/25'}`}>{r.value}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

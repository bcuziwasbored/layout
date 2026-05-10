import { useStore } from '../../useStore'

const PRESETS = ['#ffffff', '#000000', '#f5f5f0', '#1a1a1a', '#e8e0d8', '#d4c5b0', '#c9d4c5', '#b0c4d4']

export default function BackgroundPanel() {
  const bgColor = useStore(s => s.bgColor)
  const setBgColor = useStore(s => s.setBgColor)
  const setPanel = useStore(s => s.setPanel)

  return (
    <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
      <div className="flex items-center justify-between mb-5">
        <span className="font-semibold text-base">Background</span>
        <button onClick={() => setPanel(null)} className="text-white/40 text-2xl leading-none">&times;</button>
      </div>

      <div className="flex gap-3 flex-wrap mb-4">
        {PRESETS.map(c => (
          <button
            key={c}
            onClick={() => setBgColor(c)}
            className="w-10 h-10 rounded-full border-2 transition-all active:scale-90"
            style={{
              background: c,
              borderColor: bgColor === c ? 'white' : 'transparent',
              boxShadow: bgColor === c ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
            }}
          />
        ))}

        {/* Custom color picker */}
        <label className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center cursor-pointer overflow-hidden relative">
          <span className="text-lg">🎨</span>
          <input
            type="color"
            value={bgColor}
            onChange={e => setBgColor(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
        <div className="w-6 h-6 rounded" style={{ background: bgColor, border: '1px solid rgba(255,255,255,0.2)' }} />
        <span className="text-sm text-white/60 font-mono">{bgColor.toUpperCase()}</span>
      </div>
    </div>
  )
}

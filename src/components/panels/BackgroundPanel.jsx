import { useState } from 'react'
import { useStore } from '../../useStore'
import { IconClose } from '../icons'

const PRESETS = ['#ffffff', '#000000', '#f5f5f0', '#1a1a1a', '#e8e0d8', '#d4c5b0', '#c9d4c5', '#b0c4d4']

export default function BackgroundPanel() {
  const bgColor          = useStore(s => s.bgColor)
  const setBgColor       = useStore(s => s.setBgColor)
  const slides           = useStore(s => s.slides)
  const activeSlideIdx   = useStore(s => s.activeSlideIdx)
  const setSlideBgColor  = useStore(s => s.setSlideBgColor)
  const clearSlideBgColor = useStore(s => s.clearSlideBgColor)
  const setPanel         = useStore(s => s.setPanel)

  const [scope, setScope] = useState('all') // 'all' | 'slide'

  const slide = slides[activeSlideIdx]
  const slideHasOwnColor = slide?.bgColor !== undefined
  // For the slide picker, use the per-slide color if set, else fall back to global
  const slideColor = slide?.bgColor ?? bgColor

  // Active color shown in the swatch/hex row
  const activeColor = scope === 'all' ? bgColor : slideColor

  const handlePreset = (c) => {
    if (scope === 'all') {
      setBgColor(c)
    } else {
      setSlideBgColor(activeSlideIdx, c)
    }
  }

  const handlePicker = (e) => {
    if (scope === 'all') {
      setBgColor(e.target.value)
    } else {
      setSlideBgColor(activeSlideIdx, e.target.value)
    }
  }

  return (
    <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-base">Background</span>
        <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
      </div>

      {/* Segmented control */}
      <div className="flex bg-white/8 rounded-xl p-0.5 mb-5">
        <button
          onClick={() => setScope('all')}
          className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
            scope === 'all' ? 'bg-white/15 text-white' : 'text-white/45'
          }`}>
          All slides
        </button>
        <button
          onClick={() => setScope('slide')}
          className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
            scope === 'slide' ? 'bg-white/15 text-white' : 'text-white/45'
          }`}>
          This slide
        </button>
      </div>

      <div className="flex gap-3 flex-wrap mb-4">
        {PRESETS.map(c => (
          <button
            key={c}
            onClick={() => handlePreset(c)}
            className="w-10 h-10 rounded-full border-2 transition-all active:scale-90"
            style={{
              background: c,
              borderColor: activeColor === c ? 'white' : 'transparent',
              boxShadow: activeColor === c ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
            }}
          />
        ))}

        {/* Custom color picker */}
        <label className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center cursor-pointer overflow-hidden relative">
          <span className="text-lg">🎨</span>
          <input
            type="color"
            value={activeColor}
            onChange={handlePicker}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
        <div className="w-6 h-6 rounded" style={{ background: activeColor, border: '1px solid rgba(255,255,255,0.2)' }} />
        <span className="text-sm text-white/60 font-mono">{activeColor.toUpperCase()}</span>
        {scope === 'slide' && slideHasOwnColor && (
          <button
            onClick={() => clearSlideBgColor(activeSlideIdx)}
            className="ml-auto text-xs text-white/50 active:text-white bg-white/10 px-2.5 py-1 rounded-full">
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

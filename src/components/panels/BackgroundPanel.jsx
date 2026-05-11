import { useState, useRef } from 'react'
import { useStore } from '../../useStore'
import { IconClose } from '../icons'

const PRESETS = ['#ffffff', '#000000', '#f5f5f0', '#1a1a1a', '#e8e0d8', '#d4c5b0', '#c9d4c5', '#b0c4d4']

const GRADIENT_PRESETS = [
  { angle: 135, stops: ['#667eea', '#764ba2'] },
  { angle: 135, stops: ['#f093fb', '#f5576c'] },
  { angle: 135, stops: ['#4facfe', '#00f2fe'] },
  { angle: 135, stops: ['#43e97b', '#38f9d7'] },
  { angle: 135, stops: ['#fa709a', '#fee140'] },
  { angle: 180, stops: ['#000000', '#434343'] },
]

function RecentColors({ onSelect }) {
  const recentColors = useStore(s => s.recentColors)
  if (!recentColors.length) return null
  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {recentColors.map(c => (
        <button key={c} onClick={() => onSelect(c)}
          className="w-7 h-7 rounded-full border border-white/20 active:scale-90 transition-transform shrink-0"
          style={{ background: c }} />
      ))}
    </div>
  )
}

export default function BackgroundPanel() {
  const bgColor           = useStore(s => s.bgColor)
  const bgGradient        = useStore(s => s.bgGradient)
  const setBgColor        = useStore(s => s.setBgColor)
  const setBgGradient     = useStore(s => s.setBgGradient)
  const clearBgGradient   = useStore(s => s.clearBgGradient)
  const slides            = useStore(s => s.slides)
  const activeSlideIdx    = useStore(s => s.activeSlideIdx)
  const setSlideBgColor   = useStore(s => s.setSlideBgColor)
  const clearSlideBgColor = useStore(s => s.clearSlideBgColor)
  const setSlideBgGradient   = useStore(s => s.setSlideBgGradient)
  const clearSlideBgGradient = useStore(s => s.clearSlideBgGradient)
  const setPanel          = useStore(s => s.setPanel)
  const addRecentColor    = useStore(s => s.addRecentColor)

  const [scope, setScope] = useState('all') // 'all' | 'slide'
  const [mode, setMode]   = useState('solid') // 'solid' | 'gradient'

  const slide = slides[activeSlideIdx]
  const slideHasOwnColor    = slide?.bgColor !== undefined
  const slideHasOwnGradient = slide?.bgGradient !== undefined

  // Active color shown in the swatch/hex row
  const slideColor    = slide?.bgColor ?? bgColor
  const activeColor   = scope === 'all' ? bgColor : slideColor

  // Active gradient
  const slideGradient  = slide?.bgGradient ?? bgGradient
  const activeGradient = scope === 'all' ? bgGradient : slideGradient

  // Local gradient editing state, synced from active
  const [gradAngle, setGradAngle]   = useState(activeGradient?.angle ?? 135)
  const [gradStop0, setGradStop0]   = useState(activeGradient?.stops?.[0] ?? '#667eea')
  const [gradStop1, setGradStop1]   = useState(activeGradient?.stops?.[1] ?? '#764ba2')

  const stop0Ref = useRef()
  const stop1Ref = useRef()

  const currentGrad = { angle: gradAngle, stops: [gradStop0, gradStop1] }

  const handlePreset = (c) => {
    if (scope === 'all') setBgColor(c)
    else setSlideBgColor(activeSlideIdx, c)
    addRecentColor(c)
  }

  const handlePicker = (e) => {
    if (scope === 'all') setBgColor(e.target.value)
    else setSlideBgColor(activeSlideIdx, e.target.value)
  }

  const handlePickerBlur = (e) => {
    addRecentColor(e.target.value)
  }

  const handleGradientPreset = (g) => {
    setGradAngle(g.angle)
    setGradStop0(g.stops[0])
    setGradStop1(g.stops[1])
    if (scope === 'all') setBgGradient(g)
    else setSlideBgGradient(activeSlideIdx, g)
  }

  const applyGradient = (g) => {
    if (scope === 'all') setBgGradient(g)
    else setSlideBgGradient(activeSlideIdx, g)
  }

  const handleSwitchToSolid = () => {
    setMode('solid')
    if (scope === 'all') clearBgGradient()
    else clearSlideBgGradient(activeSlideIdx)
  }

  const handleSwitchToGradient = () => {
    setMode('gradient')
    // Initialize from existing or defaults
    const g = (scope === 'all' ? bgGradient : slideGradient) ?? GRADIENT_PRESETS[0]
    setGradAngle(g.angle)
    setGradStop0(g.stops[0])
    setGradStop1(g.stops[1])
    applyGradient(g)
  }

  return (
    <div className="bg-[#111] rounded-t-2xl p-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-base">Background</span>
        <button onClick={() => setPanel(null)} className="text-white/40"><IconClose size={18} /></button>
      </div>

      {/* All slides / This slide */}
      <div className="flex bg-white/8 rounded-xl p-0.5 mb-3">
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

      {/* Solid / Gradient */}
      <div className="flex bg-white/8 rounded-xl p-0.5 mb-5">
        <button
          onClick={handleSwitchToSolid}
          className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
            mode === 'solid' ? 'bg-white/15 text-white' : 'text-white/45'
          }`}>
          Solid
        </button>
        <button
          onClick={handleSwitchToGradient}
          className={`flex-1 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
            mode === 'gradient' ? 'bg-white/15 text-white' : 'text-white/45'
          }`}>
          Gradient
        </button>
      </div>

      {mode === 'solid' ? (
        <>
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
                onBlur={handlePickerBlur}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>

          <RecentColors onSelect={c => { handlePreset(c) }} />

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
        </>
      ) : (
        <>
          {/* Gradient preset swatches */}
          <div className="flex gap-2 flex-wrap mb-4">
            {GRADIENT_PRESETS.map((g, i) => (
              <button key={i} onClick={() => handleGradientPreset(g)}
                className="w-10 h-10 rounded-full border-2 active:scale-90 transition-all"
                style={{
                  background: `linear-gradient(${g.angle}deg, ${g.stops[0]}, ${g.stops[1]})`,
                  borderColor: (activeGradient?.stops?.[0] === g.stops[0] && activeGradient?.stops?.[1] === g.stops[1])
                    ? 'white' : 'transparent',
                }}
              />
            ))}
          </div>

          {/* Color stops */}
          <div className="flex gap-3 mb-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-white/40">Start</span>
              <button onClick={() => stop0Ref.current?.click()}
                className="w-10 h-10 rounded-full border-2 border-white/20 active:scale-90 transition-transform relative overflow-hidden"
                style={{ background: gradStop0 }}>
                <input ref={stop0Ref} type="color" value={gradStop0}
                  onChange={e => {
                    setGradStop0(e.target.value)
                    applyGradient({ angle: gradAngle, stops: [e.target.value, gradStop1] })
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-white/40">End</span>
              <button onClick={() => stop1Ref.current?.click()}
                className="w-10 h-10 rounded-full border-2 border-white/20 active:scale-90 transition-transform relative overflow-hidden"
                style={{ background: gradStop1 }}>
                <input ref={stop1Ref} type="color" value={gradStop1}
                  onChange={e => {
                    setGradStop1(e.target.value)
                    applyGradient({ angle: gradAngle, stops: [gradStop0, e.target.value] })
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </button>
            </div>
            <div className="flex-1 flex flex-col gap-1 ml-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">Angle</span>
                <span className="text-[10px] text-white/60">{gradAngle}°</span>
              </div>
              <input type="range" min={0} max={360} step={1} value={gradAngle}
                onChange={e => {
                  const a = parseInt(e.target.value)
                  setGradAngle(a)
                  applyGradient({ angle: a, stops: [gradStop0, gradStop1] })
                }}
                className="flex-1 accent-white" />
            </div>
          </div>

          {/* Gradient preview */}
          <div className="h-10 rounded-xl mb-2"
            style={{ background: `linear-gradient(${gradAngle}deg, ${gradStop0}, ${gradStop1})` }} />

          {scope === 'slide' && slideHasOwnGradient && (
            <button
              onClick={() => clearSlideBgGradient(activeSlideIdx)}
              className="mt-2 text-xs text-white/50 active:text-white bg-white/10 px-2.5 py-1 rounded-full">
              Reset to global
            </button>
          )}
        </>
      )}
    </div>
  )
}

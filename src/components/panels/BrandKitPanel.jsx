import { useRef, useState } from 'react'
import { useStore } from '../../useStore'
import { FONTS, loadFont } from '../../fonts'
import { processLogoFile, LOGO_ACCEPT_TYPES } from '../../brandKit'
import { IconClose } from '../icons'

// Brand kit editor (issue #64), rendered as a view inside AddPanel. Edits the
// device-global brand record (palette, heading/body font pair, logo) via
// setBrand, which persists to the 'brandkit' IDB store (debounced). None of
// this touches project undo history — the brand kit is identity, not document
// content — so there is no capture/commit wiring here by design.

const uid = () => Math.random().toString(36).slice(2)

const CORNERS = [
  { id: 'tl', label: 'Top left' },
  { id: 'tr', label: 'Top right' },
  { id: 'bl', label: 'Bottom left' },
  { id: 'br', label: 'Bottom right' },
]

// Checkerboard so a transparent logo preview reads as transparent.
const CHECKER_BG = {
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%), ' +
    'linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
}

function SectionLabel({ children }) {
  return <div className="text-xs text-white/30 uppercase tracking-wider mb-3">{children}</div>
}

// One horizontal font-chip row (shared by Heading / Body). `value` null = none.
function FontRow({ label, value, onPick }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] text-white/40 mb-2">{label}</div>
      <div className="flex gap-2 items-center overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button onClick={() => onPick(null)}
          className={`shrink-0 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
            value == null ? 'bg-white text-black font-medium' : 'bg-white/10 text-white/60 active:bg-white/20'
          }`}>
          None
        </button>
        {FONTS.map(f => (
          <button key={f.name} onClick={() => onPick(f.name)}
            style={{ fontFamily: f.name }}
            className={`shrink-0 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
              value === f.name ? 'bg-white text-black font-medium' : 'bg-white/10 text-white/80 active:bg-white/20'
            }`}>
            {f.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BrandKitPanel({ onBack, onClose }) {
  const brand        = useStore(s => s.brand)
  const setBrand     = useStore(s => s.setBrand)
  const addLogoLayer = useStore(s => s.addLogoLayer)
  const setPanel     = useStore(s => s.setPanel)
  const logoInputRef = useRef(null)
  const [logoError, setLogoError] = useState(false)

  const updateColor = (id, patch) => {
    setBrand({ colors: brand.colors.map(c => (c.id === id ? { ...c, ...patch } : c)) })
  }
  const removeColor = (id) => {
    setBrand({ colors: brand.colors.filter(c => c.id !== id) })
  }
  const addColor = () => {
    setBrand({ colors: [...brand.colors, { id: uid(), name: `Color ${brand.colors.length + 1}`, hex: '#3b82f6' }] })
  }

  const pickFont = (key) => (name) => {
    if (name) loadFont(name)
    setBrand({ [key]: name })
  }

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!LOGO_ACCEPT_TYPES.has(file.type)) { setLogoError(true); return }
    try {
      const logo = await processLogoFile(file)
      setLogoError(false)
      setBrand({ logo })
    } catch (err) {
      console.warn('Logo upload failed:', err)
      setLogoError(true)
    }
  }

  const placeLogo = (corner) => {
    addLogoLayer(corner)
    setPanel(null)
  }

  return (
    <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <button onClick={onBack} className="text-white/50 text-sm active:text-white">‹ Back</button>
        <span className="font-semibold text-base">Brand Kit</span>
        <button onClick={onClose} className="text-white/40"><IconClose size={18} /></button>
      </div>

      <div className="overflow-y-auto px-5 pb-8 space-y-6">

        {/* Logo */}
        <div>
          <SectionLabel>Logo</SectionLabel>
          {brand.logo ? (
            <>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-20 h-20 rounded-xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0"
                  style={CHECKER_BG}>
                  <img src={brand.logo.src} alt="Brand logo"
                    className="max-w-full max-h-full" style={{ maxWidth: '85%', maxHeight: '85%' }} />
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => logoInputRef.current?.click()}
                    className="text-xs text-white bg-white/10 px-3 py-1.5 rounded-full active:bg-white/20 text-left w-fit">
                    Replace…
                  </button>
                  <button onClick={() => setBrand({ logo: null })}
                    className="text-xs text-red-400 bg-white/10 px-3 py-1.5 rounded-full active:bg-white/20 text-left w-fit">
                    Remove
                  </button>
                </div>
              </div>
              {/* One-tap corner placement onto the active slide */}
              <div className="text-[11px] text-white/40 mb-2">Add to this slide</div>
              <div className="grid grid-cols-4 gap-2">
                {CORNERS.map(c => (
                  <button key={c.id} onClick={() => placeLogo(c.id)}
                    aria-label={`Place logo ${c.label.toLowerCase()}`}
                    className="bg-white/8 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/15">
                    {/* Mini slide diagram with the corner marked */}
                    <div className="relative w-9 h-9 rounded-md border border-white/25">
                      <div className={`absolute w-2.5 h-2.5 rounded-[3px] bg-white/80 ${
                        c.id.includes('t') ? 'top-1' : 'bottom-1'} ${c.id.includes('l') ? 'left-1' : 'right-1'}`} />
                    </div>
                    <span className="text-[9px] text-white/50 leading-none">{c.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button onClick={() => logoInputRef.current?.click()}
              className="w-full border border-dashed border-white/20 rounded-xl py-6 text-sm text-white/50 active:bg-white/5">
              Upload logo — transparent PNG or SVG
            </button>
          )}
          {logoError && (
            <div className="text-xs text-red-400 mt-2">
              Couldn't use that file — try a PNG, SVG, WebP, GIF or JPEG image.
            </div>
          )}
          <input ref={logoInputRef} type="file"
            accept="image/png,image/webp,image/svg+xml,image/gif,image/jpeg"
            onChange={handleLogoFile} className="hidden" />
        </div>

        {/* Palette */}
        <div>
          <SectionLabel>Colors</SectionLabel>
          <div className="space-y-2">
            {brand.colors.map(c => (
              <div key={c.id ?? `${c.name}-${c.hex}`} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                {/* Overlay input (iOS-safe direct tap — BackgroundPanel pattern) */}
                <button className="w-8 h-8 rounded-full border-2 border-white/20 shrink-0 relative overflow-hidden"
                  style={{ background: c.hex }}>
                  <input type="color" value={c.hex}
                    onChange={e => updateColor(c.id, { hex: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </button>
                <input type="text" value={c.name}
                  onChange={e => updateColor(c.id, { name: e.target.value })}
                  placeholder="Name"
                  className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
                <span className="text-[11px] text-white/35 font-mono shrink-0">{c.hex.toUpperCase()}</span>
                <button onClick={() => removeColor(c.id)} aria-label={`Remove ${c.name || c.hex}`}
                  className="text-white/40 active:text-white shrink-0 p-1">
                  <IconClose size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addColor}
            className="mt-2.5 text-sm text-white bg-white/10 px-4 py-2 rounded-xl active:bg-white/20">
            + Add color
          </button>
        </div>

        {/* Default fonts */}
        <div>
          <SectionLabel>Default fonts</SectionLabel>
          <FontRow label="Heading — new text layers start with this" value={brand.headingFont} onPick={pickFont('headingFont')} />
          <FontRow label="Body" value={brand.bodyFont} onPick={pickFont('bodyFont')} />
        </div>

      </div>
    </div>
  )
}

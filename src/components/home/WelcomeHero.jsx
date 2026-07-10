import { useRef } from 'react'
import BrandMark from './BrandMark'
import { IconPlus, IconImportTray, IconScissors } from '../icons'

// First-run welcome (mockup frame 01). The hero artwork shows one photo split
// across two carousel slides with a dashed gold cut line + scissors chip — built
// from plain divs and an overflowing <img> (no canvas). We reuse a real sample
// photo (s1.jpg): its wide top band reads as one continuous shot, so the seam
// down the middle sells the "one photo → two slides" idea.

const PHOTO = import.meta.env.BASE_URL + 'samples/s1.jpg'

const SLIDE_W = 138
const SLIDE_H = 172
const GAP = 6
const FULL_W = SLIDE_W * 2 + GAP // photo strip spans both slides

function WelcomeArt() {
  // Each slide reveals its half of one oversized image; slide 2 shifts the image
  // left by one slide+gap so the two halves line up seamlessly at the cut line.
  const slide = (offset) => (
    <div
      className="relative overflow-hidden"
      style={{ width: SLIDE_W, height: SLIDE_H, borderRadius: 14, border: '1px solid #26272C', background: '#141518' }}
    >
      <img
        src={PHOTO}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{ width: FULL_W, height: 'auto', top: -20, left: offset }}
      />
    </div>
  )

  return (
    <div className="relative flex flex-col items-center gap-4">
      <div className="relative flex" style={{ gap: GAP }}>
        {slide(0)}
        {slide(-(SLIDE_W + GAP))}
        {/* dashed gold cut line down the seam */}
        <div
          className="absolute"
          style={{ top: -9, bottom: -9, left: SLIDE_W + GAP / 2 - 1, width: 0, borderLeft: '2px dashed rgba(198,160,82,.92)' }}
        />
        {/* scissors chip centered on the seam */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: '50%', left: SLIDE_W + GAP / 2, transform: 'translate(-50%,-50%)',
            width: 28, height: 28, borderRadius: '50%', background: '#C6A052',
            color: '#171205', boxShadow: '0 4px 14px rgba(0,0,0,.55)',
          }}
        >
          <IconScissors size={15} />
        </div>
      </div>

      {/* caption pill */}
      <div
        className="flex items-center gap-2"
        style={{ padding: '7px 14px', borderRadius: 999, background: '#141518', border: '1px solid #26272C' }}
      >
        <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6A052' }} />
        <span className="text-[13px] font-semibold text-[#C9C8CE]">One photo → two slides, auto-split on export</span>
      </div>

      {/* carousel dots */}
      <div className="flex gap-1.5">
        <span style={{ width: 18, height: 5, borderRadius: 3, background: '#C6A052' }} />
        <span style={{ width: 5, height: 5, borderRadius: 3, background: '#3A3B42' }} />
      </div>
    </div>
  )
}

export default function WelcomeHero({ onStart, onImportFile }) {
  const importRef = useRef(null)

  return (
    <div className="font-inter flex flex-col h-full bg-[#0A0A0B] text-[#F5F4F1] overflow-hidden">
      {/* Brand header */}
      <div
        className="shrink-0 flex items-center gap-[9px] px-6"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 4 }}
      >
        <BrandMark />
        <span className="text-[18px] font-bold tracking-[-0.01em]">Layout</span>
      </div>

      {/* Artwork */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6">
        <WelcomeArt />
      </div>

      {/* Copy + CTAs */}
      <div className="shrink-0 px-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#C6A052] mb-3.5">
          Grids · Collages · Carousels
        </div>
        <h1 className="text-[30px] font-bold leading-[1.08] tracking-[-0.022em] text-[#F5F4F1]">
          Your photos,<br />perfectly laid out.
        </h1>
        <p className="text-[15px] leading-[1.5] text-[#9C9BA1] mt-3 max-w-[304px]">
          Build grids and collages from your camera roll, or split one shot across slides for a seamless carousel scroll.
        </p>

        <button
          onClick={onStart}
          className="w-full h-[52px] mt-6 rounded-full bg-[#C6A052] text-[#171205] text-[16px] font-semibold flex items-center justify-center gap-2 active:translate-y-px active:brightness-95 transition"
        >
          <IconPlus size={19} /> Start creating
        </button>
        <button
          onClick={() => importRef.current?.click()}
          className="w-full h-[48px] mt-3 rounded-full bg-transparent border border-[#2E2F36] text-[#F5F4F1] text-[15px] font-semibold flex items-center justify-center gap-2 active:bg-[#1C1D22] transition"
        >
          <IconImportTray size={18} /> Import a project
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".layout,.zip,application/zip"
          onChange={onImportFile}
          className="hidden"
        />
        <div className="mt-[18px] text-center text-[12px] font-medium text-[#67666C] tracking-[0.01em]">
          Free · No account needed · Works offline
        </div>
      </div>
    </div>
  )
}

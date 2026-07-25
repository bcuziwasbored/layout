// Suspense fallbacks for the lazily-loaded surfaces (issue #87).
//
// Two rules everything here follows:
//  1. Nothing renders for the first DELAY_MS. A precached chunk resolves in a
//     few milliseconds, and a skeleton that flashes for 8ms reads as a glitch —
//     worse than a frame of nothing. Past the delay the load is slow enough that
//     silence would read as a dead tap, so the skeleton appears.
//  2. The placeholder occupies the same box as the real thing (sheet height,
//     shelf tile size, full screen), so the surface doesn't jump when it swaps.
//
// Visual language matches the home screen's loading state: .animate-shimmer
// blocks on the panel background, or the app's small gold spinner.

import { useEffect, useState } from 'react'

const DELAY_MS = 150

// Renders `children` only once DELAY_MS has elapsed. Below that, nothing.
function Delayed({ children }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), DELAY_MS)
    return () => clearTimeout(t)
  }, [])
  return show ? children : null
}

// Spinner used inside the darker overlay surfaces.
function Spinner({ size = 18 }) {
  return (
    <div
      className="rounded-full border-2 border-white/20 border-t-[#C6A052] animate-spin"
      style={{ width: size, height: size }}
    />
  )
}

// ── Editor bottom sheet (Add panel views, crop/adjust-style panels) ────────────
// Matches the panel chrome: #111 sheet, rounded top, a header row and a grid of
// shimmer tiles. `rows`/`cols` tune the tile grid to the view being loaded.
export function SheetFallback({ title, rows = 2, cols = 4 }) {
  return (
    <Delayed>
      <div className="bg-[#111] rounded-t-2xl p-5 pb-8" role="status" aria-busy="true" aria-label={`Loading ${title ?? 'panel'}`}>
        <div className="flex items-center justify-between mb-5">
          <span className="font-semibold text-base text-white/90">{title}</span>
          <Spinner />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: rows * cols }, (_, i) => (
            <div key={i} className="animate-shimmer rounded-xl" style={{ aspectRatio: '1 / 1' }} />
          ))}
        </div>
      </div>
    </Delayed>
  )
}

// ── Full-screen overlay (export, stock search, template browser) ───────────────
// A plain scrim + spinner: these surfaces cover the whole viewport, so there is
// no layout underneath to preserve, and a fake skeleton of an unknown screen
// would be more distracting than a quiet loading state.
export function ScreenFallback({ label = 'Loading…', dark = '#0A0A0B' }) {
  return (
    <Delayed>
      <div
        className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3"
        style={{ background: dark }}
        role="status"
        aria-live="polite"
      >
        <Spinner size={22} />
        <span className="text-[13px] text-white/45">{label}</span>
      </div>
    </Delayed>
  )
}

// ── Home-screen template shelf ────────────────────────────────────────────────
// Reserves the shelf's exact height (section label + 120px tiles + caption) so
// the "Recent" grid below it never shifts while the shelf chunk loads.
export function ShelfFallback() {
  return (
    <div className="pt-[26px]" role="status" aria-busy="true" aria-label="Loading templates">
      <div className="px-5 flex items-center justify-between mb-[13px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67666C]">
          Start from a template
        </span>
      </div>
      <div className="flex gap-3 px-5 overflow-hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="shrink-0 flex flex-col" style={{ width: 96 }}>
            <div
              className="animate-shimmer"
              style={{ width: 96, height: 120, borderRadius: 12, border: '1px solid #26272C' }}
            />
            <div className="animate-shimmer mt-2" style={{ width: 58, height: 11, borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bottom sheet with unknown content (caption sheet, brand kit) ──────────────
// Sits at the bottom of the viewport like the real sheet, at a representative
// height, so the swap is a content change rather than a position change.
export function BottomSheetFallback({ height = 260, label = 'Loading…' }) {
  return (
    <Delayed>
      <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(6,6,8,.6)' }} role="status" aria-live="polite">
        <div
          className="w-full flex flex-col items-center justify-center gap-3"
          style={{
            height,
            background: '#16171B',
            borderTop: '1px solid #2E2F36',
            borderRadius: '24px 24px 0 0',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}
        >
          <Spinner size={20} />
          <span className="text-[13px] text-white/45">{label}</span>
        </div>
      </div>
    </Delayed>
  )
}

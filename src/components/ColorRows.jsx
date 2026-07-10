import { useStore } from '../useStore'

// Shared swatch rows for every color-picker surface (issue #64): the brand kit
// palette as the FIRST row, then the session's recent colors. Replaces the two
// identical local RecentColors components that lived in LayerToolbar and
// BackgroundPanel. Purely presentational — the caller's onSelect keeps whatever
// undo semantics that surface already has (discrete apply, scrub commit, …), so
// the #28/#26 capture/commit wiring is untouched.
//
// `recents={false}` renders the brand row alone — used on secondary color inputs
// (border/stroke/shadow/outline) that never had a recents row, so the palette is
// one tap away everywhere without bloating those sections.
export default function ColorRows({ onSelect, recents = true }) {
  const brandColors = useStore(s => s.brand.colors)
  const recentColors = useStore(s => s.recentColors)
  const showBrand = brandColors.length > 0
  const showRecents = recents && recentColors.length > 0
  if (!showBrand && !showRecents) return null
  return (
    <div className="mb-3">
      {showBrand && (
        <>
          {showRecents && (
            <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1.5">Brand</div>
          )}
          <div className={`flex gap-2 flex-wrap ${showRecents ? 'mb-2.5' : ''}`}>
            {brandColors.map(c => (
              <button key={c.id ?? `${c.name}-${c.hex}`} onClick={() => onSelect(c.hex)}
                title={c.name} aria-label={c.name || c.hex}
                className="w-7 h-7 rounded-full border border-white/20 active:scale-90 transition-transform shrink-0"
                style={{ background: c.hex }} />
            ))}
          </div>
        </>
      )}
      {showRecents && (
        <>
          {showBrand && (
            <div className="text-[9px] text-white/25 uppercase tracking-widest mb-1.5">Recent</div>
          )}
          <div className="flex gap-2 flex-wrap">
            {recentColors.map(c => (
              <button key={c} onClick={() => onSelect(c)}
                className="w-7 h-7 rounded-full border border-white/20 active:scale-90 transition-transform shrink-0"
                style={{ background: c }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Sticker catalog — the Add panel's "Stickers" view, split out of AddPanel so the
// sticker pack (./stickers: ~50 inline SVG definitions plus the rasterizer) only
// loads when the catalog is opened (issue #87).
//
// Behaviour is unchanged: pick a tint, tap a sticker, it is rasterized to a
// transparent PNG at export-quality resolution and placed through the normal
// image-layer pipeline.

import { useState } from 'react'
import { STICKERS, STICKER_CATEGORIES, STICKER_COLORS, stickerPreviewURL, rasterizeSticker } from '../../stickers'
import { IconClose } from '../icons'

export default function StickersView({ ratio, onPlace, onBack, onClose }) {
  const [stickerColor, setStickerColor] = useState(STICKER_COLORS[0])

  // Rasterize the tapped sticker at export-quality resolution, then hand it to
  // the caller to place centered on the active slide as a normal image layer.
  const placeSticker = async (sticker) => {
    const placedW = ratio.w * 0.3
    const placedLong = Math.max(placedW, placedW * (sticker.vb[1] / sticker.vb[0]))
    // 2× headroom so a 2× export stays crisp; capped so data URLs stay modest.
    const longPx = Math.min(1024, Math.max(256, Math.round(placedLong * 2)))
    try {
      const { src, naturalW, naturalH } = await rasterizeSticker(sticker, stickerColor, longPx)
      onPlace(src, naturalW, naturalH)
    } catch (e) {
      console.warn('Failed to place sticker', sticker.id, e)
    }
  }

  return (
    <div className="bg-[#111] rounded-t-2xl" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <button onClick={onBack} className="text-white/50 text-sm active:text-white">‹ Back</button>
        <span className="font-semibold text-base">Stickers</span>
        <button onClick={onClose} className="text-white/40"><IconClose size={18} /></button>
      </div>
      {/* Tint color row */}
      <div className="flex gap-2.5 px-5 pb-3 overflow-x-auto scrollbar-hide shrink-0">
        {STICKER_COLORS.map(c => (
          <button key={c} onClick={() => setStickerColor(c)}
            aria-label={`Tint ${c}`}
            className={`shrink-0 w-7 h-7 rounded-full border-2 transition-transform ${
              stickerColor === c ? 'border-white scale-110' : 'border-white/25'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="overflow-y-auto px-5 pb-8 space-y-5">
        {STICKER_CATEGORIES.map(cat => {
          const items = STICKERS.filter(s => s.category === cat.id)
          if (!items.length) return null
          return (
            <div key={cat.id}>
              <div className="text-xs text-white/30 uppercase tracking-wider mb-3">{cat.label}</div>
              <div className="grid grid-cols-4 gap-3">
                {items.map(s => (
                  <button key={s.id} onClick={() => placeSticker(s)}
                    className="rounded-xl p-2 flex items-center justify-center active:opacity-60"
                    style={{ background: '#6b7280', aspectRatio: '1 / 1' }}>
                    <img src={stickerPreviewURL(s, stickerColor)} alt={s.label} loading="lazy"
                      className="max-w-full max-h-full" style={{ maxWidth: '80%', maxHeight: '80%' }} />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sticker pack (issue #67) ────────────────────────────────────────────────
// Curated Instagram-carousel overlay graphics defined as compact inline SVG
// strings (simple paths — not illustrations — to keep the bundle small). Each is
// single-`currentColor` so it can be tinted to any picker colour. Stickers are
// rasterized on demand to a transparent PNG data URL and placed through the
// NORMAL image-layer pipeline (src + srcOriginal + imgId), so undo/redo,
// persistence and export all work unchanged.
//
// Sticker shape: { id, label, category, tint, vb:[w,h], svg }
//   vb  — the SVG viewBox size; also the natural aspect ratio used at placement.
//   svg — inner markup (no <svg> wrapper); `currentColor` is swapped for the
//         chosen tint at raster time. `tint:true` means the fill/stroke tracks the
//         picked colour; a few decorative accents use fixed black-alpha on purpose.

import { get2dContext } from './colorSpace'

export const STICKER_CATEGORIES = [
  { id: 'arrows',    label: 'Arrows' },
  { id: 'scribbles', label: 'Scribbles' },
  { id: 'tape',      label: 'Tape' },
  { id: 'paper',     label: 'Paper' },
  { id: 'badges',    label: 'Badges' },
  { id: 'prompts',   label: 'Prompts' },
  { id: 'sparkle',   label: 'Stars' },
]

// Default tint swatches — white and black lead, per the issue's "default white and
// black variants", followed by a small accent row.
export const STICKER_COLORS = [
  '#ffffff', '#000000', '#ff3b30', '#ff9500',
  '#ffcc00', '#34c759', '#0a84ff', '#ff2d92',
]

const stroke = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'

// A rounded-rect outline pill with centred bold text — the "swipe / link in bio"
// staples. Kept as a builder so the seven prompt pills stay one line of data each.
const pill = (text, w) =>
  `<rect x="3" y="4" width="${w - 6}" height="46" rx="23" fill="none" stroke="currentColor" stroke-width="4"/>` +
  `<text x="${w / 2}" y="35" font-family="Arial, Helvetica, sans-serif" font-size="20" ` +
  `font-weight="700" letter-spacing="1" fill="currentColor" text-anchor="middle">${text}</text>`

export const STICKERS = [
  // ── Arrows ──────────────────────────────────────────────────────────────────
  { id: 'arrow-straight', label: 'Arrow', category: 'arrows', tint: true, vb: [120, 44],
    svg: `<g ${stroke} stroke-width="7"><path d="M10 22H104"/><path d="M86 8l20 14-20 14"/></g>` },
  { id: 'arrow-curve-ur', label: 'Curve up', category: 'arrows', tint: true, vb: [100, 100],
    svg: `<g ${stroke} stroke-width="7"><path d="M14 82C22 34 52 20 84 24"/><path d="M66 12l20 10-8 22"/></g>` },
  { id: 'arrow-curve-dn', label: 'Curve down', category: 'arrows', tint: true, vb: [100, 100],
    svg: `<g ${stroke} stroke-width="7"><path d="M18 16C64 20 84 44 80 84"/><path d="M60 68l20 18 14-18"/></g>` },
  { id: 'arrow-scribble', label: 'Scribble', category: 'arrows', tint: true, vb: [130, 60],
    svg: `<g ${stroke} stroke-width="6"><path d="M8 40c18-6 30 6 44 0s22-16 40-10"/><path d="M74 12l22 8-8 22"/></g>` },
  { id: 'arrow-hand', label: 'Hand', category: 'arrows', tint: true, vb: [120, 50],
    svg: `<g ${stroke} stroke-width="6"><path d="M8 26h96"/><path d="M84 10l22 16"/><path d="M84 42l22-16"/></g>` },
  { id: 'arrow-long', label: 'Long', category: 'arrows', tint: true, vb: [160, 30],
    svg: `<g ${stroke} stroke-width="4"><path d="M6 15h140"/><path d="M130 6l18 9-18 9"/></g>` },
  { id: 'arrow-loop', label: 'Loop', category: 'arrows', tint: true, vb: [110, 84],
    svg: `<g ${stroke} stroke-width="6"><path d="M18 62C10 30 34 14 60 20s28 40 6 48"/><path d="M78 50l-12 18-16-12"/></g>` },
  { id: 'arrow-double', label: 'Double', category: 'arrows', tint: true, vb: [140, 40],
    svg: `<g ${stroke} stroke-width="6"><path d="M22 20h96"/><path d="M40 8L22 20l18 12"/><path d="M100 8l18 12-18 12"/></g>` },

  // ── Scribbles / marks ───────────────────────────────────────────────────────
  { id: 'circle-scribble', label: 'Circle', category: 'scribbles', tint: true, vb: [140, 96],
    svg: `<path ${stroke} stroke-width="5" d="M70 12C30 8 10 30 12 52c2 24 40 36 70 32 28-4 46-24 40-42C156 26 108 12 66 16"/>` },
  { id: 'underline-1', label: 'Underline', category: 'scribbles', tint: true, vb: [120, 24],
    svg: `<path ${stroke} stroke-width="6" d="M8 14c30 6 74 6 104-2"/>` },
  { id: 'underline-2', label: 'Double line', category: 'scribbles', tint: true, vb: [120, 30],
    svg: `<g ${stroke} stroke-width="5"><path d="M8 10c30 6 74 6 104-2"/><path d="M12 24c28 4 66 4 96-2"/></g>` },
  { id: 'underline-wavy', label: 'Wavy', category: 'scribbles', tint: true, vb: [112, 24],
    svg: `<path ${stroke} stroke-width="5" d="M8 12q10-10 20 0t20 0t20 0t20 0t20 0"/>` },
  { id: 'highlight', label: 'Highlight', category: 'scribbles', tint: true, vb: [130, 44],
    svg: `<path fill="currentColor" fill-opacity="0.5" d="M6 30c30-10 90-14 118-8 6 2 4 14-2 15C94 42 40 44 10 40c-6-1-8-8-4-10z"/>` },
  { id: 'cross-out', label: 'Strike', category: 'scribbles', tint: true, vb: [120, 40],
    svg: `<path ${stroke} stroke-width="6" d="M8 30c30 4 70-16 104-18"/>` },
  { id: 'check', label: 'Check', category: 'scribbles', tint: true, vb: [90, 70],
    svg: `<path ${stroke} stroke-width="8" d="M12 38l22 22L80 12"/>` },

  // ── Tape ────────────────────────────────────────────────────────────────────
  { id: 'tape-h', label: 'Tape', category: 'tape', tint: true, vb: [140, 40],
    svg: `<path fill="currentColor" fill-opacity="0.5" d="M5 9 135 4 137 31 7 34z"/>` },
  { id: 'tape-diag', label: 'Diagonal', category: 'tape', tint: true, vb: [120, 90],
    svg: `<path fill="currentColor" fill-opacity="0.5" d="M10 44 92 8 110 42 28 78z"/>` },
  { id: 'tape-torn', label: 'Torn', category: 'tape', tint: true, vb: [130, 48],
    svg: `<path fill="currentColor" fill-opacity="0.5" d="M6 12l14-4 10 6 12-6 12 5 12-6 12 5 14-4 6 30-14 3-12-5-12 5-12-5-10 5-14-3z"/>` },
  { id: 'tape-washi', label: 'Washi', category: 'tape', tint: true, vb: [140, 40],
    svg: `<path fill="currentColor" fill-opacity="0.45" d="M5 8 135 5 137 33 7 36z"/><path d="M12 21h120" stroke="#000" stroke-opacity="0.14" stroke-width="6" stroke-dasharray="4 10"/>` },
  { id: 'tape-cross', label: 'Cross', category: 'tape', tint: true, vb: [120, 120],
    svg: `<g fill="currentColor"><path fill-opacity="0.5" d="M8 46 100 18 108 44 16 72z"/><path fill-opacity="0.42" d="M46 112 18 22 46 14 74 104z"/></g>` },

  // ── Paper ───────────────────────────────────────────────────────────────────
  { id: 'paper-strip', label: 'Torn paper', category: 'paper', tint: true, vb: [140, 60],
    svg: `<path fill="currentColor" d="M6 12l16-2 10 3 12-3 12 3 12-3 12 3 12-3 12 3 12-3v40l-12 2-12-3-12 3-12-3-12 3-12-3-12 3-10-3-16 2z"/>` },
  { id: 'sticky-note', label: 'Sticky', category: 'paper', tint: true, vb: [100, 100],
    svg: `<path fill="currentColor" d="M8 8h84v74l-18 18H8z"/><path fill="#000" fill-opacity="0.12" d="M74 100l18-18H78a4 4 0 0 0-4 4z"/>` },
  { id: 'index-card', label: 'Card', category: 'paper', tint: true, vb: [130, 90],
    svg: `<rect x="6" y="10" width="118" height="70" rx="6" fill="currentColor"/><path d="M6 32h118" stroke="#000" stroke-opacity="0.12" stroke-width="3"/><path d="M24 10v70" stroke="#e2554e" stroke-opacity="0.55" stroke-width="3"/>` },
  { id: 'ripped-note', label: 'Ripped', category: 'paper', tint: true, vb: [120, 100],
    svg: `<path fill="currentColor" d="M12 8h100v84H12l6-10-6-10 6-12-6-10 6-12-6-10z"/>` },

  // ── Badges / bursts ─────────────────────────────────────────────────────────
  { id: 'seal-star', label: 'Seal', category: 'badges', tint: true, vb: [110, 110],
    svg: `<path fill="currentColor" d="M55 4l9 14 16-7-3 17 17 3-12 12 12 12-17 3 3 17-16-7-9 14-9-14-16 7 3-17-17-3 12-12L14 46l17-3-3-17 16 7z"/>` },
  { id: 'seal-dashed', label: 'Stamp', category: 'badges', tint: true, vb: [110, 110],
    svg: `<circle cx="55" cy="55" r="48" fill="currentColor"/><circle cx="55" cy="55" r="38" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="3" stroke-dasharray="2 8"/>` },
  { id: 'sunburst', label: 'Rays', category: 'badges', tint: true, vb: [120, 120],
    svg: `<g stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M60 8v18"/><path d="M60 94v18"/><path d="M8 60h18"/><path d="M94 60h18"/><path d="M23 23l13 13"/><path d="M84 84l13 13"/><path d="M97 23L84 36"/><path d="M36 84L23 97"/></g>` },
  { id: 'circle-outline', label: 'Ring', category: 'badges', tint: true, vb: [110, 110],
    svg: `<g fill="none" stroke="currentColor"><circle cx="55" cy="55" r="46" stroke-width="6"/><circle cx="55" cy="55" r="36" stroke-width="3"/></g>` },
  { id: 'sale-burst', label: 'Burst', category: 'badges', tint: true, vb: [120, 120],
    svg: `<path fill="currentColor" d="M60 6l7 16 15-11 0 19 18-6-8 17 19 3-14 12 14 12-19 3 8 17-18-6 0 19-15-11-7 16-7-16-15 11 0-19-18 6 8-17-19-3 14-12-14-12 19-3-8-17 18 6 0-19 15 11z"/>` },
  { id: 'ribbon', label: 'Ribbon', category: 'badges', tint: true, vb: [140, 60],
    svg: `<g fill="currentColor"><path fill-opacity="0.6" d="M8 20l16-4 6 22-16 4z"/><path fill-opacity="0.6" d="M132 20l-16-4-6 22 16 4z"/><path d="M22 12h96l-10 18 10 18H22l10-18z"/></g>` },
  { id: 'burst-pow', label: 'Pow', category: 'badges', tint: true, vb: [120, 120],
    svg: `<path fill="currentColor" d="M60 4l12 22 22-14-6 26 26 2-18 18 20 16-26-2 6 26-22-14-12 22-12-22-22 14 6-26-26 2 20-16-18-18 26-2-6-26 22 14z"/>` },

  // ── Prompts ─────────────────────────────────────────────────────────────────
  { id: 'pill-swipe',   label: 'Swipe',      category: 'prompts', tint: true, vb: [150, 54], svg: pill('SWIPE →', 150) },
  { id: 'pill-swipeup', label: 'Swipe up',   category: 'prompts', tint: true, vb: [170, 54], svg: pill('SWIPE UP ↑', 170) },
  { id: 'pill-linkbio', label: 'Link in bio',category: 'prompts', tint: true, vb: [190, 54], svg: pill('LINK IN BIO', 190) },
  { id: 'pill-newpost', label: 'New post',   category: 'prompts', tint: true, vb: [165, 54], svg: pill('NEW POST', 165) },
  { id: 'pill-tap',     label: 'Tap',        category: 'prompts', tint: true, vb: [120, 54], svg: pill('TAP →', 120) },
  { id: 'pill-follow',  label: 'Follow',     category: 'prompts', tint: true, vb: [150, 54], svg: pill('FOLLOW', 150) },
  { id: 'pill-new',     label: 'New',        category: 'prompts', tint: true, vb: [100, 54], svg: pill('NEW', 100) },
  { id: 'speech', label: 'Speech', category: 'prompts', tint: true, vb: [110, 92],
    svg: `<path fill="currentColor" d="M14 12h82a10 10 0 0 1 10 10v40a10 10 0 0 1-10 10H50l-22 18 3-18H14a10 10 0 0 1-10-10V22a10 10 0 0 1 10-10z"/>` },

  // ── Stars / sparkles / hearts ─────────────────────────────────────────────────
  { id: 'star-5', label: 'Star', category: 'sparkle', tint: true, vb: [100, 100],
    svg: `<path fill="currentColor" d="M50 6l13 27 30 4-22 21 6 30-27-15-27 15 6-30L7 37l30-4z"/>` },
  { id: 'sparkle-4', label: 'Sparkle', category: 'sparkle', tint: true, vb: [100, 100],
    svg: `<path fill="currentColor" d="M50 6C54 30 70 46 94 50 70 54 54 70 50 94 46 70 30 54 6 50 30 46 46 30 50 6z"/>` },
  { id: 'sparkle-trio', label: 'Sparkles', category: 'sparkle', tint: true, vb: [120, 100],
    svg: `<g fill="currentColor"><path d="M44 10C48 30 60 42 80 46 60 50 48 62 44 82 40 62 28 50 8 46 28 42 40 30 44 10z"/><path d="M94 52c2 12 8 18 20 20-12 2-18 8-20 20-2-12-8-18-20-20 12-2 18-8 20-20z"/><path d="M98 6c1 8 5 12 13 13-8 1-12 5-13 13-1-8-5-12-13-13 8-1 12-5 13-13z"/></g>` },
  { id: 'twinkle', label: 'Twinkle', category: 'sparkle', tint: true, vb: [100, 100],
    svg: `<path fill="currentColor" d="M50 4l8 38 38 8-38 8-8 38-8-38-38-8 38-8z"/>` },
  { id: 'heart-fill', label: 'Heart', category: 'sparkle', tint: true, vb: [100, 92],
    svg: `<path fill="currentColor" d="M50 88C12 60 6 36 20 22c12-12 26-6 30 6 4-12 18-18 30-6 14 14 8 38-30 66z"/>` },
  { id: 'heart-outline', label: 'Heart line', category: 'sparkle', tint: true, vb: [100, 92],
    svg: `<path ${stroke} stroke-width="6" d="M50 84C16 58 10 36 22 24c11-11 22-6 28 4 6-10 17-15 28-4 12 12 6 34-28 60z"/>` },
  { id: 'star-outline', label: 'Star line', category: 'sparkle', tint: true, vb: [100, 100],
    svg: `<path ${stroke} stroke-width="6" d="M50 8l12 26 28 3-21 20 6 29-25-14-25 14 6-29L10 37l28-3z"/>` },
  { id: 'shooting-star', label: 'Shooting', category: 'sparkle', tint: true, vb: [120, 90],
    svg: `<path fill="currentColor" d="M84 14l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z"/><g ${stroke} stroke-width="5"><path d="M14 76c14-6 26-14 34-24"/><path d="M30 76c8-4 16-10 22-18"/></g>` },
  { id: 'heart-double', label: 'Hearts', category: 'sparkle', tint: true, vb: [120, 100],
    svg: `<g fill="currentColor"><path d="M40 78C12 56 8 38 19 27c9-9 18-5 21 3 3-8 12-12 21-3 11 11 7 29-21 51z"/><path fill-opacity="0.6" d="M86 52C68 38 66 27 73 20c6-6 12-3 13 2 1-5 8-8 13-2 7 7 5 18-13 32z"/></g>` },
  { id: 'lightning', label: 'Bolt', category: 'sparkle', tint: true, vb: [70, 110],
    svg: `<path fill="currentColor" d="M40 6L14 62h22l-10 42 42-60H44l14-38z"/>` },
]

// Build a standalone <svg> document string for a sticker in the given tint.
// `currentColor` is only swapped when the sticker is tintable; fixed decorative
// accents (black-alpha lines) are left untouched.
export function stickerSVG(sticker, color) {
  const [w, h] = sticker.vb
  const body = sticker.tint && color
    ? sticker.svg.replaceAll('currentColor', color)
    : sticker.svg
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`
}

// Lightweight preview source — the raw SVG as a data URL, used for the picker
// grid (no rasterization needed for thumbnails).
export function stickerPreviewURL(sticker, color) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stickerSVG(sticker, color))
}

// Rasterize a sticker to a transparent PNG data URL sized so its long edge is
// `longPx` device pixels (caller passes placement size × devicePixelRatio, with
// export headroom). Returns { src, naturalW, naturalH } for the image pipeline.
export function rasterizeSticker(sticker, color, longPx) {
  return new Promise((resolve, reject) => {
    const [vw, vh] = sticker.vb
    const scale = longPx / Math.max(vw, vh)
    const w = Math.max(1, Math.round(vw * scale))
    const h = Math.max(1, Math.round(vh * scale))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      // Wide-gamut (issue #109): a rasterized sticker becomes an ordinary image
      // layer, so it rides the same pipeline a photo does. The tints themselves are
      // sRGB hex, so no colour changes here — this just keeps the sticker in the
      // export's colour space instead of forcing a conversion on the way in.
      const ctx = get2dContext(canvas)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      // PNG keeps the alpha channel — the whole point of the sticker pipeline.
      resolve({ src: canvas.toDataURL('image/png'), naturalW: w, naturalH: h })
    }
    img.onerror = () => reject(new Error('sticker rasterize failed'))
    img.src = stickerPreviewURL(sticker, color)
  })
}

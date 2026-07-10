// The Layout brand mark: a 24×24 gold rounded square holding an "L-frames" glyph,
// transcribed from the home-redesign mockup. Sits left of the "Layout" wordmark.

export default function BrandMark({ size = 24 }) {
  const glyph = Math.round(size * 0.58)
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: 8, background: '#C6A052' }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#171205"
        strokeWidth="2.1"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="12" height="16" rx="2" />
        <path d="M16 8h4v12H9" />
      </svg>
    </div>
  )
}

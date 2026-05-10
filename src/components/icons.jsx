// Shared SVG icon components — stroke-based, sized via `size` prop

export function IconBackground({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8.5" />
      <circle cx="11" cy="11" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconLayers({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="16" height="5" rx="1.5" />
      <rect x="3" y="10" width="16" height="4" rx="1.5" />
      <rect x="3" y="16" width="16" height="3" rx="1.5" />
    </svg>
  )
}

export function IconRatio({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2.5" y="6" width="17" height="10" rx="2" />
    </svg>
  )
}

export function IconSlides({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="13" height="16" rx="2" />
      <rect x="3" y="5" width="13" height="16" rx="2" fill="none" />
    </svg>
  )
}

export function IconImage({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.8" />
      <path d="M2 17l5.5-5.5 4.5 4.5 2.5-2.5 5 5" />
    </svg>
  )
}

export function IconGrid({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="9" height="9" rx="2" />
      <rect x="13" y="2" width="9" height="9" rx="2" />
      <rect x="2" y="13" width="9" height="9" rx="2" />
      <rect x="13" y="13" width="9" height="9" rx="2" />
    </svg>
  )
}

export function IconBlank({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="2" width="18" height="20" rx="2.5" />
    </svg>
  )
}

export function IconUndo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h9a5 5 0 0 1 0 10H8" />
      <path d="M4 8l3-3M4 8l3 3" />
    </svg>
  )
}

export function IconRedo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8H9a5 5 0 0 0 0 10h5" />
      <path d="M18 8l-3-3M18 8l-3 3" />
    </svg>
  )
}

export function IconClose({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

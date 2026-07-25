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

// ─── Position panel icons ──────────────────────────────────────────────────────

export function IconFront({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="10" width="12" height="12" rx="1.5" opacity="0.4" />
      <rect x="4" y="14" width="12" height="12" rx="1.5" opacity="0.25" />
      <rect x="6" y="4" width="14" height="14" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M13 10V4M10 7l3-3 3 3" />
    </svg>
  )
}

export function IconForward({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="12" width="12" height="12" rx="1.5" opacity="0.35" />
      <rect x="4" y="8" width="14" height="14" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M11 5V2M8.5 4.5L11 2l2.5 2.5" />
    </svg>
  )
}

export function IconBackward({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="14" height="14" rx="1.5" opacity="0.35" />
      <rect x="8" y="10" width="14" height="14" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M15 21v3M12.5 21.5L15 24l2.5-2.5" />
    </svg>
  )
}

export function IconBack({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="14" height="14" rx="1.5" opacity="0.25" />
      <rect x="10" y="8" width="12" height="12" rx="1.5" opacity="0.4" />
      <rect x="4" y="10" width="14" height="14" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M13 18v6M10 21l3 3 3-3" />
    </svg>
  )
}

export function IconAlignLeft({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="5" y1="4" x2="5" y2="24" />
      <rect x="7" y="9" width="14" height="10" rx="2" />
    </svg>
  )
}

export function IconAlignCenterH({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="14" y1="4" x2="14" y2="24" />
      <rect x="7" y="9" width="14" height="10" rx="2" />
    </svg>
  )
}

export function IconAlignRight({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="23" y1="4" x2="23" y2="24" />
      <rect x="7" y="9" width="14" height="10" rx="2" />
    </svg>
  )
}

export function IconAlignTop({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="5" x2="24" y2="5" />
      <rect x="9" y="7" width="10" height="14" rx="2" />
    </svg>
  )
}

export function IconAlignCenterV({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="14" x2="24" y2="14" />
      <rect x="9" y="7" width="10" height="14" rx="2" />
    </svg>
  )
}

export function IconAlignBottom({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="23" x2="24" y2="23" />
      <rect x="9" y="7" width="10" height="14" rx="2" />
    </svg>
  )
}

export function IconFillHeight({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="12" height="20" rx="2" />
      <path d="M13 7.5v-3M15 6l-2-1.5L11 6M13 20.5v3M11 22l2 1.5L15 22" />
    </svg>
  )
}

export function IconFillWidth({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="20" height="12" rx="2" />
      <path d="M7.5 13h-3M6 11l-1.5 2L6 15M20.5 13h3M22 15l1.5-2L22 11" />
    </svg>
  )
}

export function IconFillWidth2x({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="11" height="12" rx="2" />
      <rect x="15" y="8" width="11" height="12" rx="2" />
      <path d="M13 14h2" strokeDasharray="1.5 1" />
    </svg>
  )
}

export function IconFlipH({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="5" x2="14" y2="23" />
      <path d="M14 9l-7 5 7 5" fill="currentColor" fillOpacity="0.15" />
      <path d="M14 9l7 5-7 5" fill="currentColor" fillOpacity="0.08" />
    </svg>
  )
}

export function IconFlipV({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="14" x2="23" y2="14" />
      <path d="M9 14l5-7 5 7" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 14l5 7 5-7" fill="currentColor" fillOpacity="0.08" />
    </svg>
  )
}

// ─── Text icons ────────────────────────────────────────────────────────────────

export function IconText({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M12 6v13" />
      <path d="M8 19h8" />
    </svg>
  )
}

export function IconBold({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <text x="10" y="10" textAnchor="middle" dominantBaseline="central"
        fontSize="15" fontWeight="800" fontFamily="system-ui, -apple-system, sans-serif">B</text>
    </svg>
  )
}

export function IconItalic({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="13" y1="4" x2="7" y2="16" />
      <line x1="9" y1="4" x2="15" y2="4" />
      <line x1="5" y1="16" x2="11" y2="16" />
    </svg>
  )
}

export function IconTextAlignLeft({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="6"  x2="19" y2="6"  />
      <line x1="3" y1="10" x2="13" y2="10" />
      <line x1="3" y1="14" x2="17" y2="14" />
      <line x1="3" y1="18" x2="11" y2="18" />
    </svg>
  )
}

export function IconTextAlignCenter({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="6"  x2="19" y2="6"  />
      <line x1="6" y1="10" x2="16" y2="10" />
      <line x1="3" y1="14" x2="19" y2="14" />
      <line x1="6" y1="18" x2="16" y2="18" />
    </svg>
  )
}

export function IconTextAlignRight({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3"  y1="6"  x2="19" y2="6"  />
      <line x1="9"  y1="10" x2="19" y2="10" />
      <line x1="5"  y1="14" x2="19" y2="14" />
      <line x1="11" y1="18" x2="19" y2="18" />
    </svg>
  )
}

// ─── Shape icons ───────────────────────────────────────────────────────────────

export function IconShapeRect({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="7" width="18" height="10" rx="2" />
    </svg>
  )
}

export function IconShapeCircle({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="9" ry="7" />
    </svg>
  )
}

export function IconShapes({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" fillOpacity="0.2" />
      <ellipse cx="17.5" cy="6.5" rx="4.5" ry="4.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="2" y="14" width="20" height="8" rx="2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function IconCaption({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 4.5h15M3.5 9h15M3.5 13.5h9" />
      <path d="M3.5 18h6" strokeOpacity="0.5" />
    </svg>
  )
}

// ─── Home-screen redesign icons ─────────────────────────────────────────────────
// Stroke paths transcribed from the Claude Design home-redesign mockup so the
// ported UI matches the source anatomy. Sized via `size`, colored via currentColor.

export function IconPlus({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// Down-into-tray — "Import a project"
export function IconImportTray({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v11m0 0l-4-4m4 4l4-4" />
      <path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
    </svg>
  )
}

// Up-out-of-tray — "Export file"
export function IconExportTray({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4m0 0l-4 4m4-4l4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export function IconMoreH({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  )
}

export function IconMoreV({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  )
}

export function IconChevronRight({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

// Empty-state icon tile — nested document frames
export function IconEmptyFrames({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="3" y="5" width="13" height="16" rx="2" />
      <path d="M16 9h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9" />
    </svg>
  )
}

export function IconAlertTriangle({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function IconRetry({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11a8 8 0 1 0-2 5.3" />
      <path d="M20 5v5h-5" />
    </svg>
  )
}

export function IconRename({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}

export function IconDuplicate({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

// Two offset rectangles — "Duplicate in another format"
export function IconFormat({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <rect x="3" y="5" width="12" height="9" rx="1.5" />
      <rect x="9" y="10" width="12" height="9" rx="1.5" />
    </svg>
  )
}

export function IconTrash2({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  )
}

export function IconBackup({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

// Small pages glyph for the ×N badge on project cards
export function IconPages({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 14V6a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

export function IconScissors({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M8.5 7.5L20 16M8.5 16.5L20 8" />
    </svg>
  )
}

// Magnifier for the project / template search fields (issue #91)
export function IconSearch({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5L16.7 16.7" />
    </svg>
  )
}

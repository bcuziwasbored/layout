// Font list for the text layer font picker.
// Inter, Poppins, and Montserrat are preloaded in index.html.
// All others are loaded on first use via loadFont().

export const FONTS = [
  // Sans-serif
  { name: 'Inter',           category: 'sans' },
  { name: 'DM Sans',         category: 'sans' },
  { name: 'Outfit',          category: 'sans' },
  { name: 'Poppins',         category: 'sans' },
  { name: 'Montserrat',      category: 'sans' },
  { name: 'Raleway',         category: 'sans' },
  { name: 'Oswald',          category: 'sans' },
  { name: 'Space Grotesk',   category: 'sans' },
  { name: 'Nunito',          category: 'sans' },
  { name: 'Work Sans',       category: 'sans' },
  { name: 'Rubik',           category: 'sans' },
  { name: 'Quicksand',       category: 'sans' },
  { name: 'Josefin Sans',    category: 'sans' },
  // Serif
  { name: 'Playfair Display',    category: 'serif' },
  { name: 'Lora',                category: 'serif' },
  { name: 'EB Garamond',         category: 'serif' },
  { name: 'Merriweather',        category: 'serif' },
  { name: 'Cormorant Garamond',  category: 'serif' },
  // Display
  { name: 'Bebas Neue',    category: 'display' },
  { name: 'Anton',         category: 'display' },
  { name: 'Abril Fatface', category: 'display' },
  // Script
  { name: 'Dancing Script', category: 'script' },
  { name: 'Pacifico',       category: 'script' },
  { name: 'Great Vibes',    category: 'script' },
  { name: 'Satisfy',        category: 'script' },
]

const _loaded = new Set(['Inter', 'Poppins', 'Montserrat'])

// Injects a Google Fonts stylesheet for the given family (bold + italic variants).
// Safe to call multiple times — deduplicates via the _loaded set.
export function loadFont(family) {
  if (_loaded.has(family)) return
  _loaded.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`
  document.head.appendChild(link)
}

// Inject stylesheets for every distinct font family used by the given text
// layers. Called on project open so a reopened project renders in its real
// fonts without the user having to touch the font picker first.
export function preloadLayerFonts(layers) {
  if (!Array.isArray(layers)) return
  const families = new Set()
  for (const l of layers) {
    if (l?.type === 'text' && l.fontFamily) families.add(l.fontFamily)
  }
  for (const family of families) loadFont(family)
}

// CSS font shorthand FontFaceSet.load() understands, e.g. `italic 700 1em "Pacifico"`.
function fontLoadSpec(family, bold, italic) {
  const style = italic ? 'italic' : 'normal'
  const weight = bold ? 700 : 400
  return `${style} ${weight} 1em "${family}"`
}

// Ensure the fonts used by the given text layers are injected AND actually
// loaded before an export rasterizes. Injecting the stylesheet (loadFont) is
// not sufficient — the FontFace may still be downloading, and on a freshly
// opened project document.fonts.ready can resolve before the glyphs exist. We
// explicitly load each used weight/style combo and await them, guarded by a
// timeout so a hung font fetch can never hang an export (falls back to whatever
// is available after ~3s).
export async function ensureLayerFontsLoaded(layers, timeoutMs = 3000) {
  if (!Array.isArray(layers)) return
  const specs = new Set()
  for (const l of layers) {
    if (l?.type !== 'text' || !l.fontFamily) continue
    loadFont(l.fontFamily)
    specs.add(fontLoadSpec(l.fontFamily, l.bold, l.italic))
  }
  if (!specs.size || typeof document === 'undefined' || !document.fonts) return
  const loads = Promise.all(
    [...specs].map(spec => document.fonts.load(spec).catch(() => {}))
  )
  let timer
  const guard = new Promise(resolve => { timer = setTimeout(resolve, timeoutMs) })
  try {
    await Promise.race([loads, guard])
  } finally {
    clearTimeout(timer)
  }
}

// Wire a callback to fire whenever a batch of fonts finishes loading. The
// browser's FontFaceSet emits 'loadingdone' after lazily-loaded fonts arrive;
// forwarding it lets the app bump a counter so Konva re-rasterizes text that
// was first drawn in the fallback font. Guarded so repeated calls (StrictMode
// double-invoke, remounts) attach the listener only once.
let _reloaderInit = false
export function initFontReloader(onFontsLoaded) {
  if (_reloaderInit) return
  if (typeof document === 'undefined' || !document.fonts) return
  _reloaderInit = true
  document.fonts.addEventListener('loadingdone', () => onFontsLoaded())
}

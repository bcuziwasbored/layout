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
  // Serif
  { name: 'Playfair Display', category: 'serif' },
  { name: 'Lora',             category: 'serif' },
  { name: 'EB Garamond',      category: 'serif' },
  // Display / script
  { name: 'Bebas Neue',    category: 'display' },
  { name: 'Dancing Script', category: 'script' },
  { name: 'Pacifico',       category: 'script' },
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

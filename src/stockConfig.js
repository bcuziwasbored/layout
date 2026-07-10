// ─── Stock-photo provider configuration ─────────────────────────────────────────
// In-editor stock photo search (issue #66). Ships DISABLED: with no key the whole
// feature is hidden and the photo picker behaves exactly as before (native input,
// no extra tap).
//
// To enable it, get a FREE Pexels API key at:  https://www.pexels.com/api/
// (instant signup, no credit card; free tier is 200 requests/hour, 20k/month —
// plenty for occasional in-editor search).
//
// Two ways to supply the key:
//   1. Paste it into PEXELS_API_KEY below and rebuild (ships with the app).
//   2. Owner-only, no rebuild: run in the browser console
//        localStorage.setItem('PEXELS_API_KEY', 'your-key-here')
//      then reload. The localStorage value OVERRIDES the baked-in constant, so a
//      single deployed build can be toggled on per-device without redeploying.
export const PEXELS_API_KEY = ''

// Resolve the active Pexels key: localStorage override wins, else the baked-in
// constant. Wrapped in try/catch because localStorage can throw in private mode
// or non-DOM (test/SSR) contexts.
export function getPexelsKey() {
  try {
    if (typeof localStorage !== 'undefined') {
      const override = localStorage.getItem('PEXELS_API_KEY')
      if (override) return override.trim()
    }
  } catch {
    /* localStorage unavailable — fall through to the baked-in key */
  }
  return PEXELS_API_KEY
}

// True when in-editor stock search should be offered at all. When false the
// chooser sheet is never shown and the native file input opens directly.
export function stockEnabled() {
  return !!getPexelsKey()
}

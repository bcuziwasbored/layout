// ─── Stock-photo provider layer (issue #66) ─────────────────────────────────────
// A tiny provider interface so a second source (Unsplash, etc.) can be dropped in
// later without touching the UI. Pexels is the primary/only provider today: it
// uses a single Authorization header (no OAuth), has a generous free tier, and —
// per its current API guidelines (https://www.pexels.com/api/documentation/) —
// requires ONLY visible attribution to Pexels and the photographer. There is NO
// mandatory download-tracking / "trigger download" endpoint (that is Unsplash's
// requirement, not Pexels'), so we call none. Attribution we render: each tile
// shows the photographer's name, and the search UI shows a "Photos provided by
// Pexels" credit — see StockPicker.jsx.
//
// Provider interface:
//   {
//     id: string,
//     name: string,                       // human label, used in attribution
//     attributionUrl: string,             // provider home / credit link
//     search({ query, page, perPage, signal }) => Promise<{
//       photos: StockPhoto[], nextPage: number|null, total: number
//     }>
//   }
//
// StockPhoto:
//   { id, thumb, full, alt, photographer, photographerUrl, avgColor, width, height }
//   - thumb: grid thumbnail URL (Pexels `src.medium`)
//   - full:  full-res URL fetched on selection (Pexels `src.large2x`, ~2x/capped;
//            processImageFile then caps display at 2048px, keeping the original
//            for export — identical treatment to a camera-roll pick).

import { getPexelsKey } from './stockConfig'

// Typed error so the UI can distinguish rate-limit / offline / config from a
// generic failure and message accordingly.
export class StockError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'StockError'
    this.code = code // 'no-key' | 'rate-limit' | 'http' | 'network'
  }
}

const PEXELS_SEARCH = 'https://api.pexels.com/v1/search'

function mapPexelsPhoto(p) {
  return {
    id: String(p.id),
    thumb: p.src?.medium || p.src?.small || p.src?.tiny,
    full: p.src?.large2x || p.src?.original || p.src?.large,
    alt: p.alt || '',
    photographer: p.photographer || 'Unknown',
    photographerUrl: p.photographer_url || '',
    avgColor: p.avg_color || '#222',
    width: p.width,
    height: p.height,
  }
}

// Build a Pexels provider. `getKey` is injectable so tests can drive it without
// touching localStorage; `fetchImpl` is injectable so the fetch layer can be
// mocked in a vite-node test with no network.
export function createPexelsProvider({ getKey = getPexelsKey, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null)
  return {
    id: 'pexels',
    name: 'Pexels',
    attributionUrl: 'https://www.pexels.com',
    async search({ query, page = 1, perPage = 30, signal } = {}) {
      const key = getKey()
      if (!key) throw new StockError('Stock photos are not configured.', 'no-key')
      if (!doFetch) throw new StockError('No fetch available.', 'network')
      const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}` +
        `&page=${page}&per_page=${perPage}`
      let res
      try {
        res = await doFetch(url, { headers: { Authorization: key }, signal })
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        throw new StockError('Network error — check your connection.', 'network')
      }
      if (res.status === 429) {
        throw new StockError("Pexels rate limit reached — please wait a moment.", 'rate-limit')
      }
      if (!res.ok) {
        throw new StockError(`Stock search failed (${res.status}).`, 'http')
      }
      const data = await res.json()
      const photos = Array.isArray(data.photos) ? data.photos.map(mapPexelsPhoto) : []
      // Pexels returns a `next_page` URL when more results exist.
      const nextPage = data.next_page ? page + 1 : null
      return { photos, nextPage, total: data.total_results ?? photos.length }
    },
  }
}

// The active provider used by the UI. A single seam to swap/extend later.
export function getStockProvider(opts) {
  return createPexelsProvider(opts)
}

// Fetch a chosen stock photo's full-res URL and wrap it in a File so it can flow
// through the exact same processImageFile pipeline the native <input> uses. No
// canvas / re-encode here — processImageFile owns downscaling and format rules.
export async function fetchStockPhotoAsFile(photo, { fetchImpl, signal } = {}) {
  const doFetch = fetchImpl || fetch
  let res
  try {
    res = await doFetch(photo.full, { signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new StockError('Could not download the photo — check your connection.', 'network')
  }
  if (!res.ok) throw new StockError(`Photo download failed (${res.status}).`, 'http')
  const blob = await res.blob()
  const type = blob.type || 'image/jpeg'
  const ext = type.includes('png') ? 'png' : 'jpg'
  return new File([blob], `pexels-${photo.id}.${ext}`, { type })
}

// Provider-level tests for issue #66 in-editor stock photo search.
// Run with: npx vite-node test/stock.test.mjs
// Mocks the fetch layer (no network) and drives the Pexels provider directly.
import assert from 'node:assert/strict'
import {
  createPexelsProvider, fetchStockPhotoAsFile, StockError, getStockProvider,
} from '../src/stockProviders.js'

let passed = 0
async function test(name, fn) {
  await fn()
  passed++
  console.log(`  ok - ${name}`)
}

// A canned Pexels /v1/search response (shape trimmed to what we map).
const PEXELS_PAGE_1 = {
  total_results: 2,
  next_page: 'https://api.pexels.com/v1/search?page=2',
  photos: [
    {
      id: 111, width: 4000, height: 3000, avg_color: '#886644',
      alt: 'a cup of coffee', photographer: 'Ada Lovelace',
      photographer_url: 'https://www.pexels.com/@ada',
      src: { medium: 'https://img/111-medium.jpg', large2x: 'https://img/111-large2x.jpg', original: 'https://img/111-orig.jpg' },
    },
    {
      id: 222, width: 3000, height: 4000, avg_color: '#224466',
      alt: '', photographer: 'Alan Turing',
      photographer_url: 'https://www.pexels.com/@alan',
      src: { medium: 'https://img/222-medium.jpg', large2x: 'https://img/222-large2x.jpg' },
    },
  ],
}
const PEXELS_PAGE_2 = { total_results: 2, next_page: null, photos: [] }

function mockFetch(routes) {
  const calls = []
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts })
    const route = routes(url, opts)
    if (typeof route === 'function') return route()
    return route
  }
  return { fetchImpl, calls }
}

const jsonRes = (status, body) => ({
  status, ok: status >= 200 && status < 300, json: async () => body,
})

// ── search maps Pexels fields → StockPhoto and derives nextPage ─────────────────
await test('search maps photos and reports nextPage from next_page', async () => {
  const { fetchImpl, calls } = mockFetch(url =>
    jsonRes(200, url.includes('page=2') ? PEXELS_PAGE_2 : PEXELS_PAGE_1))
  const provider = createPexelsProvider({ getKey: () => 'test-key', fetchImpl })

  const r = await provider.search({ query: 'coffee', page: 1 })
  assert.equal(r.photos.length, 2)
  assert.equal(r.nextPage, 2, 'next_page present → page+1')
  assert.equal(r.total, 2)

  const p0 = r.photos[0]
  assert.equal(p0.id, '111', 'id stringified')
  assert.equal(p0.thumb, 'https://img/111-medium.jpg', 'thumb = src.medium')
  assert.equal(p0.full, 'https://img/111-large2x.jpg', 'full = src.large2x')
  assert.equal(p0.photographer, 'Ada Lovelace')
  assert.equal(p0.width, 4000)

  // Sends the Authorization header with the resolved key.
  assert.equal(calls[0].opts.headers.Authorization, 'test-key')
  assert.match(calls[0].url, /query=coffee/)
})

// ── last page: no next_page → nextPage null (stops infinite scroll) ─────────────
await test('search returns nextPage=null on the final page', async () => {
  const { fetchImpl } = mockFetch(() => jsonRes(200, PEXELS_PAGE_2))
  const provider = createPexelsProvider({ getKey: () => 'k', fetchImpl })
  const r = await provider.search({ query: 'x', page: 2 })
  assert.equal(r.nextPage, null)
  assert.equal(r.photos.length, 0)
})

// ── no key → typed 'no-key' error, no fetch attempted ───────────────────────────
await test('search throws StockError(no-key) when unconfigured', async () => {
  let fetched = false
  const provider = createPexelsProvider({ getKey: () => '', fetchImpl: async () => { fetched = true } })
  await assert.rejects(
    () => provider.search({ query: 'coffee' }),
    (e) => e instanceof StockError && e.code === 'no-key',
  )
  assert.equal(fetched, false, 'no network call without a key')
})

// ── 429 → friendly rate-limit error ─────────────────────────────────────────────
await test('search maps HTTP 429 to StockError(rate-limit)', async () => {
  const { fetchImpl } = mockFetch(() => jsonRes(429, {}))
  const provider = createPexelsProvider({ getKey: () => 'k', fetchImpl })
  await assert.rejects(
    () => provider.search({ query: 'coffee' }),
    (e) => e instanceof StockError && e.code === 'rate-limit',
  )
})

// ── network throw → StockError(network) ─────────────────────────────────────────
await test('search wraps a fetch throw as StockError(network)', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch') }
  const provider = createPexelsProvider({ getKey: () => 'k', fetchImpl })
  await assert.rejects(
    () => provider.search({ query: 'coffee' }),
    (e) => e instanceof StockError && e.code === 'network',
  )
})

// ── fetchStockPhotoAsFile downloads full-res and wraps it in a File ─────────────
await test('fetchStockPhotoAsFile downloads photo.full into a typed File', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  let requested = null
  const fetchImpl = async (url) => {
    requested = url
    return { ok: true, status: 200, blob: async () => new Blob([bytes], { type: 'image/jpeg' }) }
  }
  const photo = { id: '111', full: 'https://img/111-large2x.jpg' }
  const file = await fetchStockPhotoAsFile(photo, { fetchImpl })
  assert.equal(requested, 'https://img/111-large2x.jpg', 'fetches the full-res URL')
  assert.equal(file.type, 'image/jpeg')
  assert.equal(file.name, 'pexels-111.jpg')
  assert.equal(file.size, 4)
})

// ── fetchStockPhotoAsFile surfaces a non-ok download as StockError(http) ─────────
await test('fetchStockPhotoAsFile throws StockError(http) on a failed download', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, blob: async () => new Blob() })
  await assert.rejects(
    () => fetchStockPhotoAsFile({ id: 'z', full: 'u' }, { fetchImpl }),
    (e) => e instanceof StockError && e.code === 'http',
  )
})

// ── getStockProvider returns the Pexels provider (swap seam) ─────────────────────
await test('getStockProvider yields the pexels provider', async () => {
  const p = getStockProvider({ getKey: () => 'k', fetchImpl: async () => jsonRes(200, PEXELS_PAGE_2) })
  assert.equal(p.id, 'pexels')
  assert.equal(p.name, 'Pexels')
})

console.log(`\n${passed} passed`)

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconClose } from './icons'
import { StockError, fetchStockPhotoAsFile } from '../stockProviders'

// ─── In-editor stock photo search (issue #66) ────────────────────────────────────
// Full-screen dark search UI. Props:
//   provider  — a stock provider (see stockProviders.js)
//   onPick(file) — called with a ready-to-process File once a photo is downloaded;
//                  the parent hands it to the SAME processImageFile pipeline the
//                  native <input> uses, so the pending cell / replace / add-layer
//                  target all fill identically.
//   onClose() — dismiss without picking.
//   onError(message) — surface a transient toast (used for the network fallback).

function IconSearch({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export default function StockPicker({ provider, onPick, onClose, onError }) {
  const [query, setQuery]     = useState('')
  const [photos, setPhotos]   = useState([])
  const [page, setPage]       = useState(null)   // next page to request (null = none)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [picking, setPicking] = useState(null)   // id of the photo being downloaded
  const [searched, setSearched] = useState(false)

  const scrollRef  = useRef(null)
  const abortRef   = useRef(null)
  const seqRef     = useRef(0)      // guards against out-of-order search responses
  const loadingRef = useRef(false)  // synchronous in-flight guard (scroll events can
                                    // fire faster than the `loading` state re-renders)
  const inputRef   = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Run a search. `reset` true = fresh query (page 1); false = append next page.
  const runSearch = useCallback(async (q, pageToLoad, reset) => {
    if (!q.trim()) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const seq = ++seqRef.current
    loadingRef.current = true
    setLoading(true)
    setError(null)
    if (reset) setSearched(true)
    try {
      const { photos: got, nextPage } = await provider.search({
        query: q, page: pageToLoad, signal: ac.signal,
      })
      if (seq !== seqRef.current) return  // superseded by a newer search
      setPhotos(prev => reset ? got : [...prev, ...got])
      setPage(nextPage)
    } catch (err) {
      if (err?.name === 'AbortError') return
      if (seq !== seqRef.current) return
      const msg = err instanceof StockError
        ? err.message
        : 'Something went wrong searching stock photos.'
      setError(msg)
      if (reset) setPhotos([])
    } finally {
      if (seq === seqRef.current) { loadingRef.current = false; setLoading(false) }
    }
  }, [provider])

  const submit = (e) => {
    e?.preventDefault()
    setPhotos([])
    setPage(null)
    runSearch(query, 1, true)
  }

  // Infinite scroll: load the next page when nearing the bottom.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el || loading || loadingRef.current || !page) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) {
      runSearch(query, page, false)
    }
  }

  const pick = async (photo) => {
    if (picking) return
    setPicking(photo.id)
    try {
      const file = await fetchStockPhotoAsFile(photo)
      onPick(file)
    } catch (err) {
      const msg = err instanceof StockError
        ? err.message
        : 'Could not download that photo.'
      onError?.(msg)
      setPicking(null)
    }
  }

  useEffect(() => () => abortRef.current?.abort(), [])

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] flex flex-col z-[90]" role="dialog" aria-label="Stock photos">
      {/* Top bar: cancel + search field */}
      <div
        className="shrink-0 px-3 pb-3 flex items-center gap-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button onClick={onClose} aria-label="Close" className="p-2 text-white/60 active:text-white">
          <IconClose size={20} />
        </button>
        <form onSubmit={submit} className="flex-1">
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 h-10">
            <span className="text-white/40"><IconSearch /></span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search free photos…"
              enterKeyHint="search"
              className="flex-1 bg-transparent text-[15px] text-white placeholder-white/40 outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-white/40 active:text-white" aria-label="Clear">
                <IconClose size={16} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-2">
        {error && (
          <div className="mx-2 my-3 rounded-xl bg-red-500/15 text-red-200 text-sm px-3 py-2.5">
            {error}
          </div>
        )}

        {!searched && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white/40">
            <div className="text-white/60 text-[15px] font-medium mb-1">Search free stock photos</div>
            <div className="text-xs">Try “coffee”, “beach”, “texture”…</div>
          </div>
        )}

        {searched && !loading && !error && photos.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white/40">
            <div className="text-white/60 text-[15px] font-medium">No results for “{query}”.</div>
          </div>
        )}

        {/* Masonry via CSS columns */}
        {photos.length > 0 && (
          <div className="[column-count:2] [column-gap:8px] pt-1">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => pick(photo)}
                className="relative block w-full mb-2 rounded-lg overflow-hidden break-inside-avoid active:opacity-80"
                style={{ backgroundColor: photo.avgColor }}
              >
                <img
                  src={photo.thumb}
                  alt={photo.alt}
                  loading="lazy"
                  className="w-full block"
                  style={{ aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : undefined }}
                />
                {/* Photographer attribution (Pexels guideline) */}
                <div className="absolute inset-x-0 bottom-0 px-2 py-1 text-[10px] text-white/90 bg-gradient-to-t from-black/70 to-transparent text-left truncate pt-4">
                  {photo.photographer}
                </div>
                {picking === photo.id && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}

        {/* Provider credit (Pexels attribution guideline) */}
        {photos.length > 0 && !page && !loading && (
          <div className="text-center text-[11px] text-white/30 py-4">
            Photos provided by {provider.name}
          </div>
        )}
      </div>
    </div>
  )
}

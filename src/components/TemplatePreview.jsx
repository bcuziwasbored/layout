import { useEffect, useState } from 'react'
import { renderSlide } from '../renderSlide'
import { instantiateTemplate, templatePageBg } from '../templates'

// Live previews for styled content templates (issue #63). Bare photo grids keep
// their cheap div-schematic thumbnails in the callers; only styled templates
// (text/shapes/backgrounds) render through here so the preview shows the real
// fonts, colors, and composition. We reuse renderSlide — the single source of
// truth for drawing a slide — exactly like the #18 slide/project thumbnails.
//
// renderSlide can't draw a src-less image cell, so instantiateTemplate is asked
// to emit image cells as neutral gray placeholder rects (placeholderFill). The
// result reads as "photo goes here" while text and shapes render for real.

// Module-level cache keyed by template + ratio so scrolling the browser or
// switching category tabs never re-renders a preview that was already made.
// Bounded so a long session can't grow it without limit.
const cache = new Map()  // `${id}@${ratio.value}` -> string[] (one dataURL per page)
const MAX_CACHE = 120

function cacheKey(template, ratio) {
  return `${template.id}@${ratio.value}`
}

function put(key, urls) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(key, urls)
}

// Sequential id generator for a single instantiation (ids only need to be unique
// within the produced layer array — these previews never hit the store).
function seqIds() {
  let n = 0
  return () => `tp${n++}`
}

async function renderPreview(template, ratio) {
  const ps = template.pageSpan ?? 1
  const { layers } = instantiateTemplate(template, ratio, 0, seqIds(), '#d6d3ce')
  const slides = Array.from({ length: ps }, (_, p) => {
    const bg = templatePageBg(template, p)
    return bg ? { id: `p${p}`, ...bg } : { id: `p${p}` }
  })
  // ~240px-tall render — crisp at thumbnail size without over-rendering.
  const scale = 240 / ratio.h
  const imgCache = new Map()
  const urls = []
  for (let p = 0; p < ps; p++) {
    urls.push(await renderSlide(p, {
      slides, layers, ratio, bgColor: '#ffffff', bgGradient: null,
      scale, quality: 0.82, preferOriginal: false, imgCache,
    }))
  }
  return urls
}

export default function TemplatePreview({ template, ratio }) {
  const ps = template.pageSpan ?? 1
  // Read the rendered pages straight from the module cache each render; a cache
  // hit (already generated, or a prior mount of this template) shows instantly.
  // State is only a re-render nudge fired from the async render's callback — so
  // nothing calls setState synchronously inside the effect.
  const [, bump] = useState(0)
  const urls = cache.get(cacheKey(template, ratio)) ?? null

  useEffect(() => {
    const k = cacheKey(template, ratio)
    if (cache.has(k)) return
    let cancelled = false
    renderPreview(template, ratio)
      .then(u => { if (!cancelled) { put(k, u); bump(n => n + 1) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [template, ratio])

  return (
    <div className="absolute inset-0 flex">
      {Array.from({ length: ps }, (_, p) => (
        <div
          key={p}
          className="relative flex-1 h-full overflow-hidden"
          style={{ borderRight: p < ps - 1 ? '1px solid rgba(255,255,255,0.25)' : 'none' }}
        >
          {urls
            ? <img src={urls[p]} className="w-full h-full object-cover" draggable={false} alt="" />
            : <div className="w-full h-full bg-white/5 animate-pulse" />}
        </div>
      ))}
    </div>
  )
}

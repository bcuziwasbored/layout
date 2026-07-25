// Carousel preview (issue #89).
//
// A full-screen takeover that plays the ALREADY-RENDERED export images back as
// an Instagram carousel inside a phone-frame mock. It never renders anything:
// it receives the same data URLs the export screen is about to save, so opening
// it is instant and costs nothing beyond this chunk.
//
// Lazily loaded from ExportScreen (the #87 pattern) — a creator who just hits
// "Save" never downloads the gesture engine or the chrome mock.
//
// Gestures are hand-rolled on pointer events (no dependency, and no native
// scroller): a scroll container can't give us velocity-aware snapping that is
// clamped to one slide per flick, rubber-band that matches iOS, or a
// swipe-down-to-dismiss that shares the same pointer stream. The track is moved
// with a single translate3d written straight to the DOM, so a drag frame costs
// one style write rather than a React render.

import { useEffect, useRef, useState } from 'react'

// ── Feel constants ────────────────────────────────────────────────────────────
const FLICK_V      = 0.35  // px/ms — above this, a release is a flick, not a drag
const PROJECT_MS   = 90    // how far a slow release is projected before snapping
const RUBBER       = 0.35  // resistance factor past the first/last slide
const AXIS_LOCK_PX = 6     // movement before the gesture commits to an axis
const DISMISS_PX   = 96    // downward distance that dismisses on release
const DISMISS_V    = 0.6   // px/ms — a fast flick down dismisses at any distance
// Snap spring, tuned to be critically damped at 60fps: any softer damping
// overshoots far enough to flash the neighbouring slide, any harder and the
// release velocity is swallowed and the snap reads as a teleport. This pair
// settles a full-slide move in ~330ms with zero overshoot, seeded velocity or not.
const STIFFNESS    = 0.22  // spring constant of the snap (per 60fps frame)
const DAMPING      = 0.48  // velocity retained per frame
const FRAME_MS     = 1000 / 60

// ── Phone-frame geometry ──────────────────────────────────────────────────────
const BEZEL    = 8   // frame padding around the "screen"
const STATUS_H = 26  // status strip (holds the island pill)
const HOME_H   = 22  // home-indicator strip
const HEADER_H = 52  // preview's own close/toggle row
const DOTS_H   = 44

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n)

// Fit the slide inside the viewport, leaving room for the frame chrome, the
// preview header and the dots. Returns the on-screen size of one slide.
function measure(ratio) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxW = Math.min(vw - 56, 400)
  const maxH = vh - HEADER_H - DOTS_H - 2 * BEZEL - STATUS_H - HOME_H - 32
  const scale = Math.min(maxW / ratio.w, maxH / ratio.h)
  return {
    w: Math.max(120, Math.round(ratio.w * scale)),
    h: Math.max(120, Math.round(ratio.h * scale)),
  }
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ── IG chrome hint ────────────────────────────────────────────────────────────
// Deliberately a silhouette, not a replica: enough to judge what the platform
// UI will cover (top gradient + header row, bottom action bar) without pretending
// to be Instagram. Overlays the slide so toggling it never resizes anything.
function IgChrome({ index, count }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Top: gradient + avatar/username placeholder + slide counter */}
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-2 px-3"
        style={{
          height: 54,
          background: 'linear-gradient(to bottom, rgba(0,0,0,.55), rgba(0,0,0,0))',
        }}
      >
        <div className="rounded-full bg-white/30" style={{ width: 22, height: 22 }} />
        <div className="flex flex-col gap-1">
          <div className="rounded-full bg-white/45" style={{ width: 68, height: 7 }} />
          <div className="rounded-full bg-white/25" style={{ width: 44, height: 5 }} />
        </div>
        <div className="ml-auto">
          {count > 1 && (
            <div className="rounded-full bg-black/45 text-white/85 text-[10px] font-semibold px-2 py-0.5">
              {index + 1}/{count}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: gradient + action-bar silhouette + caption placeholder */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-end gap-2 px-3 pb-3"
        style={{
          height: 88,
          background: 'linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,0))',
        }}
      >
        <div className="flex items-center gap-4 text-white/75">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 20.5 3.8 12.6a4.8 4.8 0 1 1 8.2-4.3 4.8 4.8 0 1 1 8.2 4.3Z" />
          </svg>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 11.6c0 4.2-4 7.6-9 7.6a10 10 0 0 1-2.9-.4L4 20.5l1.4-3.6A7.2 7.2 0 0 1 3 11.6C3 7.4 7 4 12 4s9 3.4 9 7.6Z" />
          </svg>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21.5 3.5 2.8 10.2l7 2.6 2.6 7Z" />
          </svg>
          <svg className="ml-auto" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 3.5h12v17l-6-4.6-6 4.6Z" />
          </svg>
        </div>
        <div className="rounded-full bg-white/25" style={{ width: '62%', height: 6 }} />
      </div>
    </div>
  )
}

export default function CarouselPreview({ images, ratio, startIndex = 0, onClose }) {
  const count = images.length
  const [index, setIndex] = useState(() => clamp(startIndex, 0, Math.max(count - 1, 0)))
  const [chromeOn, setChromeOn] = useState(true)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const [size, setSize] = useState(() => measure(ratio))
  const [mounted, setMounted] = useState(false)

  const trackRef    = useRef(null)
  const sheetRef    = useRef(null)
  const backdropRef = useRef(null)
  const animRef     = useRef(0)
  const xRef        = useRef(0)     // current track translateX, px
  const dragRef     = useRef(null)  // live gesture, or null
  const closingRef  = useRef(false)

  const pageW = size.w

  // ── Track position ──────────────────────────────────────────────────────────
  const applyX = (x) => {
    xRef.current = x
    const el = trackRef.current
    if (el) el.style.transform = `translate3d(${x}px,0,0)`
  }

  const stopAnim = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = 0
  }

  // Snap to `target`, seeded with the release velocity so a flick carries its
  // momentum into the settle instead of restarting from zero. Critically damped
  // enough that it never overshoots into the neighbouring slide.
  const settleTo = (target, v0 = 0, width = pageW) => {
    stopAnim()
    setIndex(target)
    const dest = -target * width
    if (reduced) { applyX(dest); return }          // instant snap, no momentum
    let vel = v0 * FRAME_MS                        // px/ms → px per frame
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min(32, now - last) / FRAME_MS
      last = now
      vel += (dest - xRef.current) * STIFFNESS * dt
      vel *= Math.pow(DAMPING, dt)
      applyX(xRef.current + vel * dt)
      if (Math.abs(dest - xRef.current) < 0.5 && Math.abs(vel) < 0.5) {
        applyX(dest)
        animRef.current = 0
        return
      }
      animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
  }

  // Position the track under the starting slide, and keep it aligned on resize.
  useEffect(() => {
    stopAnim()
    applyX(-clamp(index, 0, Math.max(count - 1, 0)) * pageW)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- realignment is for size changes only; index moves are animated by settleTo
  }, [pageW, count])

  useEffect(() => () => stopAnim(), [])

  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(r)
  }, [])

  useEffect(() => {
    const onResize = () => setSize(measure(ratio))
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [ratio])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ── Dismiss ─────────────────────────────────────────────────────────────────
  const applyDismiss = (dy, animate) => {
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    const t = animate && !reduced ? 'transform .22s cubic-bezier(.32,.72,0,1), opacity .22s ease' : ''
    if (sheet) {
      sheet.style.transition = t
      sheet.style.transform = `translate3d(0,${dy}px,0)`
    }
    if (backdrop) {
      backdrop.style.transition = t
      backdrop.style.opacity = String(clamp(1 - Math.abs(dy) / (window.innerHeight * 0.9), 0.35, 1))
    }
  }

  const closeWithDismiss = () => {
    if (closingRef.current) return
    closingRef.current = true
    if (reduced) { onClose(); return }
    applyDismiss(window.innerHeight, true)
    if (backdropRef.current) backdropRef.current.style.opacity = '0'
    setTimeout(onClose, 200)
  }

  // ── Pointer gesture ─────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (dragRef.current || closingRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stopAnim()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    // Start from where the track VISUALLY is, so grabbing mid-animation feels
    // like catching the slide rather than snapping back to the last committed one.
    const base = clamp(Math.round(-xRef.current / pageW), 0, Math.max(count - 1, 0))
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      baseX: xRef.current, baseIndex: base,
      axis: null, v: 0,
      last: 0, lastT: performance.now(),
    }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.axis) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      d.last = d.axis === 'x' ? e.clientX : e.clientY
      d.lastT = performance.now()
    }

    const pos = d.axis === 'x' ? e.clientX : e.clientY
    const now = performance.now()
    const dt = now - d.lastT
    if (dt > 0) {
      // Light smoothing: a single raw sample is noisy, a long average lags.
      d.v = d.v * 0.25 + ((pos - d.last) / dt) * 0.75
      d.last = pos
      d.lastT = now
    }

    if (d.axis === 'x') {
      const min = -(count - 1) * pageW
      let x = d.baseX + dx
      if (x > 0) x = x * RUBBER                       // rubber-band before slide 1
      else if (x < min) x = min + (x - min) * RUBBER  // …and past the last
      applyX(x)
      const near = clamp(Math.round(-x / pageW), 0, Math.max(count - 1, 0))
      if (near !== index) setIndex(near)
    } else {
      // Downward drags dismiss; upward ones are pure rubber-band.
      applyDismiss(dy > 0 ? dy : dy * RUBBER, false)
    }
  }

  const endDrag = (e) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* synthetic pointer */ }

    if (d.axis === 'y') {
      const dy = e.clientY - d.startY
      if (dy > DISMISS_PX || d.v > DISMISS_V) closeWithDismiss()
      else applyDismiss(0, true)
      return
    }
    if (d.axis !== 'x') return  // a tap: nothing to settle

    let target
    if (Math.abs(d.v) > FLICK_V) {
      target = d.baseIndex + (d.v < 0 ? 1 : -1)   // leftward flick → next slide
    } else {
      target = Math.round(-(xRef.current + d.v * PROJECT_MS) / pageW)
    }
    // One slide per gesture (IG behaviour), then clamp into range.
    target = clamp(target, d.baseIndex - 1, d.baseIndex + 1)
    settleTo(clamp(target, 0, Math.max(count - 1, 0)), d.v)
  }

  // ── Keyboard (desktop) ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { closeWithDismiss(); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const from = clamp(Math.round(-xRef.current / pageW), 0, Math.max(count - 1, 0))
        settleTo(clamp(from + (e.key === 'ArrowRight' ? 1 : -1), 0, Math.max(count - 1, 0)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read live values through refs
  }, [pageW, count, reduced])

  const goTo = (i) => settleTo(clamp(i, 0, Math.max(count - 1, 0)))

  return (
    <div
      className="fixed inset-0 z-[60] select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Carousel preview"
    >
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{
          background: '#0A0A0B',
          opacity: mounted ? 1 : 0,
          transition: reduced ? 'none' : 'opacity .18s ease',
        }}
      />

      <div ref={sheetRef} className="relative h-full flex flex-col items-center">
        {/* Header: exit + IG chrome toggle */}
        <div
          className="w-full flex items-center justify-between px-4 shrink-0"
          style={{ height: HEADER_H, paddingTop: 'max(0px, env(safe-area-inset-top))' }}
        >
          <button
            onClick={closeWithDismiss}
            aria-label="Close preview"
            className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full text-white/70 active:bg-white/10 active:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <span className="text-[13px] font-semibold text-white/70">Preview</span>
          <button
            onClick={() => setChromeOn(v => !v)}
            aria-pressed={chromeOn}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
              chromeOn ? 'bg-white text-black' : 'bg-white/10 text-white/55 active:text-white'
            }`}
          >
            IG chrome
          </button>
        </div>

        {/* Phone frame */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div
            className="relative"
            style={{
              padding: BEZEL,
              borderRadius: 40,
              background: '#141419',
              border: '1px solid rgba(255,255,255,.14)',
              boxShadow: '0 24px 60px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.05)',
            }}
          >
            <div
              className="overflow-hidden flex flex-col"
              style={{ borderRadius: 32, background: '#000' }}
            >
              {/* Status strip + dynamic-island pill */}
              <div className="flex items-center justify-center shrink-0" style={{ height: STATUS_H }}>
                <div className="rounded-full bg-white/12" style={{ width: 62, height: 15 }} />
              </div>

              {/* Swipe surface */}
              <div
                className="relative overflow-hidden"
                style={{ width: size.w, height: size.h, touchAction: 'none', cursor: 'grab' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <div
                  ref={trackRef}
                  className="flex h-full"
                  style={{ width: size.w * Math.max(count, 1), willChange: 'transform' }}
                >
                  {images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      draggable={false}
                      alt={`Slide ${i + 1} of ${count}`}
                      className="shrink-0 object-cover pointer-events-none"
                      style={{ width: size.w, height: size.h }}
                    />
                  ))}
                </div>
                {chromeOn && <IgChrome index={index} count={count} />}
              </div>

              {/* Home indicator */}
              <div className="flex items-center justify-center shrink-0" style={{ height: HOME_H }}>
                <div className="rounded-full bg-white/25" style={{ width: 96, height: 4 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Page dots — a single-slide project has nothing to indicate */}
        <div
          className="shrink-0 flex items-center justify-center gap-2"
          style={{ height: DOTS_H, paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          {count > 1 && images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              className="p-1.5 -m-1"
            >
              <span
                className={`block rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/30'}`}
                style={{ width: 6, height: 6 }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

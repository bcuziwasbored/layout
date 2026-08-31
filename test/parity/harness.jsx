// Browser half of the editor↔export parity suite (issue #93).
//
// Renders every case in cases.js TWICE at scale 1 and diffs the two bitmaps:
//   1. through the REAL editor components — TextCell / ShapeCell / FilledCell
//      exported from src/components/Canvas.jsx — inside a Konva Stage whose
//      Layer/Group props mirror the editor's (Group offset by the slice origin,
//      no zoom, Konva.pixelRatio forced to 1), and
//   2. through src/renderSlide.js, the canvas2d exporter, at scale 1 / PNG.
//
// Driven from Node by run.mjs over CDP: it waits for window.__parityReady, then
// calls window.__parityRunAll().

import React from 'react'
import { createRoot } from 'react-dom/client'
import Konva from 'konva'
import { Stage, Layer, Group, Rect } from 'react-konva'

import { setForceSRGB, photoColorSpace } from '../../src/colorSpace.js'
import { TextCell, ShapeCell, FilledCell } from '../../src/components/Canvas.jsx'
import { renderSlide } from '../../src/renderSlide.js'
import { ensureLayerFontsLoaded } from '../../src/fonts.js'
import { CASES, RATIO, PHOTO_SRC, PHOTO_W, PHOTO_H } from './cases.js'

// ─── Colour-space normalization (issue #109) ───────────────────────────────────
// The exporter now draws into a Display-P3 canvas where the browser supports one,
// but Konva 10 exposes no colour-space knob (Layer builds `new SceneCanvas()`;
// SceneContext hardcodes its getContext attributes), so the editor side of every
// comparison is unavoidably sRGB. Diffing an sRGB bitmap against a P3 one measures
// the gamut conversion, not the renderers — a saturated fill would read as a large
// "regression" that no code change caused.
//
// So the suite pins BOTH sides to sRGB. That keeps every case an apples-to-apples
// geometry/rasterization comparison at its existing tolerances, and it doubles as
// the regression guard for the sRGB fallback path: if routing the exporter through
// get2dContext changed any pixel in sRGB mode, these 16 cases would say so.
//
// The wide-gamut behaviour itself is covered separately, by test/colorspace.test.mjs.
//
// This runs at module scope. None of the modules imported above creates a canvas
// while it is being evaluated (adjustments.js generates its noise tile lazily, on
// first use), so no context can have been cached in the wrong space by this point;
// boot() re-asserts it before any case is measured.
setForceSRGB(true)

// The editor never rasterizes at a device pixel ratio the exporter doesn't know
// about in this harness — pin both sides to 1 device pixel per logical pixel.
Konva.pixelRatio = 1

// ─── Diff metrics ──────────────────────────────────────────────────────────────
// NOISE_FLOOR: per-channel differences at or below this are treated as zero. The
// editor paints a `rgba(0,0,0,0.01)` hit rectangle over every layer (needed for
// pointer hit-testing) that the exporter correctly omits; that is a uniform
// ~2.5/255 offset across the layer box. It is invisible on screen but would
// otherwise dominate a mean-difference metric and hide real regressions.
const NOISE_FLOOR = 6
// VISIBLE_DIFF: a difference a person could actually see on a flat field. The
// per-case pct assertion counts pixels above this — that is the metric geometry
// shifts (a moved baseline, a mis-sliced seam) blow through.
const VISIBLE_DIFF = 24

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const raf = () => new Promise(r => requestAnimationFrame(() => r()))

// ─── Deterministic test photo ──────────────────────────────────────────────────
// Generated in-page (no network, identical bytes every run) with plenty of
// high-frequency detail so resampling/rotation differences show up.
function makePhotoDataURL() {
  const c = document.createElement('canvas')
  c.width = PHOTO_W
  c.height = PHOTO_H
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, PHOTO_W, PHOTO_H)
  g.addColorStop(0, '#ff8a3d')
  g.addColorStop(0.5, '#2fb3a8')
  g.addColorStop(1, '#20264f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H)
  // Checkerboard — hard edges catch subpixel sampling drift.
  const cell = 40
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  for (let y = 0; y < PHOTO_H; y += cell) {
    for (let x = 0; x < PHOTO_W; x += cell) {
      if (((x / cell) + (y / cell)) % 2 === 0) ctx.fillRect(x, y, cell, cell)
    }
  }
  // A few solid discs — curved edges catch clip/mask differences.
  const discs = [[180, 160, 110, '#fde047'], [560, 200, 90, '#1d4ed8'], [380, 430, 130, '#f43f5e']]
  for (const [x, y, r, fill] of discs) {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#0b1020'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, PHOTO_W - 8, PHOTO_H - 8)
  return c.toDataURL('image/png')
}

const PHOTO_DATA_URL = makePhotoDataURL()

// Swap the case's placeholder src for the generated data URL. srcOriginal is
// deliberately left unset so both renderers read the exact same bitmap.
function resolveLayers(layers) {
  return layers.map(l => (l.src === PHOTO_SRC ? { ...l, src: PHOTO_DATA_URL } : l))
}

// ─── Konva side ────────────────────────────────────────────────────────────────
// Mirrors the editor's Stage tree (Canvas.jsx): a Group translated so the target
// slide's slice origin sits at (0,0), the per-slide background Rect (solid or
// linear gradient, same points math), then the layer cells in order. Editor-only
// chrome (selection handles, snap guides, dividers, dimming) is omitted — none of
// it is part of the slide the user is composing.
function linearGradientPoints(angleDeg, w, h) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const len = Math.abs(w * sin) + Math.abs(h * cos)
  const cx = w / 2, cy = h / 2
  return {
    x1: cx - sin * len / 2, y1: cy - cos * len / 2,
    x2: cx + sin * len / 2, y2: cy + cos * len / 2,
  }
}

function SlideBackground({ slide, index, ratio, bgColor, bgGradient }) {
  const grad = slide.bgGradient ?? bgGradient
  if (grad) {
    const gp = linearGradientPoints(grad.angle, ratio.w, ratio.h)
    return (
      <Rect x={index * ratio.w} y={0} width={ratio.w} height={ratio.h}
        fillLinearGradientStartPoint={{ x: gp.x1, y: gp.y1 }}
        fillLinearGradientEndPoint={{ x: gp.x2, y: gp.y2 }}
        fillLinearGradientColorStops={[0, grad.stops[0], 1, grad.stops[1]]}
        listening={false} />
    )
  }
  return (
    <Rect x={index * ratio.w} y={0} width={ratio.w} height={ratio.h}
      fill={slide.bgColor ?? bgColor} listening={false} />
  )
}

function CaseStage({ testCase, layers, stageRef }) {
  const ratio = testCase.ratio
  const sliceStart = testCase.slideIdx * ratio.w
  return (
    <Stage ref={stageRef} width={ratio.w} height={ratio.h}>
      <Layer>
        <Group x={-sliceStart} y={0}>
          {testCase.slides.map((slide, i) => (
            <SlideBackground key={slide.id} slide={slide} index={i} ratio={ratio}
              bgColor={testCase.bgColor} bgGradient={testCase.bgGradient} />
          ))}
          {layers.map(layer => {
            if (layer.type === 'text') return <TextCell key={layer.id} layer={layer} isEditing={false} />
            if (layer.type === 'shape') return <ShapeCell key={layer.id} layer={layer} />
            return <FilledCell key={layer.id} layer={layer} />
          })}
        </Group>
      </Layer>
    </Stage>
  )
}

let root = null
const stageRef = React.createRef()

function canvasSignature(canvas) {
  // Cheap convergence probe: sample a coarse grid rather than the full bitmap.
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let h = 2166136261
  const step = 4 * 37   // stride across pixels, prime to avoid aliasing with tiles
  for (let i = 0; i < data.length; i += step) {
    h ^= data[i]
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Render the case through Konva and wait for the layer to stop changing (images
// decode asynchronously via useImage, and useAdjustedImage re-draws once its
// filtered canvas is ready).
async function renderKonva(testCase, layers) {
  const host = document.getElementById('stage-host')
  if (!root) root = createRoot(host)
  // Tear the previous case down first so nothing from it can survive into this
  // render (React would otherwise reconcile same-typed nodes across cases).
  root.render(null)
  await raf()
  root.render(<CaseStage testCase={testCase} layers={layers} stageRef={stageRef} />)

  let last = null
  let stable = 0
  for (let i = 0; i < 120; i++) {
    await raf()
    await sleep(40)
    const stage = stageRef.current
    if (!stage) continue
    const konvaLayer = stage.getLayers()[0]
    konvaLayer.draw()
    const canvas = konvaLayer.getCanvas()._canvas
    const sig = canvasSignature(canvas)
    if (sig === last) {
      stable++
      // Require a minimum settle window as well as stability, so a case can't be
      // sampled as "converged" while an image is still decoding.
      if (stable >= 3 && i >= 6) return canvas
    } else {
      stable = 0
      last = sig
    }
  }
  throw new Error(`Konva render never converged for case ${testCase.id}`)
}

// ─── Export side ───────────────────────────────────────────────────────────────
async function renderExport(testCase, layers) {
  const ratio = testCase.ratio
  const dataURL = await renderSlide(testCase.slideIdx, {
    slides: testCase.slides,
    layers,
    ratio,
    bgColor: testCase.bgColor,
    bgGradient: testCase.bgGradient,
    scale: 1,
    format: 'png',
    // Both renderers must read the same bitmap: the cases never set srcOriginal,
    // and preferOriginal:false makes that explicit.
    preferOriginal: false,
  })
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('export image failed to decode'))
    img.src = dataURL
  })
  const canvas = document.createElement('canvas')
  canvas.width = ratio.w
  canvas.height = ratio.h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return canvas
}

// ─── Diff ──────────────────────────────────────────────────────────────────────
function diff(aCanvas, bCanvas) {
  const w = aCanvas.width, h = aCanvas.height
  if (bCanvas.width !== w || bCanvas.height !== h) {
    throw new Error(`size mismatch: konva ${w}×${h} vs export ${bCanvas.width}×${bCanvas.height}`)
  }
  const a = aCanvas.getContext('2d').getImageData(0, 0, w, h).data
  const b = bCanvas.getContext('2d').getImageData(0, 0, w, h).data

  let sumRaw = 0
  let sumFloored = 0
  let maxDiff = 0
  let visible = 0
  const n = w * h

  const heat = document.createElement('canvas')
  heat.width = w; heat.height = h
  const heatCtx = heat.getContext('2d')
  const heatData = heatCtx.createImageData(w, h)

  for (let p = 0; p < n; p++) {
    const i = p * 4
    const dr = Math.abs(a[i] - b[i])
    const dg = Math.abs(a[i + 1] - b[i + 1])
    const db = Math.abs(a[i + 2] - b[i + 2])
    const chanMax = Math.max(dr, dg, db)
    sumRaw += dr + dg + db
    if (dr > NOISE_FLOOR) sumFloored += dr
    if (dg > NOISE_FLOOR) sumFloored += dg
    if (db > NOISE_FLOOR) sumFloored += db
    if (chanMax > maxDiff) maxDiff = chanMax
    if (chanMax > VISIBLE_DIFF) visible++
    const v = Math.min(255, chanMax * 6)
    heatData.data[i] = v
    heatData.data[i + 1] = chanMax > VISIBLE_DIFF ? 0 : v
    heatData.data[i + 2] = chanMax > VISIBLE_DIFF ? 0 : v
    heatData.data[i + 3] = 255
  }
  heatCtx.putImageData(heatData, 0, 0)

  return {
    meanRaw: sumRaw / (n * 3),
    mean: sumFloored / (n * 3),
    maxDiff,
    pctVisible: (visible / n) * 100,
    heat,
  }
}

// ─── Runner entry points ───────────────────────────────────────────────────────
async function runCase(testCase, { keepImages }) {
  const layers = resolveLayers(testCase.layers)
  const konva = await renderKonva(testCase, layers)
  const exported = await renderExport(testCase, layers)
  const d = diff(konva, exported)
  const failed = d.mean > testCase.meanTol || d.pctVisible > testCase.pctTol
  const out = {
    id: testCase.id,
    name: testCase.name,
    mean: d.mean,
    meanRaw: d.meanRaw,
    maxDiff: d.maxDiff,
    pctVisible: d.pctVisible,
    meanTol: testCase.meanTol,
    pctTol: testCase.pctTol,
    failed,
  }
  if (failed || keepImages) {
    out.images = {
      konva: konva.toDataURL('image/png'),
      export: exported.toDataURL('image/png'),
      heat: d.heat.toDataURL('image/png'),
    }
  }
  return out
}

async function runAll(opts = {}) {
  const results = []
  for (const testCase of CASES) {
    const withRatio = { ...testCase, ratio: testCase.ratio ?? RATIO }
    try {
      results.push(await runCase(withRatio, opts))
    } catch (err) {
      results.push({
        id: testCase.id, name: testCase.name, failed: true,
        error: String(err && err.stack ? err.stack : err),
      })
    }
  }
  return results
}

async function boot() {
  // Both sides of every diff must be in the same colour space — see the
  // normalization note at the top of this file.
  if (photoColorSpace() !== 'srgb') {
    throw new Error(`parity harness expected a forced-sRGB pipeline, got ${photoColorSpace()}`)
  }
  // Fonts first, and settled, so neither renderer can pick up a font mid-run.
  const textLayers = CASES.flatMap(c => c.layers.filter(l => l.type === 'text'))
  await ensureLayerFontsLoaded(textLayers, 10000)
  // Decode the test photo once up front so per-case image loads are cache hits.
  await new Promise(resolve => {
    const img = new Image()
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve)
    img.onerror = () => resolve()
    img.src = PHOTO_DATA_URL
  })
  await document.fonts.ready
  await sleep(250)
  // Discarded warm-up pass: decodes the test photo, primes the grain tile, and
  // — critically — forces any late-arriving webfont to land BEFORE measuring.
  await runAll({ warmup: true })
  await document.fonts.ready
  window.__parityReady = true
}

window.__parityRunAll = (opts) => runAll(opts ?? {})
window.__parityCaseIds = CASES.map(c => c.id)

boot().catch(err => {
  window.__parityError = String(err && err.stack ? err.stack : err)
})

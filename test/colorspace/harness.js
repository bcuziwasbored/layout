// Browser half of the wide-gamut (Display-P3) probe — issue #109.
//
// Pushes a synthetic Display-P3 test image through the REAL pipeline —
// Canvas.jsx's processImageFile (the import downscale) and then renderSlide.js
// (the export) — and reports the exported pixel measured back in P3 coordinates,
// plus the raw head of the encoded file so Node can look for the ICC tag.
//
// Run twice by test/colorspace.test.mjs:
//   forceSRGB:false  → the new P3 pipeline
//   forceSRGB:true   → the old sRGB pipeline, as the control
// The difference between the two is the whole point: the control CLIPS the probe
// colour to the sRGB gamut, the P3 run does not.
//
// Driven from Node over CDP: it waits for window.__csReady, then calls
// window.__csRunProbe({ forceSRGB }).

import { setForceSRGB, supportsDisplayP3, photoColorSpace } from '../../src/colorSpace.js'
import { processImageFile } from '../../src/imageImport.js'
import { renderSlide } from '../../src/renderSlide.js'
import { fitInCell } from '../../src/useStore.js'

// The probe colour: the most saturated red Display-P3 can express. In sRGB
// coordinates it is roughly (1.22, -0.22, -0.04) — i.e. genuinely outside the
// gamut, so any sRGB canvas in the path has to clamp it and the damage is
// permanent and measurable.
const PROBE_FILL = 'color(display-p3 1 0 0)'

// Bigger than Canvas.jsx's MAX_DIM (2048) on the long edge, so processImageFile
// takes its DOWNSCALE branch — the canvas the issue is actually about. A short
// second axis keeps the bitmap cheap.
const SRC_W = 2400
const SRC_H = 240

const RATIO = { w: 600, h: 750 }

function p3Canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  // Deliberately NOT via get2dContext: this canvas is the test FIXTURE standing
  // in for an iPhone photo, so it must be P3 in both runs, including the control.
  return [c, c.getContext('2d', { colorSpace: 'display-p3' })]
}

// A Display-P3 PNG File, as if it had come off a phone camera.
async function makeProbeFile() {
  const [c, ctx] = p3Canvas(SRC_W, SRC_H)
  ctx.fillStyle = PROBE_FILL
  ctx.fillRect(0, 0, SRC_W, SRC_H)
  const blob = await new Promise((resolve, reject) => {
    c.toBlob(b => (b ? resolve(b) : reject(new Error('probe toBlob failed'))), 'image/png')
  })
  // PNG (not JPEG) so the fixture itself is lossless — every value the assertions
  // read back is the pipeline's doing, not the encoder's.
  return new File([blob], 'p3-probe.png', { type: 'image/png' })
}

function decode(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('export image failed to decode'))
    img.src = dataURL
  })
}

// Centre pixel of an encoded image, read in Display-P3 coordinates. Measuring in
// P3 is what makes the two runs comparable: a colour that survived reads as
// (255, 0, 0) here, while one that was clipped to sRGB red on the way through
// reads as roughly (234, 51, 35) — the green/blue lift IS the damage.
async function measureP3(dataURL) {
  const img = await decode(dataURL)
  const [, ctx] = p3Canvas(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, 0, 0)
  const x = Math.floor(img.naturalWidth / 2)
  const y = Math.floor(img.naturalHeight / 2)
  const d = ctx.getImageData(x, y, 1, 1, { colorSpace: 'display-p3' }).data
  return [d[0], d[1], d[2]]
}

// First `n` bytes of a data URL's payload, as a plain array Node can inspect. The
// ICC tag lives in the file header (PNG's iCCP chunk precedes IDAT; JPEG's
// ICC_PROFILE APP2 segment sits right after SOI/APP0), so the head is enough and
// it keeps a multi-MB PNG from crossing the CDP bridge.
function head(dataURL, n = 4096) {
  const bin = atob(dataURL.slice(dataURL.indexOf(',') + 1))
  const take = Math.min(n, bin.length)
  const out = new Array(take)
  for (let i = 0; i < take; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function runProbe({ forceSRGB }) {
  setForceSRGB(forceSRGB)
  if (photoColorSpace() !== (forceSRGB ? 'srgb' : 'display-p3')) {
    throw new Error(`unexpected pipeline colour space ${photoColorSpace()} for forceSRGB=${forceSRGB}`)
  }

  const file = await makeProbeFile()
  const imported = await processImageFile(file)
  if (imported.naturalW >= SRC_W) {
    throw new Error(`probe did not exercise the downscale branch (naturalW ${imported.naturalW})`)
  }

  // One full-bleed image layer. No crop, no adjustments, no shape — the export
  // path is being measured for colour, and anything else would only add ways for
  // the probe pixel to move.
  const layer = {
    id: 'p3-probe', type: 'image',
    x: 0, y: 0, w: RATIO.w, h: RATIO.h,
    src: imported.src, naturalW: imported.naturalW, naturalH: imported.naturalH,
    // The app's own cover-fit, so the layer is placed exactly as the editor would
    // place it on import.
    ...fitInCell(imported.naturalW, imported.naturalH, RATIO.w, RATIO.h),
  }
  const slideArgs = {
    slides: [{ id: 's1' }],
    layers: [layer],
    ratio: RATIO,
    bgColor: '#ffffff',
    scale: 1,
    preferOriginal: false,
  }

  const png = await renderSlide(0, { ...slideArgs, format: 'png' })
  const jpeg = await renderSlide(0, { ...slideArgs, format: 'jpeg', quality: 0.95 })

  return {
    forceSRGB,
    colorSpace: photoColorSpace(),
    importedSize: [imported.naturalW, imported.naturalH],
    pngP3: await measureP3(png),
    jpegP3: await measureP3(jpeg),
    pngHead: head(png),
    jpegHead: head(jpeg),
  }
}

window.__csRunProbe = (opts) => runProbe(opts ?? { forceSRGB: false })
window.__csSupportsP3 = supportsDisplayP3()
window.__csReady = true

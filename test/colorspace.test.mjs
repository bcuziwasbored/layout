// Node half of the wide-gamut (Display-P3) pipeline probe — issue #109.
//
//   npm run test:colorspace
//
// Starts the project's own Vite dev server, drives headless Chrome (which has
// Display-P3 canvas support) through puppeteer, and runs a saturated P3 colour
// through the REAL import→export path twice: once with the pipeline in P3 and
// once with colorSpace.js forced back to sRGB.
//
// Three things are asserted:
//   1. SURVIVAL   — the P3 run keeps the probe colour out past the sRGB gamut,
//                   where the forced-sRGB run clips it. Measured numerically, in
//                   P3 coordinates, on both PNG and JPEG output.
//   2. ICC TAG    — the P3 export is tagged (PNG iCCP chunk / JPEG ICC_PROFILE
//                   APP2 marker), so an sRGB display tone-maps it correctly
//                   instead of showing raw wide-gamut numbers.
//   3. FALLBACK   — the forced-sRGB run still produces sRGB-gamut output, i.e.
//                   the escape hatch really does restore the old behaviour. (The
//                   pixel-level proof that the fallback is unchanged is the
//                   parity suite, which runs entirely under forceSRGB.)
//
// Exit code 0 = pass, 1 = fail.

import { createServer } from 'vite'
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

// ─── Expected probe values ─────────────────────────────────────────────────────
// All in Display-P3 coordinates (the space the harness measures in).
//
// color(display-p3 1 0 0) is (255, 0, 0) in P3. Converted to sRGB it is about
// (1.22, -0.22, -0.04) — outside the gamut on all three channels — so an sRGB
// canvas clamps it to plain sRGB red, which expressed back in P3 is ~(234, 51, 35).
// The green channel is therefore the single cleanest witness: ~0 if the colour
// survived, ~51 if something in the path clipped it.
const P3_GREEN_MAX = 8       // survived: green stays at the floor
const SRGB_GREEN_MIN = 30    // clipped: the sRGB clamp lifts green well off zero
const P3_RED_MIN = 250       // survived: red stays pinned at full P3 red

// ─── ICC parsing ───────────────────────────────────────────────────────────────
// PNG: a colour profile rides in an `iCCP` chunk (or `cICP` for a coding-independent
// tag). An UNTAGGED PNG is sRGB by convention and carries neither.
function pngICC(bytes) {
  const buf = Buffer.from(bytes)
  return { iCCP: buf.includes('iCCP'), cICP: buf.includes('cICP') }
}

// JPEG: the profile is an APP2 segment whose payload begins with the NUL-terminated
// identifier "ICC_PROFILE".
function jpegICC(bytes) {
  return Buffer.from(bytes).includes('ICC_PROFILE')
}

// ─── Assertions ────────────────────────────────────────────────────────────────
const failures = []
function check(ok, label, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

async function main() {
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    logLevel: 'error',
    server: { port: 0, strictPort: false },
  })
  await server.listen()
  const base = server.resolvedUrls.local[0]
  const url = new URL('test/colorspace/harness.html', base).href

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // NOTE: unlike the parity suite this deliberately does NOT pass
      // --force-color-profile=srgb. That flag sets the DISPLAY profile and does
      // not disable canvas colour spaces (verified either way), but leaving it
      // off keeps the one test that is about colour management free of a flag
      // that overrides colour management.
    ],
  })

  let p3, srgb
  try {
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', e => pageErrors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()) })

    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    await page.waitForFunction('window.__csReady === true', { timeout: 120000, polling: 250 })

    const supported = await page.evaluate(() => window.__csSupportsP3)
    if (!supported) {
      // Not a silent skip: this suite exists to measure P3, and a browser that
      // can't do P3 can't measure it. Headless Chrome has supported it since 94.
      throw new Error('headless Chrome reported no display-p3 canvas support — cannot run the probe')
    }

    p3 = await page.evaluate(() => window.__csRunProbe({ forceSRGB: false }))
    srgb = await page.evaluate(() => window.__csRunProbe({ forceSRGB: true }))

    if (pageErrors.length) console.warn('\nPage errors during run:\n  ' + pageErrors.join('\n  '))
  } finally {
    await browser.close()
    await server.close()
  }

  const show = (r) => `PNG ${JSON.stringify(r.pngP3)} JPEG ${JSON.stringify(r.jpegP3)} (P3 coords)`
  console.log(`\nProbe: color(display-p3 1 0 0) through import→export, ` +
    `downscaled to ${p3.importedSize.join('×')}`)
  console.log(`  display-p3 pipeline : ${show(p3)}`)
  console.log(`  forced-sRGB pipeline: ${show(srgb)}`)

  console.log('\n1. Wide-gamut survival')
  check(p3.colorSpace === 'display-p3', 'P3 run uses a display-p3 pipeline', p3.colorSpace)
  check(p3.pngP3[1] <= P3_GREEN_MAX, 'PNG: P3 red survives (green at floor)',
    `green ${p3.pngP3[1]} <= ${P3_GREEN_MAX}`)
  check(p3.pngP3[0] >= P3_RED_MIN, 'PNG: P3 red stays saturated',
    `red ${p3.pngP3[0]} >= ${P3_RED_MIN}`)
  check(srgb.pngP3[1] >= SRGB_GREEN_MIN, 'PNG: forced-sRGB run clips it (control)',
    `green ${srgb.pngP3[1]} >= ${SRGB_GREEN_MIN}`)
  check(srgb.pngP3[1] - p3.pngP3[1] >= 20, 'PNG: P3 run is measurably wider than the control',
    `green delta ${srgb.pngP3[1] - p3.pngP3[1]}`)
  check(p3.jpegP3[1] <= P3_GREEN_MAX, 'JPEG: P3 red survives (green at floor)',
    `green ${p3.jpegP3[1]} <= ${P3_GREEN_MAX}`)
  check(srgb.jpegP3[1] >= SRGB_GREEN_MIN, 'JPEG: forced-sRGB run clips it (control)',
    `green ${srgb.jpegP3[1]} >= ${SRGB_GREEN_MIN}`)

  console.log('\n2. ICC tagging of the P3 export')
  const png = pngICC(p3.pngHead)
  check(png.iCCP || png.cICP, 'PNG export carries a colour profile',
    `iCCP=${png.iCCP} cICP=${png.cICP}`)
  check(jpegICC(p3.jpegHead), 'JPEG export carries an ICC_PROFILE APP2 marker')

  console.log('\n3. sRGB fallback')
  check(srgb.colorSpace === 'srgb', 'forceSRGB pins the pipeline to sRGB', srgb.colorSpace)
  check(!pngICC(srgb.pngHead).iCCP, 'forced-sRGB PNG is untagged, exactly as before')

  if (failures.length) {
    console.error(`\nFAIL: ${failures.length} assertion(s):\n  ${failures.join('\n  ')}`)
    process.exitCode = 1
    return
  }
  console.log('\nPASS: Display-P3 survives import→export and the export is ICC-tagged')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

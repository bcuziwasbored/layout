// Browser round-trip test for the HDR byte-crop path (issue #110).
//
//   node test/hdrcrop/run.mjs
//
// Runs the REAL src/hdrCrop.js in headless Chrome against real gain-map
// fixtures, then checks three things the feature lives or dies by:
//
//   1. Every cropped slice is still a valid gain-map JPEG — parsed back by the
//      same detector the import path uses, with the gain map's channel count and
//      the container variant intact.
//   2. Adjacent slices tile the source exactly, on BOTH the base image and the
//      gain map, and every slice comes out the same size.
//   3. The slices land on the right pixels. Verified against a deliberately
//      1px-shifted control: on high-frequency content, drift of a single column
//      would make the aligned error approach the shifted one.
//
// Exit code 0 = pass, 1 = fail.
import { createServer } from 'vite'
import puppeteer from 'puppeteer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')

// `components` is what the gain map comes out as, which is not always what it
// went in as. A canvas cannot encode a 1-component JPEG — toBlob('image/jpeg')
// always writes 3-component YCbCr — so Apple's single-channel L008 gain map
// necessarily widens to 3 channels on the way through. That was checked against
// Apple's own ImageIO before relying on it: a 3-channel Apple gain map is
// accepted and reports the identical HDR headroom as the 1-channel original
// (contentHeadroom 8.000 either way), so the widening costs nothing. libultrahdr
// writes 3-channel gain maps itself, so the ISO variant round-trips unchanged.
const CASES = [
  { fixture: 'ultrahdr-iso.jpg', slices: 3, variant: 'iso', srcComponents: 3, components: 3 },
  { fixture: 'apple-aux.jpg', slices: 3, variant: 'apple', srcComponents: 1, components: 3 },
]

let failures = 0
function check(cond, msg) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures++
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
  const url = new URL('test/hdrcrop/harness.html', base).href

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()) })

  try {
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.waitForFunction('window.__hdrReady === true', { timeout: 20000 })
    console.log(`Chromium: ${await browser.version()}\n`)

    for (const c of CASES) {
      const fixtureUrl = new URL(`test/fixtures/gainmap/${c.fixture}`, base).href
      const r = await page.evaluate(
        (u, n) => window.runHdrCrop(u, n), fixtureUrl, c.slices,
      )
      console.log(`### ${c.fixture}  ${r.source.W}x${r.source.H}  `
        + `gain map ${r.source.gw}x${r.source.gh}/${r.source.components}ch  `
        + `variant=${r.source.variant}`)
      check(r.source.components === c.srcComponents,
        `fixture's gain map is ${r.source.components}-channel as expected`)

      // 1. Each slice is still a gain-map JPEG.
      for (let i = 0; i < r.slices.length; i++) {
        const s = r.slices[i]
        check(s.hasGainMap, `slice ${i}: output is still a gain-map JPEG`)
        check(s.detVariant === c.variant,
          `slice ${i}: container variant preserved (${s.detVariant})`)
        check(s.gainComponents === c.components,
          `slice ${i}: gain map is ${s.gainComponents}-channel as expected`)
        check(s.primaryW === s.baseRect.w && s.primaryH === s.baseRect.h,
          `slice ${i}: base is ${s.primaryW}x${s.primaryH}, as cropped`)
        check(s.gainW === s.gainRect.w && s.gainH === s.gainRect.h,
          `slice ${i}: gain map is ${s.gainW}x${s.gainH}, as cropped`)
      }

      // 2. Exact tiling on both images, and uniform slice size.
      for (let i = 1; i < r.slices.length; i++) {
        const prev = r.slices[i - 1]
        const cur = r.slices[i]
        check(prev.baseRect.x + prev.baseRect.w === cur.baseRect.x,
          `seam ${i}: base edges abut exactly at ${cur.baseRect.x}`)
        check(prev.gainRect.x + prev.gainRect.w === cur.gainRect.x,
          `seam ${i}: gain-map edges abut exactly at ${cur.gainRect.x}`)
      }
      const widths = new Set(r.slices.map((s) => s.baseRect.w))
      check(widths.size === 1,
        `all slices share one width (${[...widths].join(', ')}) — Instagram drops HDR otherwise`)
      const gainWidths = new Set(r.slices.map((s) => s.gainRect.w))
      check(gainWidths.size === 1, `all gain-map slices share one width (${[...gainWidths].join(', ')})`)

      // 3. The pixels are where they should be.
      console.log(`  aligned meanAbsErr=${r.alignedMeanErr.toFixed(3)}  `
        + `1px-shifted control=${r.shiftedMeanErr.toFixed(3)}  `
        + `seam=${r.seamMeanErr.toFixed(3)}  interior=${r.interiorMeanErr.toFixed(3)}`)
      check(r.alignedMeanErr * 3 < r.shiftedMeanErr,
        'slices land on the exact source columns (aligned error far below the shifted control)')
      check(r.seamMeanErr <= r.interiorMeanErr * 2 + 1,
        'seam columns are no worse than the slice interior')
      console.log('')
    }

    if (pageErrors.length) {
      console.error('Page errors:\n' + pageErrors.join('\n'))
      failures++
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(failures === 0
    ? 'HDR crop round-trip passed'
    : `${failures} HDR crop check(s) failed`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })

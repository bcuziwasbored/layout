// Node half of the editor↔export parity suite (issue #93).
//
//   npm run test:parity              — assert every case is within tolerance
//   npm run test:parity:regression   — NEGATIVE CONTROL: inject a 2px text
//                                      baseline offset into renderSlide.js and
//                                      assert the suite catches it
//   node test/parity/run.mjs --inject curved-text-origin
//                                    — the same control for the curved-text
//                                      (issue #92) path
//
// Starts the project's own Vite dev server (no build step, no vite.config
// changes), drives headless Chrome through puppeteer, and asserts the numbers
// the browser harness reports. Failing cases dump konva/export/heat PNGs to
// test/parity/artifacts/.
//
// Exit code 0 = pass, 1 = fail. Any assertion failure prints the case table.

import { createServer } from 'vite'
import puppeteer from 'puppeteer'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CASES, TEXT_CASE_IDS, CURVED_TEXT_CASE_IDS } from './cases.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const ARTIFACTS = path.join(HERE, 'artifacts')

// ─── Injections (negative controls) ────────────────────────────────────────────
// Applied to the REAL source as Vite serves it, so the run exercises a genuinely
// regressed renderSlide.js instead of a simulated one. Nothing is written to disk.
const INJECTIONS = {
  'text-baseline': {
    file: 'src/renderSlide.js',
    from: 'const baseY = y + alignY + translateY + i * lineHeightPx',
    to: 'const baseY = 2 + y + alignY + translateY + i * lineHeightPx',
    describe: '2px text-baseline shift in renderSlide.renderTextLayer',
    // Every text-dependent case must fail when this is injected.
    mustFail: TEXT_CASE_IDS,
  },
  // Curved text (issue #92) never runs the straight path's baseline expression,
  // so it needs its own control. The arc GEOMETRY is shared code (curvedText.js,
  // used by both renderers) and a change there moves both sides equally — the
  // only thing a pixel diff can police is the export-side anchor, which is
  // exactly what this shifts. Run it with:
  //   node test/parity/run.mjs --inject curved-text-origin
  'curved-text-origin': {
    file: 'src/renderSlide.js',
    from: 'const curveOrigin = { x, y }',
    to: 'const curveOrigin = { x, y: y + 2 }',
    describe: '2px curved-text origin shift in renderSlide.renderTextLayer',
    mustFail: CURVED_TEXT_CASE_IDS,
  },
}

const args = process.argv.slice(2)
const injectName = (() => {
  const i = args.indexOf('--inject')
  return i >= 0 ? args[i + 1] : null
})()
const injection = injectName ? INJECTIONS[injectName] : null
if (injectName && !injection) {
  console.error(`Unknown injection "${injectName}". Known: ${Object.keys(INJECTIONS).join(', ')}`)
  process.exit(2)
}

function injectPlugin(inj) {
  let applied = false
  return {
    name: 'parity-inject',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith(inj.file.replace(/\//g, path.sep)) && !id.endsWith(inj.file)) return null
      if (!code.includes(inj.from)) {
        throw new Error(`parity injection "${injectName}" no longer matches ${inj.file}. ` +
          'Update INJECTIONS in test/parity/run.mjs.')
      }
      applied = true
      return code.replace(inj.from, inj.to)
    },
    buildEnd() {
      if (!applied) throw new Error(`parity injection "${injectName}" was never applied`)
    },
  }
}

const fmt = (n, d = 3) => (typeof n === 'number' ? n.toFixed(d) : String(n))

function printTable(results) {
  const rows = results.map(r => ({
    case: r.id,
    mean: fmt(r.mean),
    meanTol: fmt(r.meanTol, 2),
    'pct>24': fmt(r.pctVisible),
    pctTol: fmt(r.pctTol, 2),
    maxCh: r.maxDiff ?? '-',
    result: r.error ? 'ERROR' : r.failed ? 'FAIL' : 'ok',
  }))
  console.table(rows)
}

async function saveArtifacts(results) {
  const failing = results.filter(r => r.images)
  if (!failing.length) return
  await mkdir(ARTIFACTS, { recursive: true })
  for (const r of failing) {
    for (const [kind, dataURL] of Object.entries(r.images)) {
      const b64 = dataURL.slice(dataURL.indexOf(',') + 1)
      await writeFile(path.join(ARTIFACTS, `${r.id}.${kind}.png`), Buffer.from(b64, 'base64'))
    }
  }
  console.log(`\nWrote diff artifacts for ${failing.length} case(s) to test/parity/artifacts/`)
}

async function main() {
  await rm(ARTIFACTS, { recursive: true, force: true })

  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    logLevel: 'error',
    server: { port: 0, strictPort: false },
    ...(injection ? { plugins: [injectPlugin(injection)] } : {}),
  })
  await server.listen()
  const base = server.resolvedUrls.local[0]
  const url = new URL('test/parity/harness.html', base).href

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Deterministic rasterization: no colour-management surprises between the
      // Konva layer canvas and the exporter's offscreen canvas.
      '--force-color-profile=srgb',
      '--disable-lcd-text',
      '--font-render-hinting=none',
    ],
  })

  let results
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 1 })
    const pageErrors = []
    page.on('pageerror', e => pageErrors.push(String(e)))
    page.on('console', m => {
      if (m.type() === 'error') pageErrors.push(m.text())
    })
    page.on('requestfailed', r => pageErrors.push(`request failed: ${r.url()}`))
    page.on('response', r => {
      // /favicon.ico is requested by the browser itself and the harness page has
      // none — never a real problem, so it is filtered out of the diagnostics.
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) {
        pageErrors.push(`HTTP ${r.status()} ${r.url()}`)
      }
    })

    // Boot with one retry: on a cold node_modules/.vite, the dev server's
    // dependency optimizer can trigger a full-page reload mid-boot, and the
    // first load after an interrupted install has raced it in practice. A
    // single fresh goto after a shorter first wait recovers both cases; a
    // genuine boot failure still fails, just ~45s later.
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    const bootWait = () => page.waitForFunction(
      'window.__parityReady === true || typeof window.__parityError === "string"',
      { timeout: 45000, polling: 250 },
    )
    try {
      await bootWait()
    } catch {
      console.warn('Harness boot slow (cold optimizer cache?) — reloading once…')
      await page.goto(url, { waitUntil: 'load', timeout: 60000 })
      await bootWait()
    }
    const bootError = await page.evaluate(() => window.__parityError ?? null)
    if (bootError) throw new Error(`harness failed to boot:\n${bootError}`)

    results = await page.evaluate(() => window.__parityRunAll({}))

    if (pageErrors.length) {
      console.warn('\nPage errors during run:\n  ' + pageErrors.join('\n  '))
    }
  } finally {
    await browser.close()
    await server.close()
  }

  const byId = new Map(results.map(r => [r.id, r]))
  for (const c of CASES) {
    if (!byId.has(c.id)) {
      results.push({ id: c.id, name: c.name, failed: true, error: 'case did not run' })
    }
  }

  printTable(results)
  await saveArtifacts(results)

  if (injection) {
    // Negative control: the suite is only trustworthy if it FAILS here.
    console.log(`\nNegative control — injected: ${injection.describe}`)
    const missed = injection.mustFail.filter(id => !byId.get(id)?.failed)
    for (const id of injection.mustFail) {
      const r = byId.get(id)
      console.log(`  ${r?.failed ? 'detected' : 'MISSED  '}  ${id}` +
        (r ? `  (mean ${fmt(r.mean)} vs tol ${fmt(r.meanTol, 2)}, ` +
             `pct>24 ${fmt(r.pctVisible)} vs tol ${fmt(r.pctTol, 2)})` : ''))
    }
    if (missed.length) {
      console.error(`\nFAIL: the parity suite did NOT catch the injected regression in: ${missed.join(', ')}`)
      process.exitCode = 1
      return
    }
    console.log('\nPASS: every text case caught the injected regression.')
    return
  }

  const failed = results.filter(r => r.failed)
  if (failed.length) {
    console.error(`\nFAIL: ${failed.length}/${results.length} parity case(s) out of tolerance`)
    for (const r of failed) {
      if (r.error) console.error(`  ${r.id}: ${r.error}`)
      else console.error(`  ${r.id}: mean ${fmt(r.mean)} (tol ${fmt(r.meanTol, 2)}), ` +
        `pct>24 ${fmt(r.pctVisible)} (tol ${fmt(r.pctTol, 2)}), max channel diff ${r.maxDiff}`)
    }
    process.exitCode = 1
    return
  }
  console.log(`\nPASS: ${results.length} parity cases within tolerance`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

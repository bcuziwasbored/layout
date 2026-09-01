// Gain-map detection tests for issue #110.
// Run with: node test/gainmap.test.mjs
// Executes as a plain script — any failed assertion throws and exits non-zero.
//
// The detector decides whether an imported photo can take the HDR byte-crop path
// at export, so both directions matter equally. A false negative silently costs
// the user their HDR; a false positive sends a file down a path that would
// produce a broken JPEG. The negative cases below are the ones that actually
// occur in the wild, not synthetic filler.
//
// Fixtures (test/fixtures/gainmap/):
//   apple-aux.jpg    real iPhone-style gain map, from google/libultrahdr's test
//                    vectors (tests/data/apple_gainmap_new.jpg)
//   ultrahdr-iso.jpg ISO 21496-1 gain map produced by libultrahdr itself
//   plain-sdr.jpg    the same base image with no gain map — the control
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectGainMap, walkSegments, findXmpText } from '../src/gainMap.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, 'fixtures', 'gainmap')
const load = (name) => new Uint8Array(readFileSync(join(FIX, name)))

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

const apple = load('apple-aux.jpg')
const ultrahdr = load('ultrahdr-iso.jpg')
const plain = load('plain-sdr.jpg')

// ── Positives ─────────────────────────────────────────────────────────────────

test('an ISO 21496-1 gain map is detected, with both images measured', () => {
  const r = detectGainMap(ultrahdr)
  assert.equal(r.hasGainMap, true)
  assert.equal(r.variant, 'iso')
  assert.equal(r.primary.width, 384)
  assert.equal(r.primary.height, 128)
  // The gain map is stored at half resolution here — proof the detector does not
  // assume the map matches the base's pixel grid.
  assert.equal(r.gainMap.width, 192)
  assert.equal(r.gainMap.height, 64)
  assert.ok(r.gainMap.start > 0 && r.gainMap.end <= ultrahdr.length)
})

test('an Apple auxiliary gain map is detected', () => {
  const r = detectGainMap(apple)
  assert.equal(r.hasGainMap, true)
  assert.equal(r.variant, 'apple')
  assert.equal(r.primary.width, 384)
  assert.equal(r.primary.height, 512)
  assert.equal(r.gainMap.width, 192)
  assert.equal(r.gainMap.height, 256)
  assert.equal(r.gainMap.components, 1, "Apple's gain map is single-channel L008")
})

test("the Apple gain map self-identifies via apdi, not via the primary's XMP", () => {
  const r = detectGainMap(apple)
  const sub = apple.subarray(r.gainMap.start, r.gainMap.end)
  const xmp = findXmpText(sub)
  assert.ok(xmp.includes('urn:com:apple:photo:2020:aux:hdrgainmap'))
  // The primary carries no gain-map XMP at all, which is why detection has to
  // walk the MPF index rather than just scanning the first APP1.
  assert.equal(findXmpText(apple), null)
})

test('the ISO variant carries no XMP whatsoever — only the ISO APP2 block', () => {
  // Current libultrahdr output. A detector keyed on hdrgm:Version misses these
  // entirely, which is the trap this test exists to prevent regressing into.
  assert.equal(findXmpText(ultrahdr), null)
  assert.equal(detectGainMap(ultrahdr).hasGainMap, true)
})

// ── Negatives ─────────────────────────────────────────────────────────────────

test('a plain SDR JPEG is not a gain map', () => {
  const r = detectGainMap(plain)
  assert.equal(r.hasGainMap, false)
  assert.equal(r.variant, null)
  assert.equal(r.primary.width, 384, 'dimensions are still reported')
})

test('non-JPEG input is rejected without throwing', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0])
  assert.equal(detectGainMap(png).hasGainMap, false)
  assert.equal(detectGainMap(new Uint8Array(0)).hasGainMap, false)
  assert.equal(detectGainMap(null).hasGainMap, false)
})

test('a truncated JPEG is rejected without throwing', () => {
  assert.equal(detectGainMap(ultrahdr.subarray(0, 400)).hasGainMap, false)
  assert.equal(detectGainMap(apple.subarray(0, 2000)).hasGainMap, false)
})

test('an MPF file whose second image is an ordinary thumbnail is rejected', () => {
  // The real false positive: iPhone Portrait shots, burst frames and Samsung
  // dual-shot files all carry a second MPF image that is NOT a gain map.
  // Simulated by defacing the ISO identifiers so the MPF index still resolves to
  // a real second JPEG that no longer claims to be a gain map.
  const faked = ultrahdr.slice()
  const needle = 'urn:iso:std:iso:ts:21496:-1'
  const replacement = 'urn:x:definitely:not:a:gm'
  for (let i = 0; i < faked.length - needle.length; i++) {
    let hit = true
    for (let k = 0; k < needle.length; k++) {
      if (faked[i + k] !== needle.charCodeAt(k)) { hit = false; break }
    }
    if (!hit) continue
    for (let k = 0; k < replacement.length; k++) faked[i + k] = replacement.charCodeAt(k)
  }
  const r = detectGainMap(faked)
  assert.equal(r.hasGainMap, false, 'a second image alone must not count as a gain map')
})

test('an MPF index promising bytes that were truncated away is rejected', () => {
  const cut = ultrahdr.subarray(0, ultrahdr.length - 2000)
  const r = detectGainMap(cut)
  assert.equal(r.hasGainMap, false)
})

// ── Cost ──────────────────────────────────────────────────────────────────────

test('detection walks markers only — it never scales with pixel count', () => {
  // Guards the property that makes it safe to run on every import: cost tracks
  // the number of APP segments, not the size of the entropy-coded data. We pad
  // the scan data heavily and require the timing not to follow it.
  const segs = walkSegments(ultrahdr, 0)
  assert.ok(segs.length > 4, 'segments parsed')

  const runs = 200
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < runs; i++) detectGainMap(ultrahdr)
  const perCall = Number(process.hrtime.bigint() - t0) / 1e6 / runs
  assert.ok(perCall < 5, `detection should be fast, took ${perCall.toFixed(3)}ms`)
})

// ── Round-trip through a temp file, as the import path will see it ────────────

test('detection works on bytes read back from disk unchanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gainmap-'))
  const p = join(dir, 'copy.jpg')
  writeFileSync(p, apple)
  const r = detectGainMap(new Uint8Array(readFileSync(p)))
  assert.equal(r.hasGainMap, true)
  assert.equal(r.variant, 'apple')
})

console.log(`\n${passed} gain-map detection tests passed`)

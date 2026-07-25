// Storage-shape tests for issue #90 version history.
// Run with: npx vite-node test/versions.test.mjs
// Executes as a plain script — any failed assertion throws and exits non-zero.
//
// Covers the two pure functions the whole design rests on: a snapshot must not
// carry image data (or ten snapshots cost ten copies of the project), and a
// restore must re-attach the images that are still in the project while
// reporting the ones that aren't.
import assert from 'node:assert/strict'
import {
  stripLayersForVersion, resolveVersionLayers, VERSION_LIMIT, VERSION_INTERVAL_MS,
} from '../src/versionHistory.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

const DATA_URL = 'data:image/jpeg;base64,' + 'A'.repeat(4096)
const OTHER_URL = 'data:image/jpeg;base64,' + 'B'.repeat(4096)

const photoLayer = (over = {}) => ({
  id: 'L0', imgId: 'IMG0', x: 10, y: 20, w: 100, h: 200,
  src: DATA_URL, srcOriginal: 'blob-ref://orig:p1:L0', cornerRadius: 8, ...over,
})

// (a) The snapshot carries no image strings at all — that IS the storage design.
test('stripped layers drop src/srcOriginal and keep identity + geometry', () => {
  const [out] = stripLayersForVersion([photoLayer()])
  assert.ok(!('src' in out), 'src must not be stored in a snapshot')
  assert.ok(!('srcOriginal' in out), 'srcOriginal must not be stored in a snapshot')
  assert.equal(out.imgId, 'IMG0')
  assert.equal(out.cornerRadius, 8)
  assert.equal(out.x, 10)
  assert.equal(out._img, 1, 'layers that had a photo are marked')
  assert.ok(JSON.stringify(out).length < 200, 'a stripped layer is small')
})

test('layers without a photo are not marked as image-bearing', () => {
  const [text, empty] = stripLayersForVersion([
    { id: 'T0', type: 'text', text: 'hi', x: 0, y: 0, w: 10, h: 10 },
    { id: 'C0', x: 0, y: 0, w: 10, h: 10, src: null },
  ])
  assert.ok(!('_img' in text))
  assert.ok(!('_img' in empty))
})

// (b) Restore resolution against the project's current layers.
test('unchanged photo restores with its src and persisted original', () => {
  const version = stripLayersForVersion([photoLayer({ x: 10 })])
  const current = [photoLayer({ x: 999 })]
  const { layers, missing } = resolveVersionLayers(version, current)
  assert.equal(missing, 0)
  assert.equal(layers[0].src, DATA_URL)
  assert.equal(layers[0].srcOriginal, 'blob-ref://orig:p1:L0')
  assert.equal(layers[0].x, 10, 'geometry comes from the snapshot, not the current layer')
  assert.ok(!('_img' in layers[0]), 'the internal marker never reaches the project record')
})

test('replaced photo restores empty and is counted as missing', () => {
  const version = stripLayersForVersion([photoLayer()])
  const current = [photoLayer({ imgId: 'IMG-NEW', src: OTHER_URL })]
  const { layers, missing } = resolveVersionLayers(version, current)
  assert.equal(missing, 1)
  assert.equal(layers[0].src, null)
  assert.equal(layers[0].srcOriginal, undefined)
})

test('deleted layer restores empty and is counted as missing', () => {
  const version = stripLayersForVersion([photoLayer()])
  const { layers, missing } = resolveVersionLayers(version, [])
  assert.equal(missing, 1)
  assert.equal(layers[0].src, null)
})

test('photo moved to another cell is found by imgId, without aliasing its original', () => {
  const version = stripLayersForVersion([photoLayer({ id: 'L0', imgId: 'IMG0' })])
  const current = [photoLayer({ id: 'L7', imgId: 'IMG0', srcOriginal: 'blob-ref://orig:p1:L7' })]
  const { layers, missing } = resolveVersionLayers(version, current)
  assert.equal(missing, 0)
  assert.equal(layers[0].src, DATA_URL)
  assert.equal(layers[0].srcOriginal, undefined,
    "an original keyed by another layer's id must not be aliased")
})

test('layers predating imgId still match on layer id', () => {
  const version = stripLayersForVersion([{ id: 'L0', x: 0, y: 0, w: 1, h: 1, src: DATA_URL }])
  const current = [{ id: 'L0', x: 5, y: 5, w: 1, h: 1, src: OTHER_URL }]
  const { layers, missing } = resolveVersionLayers(version, current)
  assert.equal(missing, 0)
  assert.equal(layers[0].src, OTHER_URL)
})

test('text and empty cells restore untouched and never count as missing photos', () => {
  const version = stripLayersForVersion([
    { id: 'T0', type: 'text', text: 'hi', x: 1, y: 2, w: 3, h: 4, fontSize: 40 },
    { id: 'C0', x: 0, y: 0, w: 10, h: 10, src: null },
  ])
  const { layers, missing } = resolveVersionLayers(version, [])
  assert.equal(missing, 0)
  assert.equal(layers[0].text, 'hi')
  assert.equal(layers[0].fontSize, 40)
  assert.ok(!('src' in layers[0]), 'a text layer gains no src on restore')
})

// (c) A snapshot of a 5-photo project must not be a copy of the project.
test('a stripped snapshot is a rounding error next to the images it omits', () => {
  const layers = Array.from({ length: 5 }, (_, i) => photoLayer({ id: `L${i}`, imgId: `IMG${i}` }))
  const full = JSON.stringify(layers).length
  const snapshot = JSON.stringify(stripLayersForVersion(layers)).length
  assert.ok(snapshot < full / 50, `snapshot ${snapshot} should be << full ${full}`)
})

test('cadence constants match the documented policy', () => {
  assert.equal(VERSION_LIMIT, 10)
  assert.equal(VERSION_INTERVAL_MS, 15 * 60 * 1000)
})

console.log(`\n${passed} version-history tests passed`)

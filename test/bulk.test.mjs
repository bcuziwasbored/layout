// Store-level tests for issue #49 bulk actions (bulkDelete / bulkDuplicate / bulkMove).
// Run with: npx vite-node test/bulk.test.mjs
// Executes as a plain script — any failed assertion throws and exits non-zero.
import assert from 'node:assert/strict'
import { useStore } from '../src/useStore.js'

let passed = 0
function test(name, fn) {
  useStore.setState({
    ratio: useStore.getState().ratio,
    slides: [{ id: 'slide0' }, { id: 'slide1' }, { id: 'slide2' }],
    layers: [],
    activeSlideIdx: 0,
    activeLayerId: null,
    activeCellId: null,
    textEditId: null,
    cropMode: false,
    cropAspect: null,
    history: [],
    future: [],
    _undoSnap: null,
    dirtyCounter: 0,
  })
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

const S = () => useStore.getState()

// A plain standalone layer at slide 0, offset (x0,y0) within the slide.
function mkLayer(id, x = 100, y = 100) {
  return { id, type: 'shape', shapeType: 'rect', x, y, w: 200, h: 200, opacity: 1 }
}

// Seed layers directly (bypassing add* so we control ids/positions).
function seed(layers) {
  useStore.setState({ layers })
}

// ── bulkDelete: three layers removed in one op, one undo restores all three ──────
test('bulkDeleteLayers removes all selected in one history entry', () => {
  seed([mkLayer('a'), mkLayer('b'), mkLayer('c'), mkLayer('d')])
  assert.equal(S().layers.length, 4)

  S().bulkDeleteLayers(['a', 'b', 'c'])
  assert.deepEqual(S().layers.map(l => l.id), ['d'], 'only unselected layer remains')
  assert.equal(S().history.length, 1, 'exactly one history entry pushed')

  S().undo()
  assert.deepEqual(S().layers.map(l => l.id).sort(), ['a', 'b', 'c', 'd'], 'one undo restores all three')
})

test('bulkDeleteLayers is a no-op with no ids (no history)', () => {
  seed([mkLayer('a')])
  S().bulkDeleteLayers([])
  assert.equal(S().layers.length, 1)
  assert.equal(S().history.length, 0, 'empty selection pushes no history')
})

// ── bulkDuplicate: fresh ids, +20 offset clamped, one undo reverses ─────────────
test('bulkDuplicateLayers copies with fresh ids and +20 offset, one history entry', () => {
  seed([mkLayer('a', 100, 100), mkLayer('b', 300, 100)])
  S().bulkDuplicateLayers(['a', 'b'])
  assert.equal(S().layers.length, 4, 'two copies appended')
  assert.equal(S().history.length, 1)

  const ids = S().layers.map(l => l.id)
  assert.equal(new Set(ids).size, 4, 'all ids unique (fresh ids on copies)')

  const copyA = S().layers.find(l => l.id !== 'a' && l.id !== 'b' && l.x === 120 && l.y === 120)
  assert.ok(copyA, 'copy of a is offset by +20,+20')

  S().undo()
  assert.deepEqual(S().layers.map(l => l.id).sort(), ['a', 'b'], 'one undo removes both copies')
})

test('bulkDuplicateLayers clamps offset to the source slide bounds', () => {
  const ratio = S().ratio
  // Layer flush against the right edge of slide 0: x + w == ratio.w.
  seed([{ id: 'edge', type: 'shape', x: ratio.w - 200, y: 100, w: 200, h: 200, opacity: 1 }])
  S().bulkDuplicateLayers(['edge'])
  const copy = S().layers.find(l => l.id !== 'edge')
  assert.equal(copy.x + copy.w <= ratio.w, true, 'copy stays within slide 0 (clamped)')
  assert.equal(copy.x, ratio.w - 200, 'clamped back to the right edge, not spilled +20')
})

// ── bulkMove: shift by whole slide widths, preserve intra-slide offset ───────────
test('bulkMoveLayers shifts owner slide 0 -> 2 keeping intra-slide offset', () => {
  const ratio = S().ratio
  seed([mkLayer('a', 100, 100), mkLayer('b', 300, 400)])
  S().bulkMoveLayers(['a', 'b'], 2)
  assert.equal(S().history.length, 1)
  const a = S().layers.find(l => l.id === 'a')
  const b = S().layers.find(l => l.id === 'b')
  assert.equal(a.x, 100 + 2 * ratio.w, 'a shifted by 2 slide widths, offset preserved')
  assert.equal(b.x, 300 + 2 * ratio.w, 'b shifted by 2 slide widths, offset preserved')
  assert.equal(a.y, 100, 'y untouched')

  S().undo()
  assert.equal(S().layers.find(l => l.id === 'a').x, 100, 'one undo restores original x')
})

// ── Groups act as a unit: one cell id expands to the whole group ─────────────────
test('bulkDeleteLayers expands a selected group cell to the whole group', () => {
  seed([
    { id: 'g1', type: 'image', groupId: 'G', x: 0, y: 0, w: 100, h: 100, opacity: 1 },
    { id: 'g2', type: 'image', groupId: 'G', x: 100, y: 0, w: 100, h: 100, opacity: 1 },
    { id: 'g3', type: 'image', groupId: 'G', x: 0, y: 100, w: 100, h: 100, opacity: 1 },
    mkLayer('solo', 500, 500),
  ])
  S().bulkDeleteLayers(['g1']) // only one cell selected
  assert.deepEqual(S().layers.map(l => l.id), ['solo'], 'whole group G removed from one cell id')
})

test('bulkDuplicateLayers remaps a duplicated group to one fresh shared groupId', () => {
  seed([
    { id: 'g1', type: 'image', groupId: 'G', x: 0, y: 0, w: 100, h: 100, opacity: 1 },
    { id: 'g2', type: 'image', groupId: 'G', x: 100, y: 0, w: 100, h: 100, opacity: 1 },
  ])
  S().bulkDuplicateLayers(['g1'])
  assert.equal(S().layers.length, 4, 'both group cells duplicated (unit expansion)')
  const copies = S().layers.filter(l => l.id !== 'g1' && l.id !== 'g2')
  const newGroupIds = new Set(copies.map(l => l.groupId))
  assert.equal(newGroupIds.size, 1, 'copies share a single new groupId')
  assert.equal(newGroupIds.has('G'), false, 'new groupId differs from the original')
})


// ── userLocked exclusion (#50 integration): bulk ops never touch locked layers ──
test('bulk ops skip userLocked layers even when their ids are passed', () => {
  seed([
    { ...mkLayer('lockedBg', 0, 0), userLocked: true },
    mkLayer('free', 300, 300),
  ])
  S().bulkDeleteLayers(['lockedBg', 'free'])
  assert.deepEqual(S().layers.map(l => l.id), ['lockedBg'], 'delete removed only the unlocked layer')

  S().bulkDuplicateLayers(['lockedBg'])
  assert.equal(S().layers.length, 1, 'duplicate skipped the locked layer entirely')

  const beforeX = S().layers[0].x
  S().bulkMoveLayers(['lockedBg'], 2)
  assert.equal(S().layers[0].x, beforeX, 'move left the locked layer in place')
})

console.log(`\n${passed} passed`)

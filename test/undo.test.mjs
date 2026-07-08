// Store-level tests for issue #14 undo/redo hygiene.
// Run with: npx vite-node test/undo.test.mjs
// Executes as a plain script — any failed assertion throws and exits non-zero.
import assert from 'node:assert/strict'
import { useStore } from '../src/useStore.js'

let passed = 0
function test(name, fn) {
  // Reset to a clean editor state before each case.
  useStore.setState({
    ratio: useStore.getState().ratio,
    slides: [{ id: 'slide0' }],
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

// (a) Add shape → undo → stale activeLayerId is dropped (bottom bar stays usable).
test('undo after add-shape clears now-stale activeLayerId', () => {
  S().addShapeLayer('rect')
  assert.equal(S().layers.length, 1)
  assert.ok(S().activeLayerId, 'shape should be auto-selected')

  S().undo()
  assert.equal(S().layers.length, 0, 'shape removed by undo')
  assert.equal(S().activeLayerId, null, 'activeLayerId dropped since the layer is gone')
})

// (a) Add slide → undo → activeSlideIdx is clamped to the restored slide count.
test('undo after add-slide clamps activeSlideIdx into range', () => {
  S().addSlide()
  assert.equal(S().slides.length, 2)
  assert.equal(S().activeSlideIdx, 1, 'add-slide focuses the new slide')

  S().undo()
  assert.equal(S().slides.length, 1, 'slide removed by undo')
  assert.equal(S().activeSlideIdx, 0, 'activeSlideIdx clamped to the last real slide')
})

// (a) Add shape, sub-select it as a cell, undo → stale activeCellId dropped.
test('undo drops a now-stale activeCellId', () => {
  S().addShapeLayer('rect')
  const id = S().activeLayerId
  useStore.setState({ activeCellId: id })
  S().undo()
  assert.equal(S().activeCellId, null, 'activeCellId dropped since the layer is gone')
})

// (d) A capture+commit with no actual change adds no history entry and preserves redo.
test('no-op _commitUndo keeps history length and preserves future/redo', () => {
  // Arrange a pending redo: add a shape, then undo it (future now holds one entry).
  S().addShapeLayer('rect')
  S().undo()
  const histLen = S().history.length
  const futLen = S().future.length
  assert.equal(futLen, 1, 'undo should have populated future (redo available)')

  // Capture + commit without mutating anything in between.
  S()._captureUndo()
  S()._commitUndo()

  assert.equal(S().history.length, histLen, 'no-op commit must not grow history')
  assert.equal(S().future.length, futLen, 'no-op commit must not wipe redo')
  assert.equal(S()._undoSnap, null, 'captured snapshot is cleared even when skipped')
})

// (d) positive control: a real change committed after capture DOES record history
// and clears redo — confirming the no-op skip is a compare, not a blanket disable.
test('real _commitUndo records history and clears future', () => {
  S().addShapeLayer('rect')
  S().undo()
  assert.equal(S().future.length, 1)

  S()._captureUndo()
  S().updateLayer(S().slides[0].id, {}) // still a no-op on layers; mutate real state instead:
  useStore.setState(st => ({ bgColor: st.bgColor === '#ffffff' ? '#000000' : '#ffffff' }))
  const histLen = S().history.length
  S()._commitUndo()

  assert.equal(S().history.length, histLen + 1, 'real change grows history')
  assert.equal(S().future.length, 0, 'real commit clears redo')
})

console.log(`\n${passed} passed`)

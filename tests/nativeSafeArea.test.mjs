import test from 'node:test'
import assert from 'node:assert/strict'
import { auditNativeSafeArea } from '../scripts/poster-studio/native-safe-area.mjs'

const frame = (left, top, width, height) => ({ position: { left, top }, dimension: { width, height } })
const fixture = () => ({
  pages: [{ page_id: 'current', page_number: 7, dimension: { width: 1080, height: 1350 } }, { page_id: 'protected', page_number: 8, dimension: { width: 1080, height: 1350 } }],
  richtexts: [{ page_index: 7, element_id: 'heading', regions: [{ text: 'A heading' }], containerElement: frame(64, 64, 952, 100) }, { page_index: 8, element_id: 'history', regions: [{ text: 'Read only' }], containerElement: frame(0, 0, 1080, 100) }],
  fills: [{ page_index: 7, element_id: 'logo', containerElement: frame(64, 1185, 160, 99.5) }, { page_index: 7, element_id: 'bleed', containerElement: frame(0, 0, 1080, 1350) }],
})
const spec = { pageIds: ['current'], logoElementIds: ['logo'], insetPx: 64 }

test('keeps full bleed and protected history outside important-frame checks', () => {
  const result = auditNativeSafeArea(fixture(), spec)
  assert.equal(result.passes, true)
  assert.equal(result.textCount, 1)
  assert.equal(result.logoCount, 1)
  assert.equal(result.measurements[1].edges.bottom, 65.5)
})
test('catches the real class of footer failure instead of trusting a successful render', () => {
  const doc = fixture(); doc.fills[0].containerElement.position.top = 1248
  const result = auditNativeSafeArea(doc, spec)
  assert.equal(result.passes, false)
  assert.equal(result.findings[0].elementId, 'logo')
  assert.equal(result.findings[0].minimumInsetPx, 2.5)
})
test('uses actual page dimensions and fresh text height after wrapping', () => {
  const doc = fixture(); doc.pages[0].dimension = { width: 720, height: 900 }
  doc.richtexts[0].containerElement = frame(64, 64, 592, 100)
  doc.fills[0].containerElement = frame(64, 736, 160, 100)
  assert.equal(auditNativeSafeArea(doc, spec).passes, true)
  doc.richtexts[0].containerElement = frame(64, 700, 592, 150)
  assert.equal(auditNativeSafeArea(doc, spec).findings[0].edges.bottom, 50)
})
test('fails closed on stale logo IDs, wrong scope and malformed geometry', () => {
  assert.throws(() => auditNativeSafeArea(fixture(), { ...spec, logoElementIds: ['missing'] }), /logo/)
  assert.throws(() => auditNativeSafeArea(fixture(), { ...spec, pageIds: ['missing'] }), /page/)
  const doc = fixture(); doc.fills[0].containerElement.dimension.height = NaN
  assert.throws(() => auditNativeSafeArea(doc, spec), /frame/)
})

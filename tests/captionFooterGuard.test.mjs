import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCaptionFooter } from '../scripts/poster-studio/caption-footer-guard.mjs'

const packet = () => ({ client: { id: 'client-a' }, runtime_readiness: 'ready',
  _context: { effective_client_id: 'client-a' }, contact_footer: {
    status: 'ready', requirement: 'mandatory', exact_scope_only: true, can_generate_footer: true,
    format_template: '{phone}\n{website}', contacts: [
      { contact_type: 'phone', value: '000 123 4567' }, { contact_type: 'website', value: 'example.test' },
    ],
  } })
const caption = 'Specific creative copy.\n\n000 123 4567\nexample.test\n\n#Client #Summer'
const audit = (text = caption, p = packet(), id = 'client-a') => auditCaptionFooter(Buffer.from(text), p, id)

test('accepts the exact terminal footer with CRLF and optional hashtags, without changing bytes', () => {
  const bytes = Buffer.from(caption.replaceAll('\n', '\r\n')), before = Buffer.from(bytes)
  assert.equal(auditCaptionFooter(bytes, packet(), 'client-a').footerChecksPassed, true)
  assert.deepEqual(bytes, before)
})
test('rejects a website-only footer and a substituted phone number', () => {
  assert.throws(() => audit(caption.replace('000 123 4567\n', '')), /exact approved footer/)
  assert.throws(() => audit(caption.replace('000 123 4567', '000 999 9999')), /exact approved footer/)
})
test('rejects a different client packet even when the footer text happens to match', () => {
  assert.throws(() => audit(caption, packet(), 'client-b'), /exact expected client/)
})
test('rejects a conflicting effective scope from a shared connection', () => {
  const p = packet(); p._context.effective_client_id = 'client-b'
  assert.throws(() => audit(caption, p), /effective client scope/)
})
test('fails closed on unavailable, non-mandatory or unapproved footer generation', () => {
  for (const [field, value] of [['status', 'unavailable'], ['requirement', 'optional'], ['can_generate_footer', false], ['exact_scope_only', false], ['contacts', null]]) {
    const p = packet(); p.contact_footer[field] = value
    assert.throws(() => audit(caption, p))
  }
})
test('never chooses the first of ambiguous approved contact values', () => {
  const p = packet(); p.contact_footer.contacts.push({ contact_type: 'phone', value: '000 888 8888' })
  assert.throws(() => audit(caption, p), /ambiguous/)
})
test('rejects unknown template fields and unsupported template syntax', () => {
  const p = packet(); p.contact_footer.format_template = '{branch_phone}\n{website}'
  assert.throws(() => audit(caption, p), /missing or ambiguous/)
  p.contact_footer.format_template = '{{website}}'
  assert.throws(() => audit(caption, p), /Unsupported/)
})
test('rejects duplicate footers and body prose after the footer', () => {
  assert.throws(() => audit('000 123 4567\nexample.test\n\n' + caption), /exactly once/)
  assert.throws(() => audit(caption + '\n\nMore copy.'), /end with/)
})

// Issue #405: recipient allowlist gate for CG-only acceptance / controlled rollout.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { recipientAllowed, resolveRecipientGate } from '../supabase/functions/_shared/websiteEnquiryProviders.ts'

const env = (value) => (name) => (name === 'WEBSITE_ENQUIRY_EMAIL_RECIPIENT_ALLOWLIST' ? value : undefined)
const worker = readFileSync(new URL('../supabase/functions/website-enquiry-delivery-worker/index.ts', import.meta.url), 'utf8')

test('unset or blank allowlist leaves normal routing open', () => {
  for (const value of [undefined, '', '   ']) {
    const gate = resolveRecipientGate(env(value))
    assert.deepEqual(gate, { mode: 'open' })
    assert.equal(recipientAllowed(gate, 'anyone@client.example'), true)
  }
})

test('allowlist matches exact addresses only, case- and space-insensitively', () => {
  const gate = resolveRecipientGate(env(' Info@CGProductionHouse.com , bounced@resend.dev,complained@resend.dev '))
  assert.equal(gate.mode, 'allowlist')
  for (const ok of ['info@cgproductionhouse.com', 'INFO@cgproductionhouse.com ', 'bounced@resend.dev', 'complained@resend.dev']) assert.equal(recipientAllowed(gate, ok), true, ok)
  for (const no of ['admin@piekgroup.co.za', 'info@cgproductionhouse.com.evil.example', 'x.info@cgproductionhouse.com', 'delivered@resend.dev', '', null, undefined]) {
    assert.equal(recipientAllowed(gate, no), false, String(no))
  }
})

test('a malformed allowlist fails closed (holds everything)', () => {
  for (const value of ['info@cgproductionhouse.com,', 'not-an-email', 'a@b.co, c d@e.co', ',', Array.from({ length: 21 }, (_, i) => `u${i}@x.example`).join(',')]) {
    const gate = resolveRecipientGate(env(value))
    assert.deepEqual(gate, { mode: 'invalid' }, value)
    assert.equal(recipientAllowed(gate, 'info@cgproductionhouse.com'), false)
  }
})

test('worker enforces the gate before replay, before claim and per claimed job', () => {
  assert.match(worker, /const recipients = resolveRecipientGate\(\(name\) => Deno\.env\.get\(name\)\)/)
  assert.match(worker, /recipients\.mode === 'invalid'[\s\S]*state: 'held'/)
  // Replays are sends: filtered by recipient.
  assert.match(worker, /select\('id, recipient_email_snapshot'\)/)
  assert.match(worker, /if \(!recipientAllowed\(recipients, job\.recipient_email_snapshot\)\) continue/)
  // Pre-claim hold, then claim.
  const preCheck = worker.indexOf("if (recipients.mode === 'allowlist') {")
  const claim = worker.indexOf("admin.rpc('claim_website_enquiry_deliveries'")
  assert.ok(preCheck > 0 && preCheck < claim, 'allowlist pre-check must run before the claim')
  // Per-job guard runs before any send and never calls the provider.
  const guard = worker.indexOf('if (!recipientAllowed(recipients, job.recipient_email)) {')
  const send = worker.indexOf('const outcome = await send(job, config)')
  assert.ok(guard > claim && guard < send, 'per-job guard must precede send')
  assert.match(worker, /p_outcome: 'retryable_failure',\s*p_provider_message_id: null, p_error_code: 'held_recipient_allowlist'/)
})

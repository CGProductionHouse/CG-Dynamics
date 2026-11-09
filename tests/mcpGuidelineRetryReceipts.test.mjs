import assert from 'node:assert/strict'
import test from 'node:test'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'

const actor = '10000000-0000-4000-8000-000000000002'
const guide = '20000000-0000-4000-8000-000000000001'
const client = '30000000-0000-4000-8000-000000000001'
const run = '40000000-0000-4000-8000-000000000001'
const guideline_url = `https://www.cgdynamics.co.za/admin/content?tab=guidelines&client=${client}&guideline=${guide}`
const original = { guideline_url, link_access: 'staff_sign_in_required', content_guide_idea_id: 'saved-original-video', created: true }

function fixture({ legacy = false, receiptFailure = false, tool = 'add_content_guideline_video' } = {}) {
  let row = legacy ? { result_status: 'success' } : null
  let writes = 0, inserts = 0
  const subject = { profileId: actor, connection: { userId: actor, profileId: actor, role: 'admin' },
    supabase: {
      async rpc(name, args) {
        if (name === 'mcp_check_idempotency') return { data: [{ already_executed: !!row,
          existing_result: row?.input_hash && row.input_hash !== args.p_input_hash ? { status: 'conflict' }
            : row?.result_payload ?? (row ? { status: row.result_status } : null) }], error: null }
        if (name === 'mcp_record_idempotency_with_context' || name === 'mcp_record_idempotency') {
          row = { result_status: args.p_result_status }; return { error: null }
        }
        throw Error(`Unexpected RPC ${name}`)
      },
      from(table) {
        assert.equal(table, 'mcp_idempotency_log')
        return { async insert(value) {
          inserts++
          if (receiptFailure) return { error: { message: 'PRIVATE receipt failure' } }
          assert.equal(row, null, 'receipt history is never rewritten')
          row = value; return { error: null }
        } }
      },
    } }
  return { dispatch: actualOperationalDispatcher(subject, { [tool]: async () => { writes++; return { ...original } } }),
    get row() { return row }, get writes() { return writes }, get inserts() { return inserts } }
}

test('lost guideline response retries return the original saved item/link without another mutation', async () => {
  const f = fixture(), input = { content_run_id: run, title: 'Exact authored video', idempotency_key: 'repeat-same-request' }
  const first = await f.dispatch(input, 'add_content_guideline_video')
  const repeat = await f.dispatch(input, 'add_content_guideline_video')
  assert.equal(first.result.isError, false)
  assert.equal(repeat.result.isError, false)
  const saved = JSON.parse(first.result.content[0].text), retried = JSON.parse(repeat.result.content[0].text)
  assert.equal(retried.content_guide_idea_id, original.content_guide_idea_id)
  assert.equal(retried.guideline_url, guideline_url)
  assert.deepEqual(retried, saved)
  assert.equal(f.writes, 1)
  assert.equal(f.inserts, 1)
})

test('old status-only success never pretends to return the original saved record or re-executes it', async () => {
  const f = fixture({ legacy: true })
  const reply = await f.dispatch({ content_run_id: run, idempotency_key: 'old-call' }, 'add_content_guideline_video')
  assert.equal(reply.result.isError, true)
  const payload = JSON.parse(reply.result.content[0].text)
  assert.equal(payload.error, 'GUIDELINE_RECEIPT_UNVERIFIED')
  assert.equal(payload.next_read.tool, 'list_content_guideline_videos')
  assert.equal(payload.next_read.arguments.content_run_id, run)
  assert.equal(f.writes, 0)
  assert.equal(f.inserts, 0)
})

test('receipt storage failure returns a truthful recovery error without a second audit or content write', async () => {
  const f = fixture({ receiptFailure: true })
  const reply = await f.dispatch({ content_run_id: run, idempotency_key: 'receipt-failure' }, 'add_content_guideline_video')
  assert.equal(reply.error.code, -32603)
  assert.match(reply.error.message, /may have been saved|may have completed/i)
  assert.doesNotMatch(reply.error.message, /PRIVATE/)
  assert.equal(f.writes, 1)
  assert.equal(f.inserts, 1)
  assert.equal(f.row, null)
})

test('every guideline mutation replays its original receipt with both audit principals', async () => {
  for (const tool of ['ensure_content_guideline', 'add_content_guideline_video', 'update_content_guideline_video',
    'reorder_content_guideline_videos', 'link_content_guideline_video_deliverable', 'generate_content_guideline_drafts']) {
    const f = fixture({ tool })
    const input = { content_run_id: run, idempotency_key: `exact-${tool}` }
    const first = await f.dispatch(input, tool), repeat = await f.dispatch(input, tool)
    assert.deepEqual(repeat, first)
    assert.equal(f.writes, 1)
    assert.equal(f.row.connection_principal_user_id, actor)
    assert.equal(f.row.effective_staff_profile_id, actor)
    assert.equal(f.row.result_payload.receipt.tool_name, tool)
  }
})

test('changed input or foreign receipt identity cannot return a misleading success or rerun the change', async () => {
  for (const tamper of [
    row => { row.result_payload.receipt.actor_profile_id = client },
    row => { row.result_payload.receipt.idempotency_key = client },
    row => { row.result_payload.receipt.tool_name = 'ensure_content_guideline' },
    row => { row.result_payload.guideline_url = 'https://untrusted.invalid/raw' },
  ]) {
    const f = fixture(), input = { content_run_id: run, idempotency_key: 'identity-guard' }
    await f.dispatch(input, 'add_content_guideline_video')
    tamper(f.row)
    const result = await f.dispatch(input, 'add_content_guideline_video')
    assert.equal(result.result.isError, true)
    assert.equal(f.writes, 1)
  }
  const f = fixture(), input = { content_run_id: run, title: 'Keep this wording', idempotency_key: 'input-guard' }
  await f.dispatch(input, 'add_content_guideline_video')
  const conflict = await f.dispatch({ ...input, title: 'Different wording' }, 'add_content_guideline_video')
  assert.equal(conflict.result.isError, true)
  assert.equal(f.writes, 1)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Two runtime errors that TypeScript flags in Edge Functions but nothing in the build
// checks, because tsc -b does not cover Supabase Edge Functions.

let server
let presentation
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  presentation = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/assistantPresentationPolicy.ts')
})
after(async () => { await server?.close() })

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('a staff member without a name still gets the daily update contract', () => {
  // get_my_assistant_bootstrap passes staff.fullName straight from the nullable
  // profiles.full_name. This used to throw on .trim() and crash the bootstrap.
  for (const name of [null, undefined, '']) {
    const contract = presentation.buildDailyUpdateContract(name)
    assert.equal(contract.contract_version, presentation.ASSISTANT_PRESENTATION_VERSION)
    assert.deepEqual(contract.exact_staff_rules, [], 'no staff-specific rules without a name')
  }
})

test('named staff keep their staff-specific rules', () => {
  assert.ok(presentation.buildDailyUpdateContract('Franco Lessing').exact_staff_rules.length > 0)
})

test('the bootstrap still passes the profile name through unchanged', () => {
  const mcp = source('supabase/functions/cg-dynamics-mcp/index.ts')
  assert.ok(mcp.includes('buildDailyUpdateContract(staff.fullName)'))
  const policy = source('supabase/functions/cg-dynamics-mcp/assistantPresentationPolicy.ts')
  assert.ok(policy.includes('buildDailyUpdateContract(fullName: string | null)'), 'the contract must accept a missing name')
})

test('file downloads read the Graph body through a Response, not ReadableStream.arrayBuffer', async () => {
  // downloadFile returns contentResponse.body, a ReadableStream. ReadableStream has
  // no arrayBuffer() method, so the old call threw on every download.
  const onboarding = source('supabase/functions/client-onboarding/index.ts')
  assert.ok(!onboarding.includes('result.stream.arrayBuffer()'), 'ReadableStream has no arrayBuffer()')
  assert.ok(onboarding.includes('new Response(result.stream).arrayBuffer()'))

  const stream = new Response('file-bytes').body
  const buffer = await new Response(stream).arrayBuffer()
  assert.equal(new TextDecoder().decode(buffer), 'file-bytes')
})

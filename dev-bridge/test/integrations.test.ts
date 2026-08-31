import assert from 'node:assert/strict'
import test from 'node:test'
import { deploymentEvents, listDeployments, runFixedDatabaseDiagnostic } from '../src/integrations.js'

test('Vercel calls are project-bound and nested log text is redacted', { concurrency: false }, async () => {
  process.env.OWNER_BRIDGE_VERCEL_TOKEN = 'test-token'
  process.env.OWNER_BRIDGE_VERCEL_PROJECT_ID = 'prj_expected'
  process.env.OWNER_BRIDGE_VERCEL_TEAM_ID = 'team_expected'
  const originalFetch = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = async input => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/v7/deployments')) return Response.json({ deployments: [] })
    if (url.includes('/v13/deployments/')) return Response.json({ projectId: 'prj_expected', ownerId: 'team_expected' })
    return Response.json([{ id: '1', type: 'stdout', payload: { text: 'api_key=top-secret' }, created: 1 }])
  }
  try {
    await listDeployments(5, 'fix/test')
    const events = await deploymentEvents('dpl_ABC123', 10)
    assert.match(urls[0] ?? '', /\/v7\/deployments\?.*branch=fix%2Ftest/)
    assert.equal(events[0]?.text, 'api_key=[REDACTED]')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Supabase diagnostics use the dedicated read-only endpoint and fixed SQL', { concurrency: false }, async () => {
  process.env.OWNER_BRIDGE_SUPABASE_ACCESS_TOKEN = 'test-token'
  process.env.OWNER_BRIDGE_SUPABASE_PROJECT_REF = 'project-ref'
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  let requestedBody = ''
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input)
    requestedBody = String(init?.body)
    return Response.json([{ table_name: 'clients' }])
  }
  try {
    const result = await runFixedDatabaseDiagnostic('schema_summary')
    assert.match(requestedUrl, /\/database\/query\/read-only$/)
    assert.match(requestedBody, /information_schema\.columns/)
    assert.equal(result.diagnostic, 'schema_summary')
    await assert.rejects(() => runFixedDatabaseDiagnostic('select * from auth.users'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

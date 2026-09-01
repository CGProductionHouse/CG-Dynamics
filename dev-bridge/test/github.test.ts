import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { dispatchCheck, getWorkflowRun, readFile } from '../src/github.js'

test('GitHub file paths encode reserved characters and file output is redacted', { concurrency: false }, async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.OWNER_BRIDGE_GITHUB_APP_ID = '123'
  process.env.OWNER_BRIDGE_GITHUB_INSTALLATION_ID = '456'
  process.env.OWNER_BRIDGE_GITHUB_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const originalFetch = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = async input => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/app/installations/456/access_tokens')) {
      return Response.json({ token: 'installation-token', expires_at: new Date(Date.now() + 3_600_000).toISOString() })
    }
    return Response.json({
      content: Buffer.from('password=hunter2').toString('base64'),
      encoding: 'base64', sha: 'a'.repeat(40), html_url: 'https://github.example/file', size: 16,
    })
  }
  try {
    const result = await readFile('main', 'folder/a#b?.ts', 1, 10)
    assert.match(urls[1] ?? '', /folder\/a%23b%3F\.ts\?ref=main/)
    assert.equal(result.content, 'password=[REDACTED]')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('workflow dispatch correlates the asynchronous run through an opaque ID', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch
  let dispatchId = ''
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/actions/workflows/owner-dev-bridge.yml/dispatches')) {
      const body = JSON.parse(String(init?.body)) as { inputs: { request_id: string } }
      dispatchId = body.inputs.request_id
      return new Response(null, { status: 204 })
    }
    if (url.includes('/actions/workflows/owner-dev-bridge.yml/runs?')) {
      return Response.json({ workflow_runs: [{
        id: 987,
        html_url: 'https://github.example/actions/runs/987',
        display_title: `Owner Dev Bridge ${dispatchId} (build)`,
        status: 'queued',
      }] })
    }
    if (url.endsWith('/actions/runs/987')) return Response.json({ id: 987, status: 'completed', conclusion: 'success' })
    if (url.includes('/actions/runs/987/jobs')) return Response.json({ jobs: [] })
    throw new Error(`Unexpected GitHub URL: ${url}`)
  }
  try {
    const dispatched = await dispatchCheck('fix/workflow-correlation', 'build')
    assert.match(dispatched.dispatch_id, /^[0-9a-f-]{36}$/)
    assert.equal(dispatched.run_id, 987)
    const result = await getWorkflowRun(undefined, dispatched.dispatch_id)
    assert.deepEqual(result, { run: { id: 987, status: 'completed', conclusion: 'success' }, jobs: { jobs: [] } })
  } finally {
    globalThis.fetch = originalFetch
  }
})

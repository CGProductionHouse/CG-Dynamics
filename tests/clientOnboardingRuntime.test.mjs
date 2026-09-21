import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { after, before, beforeEach, test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const edge = read('../supabase/functions/client-onboarding/index.ts')
const adapter = read('../supabase/functions/client-onboarding/onedrive-adapter.ts')
const api = read('../src/features/client-onboarding/api.ts')

let graphServer
let graphBaseUrl
let uploadFileToGraphSession
let requests = []
let attempts = new Map()

function readBody(request) {
  return new Promise(resolve => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

before(async () => {
  graphServer = createHttpServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const body = await readBody(request)
    const attempt = (attempts.get(url.pathname) ?? 0) + 1
    attempts.set(url.pathname, attempt)
    requests.push({
      path: url.pathname,
      range: request.headers['content-range'],
      length: Number(request.headers['content-length']),
      body,
      attempt,
    })

    if (url.pathname === '/retry.pdf' && attempt === 1) return json(response, 503, { error: 'temporary' })
    if (url.pathname === '/failure.pdf') return json(response, 400, { error: 'invalid range' })

    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(request.headers['content-range'] ?? '')
    if (!range) return json(response, 400, { error: 'missing range' })

    const end = Number(range[2])
    const total = Number(range[3])
    if (end + 1 < total) {
      return json(response, 202, { nextExpectedRanges: [`${end + 1}-`] })
    }
    if (url.pathname === '/malformed.pdf') return json(response, 201, { name: 'malformed.pdf' })

    const filename = url.pathname.slice(1)
    return json(response, 201, {
      id: `item-${filename}`,
      name: filename,
      size: total,
      file: { mimeType: 'application/pdf' },
      webUrl: `https://example.test/${filename}`,
    })
  })
  await new Promise(resolve => graphServer.listen(0, '127.0.0.1', resolve))
  graphBaseUrl = `http://127.0.0.1:${graphServer.address().port}`

  ;({ uploadFileToGraphSession } = await import('../src/features/client-onboarding/upload-session.ts'))
})

beforeEach(() => {
  requests = []
  attempts = new Map()
})

after(async () => {
  await new Promise(resolve => graphServer?.close(resolve))
})

function file(name, size) {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' })
}

test('production uploader sends one chunk with browser-generated Content-Length and Content-Range', async () => {
  const result = await uploadFileToGraphSession(`${graphBaseUrl}/logo.pdf`, file('logo.pdf', 5), undefined, 1024)

  assert.equal(result.error, null)
  assert.equal(result.item.id, 'item-logo.pdf')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].range, 'bytes 0-4/5')
  assert.equal(requests[0].length, 5)
  assert.equal(requests[0].body.length, 5)
})

test('production uploader sends sequential chunks and returns the final DriveItem', async () => {
  const progress = []
  const result = await uploadFileToGraphSession(
    `${graphBaseUrl}/profile.pdf`,
    file('profile.pdf', 2500),
    value => progress.push(value),
    1024,
  )

  assert.equal(result.item.id, 'item-profile.pdf')
  assert.deepEqual(requests.map(item => item.range), [
    'bytes 0-1023/2500',
    'bytes 1024-2047/2500',
    'bytes 2048-2499/2500',
  ])
  assert.deepEqual(requests.map(item => item.length), [1024, 1024, 452])
  assert.deepEqual(progress, [41, 82, 100])
})

test('production uploader retries a transient Graph failure', async () => {
  const result = await uploadFileToGraphSession(`${graphBaseUrl}/retry.pdf`, file('retry.pdf', 10), undefined, 1024)

  assert.equal(result.error, null)
  assert.equal(result.item.id, 'item-retry.pdf')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].range, requests[1].range)
})

test('production uploader does not retry a non-transient Graph failure', async () => {
  const result = await uploadFileToGraphSession(`${graphBaseUrl}/failure.pdf`, file('failure.pdf', 10), undefined, 1024)

  assert.equal(result.item, null)
  assert.match(result.error, /File upload failed/)
  assert.equal(requests.length, 1)
})

test('production uploader rejects a final response without a DriveItem', async () => {
  const result = await uploadFileToGraphSession(`${graphBaseUrl}/malformed.pdf`, file('malformed.pdf', 10), undefined, 1024)

  assert.equal(result.item, null)
  assert.match(result.error, /could not confirm/)
})

test('public token upload actions execute before the authenticated-user guard', () => {
  const guard = edge.indexOf('const authorized = await getAuthorizedUser')
  assert.ok(edge.indexOf("action === 'upload_init'") < guard)
  assert.ok(edge.indexOf("action === 'upload_complete'") < guard)
  assert.ok(edge.indexOf("action === 'upload_cancel'") < guard)
})

test('completion verifies the exact item, parent folder, and byte size', () => {
  const complete = edge.slice(edge.indexOf("action === 'upload_complete'"), edge.indexOf("action === 'upload_cancel'"))
  assert.match(complete, /driveItemId/)
  assert.match(complete, /pendingUpload\.storage_item_id/)
  assert.match(complete, /Number\(pendingUpload\.size_bytes\)/)
  assert.match(complete, /original_filename: verifiedItem\.name/)
  assert.match(complete, /mime_type: verifiedItem\.mimeType/)
  assert.match(adapter, /parentReference\?\.driveId !== driveId/)
  assert.match(adapter, /parentReference\?\.id !== folderItemId/)
  assert.doesNotMatch(adapter, /\/children\?\$select/)
})

test('portal download fetches a raw Blob with the authenticated session token', () => {
  const download = api.slice(api.indexOf('downloadOnboardingFile'), api.indexOf('loadPortalSetup'))
  assert.match(download, /session\.access_token/)
  assert.match(download, /apikey: supabaseKey/)
  assert.match(download, /response\.blob\(\)/)
  assert.match(download, /\/functions\/v1\/client-onboarding/)
  assert.doesNotMatch(download, /functions\.invoke/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const index = read('../supabase/functions/cg-dynamics-mcp/index.ts')

let server, verification, catalog
before(async () => {
  server = await createServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  verification = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/oneDriveFolderVerification.ts')
  catalog = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
})
after(async () => { await server?.close() })

const adapterFor = listings => ({
  async listChildren(_driveId, itemId) {
    return Object.hasOwn(listings, itemId) ? listings[itemId] : null
  },
})

test('complete exact-folder inspection with nested media is VERIFIED', async () => {
  const result = await verification.inspectExactOneDriveFolder(adapterFor({
    root: [
      { id: 'shoot-a', name: 'Shoot A', isFolder: true },
      { id: 'notes', name: 'notes.txt', isFolder: false },
    ],
    'shoot-a': [
      { id: 'video-1', name: 'clip.MP4', isFolder: false },
      { id: 'photo-1', name: 'frame.jpg', isFolder: false },
    ],
  }), 'exact-drive', 'root', 2)

  assert.equal(result.status, 'VERIFIED')
  assert.equal(result.inspection_complete, true)
  assert.equal(result.inspected_folder_count, 2)
  assert.equal(result.uninspected_folder_count, 0)
  assert.equal(result.media_file_count, 2)
  assert.deepEqual(result.media_types, { mp4: 1, jpg: 1 })
  assert.equal(result.expected_media_file_count, 2)
  assert.equal(result.expected_upload_complete, true)
  assert.doesNotMatch(JSON.stringify(result), /exact-drive|shoot-a|video-1|photo-1/)
})

test('complete exact-folder inspection with no media is MISSING', async () => {
  const result = await verification.inspectExactOneDriveFolder(adapterFor({
    root: [{ id: 'notes', name: 'notes.txt', isFolder: false }],
  }), 'exact-drive', 'root')

  assert.equal(result.status, 'MISSING')
  assert.equal(result.inspection_complete, true)
  assert.equal(result.media_file_count, 0)
  assert.equal(result.other_file_count, 1)
})

test('reachable folder with incomplete descendant coverage is PARTIAL', async () => {
  const result = await verification.inspectExactOneDriveFolder(adapterFor({
    root: [
      { id: 'available', name: 'Available', isFolder: true },
      { id: 'unavailable', name: 'Unavailable', isFolder: true },
    ],
    available: [{ id: 'video', name: 'clip.mov', isFolder: false }],
    unavailable: null,
  }), 'exact-drive', 'root')

  assert.equal(result.status, 'PARTIAL')
  assert.equal(result.inspection_complete, false)
  assert.equal(result.uninspected_folder_count, 1)
  assert.equal(result.media_file_count, 1)
  assert.equal(result.blocker, 'folder_inspection_incomplete')
})

test('complete folder with fewer media files than the canonical expected upload is PARTIAL', async () => {
  const result = await verification.inspectExactOneDriveFolder(adapterFor({
    root: [{ id: 'video-1', name: 'clip.mp4', isFolder: false }],
  }), 'exact-drive', 'root', 2)

  assert.equal(result.status, 'PARTIAL')
  assert.equal(result.inspection_complete, true)
  assert.equal(result.expected_upload_complete, false)
  assert.equal(result.blocker, 'expected_upload_incomplete')
})

test('media without a canonical expected count stays PARTIAL rather than guessing complete', async () => {
  const result = await verification.inspectExactOneDriveFolder(adapterFor({
    root: [{ id: 'video-1', name: 'clip.mp4', isFolder: false }],
  }), 'exact-drive', 'root')

  assert.equal(result.status, 'PARTIAL')
  assert.equal(result.expected_media_file_count, null)
  assert.equal(result.expected_upload_complete, null)
  assert.equal(result.blocker, 'expected_upload_count_unavailable')
})

test('failed root listing and absent reader remain UNVERIFIED, never MISSING', async () => {
  const failed = await verification.inspectExactOneDriveFolder(adapterFor({ root: null }), 'exact-drive', 'root')
  const absent = await verification.inspectExactOneDriveFolder({}, 'exact-drive', 'root')

  assert.equal(failed.status, 'UNVERIFIED')
  assert.equal(absent.status, 'UNVERIFIED')
  assert.equal(failed.inspection_complete, false)
})

test('connector exceptions fail closed and preserve root-versus-descendant semantics', async () => {
  const rootFailure = await verification.inspectExactOneDriveFolder({
    async listChildren() { throw new Error('token expired') },
  }, 'exact-drive', 'root')
  const descendantFailure = await verification.inspectExactOneDriveFolder({
    async listChildren(_driveId, itemId) {
      if (itemId === 'root') return [{ id: 'child', name: 'Child', isFolder: true }]
      throw new Error('page unavailable')
    },
  }, 'exact-drive', 'root')

  assert.equal(rootFailure.status, 'UNVERIFIED')
  assert.equal(rootFailure.uninspected_folder_count, 0)
  assert.equal(descendantFailure.status, 'PARTIAL')
  assert.equal(descendantFailure.uninspected_folder_count, 1)
})

test('MCP verification tool is read-only and declares the canonical #307 mapping contract', () => {
  const tool = catalog.CG_DYNAMICS_MCP_TOOLS.find(item => item.name === 'verify_content_run_upload')
  assert.ok(tool)
  assert.equal(tool.annotations.readOnlyHint, true)
  assert.deepEqual(tool.inputSchema.required, ['content_run_id', 'context'])
  assert.equal(tool.dependency, '#307')
  assert.match(tool.canonicalContract, /get_content_run_onedrive_folder RPC/)
  assert.match(tool.description, /Staff self-report never upgrades this result/)
  assert.match(tool.description, /Raw Graph IDs, URLs and tokens are never returned/)
})

test('exact mapping validation enforces content run and client isolation', () => {
  const exact = verification.validateExactContentRunFolderMapping({
    content_run_id: 'run-1', client_id: 'client-1', drive_id: 'drive-1', month_folder_item_id: 'folder-1',
  }, 'run-1', 'client-1')
  const wrongRun = verification.validateExactContentRunFolderMapping({
    content_run_id: 'run-2', client_id: 'client-1', drive_id: 'drive-1', month_folder_item_id: 'folder-1',
  }, 'run-1', 'client-1')
  const wrongClient = verification.validateExactContentRunFolderMapping({
    content_run_id: 'run-1', client_id: 'client-2', drive_id: 'drive-1', month_folder_item_id: 'folder-1',
  }, 'run-1', 'client-1')
  const missing = verification.validateExactContentRunFolderMapping(null, 'run-1', 'client-1')

  assert.equal(exact.ok, true)
  assert.deepEqual(wrongRun, { ok: false, blocker: 'mapped_folder_content_run_mismatch' })
  assert.deepEqual(wrongClient, { ok: false, blocker: 'mapped_folder_client_mismatch' })
  assert.deepEqual(missing, { ok: false, blocker: 'exact_content_run_folder_not_mapped' })
})

test('exact folder metadata must match both durable Graph IDs', () => {
  const mapping = {
    content_run_id: 'run-1', client_id: 'client-1', drive_id: 'drive-1', month_folder_item_id: 'folder-1',
  }
  assert.equal(verification.validateExactFolderMetadata(null, mapping), 'authorised_folder_metadata_unavailable')
  assert.equal(verification.validateExactFolderMetadata({ driveId: 'drive-1', itemId: 'folder-2', name: 'wrong' }, mapping), 'mapped_folder_identity_mismatch')
  assert.equal(verification.validateExactFolderMetadata({ driveId: 'drive-1', itemId: 'folder-1', name: 'exact' }, mapping), null)
})

test('handler resolves exact run then canonical durable mapping without fuzzy fallback', () => {
  assert.match(index, /function handleVerifyContentRunUpload/)
  assert.match(index, /\.from\('content_runs'\)[\s\S]*?\.eq\('id', runId\)/)
  assert.match(index, /rpc\('get_content_run_onedrive_folder', \{ p_content_run_id: runId \}\)/)
  assert.match(index, /validateExactContentRunFolderMapping\(mapping, run\.id, run\.client_id\)/)
  assert.match(index, /adapter\.getItem\(exactMapping\.drive_id, exactMapping\.month_folder_item_id\)/)
  assert.match(index, /validateExactFolderMetadata\(folder, exactMapping\)/)
  assert.doesNotMatch(index, /root:\/Clients.*find|folder_name.*find|fuzzy.*folder/i)
})

test('handler emits sanitised evidence and never returns mapping IDs or OneDrive URLs', () => {
  assert.match(index, /mapped_folder: \{ name: folder\.name \}/)
  assert.match(index, /inspectExactOneDriveFolder\([\s\S]*?exactMapping\.drive_id,[\s\S]*?exactMapping\.month_folder_item_id,[\s\S]*?expectedMediaFileCount/)
  assert.doesNotMatch(index, /mapped_folder: \{[^}]*drive_id|mapped_folder: \{[^}]*item_id|mapped_folder: \{[^}]*web_url/)
  assert.match(index, /Staff self-report alone remains unverified/)
})

test('MCP writes cannot promote a staff claim into mapped-folder evidence', () => {
  const closeout = catalog.CG_DYNAMICS_MCP_TOOLS.find(item => item.name === 'close_content_run')
  const update = catalog.CG_DYNAMICS_MCP_TOOLS.find(item => item.name === 'update_closeout_upload_status')

  assert.ok(closeout)
  assert.ok(update)
  assert.equal(closeout.inputSchema.properties.upload_status, undefined)
  assert.equal(closeout.inputSchema.properties.upload_evidence, undefined)
  assert.equal(closeout.inputSchema.properties.onedrive_folder_ref, undefined)
  assert.deepEqual(update.inputSchema.required, ['content_run_id', 'idempotency_key', 'context'])
  assert.equal(update.inputSchema.properties.upload_status, undefined)
  assert.equal(update.inputSchema.properties.upload_evidence, undefined)

  const closeHandler = index.slice(index.indexOf('async function handleCloseContentRun'), index.indexOf('async function handleUpdateCloseoutUploadStatus'))
  const updateHandler = index.slice(index.indexOf('async function handleUpdateCloseoutUploadStatus'), index.indexOf('// ── Tool Router'))
  assert.match(closeHandler, /p_upload_status: existingCloseout\?\.upload_status \?\? 'unverified'/)
  assert.match(closeHandler, /p_upload_evidence: existingCloseout\?\.upload_evidence \?\? null/)
  assert.match(closeHandler, /p_onedrive_folder_ref: null/)
  assert.doesNotMatch(closeHandler, /input\.upload_status|input\.upload_evidence|input\.onedrive_folder_ref/)
  assert.match(updateHandler, /await handleVerifyContentRunUpload\(staff, input\)/)
  assert.match(updateHandler, /verification\.evidence\.status\.toLowerCase\(\)/)
  assert.doesNotMatch(updateHandler, /input\.upload_status|input\.upload_evidence/)
})

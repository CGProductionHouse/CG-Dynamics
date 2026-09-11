// #224: a Content Run links to its ONE exact OneDrive month folder by durable id.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const FN = await readFile(new URL('../supabase/functions/content-run-onedrive-folder/index.ts', import.meta.url), 'utf8')
const code = FN.replace(/\/\/[^\n]*/g, '')

let server
let lib

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  lib = await server.ssrLoadModule('/src/lib/contentRunOneDrive.ts')
})

after(async () => {
  await server?.close()
})

test('the expected month folder follows the canonical Clients/<Client>/Videos/YYYY/YYYY_MM_MON path', () => {
  assert.deepEqual(lib.expectedRunMonthFolder('2026-09-01', 'DULUX'), {
    year: '2026',
    monthFolder: '2026_09_SEP',
    path: 'Clients / DULUX / Videos / 2026 / 2026_09_SEP',
  })
  assert.equal(lib.expectedRunMonthFolder('2026-03-14', null).path, 'Clients / <client folder> / Videos / 2026 / 2026_03_MAR')
  assert.equal(lib.expectedRunMonthFolder(null, 'DULUX'), null)
  assert.equal(lib.expectedRunMonthFolder('September', 'DULUX'), null)
})

test('there are no per-video folders and nothing is renamed, moved or deleted', () => {
  assert.doesNotMatch(code, /buildVideoFolderName|_VIDEO_/)
  assert.doesNotMatch(code, /method:\s*['"](PATCH|DELETE|PUT)['"]/)
  assert.doesNotMatch(code, /\/move|\/copy|rename/i)
})

test('the linked folder is re-read by durable id and only named while an admin links it', () => {
  assert.match(code, /getItem\(runFolder\.drive_id, runFolder\.month_folder_item_id\)/)
  assert.match(code, /resolveChildByDurableId\(clientFolders, body\.clientFolderItemId\)/)
  assert.match(code, /findChildByExactName\(foldersOnly\(years\), expectedNames\.year, \{ caseInsensitive: true \}\)/)
  assert.match(code, /findChildByExactName\(foldersOnly\(months\), expectedNames\.month, \{ caseInsensitive: true \}\)/)
  assert.match(code, /assertSameClient\(mapping\.client_id, run\.client_id\)/)
})

test('status is readable by staff; every mapping change is admin-only through the existing RPCs', () => {
  assert.match(code, /const canManage = profile\.role === 'admin'/)
  assert.match(code, /if \(!canManage\) return jsonResponse\(\{ error: 'Only an admin can link OneDrive production folders\.' \}, 403\)/)
  const statusBranch = code.indexOf("if (action === 'status')")
  const adminGate = code.indexOf('if (!canManage)')
  assert.ok(statusBranch > -1 && adminGate > statusBranch, 'status is answered before the admin gate')
  assert.match(code, /rpc\('upsert_client_onedrive_mapping'[\s\S]*p_actor_id: user\.id/)
  assert.match(code, /rpc\('upsert_content_run_onedrive_folder'[\s\S]*p_actor_id: user\.id/)
  assert.match(code, /rpc\('get_content_run_onedrive_folder'/)
})

test('missing year/month folders are created only on an explicit confirmed action, create-only', () => {
  assert.match(code, /const create = action === 'create_month_folder' && body\.confirmCreate === true/)
  assert.match(code, /if \(!create\) return jsonResponse\(\{ status: 'create_required', missing: 'year', expected \}\)/)
  assert.match(code, /if \(!create\) return jsonResponse\(\{ status: 'create_required', missing: 'month', expected \}\)/)
  assert.match(code, /ensureCanonicalChildFolder\(mapping\.drive_id, mapping\.videos_folder_item_id, expectedNames\.year\)/)
  assert.match(code, /ensureCanonicalChildFolder\(mapping\.drive_id, yearFolder\.id, expectedNames\.month\)/)
})

test('the month follows the guideline content month, with the shoot date as fallback', () => {
  assert.match(code, /const guidelineMonth: string \| null = guideline\?\.coverage_start \?\? guideline\?\.month \?\? null/)
  assert.match(code, /const monthDate: string \| null = guidelineMonth \?\? run\.run_date \?\? null/)
})

test('the run detail shows the production folder, checked on demand', async () => {
  const page = await readFile(new URL('../src/pages/admin/ContentWorkflowPage.tsx', import.meta.url), 'utf8')
  const card = await readFile(new URL('../src/components/content/ContentRunOneDriveCard.tsx', import.meta.url), 'utf8')
  assert.match(page, /<ContentRunOneDriveCard run=\{selectedRun\} \/>/)
  // OneDrive is a separate CA-gated rollout: opening a run must not call it.
  assert.doesNotMatch(card, /useEffect/)
  assert.match(card, /Check production folder/)
  assert.match(card, /videos are not given their own folders/i)
  assert.match(card, /An admin links production folders/)
})

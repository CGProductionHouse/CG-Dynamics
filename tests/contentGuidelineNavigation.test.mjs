import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
const helperCode = ts.transpileModule(readFileSync('supabase/functions/cg-dynamics-mcp/contentGuidelineActions.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const { buildGuidelineNavigation, shapeGuidelineClientReviews } = new Function('exports', `${helperCode};return exports`)({})
const GUIDE = 'e4a541a8-e730-478c-812e-feb043d0ed71'
const CLIENT = 'b6052710-417d-4b3b-8348-0f126bfea671'
const RUN = '72624865-e13d-4d98-af5d-211f6c837d21'
const loaded = {
  scope: { runId: RUN, clientId: CLIENT, clientName: 'Germoparts' },
  guideline: { id: GUIDE, status: 'draft', title: 'Saved guide' },
  videos: [{ script: 'Keep the saved complete script.' }], created: false,
}

function handler(start, end, dependencies) {
  const body = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(dependencies), `${js}; return ${start.match(/const (\w+)/)[1]}`)(...Object.values(dependencies))
}

test('existing guideline read returns its exact authenticated editor link, without creating or publishing', async () => {
  const list = handler('const handleListContentGuidelineVideos:', 'const handleGetContentVideoReadiness:', {
    loadRunGuideline: async (_staff, id, allowCreate) => { assert.equal(id, RUN); assert.notEqual(allowCreate, true); return loaded },
    loadVideoEvidence: async () => ({}),
    shapeRunVideos: (_scope, videos) => videos,
    buildGuidelineNavigation, shapeGuidelineClientReviews,
  })
  const result = await list({ profileId: 'canonical-actor', supabase: { async rpc(name, args) {
    assert.equal(name, 'get_guideline_client_reviews_as_actor')
    assert.deepEqual(args, { p_run_id: RUN, p_actor_profile_id: 'canonical-actor' })
    return { error: null, data: { content_run_id: RUN, guideline_id: GUIDE, responses: [] } }
  } } }, { content_run_id: RUN, actor_profile_id: 'untrusted-actor' })
  assert.equal(result.guideline_url, `https://www.cgdynamics.co.za/admin/content?tab=guidelines&client=${CLIENT}&guideline=${GUIDE}`)
  assert.equal(result.link_access, 'staff_sign_in_required')
  assert.deepEqual(result.videos, loaded.videos)
  assert.equal(result.guideline_status, 'draft')
  assert.equal(result.client_idea_responses.state, 'verified')
  const unavailable = await list({ supabase: { rpc: async () => { throw Error('Unavailable response transport') } } }, { content_run_id: RUN })
  assert.deepEqual(unavailable.videos, loaded.videos, 'Response transport failure never hides full saved scripts')
  assert.equal(unavailable.client_idea_responses.state, 'unavailable')
})

test('draft ensure and subsequent reads return the same document and Content Run links', async () => {
  const ensure = handler('const handleEnsureContentGuideline:', '/** Per-video evidence', {
    loadRunGuideline: async () => loaded, buildGuidelineNavigation,
  })
  const result = await ensure({}, { content_run_id: RUN })
  const link = new URL(result.guideline_url)
  assert.equal(link.origin, 'https://www.cgdynamics.co.za')
  assert.equal(link.pathname, '/admin/content')
  assert.deepEqual(Object.fromEntries(link.searchParams), { tab: 'guidelines', client: CLIENT, guideline: GUIDE })
  assert.equal(new URL(result.content_run_url).searchParams.get('run'), RUN)
  assert.equal(result.created, false)
  assert.match(result.link_note, /not a public client link/)
  assert.match(readFileSync('src/App.tsx', 'utf8'), /path="\/admin\/content"/)
  assert.match(readFileSync('src/pages/admin/FullContentGuidePage.tsx', 'utf8'), /searchParams\.get\('guideline'\)/)
})

test('navigation refuses malformed identities, caller URLs and query injection', () => {
  for (const invalid of ['', null, undefined, 'https://evil.example/raw', `${GUIDE}&client=other`]) {
    assert.equal(buildGuidelineNavigation(invalid, CLIENT, RUN).guideline_url, null)
    assert.equal(buildGuidelineNavigation(GUIDE, invalid, RUN).guideline_url, null)
  }
  assert.equal(buildGuidelineNavigation(GUIDE, CLIENT, 'https://evil.example').content_run_url, null)
  assert.equal(buildGuidelineNavigation(GUIDE, CLIENT).content_run_url, null)
  assert.equal(buildGuidelineNavigation(GUIDE, CLIENT).link_access, 'staff_sign_in_required')
})

test('failed or missing reads never manufacture a document link', async () => {
  const list = handler('const handleListContentGuidelineVideos:', 'const handleGetContentVideoReadiness:', {
    loadRunGuideline: async () => ({ error: 'Not found or not authorized' }),
    loadVideoEvidence: () => assert.fail('must stop before evidence'),
    shapeRunVideos: () => assert.fail('must stop before shaping'), buildGuidelineNavigation,
  })
  assert.deepEqual(await list({}, { content_run_id: RUN }), { error: 'Not found or not authorized' })
})

test('successful edit receipt reopens the saved document and preserves the exact field patch', async () => {
  const patch = { script: 'The amended complete script.' }
  let written
  const query = {
    update: value => { written = value; return query },
    eq: () => query, select: () => query,
    single: async () => ({ data: { id: 'video-1', title: 'Saved video', position: 1 }, error: null }),
  }
  const update = handler('const handleUpdateContentGuidelineVideo:', 'const handleReorderContentGuidelineVideos:', {
    resolveVideoScope: async () => ({ video: { id: 'video-1', client_id: CLIENT, content_guideline_id: GUIDE } }),
    validateVideoPatch: () => ({ ok: true, value: patch }),
    GUIDELINE_VIDEO_SELECT: '*', buildGuidelineNavigation,
  })
  const result = await update({ supabase: { from: () => query } }, { content_guide_idea_id: 'video-1', ...patch })
  assert.deepEqual(written, patch)
  assert.deepEqual(result.updated_fields, ['script'])
  assert.equal(new URL(result.guideline_url).searchParams.get('guideline'), GUIDE)
  assert.equal(result.link_access, 'staff_sign_in_required')
  assert.equal(result.content_run_url, null, 'do not guess a run from a video-only edit')
})

test('failed edits return the database error without a false saved-link receipt', async () => {
  const query = { update: () => query, eq: () => query, select: () => query,
    single: async () => ({ error: { message: 'Write refused' } }) }
  const update = handler('const handleUpdateContentGuidelineVideo:', 'const handleReorderContentGuidelineVideos:', {
    resolveVideoScope: async () => ({ video: { id: 'video-1', client_id: CLIENT, content_guideline_id: GUIDE } }),
    validateVideoPatch: () => ({ ok: true, value: { title: 'Draft amendment' } }),
    GUIDELINE_VIDEO_SELECT: '*', buildGuidelineNavigation,
  })
  assert.deepEqual(await update({ supabase: { from: () => query } }, {}), { error: 'Write refused' })
})

test('Content Run discovery returns the exact guide link and refuses a mismatched client', async () => {
  for (const guideClient of [CLIENT, '00000000-0000-4000-8000-000000000001']) {
    const tables = {
      content_runs: { data: [{ id: RUN, client_id: CLIENT, client_name: 'Germoparts' }] },
      content_guidelines: { data: { id: GUIDE, client_id: guideClient, status: 'draft' } },
      content_run_onedrive_folders: { data: null }, content_run_closeouts: { data: null },
      content_guide_ideas: { data: [] },
    }
    const from = name => {
      const query = { ...tables[name] }
      for (const method of ['select', 'order', 'limit', 'eq', 'maybeSingle']) query[method] = () => query
      return query
    }
    const find = handler('const handleFindContentRuns:', 'const handleLinkContentRunDeliverables:', {
      buildGuidelineNavigation, classifyOneDriveReadiness: () => ({ status: 'unverified' }),
    })
    const result = await find({ supabase: { from } }, {})
    if (guideClient === CLIENT) {
      assert.equal(new URL(result.runs[0].content_guideline.guideline_url).searchParams.get('guideline'), GUIDE)
    } else {
      assert.match(result.runs[0].error, /different client/)
      assert.equal(result.runs[0].content_guideline, undefined)
    }
  }
})

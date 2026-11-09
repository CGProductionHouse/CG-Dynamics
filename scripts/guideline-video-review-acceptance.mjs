import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const container = `cg-guideline-review-${randomUUID()}`
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout
}
let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=local-disposable-only', 'postgres:17-alpine']); created = true
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { windowsHide: true }).status === 0) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  for (const file of ['tests/sql/public_guideline_share_fixture.sql', 'supabase/migrations/20261109093718_public_content_guideline_shares.sql', 'supabase/migrations/20261109112347_guideline_video_client_review.sql', 'tests/sql/guideline_video_review_acceptance.sql']) {
    const output = docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-At'], readFileSync(file, 'utf8'))
    if (output.includes('GUIDELINE VIDEO REVIEW ACCEPTANCE PASSED')) console.log('PASS real PostgreSQL: per-video decisions/comments, idempotency, stale versions, revocation, roles, isolation and rate limits')
  }
  const psql = ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-At']
  if (process.argv.includes('--inspiration')) {
    docker(psql, `alter table content_guidelines add column created_at timestamptz default now();
      create function public.is_staff() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','manager','staff','team'))$$;
      create function public.my_client_id() returns uuid language sql stable as $$select nullif(current_setting('qa.client',true),'')::uuid$$;`)
    for (const file of ['supabase/migrations/20261109115055_guideline_inspiration_links.sql','tests/sql/guideline_inspiration_acceptance.sql']) {
      const output=docker(psql,readFileSync(file,'utf8'))
      if(output.includes('GUIDELINE INSPIRATION ACCEPTANCE PASSED')) console.log('PASS real PostgreSQL: optional inspiration, URL constraints, immutable publication, own-client/month projection, exact approval-version comparison and clear/republish')
    }
  }
  const scope = JSON.parse(docker(psql, "select json_build_object('slug',public_slug,'token',share_token,'version',published_at) from content_guideline_public_shares where client_id='20000000-0000-4000-8000-000000000002';").trim())
  const concurrent = id => new Promise(resolve => {
    const child = spawn('docker', psql, { windowsHide: true }); let output = ''
    child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
    child.on('exit', code => resolve({ code, output }))
    child.stdin.end(`set role anon;select respond_public_guideline_video('${scope.slug}','${scope.token}','${scope.version}',1,'approved','Concurrent local fixture','','${id}',null);`)
  })
  const results = await Promise.all([concurrent(randomUUID()), concurrent(randomUUID())])
  assert.equal(results.filter(r => r.code === 0).length, 1, 'Only one concurrent stale-revision decision wins')
  assert.match(results.find(r => r.code !== 0).output, /Another response was added/)
  assert.equal(docker(psql, "select count(*) from content_guideline_client_responses where client_id='20000000-0000-4000-8000-000000000002';").trim(), '1')
  console.log('PASS real PostgreSQL: simultaneous review conflict prevents silent overwrites')
} finally { if (created) docker(['stop', container]) }

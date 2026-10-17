import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'
const approved = { id:first, title:'Reviewed content', asset_path:'synthetic/approved.png', media_type:'image/png',
  caption:'Public caption', channels:['facebook'], scheduled_at:'2026-10-20T10:00:00+02:00', state:'approved' }

test('client approval projection rejects malformed rows and internal states, keeps verified empty and safe history', async () => {
  const server = await createServer({ configFile:false, server:{middlewareMode:true,hmr:false}, optimizeDeps:{noDiscovery:true} })
  try {
    const { projectClientReviewQueue: project } = await server.ssrLoadModule('/src/lib/contentReviews.ts')
    assert.deepEqual(project([]), [])
    for (const value of [null, undefined, {}, 'invalid', [null], [[]], [{}], [approved, null], [approved, approved]]) {
      assert.equal(project(value), null, 'Untrustworthy evidence is unavailable, never filtered into all-clear')
    }
    for (const patch of [
      {id:'bad'}, {id:null}, {title:null}, {title:' '}, {asset_path:''}, {media_type:'text/html'}, {caption:undefined},
      {channels:null}, {channels:'facebook'}, {channels:[]}, {channels:[null]}, {channels:['unknown']},
      {channels:Array(6).fill('facebook')}, {state:'internal_review'}, {state:'superseded'}, {state:'changes_requested'},
      {scheduled_at:null}, {scheduled_at:'invalid'}, {scheduled_at:'2026-10-20T10:00:00'},
      {scheduled_at:'2026-10-20T24:00:00Z'}, {scheduled_at:'2026-02-30T10:00:00Z'},
    ]) assert.equal(project([{...approved,...patch}]), null, JSON.stringify(patch))
    for (const media_type of ['image/jpeg','image/png','image/webp','video/mp4']) {
      for (const scheduled_at of ['2026-10-20T10:00:00Z','2026-10-20T10:00:00.123456+00:00','2026-10-20T10:00:00-07:00']) {
        assert.ok(project([{...approved,media_type,scheduled_at}]))
      }
    }
    const withStaffData = {...approved, client_id:second, deliverable_id:'PRIVATE', client:{name:'PRIVATE'}, source:'PRIVATE', internal_notes:'PRIVATE'}
    const before = JSON.stringify(withStaffData)
    const result = project([withStaffData,{...approved,id:second,state:'client_review',channels:['instagram','tiktok','linkedin','manual']}])
    assert.equal(result.length, 2)
    assert.equal(result[1].state, 'client_review')
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|client_id|deliverable_id|internal_notes|source/)
    assert.equal(JSON.stringify(withStaffData), before)
    result[0].channels.push('manual')
    assert.deepEqual(withStaffData.channels, ['facebook'], 'Client state cannot mutate the read payload')
  } finally { await server.close() }
})

test('selected-client preview applies the same public projection and contains read failures', async () => {
  const server = await createServer({ configFile:false, server:{middlewareMode:true,hmr:false}, optimizeDeps:{noDiscovery:true} })
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts')
    const { listPreviewApprovals } = await server.ssrLoadModule('/src/lib/clientPortalPreview.ts')
    const original = supabase.from, calls = []
    let response, rejected = false
    supabase.from = table => {
      calls.push(['from',table])
      const query = {then:(resolve,reject)=>(rejected?Promise.reject(Error('PRIVATE transport')):Promise.resolve(response)).then(resolve,reject)}
      for (const method of ['select','eq','in','not','order']) query[method]=(...args)=>{calls.push([method,...args]);return query}
      return query
    }
    try {
      for (const data of [[null],[{...approved,channels:null}],[{...approved,state:'internal_review'}],[approved,approved]]) {
        response = {data,error:null}
        const result = await listPreviewApprovals(first)
        assert.ok(result.error)
        assert.deepEqual(result.data, [])
      }
      response = {data:[{...approved,internal_notes:'PRIVATE'}],error:null}
      const result = await listPreviewApprovals(first)
      assert.deepEqual(result.data,[approved])
      assert.equal(result.error,null)
      assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['eq','client_id',first])))
      assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['eq','client_approval_required',true])))
      assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['not','internal_approved_at','is',null])))
      response = {data:[approved],error:{message:'PRIVATE backend'}}
      assert.deepEqual((await listPreviewApprovals(first)).data,[])
      rejected = true
      assert.doesNotMatch(JSON.stringify(await listPreviewApprovals(first)), /PRIVATE/)
      assert.ok(!calls.some(([method])=>['insert','update','delete','upsert'].includes(method)))
    } finally {supabase.from=original}
  } finally {await server.close()}
})

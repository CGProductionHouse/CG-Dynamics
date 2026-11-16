import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {createServer} from 'vite'
import {readFileSync} from 'node:fs'
let server,withViewer
const viewer={userId:'one',profileId:'one',role:'manager'}
const profile={id:'one',role:'manager',is_active:true}
before(async()=>{server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});({withNolanVerifiedViewer:withViewer}=await server.ssrLoadModule('/src/lib/nolanVerifiedViewer.ts'))})
after(async()=>{await server?.close()})
test('valid fresh identity is checked before and after the real read',async()=>{const calls=[];const result=await withViewer(viewer,async()=>{calls.push('read');return ['row']},async()=>{calls.push('profile');return {data:profile,error:null}});assert.deepEqual(calls,['profile','read','profile']);assert.deepEqual(result,['row'])})
test('invalid local identity and unauthorized roles never start profile or source reads',async()=>{for(const candidate of [{...viewer,userId:''},{...viewer,profileId:'foreign'},{...viewer,role:'staff'},{...viewer,role:'client'}])await assert.rejects(withViewer(candidate,async()=>assert.fail('read'),async()=>assert.fail('profile')),/authorization/)})
test('inactive, absent, foreign, changed-role or unreadable profiles never start source reads',async()=>{for(const result of [{data:null,error:null},{data:{...profile,is_active:false},error:null},{data:{...profile,is_active:undefined},error:null},{data:{...profile,id:'foreign'},error:null},{data:{...profile,role:'admin'},error:null},{data:profile,error:{message:'denied'}}])await assert.rejects(withViewer(viewer,async()=>assert.fail('source read'),async()=>result),/authorization/)})
test('revocation during source reads discards returned rows, restoration allows a fresh read',async()=>{let active=true;const reader=async()=>({data:{...profile,is_active:active},error:null});await assert.rejects(withViewer(viewer,async()=>{active=false;return ['must not escape']},reader),/authorization/);active=true;assert.deepEqual(await withViewer(viewer,async()=>['fresh'],reader),['fresh'])})
test('overview wraps all source reads and its error path clears retained records',()=>{const source=readFileSync('src/pages/admin/NolanOverview.tsx','utf8');assert.match(source,/await withNolanVerifiedViewer/);assert(source.includes('clients: {}, tasks: [], videos: [], deliverables: []'))})

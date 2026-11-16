import assert from 'node:assert/strict'
import test from 'node:test'
import { marketingSourceReview } from '../supabase/functions/cg-dynamics-mcp/marketingGovernance.ts'
const id='11111111-1111-4111-8111-111111111111'
const staff={isActive:true,role:'admin',profileId:id,contextKind:'company_admin',connection:{role:'admin',profileId:id}}
test('governance adapter denies inactive, manager, client and impersonated contexts before authenticated RPC',async()=>{
 let calls=0;const db={rpc(){calls++;throw new Error('must not call')}}
 for(const override of [{isActive:false},{role:'manager'},{contextKind:'client'},{contextKind:'staff'},{profileId:'other'}]) assert.ok((await marketingSourceReview({...staff,...override},{card_id:id},db)).error)
 assert.equal(calls,0)
})
test('source read projects exact scope and redacts returned evidence; activation needs exact human instruction',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{card:{id},activated:args.p_activate,chunks:[{body:'password=private'}],storage_path:'not a selected SQL field'},error:null}}}
 const input={card_id:id,client_id:id,scope_key:'branch',document_id:id,offset:10}
 const result=await marketingSourceReview(staff,input,db)
 assert.equal(calls[0].args.p_client,id);assert.equal(calls[0].args.p_scope,'branch');assert.equal(calls[0].args.p_document,id)
 assert.equal(result.chunks[0].body,'[redacted-credential]');assert.equal(result.storage_path,undefined)
 assert.ok((await marketingSourceReview(staff,input,db,true)).error)
 assert.equal(calls.length,1)
 const activated=await marketingSourceReview(staff,{...input,expected_content_hash:'a'.repeat(64),confirm_human_activation:true},db,true)
 assert.equal(activated.activated,true);assert.equal(calls[1].args.p_document,null)
})

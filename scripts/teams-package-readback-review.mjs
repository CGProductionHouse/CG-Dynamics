// Read-only evidence receipt. Numeric-mix corroboration is not a package edit.
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs'
import {resolve,relative,isAbsolute,dirname,basename,join} from 'node:path'
import {createHash} from 'node:crypto'
const args=process.argv.slice(2),[auditPath,inputPath,receiptPath,out]=args
const canonical=p=>{const full=existsSync(p)?realpathSync(p):join(realpathSync(dirname(resolve(p))),basename(p));return process.platform==='win32'?full.toLowerCase():full}
if(args.length!==4||!isAbsolute(out)||existsSync(out)||!relative(canonical(process.cwd()),canonical(out)).startsWith('..')
  ||args.slice(0,3).some(p=>canonical(p)===canonical(out)))throw Error('New private output outside Git required')
const bytes=args.slice(0,3).map(p=>readFileSync(p,'utf8')),[audit,input,receipt]=bytes.map(s=>JSON.parse(s))
const clients=input.clients.filter(c=>c.active===true),seen=new Set()
if(audit.writes!==0||audit.apply_ready!==false||audit.native_master_export_proof?.kind!=='native_planner_export'
  ||receipt.contract!=='canonical_package_excerpt_readback_v1'||receipt.read_only!==true
  ||!Array.isArray(receipt.clients)||receipt.clients.length!==clients.length)throw Error('Exact zero-write audit and current package receipts required')
const fields=[['professional_videos_per_month','professional video'],['reels_per_month','reel'],['photo_posts_per_month','photo post'],['design_posters_per_month','design poster']]
const reviews=receipt.clients.map(r=>{
  const c=clients.find(c=>c.id===r.client?.id)
  if(!c||c.name!==r.client.name||seen.has(c.id)||!Number.isFinite(Date.parse(r.observed_at))||!Array.isArray(r.package_evidence)
    ||r.package_evidence.some(e=>e.authority!=='confirmed_client_package'||e.source_id!==c.id||e.field!=='actionPlan'||typeof e.excerpt!=='string'))throw Error('Foreign, duplicate or mismatched package receipt')
  seen.add(c.id)
  const s=c.package_settings??{}
  if(fields.some(([k])=>typeof s[k]==='number'&&(!Number.isSafeInteger(s[k])||s[k]<0)))throw Error('Invalid frozen numeric scope')
  const mix=fields.filter(([k])=>typeof s[k]==='number').map(([k,label])=>`${s[k]} ${label}${s[k]===1?'':'s'}`).join(', ')
  // Exact rendering of the existing deployed brief's numeric receipt. Never parse
  // omitted fields as zero or rebuild settings from this deliberately partial text.
  const expected=`Confirmed ${s.verification?.confirmed_at}: ${mix}.`
  const match=!r.error&&r.client_package_coverage==='available'&&r.package_evidence.length===1&&r.package_evidence[0].excerpt===expected
  return {client_id:c.id,client:c.name,observed_at:r.observed_at,package_readback:match?'numeric_mix_and_confirmation_timestamp_match':'held_missing_or_changed_package_receipt',
    source_evidence:r.package_evidence,full_structured_package_readback_required:true,proposed_package_changes:0}
})
const byClient=new Map(reviews.map(r=>[r.client_id,r]))
const comparisons=audit.months.flatMap(m=>m.buckets.flatMap(b=>b.comparison.map(f=>({client_id:b.client_id,client:b.client,month:m.month,
  bucket_id:b.bucket_id,plan_id:b.plan_id,...f,current_package_readback:byClient.get(b.client_id)?.package_readback??'held_exact_client_identity_required',
  proposed_schedule_writes:0,proposed_package_changes:0}))))
const hash=s=>createHash('sha256').update(s).digest('hex')
const result={contract:'teams_full_source_package_review_v1',source_proof:audit.native_master_export_proof,
  clients:reviews,comparisons,slot_review:audit.months.map(m=>({month:m.month,reviews:m.slot_review})),
  source_hashes:bytes.map(hash),writes:0,apply_ready:false,
  limitations:['Native master export and monthly reads are not atomic and have different capture times.','Numeric package excerpts omit other scope, provenance and field states; preserve frozen null/zero/flexible values and require structured readback before writes.','No master/month additive capacity, inferred posting date, approval or publication.']}
writeFileSync(out,JSON.stringify(result,null,2),{flag:'wx'})
console.log(JSON.stringify({output:out,clients:reviews.length,matching_numeric_receipts:reviews.filter(r=>r.package_readback==='numeric_mix_and_confirmation_timestamp_match').length,
  held_package_receipts:reviews.filter(r=>r.package_readback!=='numeric_mix_and_confirmation_timestamp_match').map(r=>({client_id:r.client_id,client:r.client})),comparisons:comparisons.length,
  slot_states:result.slot_review.map(m=>({month:m.month,counts:m.reviews.reduce((a,r)=>(a[r.state]=(a[r.state]??0)+1,a),{})})),sha256:hash(JSON.stringify(result)),writes:0,apply_ready:false}))

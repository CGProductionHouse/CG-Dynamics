// Offline native-export adapter. Never contacts a provider, API or database.
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs'
import {resolve,relative,isAbsolute,dirname,basename,join} from 'node:path'
import {createHash} from 'node:crypto'
import {verifyNativePlannerExport} from './lib/native-planner-export.mjs'
const args=process.argv.slice(2),[inputPath,receiptPath,workbookPath,authorityPath,out]=args
const canonical=p=>{const full=existsSync(p)?realpathSync(p):join(realpathSync(dirname(resolve(p))),basename(p));return process.platform==='win32'?full.toLowerCase():full}
if(args.length!==5||!isAbsolute(out)||existsSync(out)||!relative(canonical(process.cwd()),canonical(out)).startsWith('..')
  ||args.slice(0,4).some(p=>canonical(p)===canonical(out)))throw Error('New private output outside Git required')
const hash=v=>createHash('sha256').update(v).digest('hex')
const input=JSON.parse(readFileSync(inputPath,'utf8')),receipt=JSON.parse(readFileSync(receiptPath,'utf8')),authority=JSON.parse(readFileSync(authorityPath,'utf8'))
if(authority.master?.kind!=='owner_confirmed_master'||authority.relationship!=='monthly_cross_check_of_master_not_additional_capacity'
  ||input.master?.plan_id!==authority.master.plan_id||receipt.file_sha256!==hash(readFileSync(workbookPath)))throw Error('Exact approved master and unchanged native workbook required')
const binding={...authority.master,source_ref:authority.source_ref}
const anchors=input.master.buckets,verified=verifyNativePlannerExport(receipt,binding,anchors)
const result={...input,master:verified,native_master_export:{receipt,binding,anchors},
  evidence_hashes:{...input.evidence_hashes,native_workbook:receipt.file_sha256,native_receipt:hash(readFileSync(receiptPath)),prior_input:hash(readFileSync(inputPath))},
  evidence_scope:'Native master export plus independent monthly connector reads; not an atomic shared-cutoff snapshot. Package evidence remains frozen pending readback.',
  package_readback_required:true,writes:0,apply_ready:false}
writeFileSync(out,JSON.stringify(result,null,2),{flag:'wx'})
console.log(JSON.stringify({output:out,...verified.proof,sha256:hash(JSON.stringify(result)),writes:0}))

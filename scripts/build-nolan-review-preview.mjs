import {build} from 'esbuild'
import {resolve} from 'node:path'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const root=process.cwd()
const fixture=resolve(root,'tests/fixtures/nolan-review')
const aliases=new Set(['src/contexts/AuthContext','src/lib/commandCentre','src/lib/contentWorkflow','src/lib/planner','src/lib/nolanPackageEvidence','src/lib/nolanDecisionApi','src/lib/db/clients','src/lib/cgWebsiteFleet','src/components/admin/WebsitePerformancePanel'].map(p=>resolve(root,p)))
export const options={entryPoints:[resolve(fixture,'entry.tsx')],bundle:true,write:false,outdir:'preview',format:'iife',platform:'browser',jsx:'automatic',minify:true,metafile:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline-review-adapters',setup(b){b.onResolve({filter:/./},args=>{if(aliases.has(resolve(args.resolveDir,args.path).replace(/\.(tsx?|jsx?)$/,'')))return {path:resolve(fixture,'adapters.tsx')}})}}]}
export async function buildPreview(output='/workspace/scratch/nolan-review/nolan-workbook-review.html'){
 const result=await build(options)
 const inputs=Object.keys(result.metafile.inputs)
 if(inputs.some(p=>/supabase|AuthContext|lib\/(commandCentre|contentWorkflow|planner|nolanDecisionApi)\.ts/.test(p)))throw new Error('Production backend/auth dependency leaked into preview')
 for(const name of ['NolanOverview','NolanNeedsYou','NolanPackageEvidence','NolanPackageRecordEvidence','NolanScheduleEvidence','NolanTaskOwnership','NolanMasterScope','NolanWebsiteConnections'])if(!inputs.some(p=>p.endsWith(name+'.tsx')))throw new Error('Actual component missing: '+name)
 const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script')
 const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>Nolan · offline sample review · PR 990</title><style>${css}\nbody{margin:0;font-family:system-ui,sans-serif}.review-banner{background:#fff4c2;color:#342b12;padding:18px 24px;border-bottom:3px solid #c89212}.review-banner strong{font-size:18px}.review-banner p{max-width:1100px}.review-controls{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.review-controls button,.review-controls select{padding:7px}.review-banner code{user-select:all}.review-banner li{margin:8px 0}.nolan-board textarea{display:block;min-height:64px;max-width:100%;width:440px}.nolan-board fieldset label{display:block;margin:12px 0}.nolan-board fieldset input{display:block;max-width:95%;width:380px}</style><div id="root"></div><script>${js}</script></html>`
 await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html)
 const receipt={candidate:'df7699a15f8935a52da41c7e97dd47a9a23579ba',bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),sourceCssSha256:createHash('sha256').update(await readFile('src/pages/admin/nolanOverview.css')).digest('hex'),inputs,limits:'Offline sample adapters only. No browser, real auth, backend or device acceptance.'}
 await writeFile(output+'.receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({output,bytes:receipt.bytes,sha256:receipt.sha256,modules:inputs.length}));return {html,receipt}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await buildPreview(process.argv[2])

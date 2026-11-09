import {copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {dirname,join,resolve,sep} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'

const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
const safe=path=>/^(dist\/index\.html|public\/client-logos\/[a-z0-9-]+\.(png|jpe?g|webp|svg))$/.test(path)

// vercel build can emit filePathMap references outside .func. dist is correctly
// excluded from source uploads, so these reviewed resources must be inside the
// self-contained Build Output API function before a --prebuilt upload.
export function materializeGuidelinePreviewBundle(projectRoot) {
  const root=resolve(projectRoot),bundle=join(root,'.vercel/output/functions/api/guideline-preview.func')
  const configPath=join(bundle,'.vc-config.json'),config=JSON.parse(readFileSync(configPath,'utf8'))
  const entries=Object.entries(config.filePathMap??{}).map(([destination,source])=>{
    if(!safe(destination)||typeof source!=='string'||!safe(source)) throw new Error('Unexpected guideline bundle resource')
    const from=resolve(root,source),to=resolve(bundle,destination)
    if(!from.startsWith(root+sep)||!to.startsWith(bundle+sep)||!existsSync(from)) throw new Error('Guideline bundle path unavailable')
    return {from,to}
  })
  for(const {from,to} of entries){mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);if(hash(from)!==hash(to))throw new Error('Guideline bundle copy mismatch')}
  if(!existsSync(join(bundle,'dist/index.html'))||!existsSync(join(bundle,'public/client-logos/germoparts.png'))) throw new Error('Guideline bundle is incomplete')
  delete config.filePathMap
  writeFileSync(configPath,JSON.stringify(config,null,2)+'\n')
  return {materialized:entries.length,templateSha256:hash(join(bundle,'dist/index.html')),selfContained:true}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.log(JSON.stringify(materializeGuidelinePreviewBundle(process.cwd())))
}

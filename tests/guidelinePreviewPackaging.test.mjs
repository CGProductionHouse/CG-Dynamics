import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname,resolve,sep,basename} from 'node:path'
import {materializeGuidelinePreviewBundle} from '../scripts/materialize-guideline-preview-bundle.mjs'

function fixture(run){
  const root=mkdtempSync(join(tmpdir(),'cg-guideline-bundle-test-'))
  const bundle=join(root,'.vercel/output/functions/api/guideline-preview.func')
  const put=(path,value)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,value)}
  const refs={'dist/index.html':'dist/index.html','public/client-logos/germoparts.png':'public/client-logos/germoparts.png'}
  put(join(root,'dist/index.html'),'<html>built app shell</html>');put(join(root,'public/client-logos/germoparts.png'),'synthetic public logo')
  const config=join(bundle,'.vc-config.json');put(config,JSON.stringify({runtime:'nodejs24.x',handler:'api/guideline-preview.js',filePathMap:refs}))
  try{run({root,bundle,config,refs})}finally{
    assert(root.startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('cg-guideline-bundle-test-'))
    rmSync(root,{recursive:true,force:true})
  }
}

test('prebuilt bundle physically contains the HTML/public logo and has no outside file references',()=>fixture(({root,bundle,config})=>{
  const result=materializeGuidelinePreviewBundle(root)
  assert.equal(result.materialized,2);assert.equal(result.selfContained,true)
  assert.equal(readFileSync(join(bundle,'dist/index.html'),'utf8'),'<html>built app shell</html>')
  assert.equal(readFileSync(join(bundle,'public/client-logos/germoparts.png'),'utf8'),'synthetic public logo')
  const updated=JSON.parse(readFileSync(config));assert.equal(updated.filePathMap,undefined);assert.equal(updated.runtime,'nodejs24.x');assert.equal(updated.handler,'api/guideline-preview.js')
  assert.equal(materializeGuidelinePreviewBundle(root).materialized,0)
}))

test('packaging refuses unexpected paths without changing the configuration',()=>fixture(({root,config,refs})=>{
  const source=JSON.stringify({runtime:'nodejs24.x',filePathMap:{...refs,'../outside':'../outside'}})
  writeFileSync(config,source)
  assert.throws(()=>materializeGuidelinePreviewBundle(root),/Unexpected guideline bundle resource/)
  assert.equal(readFileSync(config,'utf8'),source)
}))

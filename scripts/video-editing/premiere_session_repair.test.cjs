const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const candidate=process.env.NOLAN_MCP_REPAIR_ROOT;
const enabled={skip:!candidate && 'Private prepared candidate required'};
function fixture(overrides={}) {
  let saved=0,starts=0,executions=0;
  const lease={projectPath:'C:\\private\\duplicate.prproj',sequenceId:'pilot',reconnect:true,expiresAt:new Date(Date.now()+600000).toISOString(),...overrides};
  const window={};
  const fakeFs={existsSync:()=>true,readFileSync:()=>JSON.stringify(lease)};
  const source=fs.readFileSync(path.join(candidate,'cep-plugin/bridge-cep.js'),'utf8');
  vm.runInNewContext(source,{require:n=>n==='fs'?fakeFs:require(n),window,document:{addEventListener(){}},console});
  const bridge=Object.create(window.MCPPremiereBridge.prototype);
  bridge.getTempDirectory=()=>'/private-queue';bridge.log=()=>{};bridge.updateCommandStatus=()=>{};
  bridge.startBridge=()=>{starts++;};
  const project={path:lease.projectPath,activeSequence:{sequenceID:'pilot'},save(){saved++;}};
  bridge.executeExtendScript=(script,cb)=>{executions++;try{cb(null,JSON.parse(vm.runInNewContext(script,{app:{project}})));}catch(e){cb(e);}};
  return {bridge,project,counts:()=>({saved,starts,executions}),lease};
}
function command(f, timestamp=new Date().toISOString()) {
  let result;
  f.bridge.executeCommand({id:'fixture',timestamp,script:'(function(){app.project.save();return JSON.stringify({success:true});})();'},r=>{result=r;});
  return result;
}
test('valid lease reconnects without executing an edit',enabled,()=>{
  const f=fixture();f.bridge.restoreNolanSession();assert.equal(f.counts().starts,1);assert.equal(f.counts().saved,0);
});

test('without an opt-in lease legacy manual operation remains available',enabled,()=>{
  const f=fixture();f.bridge.readNolanSession=()=>null;
  f.bridge.restoreNolanSession();assert.equal(f.counts().starts,0);
  const r=command(f);assert.equal(r.result.success,true);assert.equal(f.counts().saved,1);
});

test('invalid and overlong leases refuse execution',enabled,()=>{
  for(const override of [{projectPath:''},{sequenceId:''},{expiresAt:'invalid'},{expiresAt:new Date(Date.now()+7300000).toISOString()}]){
    const f=fixture(override);const r=command(f);assert.equal(r.nolanGuard,true);assert.equal(f.counts().executions,0);
  }
});
test('expired lease never reconnects or executes',enabled,()=>{
  const f=fixture({expiresAt:new Date(Date.now()-1000).toISOString()});f.bridge.restoreNolanSession();
  const r=command(f);assert.equal(r.nolanGuard,true);assert.equal(f.counts().executions,0);
});
test('wrong project and wrong sequence block before save',enabled,()=>{
  for(const mismatch of ['project','sequence']) {
    const f=fixture();if(mismatch==='project')f.project.path='C:\\private\\other.prproj';else f.project.activeSequence.sequenceID='other';
    f.bridge.restoreNolanSession();assert.equal(f.counts().starts,0);
    const r=command(f);assert.equal(r.success,false);assert.equal(r.nolanGuard,true);assert.equal(r.mutated,false);assert.equal(f.counts().saved,0);
  }
});
test('scoped command preserves successful host result',enabled,()=>{
  const f=fixture();const r=command(f);assert.equal(r.success,true);assert.equal(r.result.success,true);assert.equal(f.counts().saved,1);
});
test('stale and future commands cannot replay',enabled,()=>{
  for(const t of [Date.now()-61000,Date.now()+10000]){const f=fixture();const r=command(f,new Date(t).toISOString());assert.equal(r.nolanGuard,true);assert.equal(f.counts().executions,0);}
});
test('transport raises protected denial instead of allowing save to claim success',enabled,async()=>{
  const {PremiereProBridge}=await import(pathToFileURL(path.join(candidate,'dist/bridge/index.js')));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nolan-bridge-test-'));
  try{
    const b=new PremiereProBridge();b.isInitialized=true;b.tempDir=dir;
    b.waitForResponse=async()=>({success:false,nolanGuard:true,error:'Protected project mismatch'});
    await assert.rejects(b.executeScript('return JSON.stringify({success:true});'),/Protected project mismatch/);
    assert.deepEqual(fs.readdirSync(dir),[]);
  }finally{fs.rmdirSync(dir);}
});

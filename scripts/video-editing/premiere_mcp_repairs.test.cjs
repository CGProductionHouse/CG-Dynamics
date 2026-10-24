// Executes actual generated vendor scripts against hostile fixtures; optional pinned source required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { repairExpanded, repairFrame } = require('./prepare_premiere_mcp_repairs.cjs');
const candidate = process.env.NOLAN_MCP_REPAIR_ROOT;
const enabled = { skip: !candidate && 'Set NOLAN_MCP_REPAIR_ROOT to the prepared private candidate' };

test('patches refuse missing or ambiguous pinned anchors', () => {
  assert.throws(() => repairExpanded(''), /anchor/);
  assert.throws(() => repairFrame(''), /anchor/);
});
function collection(items, count) { return Object.assign(items, { [count]: items.length }); }
async function expanded(name, args, extra={}, propertyOverride) {
  const { executeExpandedTool } = await import(pathToFileURL(path.join(candidate, 'dist/tools/expanded.js')));
  let reads=0, closes=0;
  const prop = propertyOverride || { displayName:'Scale', getValue(){ throw Error('Static getter must never be used'); }, getValueAtTime(t){reads++; return 100+t.seconds;} };
  const component = {displayName:'Motion', properties:collection([prop],'numItems')};
  const clip={nodeId:'clip',components:collection([component],'numItems')};
  const seq={sequenceID:'target',videoTracks:collection([{clips:collection([clip],'numItems')}],'numTracks'),audioTracks:collection([],'numTracks')};
  const app={project:{activeSequence:seq,sequences:collection([seq],'numSequences'),closeDocument(){closes++;throw Error('Must not close');}}};
  const bridge={executeScript: async script => JSON.parse(vm.runInNewContext('(function(){'+script+'})()', {app,Time:class{seconds=0},...extra}))};
  const result=await executeExpandedTool(bridge,name,args);
  return {result,reads,closes};
}
test('time-aware stream receives actual requested time; static getter forbidden', enabled, async()=>{
  for (const time of [0,2,4]) {
    const {result,reads}=await expanded('get_value_at_time',{sequenceId:'target',clipId:'clip',componentName:'Motion',propertyName:'Scale',time});
    assert.equal(result.success,true);assert.equal(result.data.value,100+time);assert.equal(reads,1);
  }
});
test('invalid source time is refused without a property read', enabled, async()=>{
  for (const time of [-1,'4',null]) {
    const {result,reads}=await expanded('get_value_at_time',{sequenceId:'target',clipId:'clip',componentName:'Motion',propertyName:'Scale',time});
    assert.equal(result.success,false);assert.equal(reads,0);
  }
});
test('stale sequence never falls back to active sequence',enabled,async()=>{
  const {result,reads}=await expanded('get_value_at_time',{sequenceId:'wrong',clipId:'clip',componentName:'Motion',propertyName:'Scale',time:2});
  assert.equal(result.success,false);assert.equal(reads,0);
});
test('close fails before host close, even with explicit confirmation',enabled,async()=>{
  const {result,closes}=await expanded('close_project',{confirm:true,saveFirst:true});
  assert.equal(result.success,false);assert.equal(result.details.quarantined,true);assert.equal(result.details.mutated,false);assert.equal(closes,0);
});
test('colour uses native channel setter, preserving exact ARGB; invalid channels never write',enabled,async()=>{
  let color=[1,0,0,0],writes=0;
  const prop={displayName:'Title Color',getColorValue:()=>color,setColorValue:(a,r,g,b,ui)=>{assert.equal(ui,1);writes++;color=[a,r,g,b];return 0;},setValue(){throw Error('Packed setter must not be used');}};
  const args={sequenceId:'target',clipId:'clip',componentName:'Motion',propertyName:'Title Color',argb:[1,15,46,28]};
  const {result}=await expanded('set_color_value',args,{},prop);
  assert.equal(result.success,true);assert.deepEqual(Array.from(result.data.after),args.argb);assert.equal(writes,1);
  for(const argb of [[1,15,46,256],[1,15,46,-1],[1,'15',46,28],[1,15,46,28.5],[255,15,46,28]]){
    assert.equal((await expanded('set_color_value',{...args,argb},{},prop)).result.success,false);
  }
  assert.equal(writes,1);
  const mismatch={...prop,getColorValue:()=>[1,15,46,32]};
  const failed=(await expanded('set_color_value',args,{},mismatch)).result;
  assert.equal(failed.success,false);assert.equal(failed.details.mutated,true);
});
test('frame export passes formatted timecode, never probes numeric seconds or trusts stale files',enabled,async()=>{
  const { PremiereProTools }=await import(pathToFileURL(path.join(candidate,'dist/tools/index.js')));
  for (const writes of [true,false]) {
    let recorded,exists=!writes;
    const sequence={name:'Fixture',zeroPoint:'0',timebase:'5080320000',getSettings:()=>({videoDisplayFormat:105})};
    class Time{seconds=0;ticks='0';getFormatted(frame,format){assert.equal(frame.ticks,'5080320000');assert.equal(format,105);return '00:00:11:00';}}
    const context={Time,__findSequence:()=>sequence,__qeSequenceFor:()=>({exportFramePNG(time,stem){recorded={time,stem};if(writes)exists=true;}}),File:class{get exists(){return exists;}get modified(){return new Date(0);}get length(){return 10;}}};
    const bridge={executeScript:async script=>JSON.parse(vm.runInNewContext('(function(){'+script+'})()',context))};
    const result=await new PremiereProTools(bridge).executeTool('export_frame',{sequenceId:'target',time:11,outputPath:'C:/private/frame.png',format:'png'});
    assert.deepEqual(recorded,{time:'00:00:11:00',stem:'C:/private/frame'});
    assert.equal(result.success,writes);
  }
});

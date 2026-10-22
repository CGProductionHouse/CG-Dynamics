'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { probePremiereReadOnly } = require('./probe_premiere_readonly.cjs');
const path = 'C:/pilot/Nolan_Duplicate_API_Test.prproj';

function fixture() {
  const calls = [];
  const param = { displayName: 'Position', areKeyframesSupported: async () => true,
    isTimeVarying: () => true, getKeyframeListAsTickTimes: () => [{}, {}] };
  const component = { getMatchName: async () => 'ADBE Motion',
    getDisplayName: async () => 'Motion', getParamCount: () => 1, getParam: () => param };
  const clip = { getComponentChain: async () => ({ getComponentCount: () => 1,
    getComponentAtIndex: () => component }) };
  const seq = { guid: { toString: () => 'sequence-id' },
    getFrameSize: async () => ({ width: 2160, height: 3840 }),
    getVideoTrackCount: async () => 1,
    getVideoTrack: async () => ({ getTrackItems: () => [clip] }) };
  const project = { path, guid: { toString: () => 'project-id' },
    getActiveSequence: async () => seq };
  // Mutation attempts fail immediately, including save/transaction access.
  const guarded = new Proxy(project, { get(obj, prop) {
    if (/^(save|execute|create|set)/.test(String(prop))) throw new Error('Mutation forbidden');
    return obj[prop];
  } });
  const ppro = { Project: { getActiveProject: async () => guarded },
    VideoFilterFactory: { getMatchNames: async () => { calls.push('effects'); return ['ADBE Motion']; } },
    Constants: { TrackItemType: { CLIP: 1 } } };
  return { ppro, project, seq, calls };
}

test('mock only: exact identity, native capability/keyframe discovery, no mutations', async () => {
  const f = fixture();
  const r = await probePremiereReadOnly(f.ppro, { expectedProjectPath: path.replaceAll('/', '\\'),
    expectedSequenceGuid: 'sequence-id' });
  assert.deepEqual(r.dimensions, [2160, 3840]);
  assert.deepEqual(r.installedVideoEffects, ['ADBE Motion']);
  assert.equal(r.tracks[0].sampled[0].components[0].params[0].keyframeCount, 2);
  assert.equal(r.mutationsExecuted, 0);
  assert.deepEqual(r.optionalApiAvailability, { typedMogrtText: false, typedMogrtComment: false });
});
test('wrong active project blocks before effect enumeration', async () => {
  const f = fixture(); f.project.path = 'C:/client/Original.prproj';
  await assert.rejects(probePremiereReadOnly(f.ppro, { expectedProjectPath: path }), /does not match/);
  assert.equal(f.calls.length, 0);
});
test('host extended-length local drive path matches the exact duplicate', async () => {
  const f = fixture(); f.project.path = '\\\\?\\' + path.replaceAll('/', '\\');
  const result = await probePremiereReadOnly(f.ppro, { expectedProjectPath: path });
  assert.equal(result.mutationsExecuted, 0);
});
test('UNC and device namespaces remain refused', async () => {
  for (const unsafe of ['\\\\server\\share\\test.prproj', '\\\\?\\UNC\\server\\test.prproj',
    '\\\\.\\C:\\test.prproj', 'C:/pilot/../Original.prproj']) {
    const f = fixture(); f.project.path = unsafe;
    await assert.rejects(probePremiereReadOnly(f.ppro, { expectedProjectPath: path }), /absolute local/);
    assert.equal(f.calls.length, 0);
  }
});
test('wrong sequence blocks before effect enumeration', async () => {
  const f = fixture();
  await assert.rejects(probePremiereReadOnly(f.ppro,
    { expectedProjectPath: path, expectedSequenceGuid: 'wrong' }), /identity changed/);
  assert.equal(f.calls.length, 0);
});
test('missing API and missing explicit duplicate path fail closed', async () => {
  await assert.rejects(probePremiereReadOnly({}, { expectedProjectPath: path }), /unavailable/);
  await assert.rejects(probePremiereReadOnly(fixture().ppro), /absolute local/);
});
test('active sequence switch during reads invalidates result', async () => {
  const f = fixture(); let reads = 0;
  f.project.getActiveSequence = async () => ++reads === 1 ? f.seq
    : { guid: { toString: () => 'other-sequence' } };
  await assert.rejects(probePremiereReadOnly(f.ppro, { expectedProjectPath: path }), /discard partial/);
});

/* Read-only UXP probe. NOT a plugin/MCP server and NOT executed in Premiere yet.
 * After approved host setup: pass require('premierepro') and the exact duplicate
 * project path. No eval, file/network access, transactions, save or edit actions.
 * API shapes: adobe/premierepro-types@c8f108941197c1d987f08b9916c0d18a2e252699.
 */
'use strict';

function localProjectPath(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]:[\\/]/.test(value)
      || !/\.prproj$/i.test(value) || /(^|[\\/])\.\.?([\\/]|$)/.test(value)) {
    throw new Error('An exact absolute local Windows .prproj path is required');
  }
  return value.replace(/\\/g, '/').toLowerCase();
}

async function probePremiereReadOnly(ppro, { expectedProjectPath, expectedSequenceGuid } = {}) {
  const expected = localProjectPath(expectedProjectPath);
  if (!ppro?.Project?.getActiveProject || !ppro?.VideoFilterFactory?.getMatchNames
      || ppro?.Constants?.TrackItemType?.CLIP === undefined) {
    throw new Error('Required Premiere UXP discovery API unavailable; no fallback mutation');
  }
  const project = await ppro.Project.getActiveProject();
  if (!project || localProjectPath(project.path) !== expected) {
    throw new Error('Active project does not match the explicitly selected duplicate');
  }
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error('No active sequence');
  const sequenceGuid = sequence.guid.toString();
  if (expectedSequenceGuid && sequenceGuid !== expectedSequenceGuid) {
    throw new Error('Active sequence identity changed');
  }
  const frame = await sequence.getFrameSize();
  const trackCount = await sequence.getVideoTrackCount();
  const tracks = [];
  // Bounded diagnostic sample, not a complete timeline/export inspection.
  for (let t = 0; t < Math.min(trackCount, 4); t++) {
    const track = await sequence.getVideoTrack(t);
    const clips = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    const sampled = [];
    for (const clip of clips.slice(0, 3)) {
      const chain = await clip.getComponentChain();
      const componentCount = await chain.getComponentCount();
      const components = [];
      for (let c = 0; c < Math.min(componentCount, 12); c++) {
        const component = await chain.getComponentAtIndex(c);
        const paramCount = await component.getParamCount();
        const params = [];
        for (let p = 0; p < Math.min(paramCount, 24); p++) {
          const param = await component.getParam(p);
          const supportsKeyframes = await param.areKeyframesSupported();
          const timeVarying = supportsKeyframes ? await param.isTimeVarying() : false;
          params.push({ name: param.displayName, supportsKeyframes, timeVarying,
            keyframeCount: timeVarying ? (await param.getKeyframeListAsTickTimes()).length : 0 });
        }
        components.push({ matchName: await component.getMatchName(),
          displayName: await component.getDisplayName(), paramCount, params });
      }
      sampled.push({ componentCount, components });
    }
    tracks.push({ index: t, clipCount: clips.length, sampled });
  }
  const installedVideoEffects = await ppro.VideoFilterFactory.getMatchNames();
  // Recheck identity after async reads. No UI-title or track-index-only authority.
  const active = await ppro.Project.getActiveProject();
  if (!active || localProjectPath(active.path) !== expected
      || active.guid.toString() !== project.guid.toString()
      || (await active.getActiveSequence())?.guid.toString() !== sequenceGuid) {
    throw new Error('Project/sequence changed during inspection; discard partial result');
  }
  return { status: 'READ_ONLY_HOST_DISCOVERY', projectGuid: project.guid.toString(),
    sequenceGuid, dimensions: [frame.width, frame.height], videoTrackCount: trackCount,
    installedVideoEffects: [...installedVideoEffects], tracks,
    samplingLimits: { tracks: 4, clipsPerTrack: 3, componentsPerClip: 12, paramsPerComponent: 24 },
    mutationsExecuted: 0,
    limitation: 'Discovery does not prove effect creation, MOGRT editing, easing, audio or 4K export.' };
}

module.exports = { probePremiereReadOnly };

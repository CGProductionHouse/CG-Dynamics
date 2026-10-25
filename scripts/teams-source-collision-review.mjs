import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { resolve, dirname, basename, join, relative, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { reviewPlannerCollisionEvidence } from './lib/planner-collision-evidence.mjs'
import { preparePlannerCollisionResolutionPacket } from './lib/planner-collision-resolution-packet.mjs'
import { reviewPlannerCollisionNativeDetails } from './lib/planner-collision-native-details.mjs'
// Optional fourth argument: the existing complete native-master input snapshot.
// Without it, preserve the original exact-metadata review contract unchanged.
// Optional fifth: a manifest of native detail receipt paths/capture timestamps
// and the owner-confirmed source authority. This never enables an apply mode.
const args = process.argv.slice(2), [reviewPath, metadataPath, out, nativeInputPath, detailManifestPath] = args
const canonical = p => { const path = existsSync(p) ? realpathSync(p) : join(realpathSync(dirname(resolve(p))), basename(p)); return process.platform === 'win32' ? path.toLowerCase() : path }
if (![3, 4, 5].includes(args.length) || !isAbsolute(out) || existsSync(out) || !relative(canonical(process.cwd()), canonical(out)).startsWith('..')
  || [reviewPath, metadataPath, nativeInputPath, detailManifestPath].filter(Boolean).some(p => canonical(p) === canonical(out))) throw Error('New private output outside Git required')
const [review, metadata] = [reviewPath, metadataPath].map(p => JSON.parse(readFileSync(p, 'utf8')))
const input = nativeInputPath ? JSON.parse(readFileSync(nativeInputPath, 'utf8')) : null
const manifest = detailManifestPath ? JSON.parse(readFileSync(detailManifestPath, 'utf8')) : null
if (manifest && [manifest.authority_path, ...manifest.exports.map(e => e.receipt_path)].some(p => canonical(p) === canonical(out))) throw Error('New private output outside Git required')
const result = manifest ? reviewPlannerCollisionNativeDetails(review, metadata, input,
  JSON.parse(readFileSync(manifest.authority_path, 'utf8')), manifest.exports.map(e => ({ observed_at: e.observed_at, receipt: JSON.parse(readFileSync(e.receipt_path, 'utf8')) })))
  : nativeInputPath ? preparePlannerCollisionResolutionPacket(review, metadata, input.native_master_export)
  : reviewPlannerCollisionEvidence(review, metadata)
writeFileSync(out, JSON.stringify(result, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ output: out, sha256: createHash('sha256').update(JSON.stringify(result)).digest('hex'),
  clients: new Set(result.groups.map(g => g.client_id)).size, exact_source_rows: result.rows?.length ?? result.contender_count, collision_groups: result.groups.length,
  states: (result.rows ?? result.groups).reduce((a, r) => { const state = r.native_detail_state ?? r.disposition ?? r.state; a[state] = (a[state] ?? 0) + 1; return a }, {}), writes: 0, apply_ready: false }))

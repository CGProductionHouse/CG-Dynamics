// Read a PRIVATE locally captured JSON packet; no connector, filesystem writes,
// provider refresh or DB client. Prints counts/statuses, never task text/URLs/IDs.
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewPlannerMetadata } from '../src/lib/microsoftMetadataReview.ts'

const file = process.argv[2]
if (!file) throw Error('Supply a private local review packet path outside the repository.')
let packet
try {
  const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)))
  const path = realpathSync(file)
  const inside = relative(root, path)
  if (inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)) throw Error('internal packet')
  if (statSync(path).size > 20 * 1024 * 1024) throw Error('packet too large')
  packet = JSON.parse(readFileSync(path, 'utf8'))
} catch {
  throw Error('Private packet must be readable valid JSON, at most 20 MiB, outside the repository. No source content logged.')
}
if (packet.format !== 'cg-planner-metadata-review' || packet.version !== 1 || !Array.isArray(packet.rows)) throw Error('Unsupported review packet.')
const seen = new Set()
const rows = packet.rows.map(row => {
  const key = JSON.stringify([row.source?.planId, row.source?.taskId])
  const duplicate = seen.has(key)
  seen.add(key)
  const result = reviewPlannerMetadata(row)
  return {
    reference: createHash('sha256').update(key).digest('hex'),
    ...result,
    ...(duplicate ? { decision: 'hold', reason: 'DUPLICATE_SOURCE_IDENTITY' } : {}),
  }
})
// If an identity collides, BOTH rows stay held: no implicit first-wins survivor.
const duplicateRefs = new Set(rows.filter(row => row.reason === 'DUPLICATE_SOURCE_IDENTITY').map(row => row.reference))
for (const row of rows) if (duplicateRefs.has(row.reference)) Object.assign(row, { decision: 'hold', reason: 'DUPLICATE_SOURCE_IDENTITY' })
console.log(JSON.stringify({ format: 'cg-planner-metadata-review-receipt', version: 1, automaticApply: false, rows }, null, 2))

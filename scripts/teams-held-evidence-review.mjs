import { readFileSync, writeFileSync, existsSync, realpathSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, relative, isAbsolute, dirname, basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createServer } from 'vite'
import { reviewHeldScheduleEvidence } from './lib/held-schedule-review.mjs'
const args = process.argv.slice(2), [auditPath, inputPath, packetPath, authorityPath, out] = args
const canonical = p => { const full = existsSync(p) ? realpathSync(p) : join(realpathSync(dirname(resolve(p))), basename(p)); return process.platform === 'win32' ? full.toLowerCase() : full }
if (args.length !== 5 || !isAbsolute(out) || existsSync(out) || !relative(canonical(process.cwd()), canonical(out)).startsWith('..')
  || args.slice(0, 4).some(p => canonical(p) === canonical(out))) throw Error('New private output outside Git required')
const bytes = args.slice(0, 4).map(p => readFileSync(p, 'utf8')), [audit, input, packet] = bytes.map(s => JSON.parse(s))
const hash = s => createHash('sha256').update(s).digest('hex')
if (packet.source_hashes?.[0] !== hash(bytes[0]) || packet.source_hashes?.[1] !== hash(bytes[1])) throw Error('Packet/source drift; regenerate exact review first')
// Re-run all canonical identity/period/native-export/scope guards. No sidecar can
// promote a stale or hand-edited audit just because its hash field looks valid.
const temp = mkdtempSync(join(tmpdir(), 'cg-held-audit-'))
try {
  const reproduced = join(temp, 'reproduced.json')
  execFileSync(process.execPath, ['scripts/teams-readiness-audit.mjs', inputPath, '--authority', authorityPath, '--output', reproduced], { stdio: 'pipe' })
  if (!isDeepStrictEqual(JSON.parse(readFileSync(reproduced, 'utf8')), audit)) throw Error('Audit/source/authority drift')
} finally { rmSync(temp, { recursive: true, force: true }) }
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { deliverableIdentity } = await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts')
  const result = { ...reviewHeldScheduleEvidence(input, audit, packet, deliverableIdentity), source_hashes: bytes.map(hash) }
  writeFileSync(out, JSON.stringify(result, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ output: out, sha256: hash(JSON.stringify(result)), writes: 0, apply_ready: false,
    months: audit.months.map(m => ({ month: m.month, states: result.reviews.filter(r => r.month === m.month).reduce((a, r) => (a[r.evidence_state] = (a[r.evidence_state] ?? 0) + 1, a), {}) })) }))
} finally { await server.close() }

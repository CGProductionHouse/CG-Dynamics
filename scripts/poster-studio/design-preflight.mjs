#!/usr/bin/env node
// Local metadata/evidence gate. It never uploads, sends, renders or publishes.
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createServer } from 'vite'

export async function runPreflight(args) {
  const flags = new Map()
  for (let i=0;i<args.length;i+=2) {
    if (!args[i]?.startsWith('--') || !args[i+1] || flags.has(args[i])) throw new Error('Use unique --flag value pairs.')
    flags.set(args[i],args[i+1])
  }
  for (const key of ['--packet','--job','--artifact','--caption','--out']) if (!flags.has(key)) throw new Error(`Required: ${key}`)
  if (!flags.has('--review') && !flags.has('--init-review')) throw new Error('Supply --review or --init-review <new-file>.')
  const json = async key => JSON.parse(await readFile(flags.get(key),'utf8'))
  const [packet,job,artifact,caption] = await Promise.all([json('--packet'),json('--job'),readFile(flags.get('--artifact')),readFile(flags.get('--caption'))])
  const server = await createServer({ root: resolve(import.meta.dirname,'../..'), logLevel: 'error', optimizeDeps:{noDiscovery:true,entries:[]}, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const s = await server.ssrLoadModule('/supabase/functions/_shared/picassoDesignSystem.ts')
    const now = new Date().toISOString()
    const rules = Array.isArray(packet.rules) ? packet.rules : []
    const active = rules.filter(r => r && (r.client_id === job.clientId || r.client_id === null) && r.retired_at === null).sort((a,b) => String(a.id).localeCompare(String(b.id)))
    const ctx = { clientId:job.clientId, scopeKey:job.scopeKey, format:job.format, stage:job.stage, hasAudio:job.hasAudio, isPrint:job.isPrint,
      packRevision:packet.brandPack?.revision, packSha256:await s.designFingerprint(packet.brandPack), rulesSha256:await s.designFingerprint(active), briefSha256:packet.briefSha256,
      artifactSha256:createHash('sha256').update(artifact).digest('hex'), captionSha256:createHash('sha256').update(caption).digest('hex') }
    const blockers = [...s.brandPackReadiness(packet.brandPack,job.clientId,job.scopeKey,now).problems]
    const observed = Date.parse(packet.observedAt)
    if (!Number.isFinite(observed) || observed > Date.parse(now) || Date.parse(now)-observed > 24*60*60*1000) blockers.push('Reload the exact-client production packet; snapshot is missing, future-dated or older than 24 hours.')
    if (packet.status !== 'ready' || packet.clientId !== job.clientId || packet.scopeKey !== job.scopeKey || packet.packSha256 !== ctx.packSha256 || packet.rulesSha256 !== ctx.rulesSha256 || active.length !== rules.length) blockers.push('Packet is not ready or its exact scope/pack/rules binding changed.')
    if (flags.has('--init-review')) {
      const skeleton = { systemVersion:s.PICASSO_VERSION, context:ctx, reviewer:'', reviewedAt:now,
        checks:s.PICASSO_CHECKS.map(c => ({ id:c.id, result:s.applicableCheck(c,ctx)?'hold':'na', reason:s.applicableCheck(c,ctx)?'Evidence not yet reviewed.':`Not applicable to ${ctx.format}/${ctx.stage}; audio=${ctx.hasAudio}, print=${ctx.isPrint}.`, evidence:[] })) }
      await writeFile(flags.get('--init-review'),JSON.stringify(skeleton,null,2)+'\n',{flag:'wx'})
    }
    const review = flags.has('--review') ? await json('--review') : null
    const result = s.evaluateDesignReview(review,ctx,now)
    result.problems.unshift(...blockers)
    if (result.problems.length) result.status='hold'
    const receipt = { ...result, evaluatedAt:now, context:ctx, evidenceAuthenticity:'Declared evidence must be inspected; this validator does not authenticate external locators or judge creative taste.' }
    await writeFile(flags.get('--out'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'})
    return receipt
  } finally { await server.close() }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runPreflight(process.argv.slice(2))
    process.stdout.write(`${result.status}: ${result.problems.length} holds. No send/publication authorised.\n`)
    if (result.status !== 'checklist_complete') process.exitCode=2
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode=1 }
}

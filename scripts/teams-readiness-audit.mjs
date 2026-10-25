// Local, zero-write comparison. Input is an approved private snapshot; never a client authority.
// Reuse the production matcher/parser; do not infer package quantities from Planner tasks.
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { createServer } from 'vite'
import { createHash } from 'node:crypto'
import { verifyCapturedSchedulePages } from './lib/captured-schedule-pages.mjs'
import { verifyNativePlannerExport, nativeBucketMatches } from './lib/native-planner-export.mjs'
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const authorityIndex = process.argv.indexOf('--authority')
if (authorityIndex !== -1) {
  const authority = JSON.parse(readFileSync(process.argv[authorityIndex + 1], 'utf8'))
  if (authority.version !== 1 || authority.relationship !== 'monthly_cross_check_of_master_not_additional_capacity'
    || typeof authority.source_ref !== 'string' || !authority.source_ref.trim() || authority.master?.kind !== 'owner_confirmed_master'
    || !Array.isArray(authority.monthly)) throw Error('Invalid explicit source-authority receipt')
  for (const month of input.months) {
    delete month.period_authority
    const ids = [...new Set(month.buckets.map(b => b.plan_id))]
    const binding = authority.monthly.filter(a => a.plan_id === ids[0] && a.month === month.month)
    if (ids.length === 1 && binding.length === 1) month.period_authority = { ...binding[0], kind: 'owner_confirmed', source_ref: authority.source_ref }
  }
  if (input.master) {
    delete input.master.authority
    if (input.master.plan_id === authority.master.plan_id) input.master.authority = { kind: authority.master.kind, source_ref: authority.source_ref }
  }
}
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { resolveMicrosoftClient, deliverableIdentity, containsRestrictedPlannerContent } = await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts')
  const { matchClient, normaliseClientText } = await server.ssrLoadModule('/src/lib/clientMatcher.ts')
  if (input.clients.some(c => typeof c.active !== 'boolean')) throw new Error('Explicit Dynamics active flags required; the snapshot is not an eligibility authority.')
  if (input.clients.some(c => typeof c.id !== 'string' || !c.id.trim() || typeof c.name !== 'string' || !c.name.trim())
    || new Set(input.clients.map(c => c.id)).size !== input.clients.length) throw new Error('Exact unique Dynamics client identities required.')
  const directory = input.clients.filter(c => c.active).map(c => ({ ...c, aliases: input.aliases.filter(a => a.client_id === c.id).map(a => a.alias) }))
  const types = { dp: 'design_posters_per_month', photo: 'photo_posts_per_month', video: 'professional_videos_per_month', reel: 'reels_per_month' }
  const native=input.native_master_export
  const nativeMaster=native?verifyNativePlannerExport(native.receipt,native.binding,native.anchors):null
  if(nativeMaster&&(nativeMaster.plan_id!==input.master?.plan_id||native.binding.kind!=='owner_confirmed_master'
    ||input.master?.authority?.kind!=='owner_confirmed_master'
    ||native.binding.source_ref!==input.master?.authority?.source_ref
    ||input.master.expected_bucket_count!==nativeMaster.expected_bucket_count
    ||input.master.buckets.length!==nativeMaster.buckets.length
    ||nativeMaster.buckets.some(b=>!input.master.buckets.some(row=>row.id===b.id))))throw Error('Native master authority or bucket coverage differs')
  if(nativeMaster&&!input.master.buckets.every(b=>nativeBucketMatches(b,nativeMaster)))throw Error('Native master source fields differ')
  const captured = new Map()
  let captureBinding = null
  for(const read of input.captured_evidence_reads ?? []) {
    const plans=[input.master?.plan_id,...input.months.flatMap(m=>m.buckets.map(b=>b.plan_id))]
    if(!plans.includes(read.source_id)||captured.has(read.source_id))throw Error('Unexpected or repeated captured source identity')
    const verified=verifyCapturedSchedulePages(read.pages,{run_id:read.run_id,source_id:read.source_id,clients:input.clients})
    const binding=JSON.stringify([verified.run_id,verified.job_id,verified.captured_at,verified.directory_revision])
    if(input.cutoff!==verified.captured_at||(captureBinding!==null&&binding!==captureBinding))throw Error('Captured sources must share the exact audit cutoff, run, job and directory revision')
    captureBinding=binding
    captured.set(read.source_id,verified)
  }
  const exactClient = name => {
    const normalized = normaliseClientText(name)
    const eligible = directory.filter(c => [c.name, ...c.aliases].some(label => normaliseClientText(label) === normalized))
    const identity = matchClient(name, eligible)
    return ['exact', 'alias'].includes(identity.confidence) ? resolveMicrosoftClient(name, eligible).client : null
  }
  const taskScope = (task, client) => {
    if (!client || containsRestrictedPlannerContent(task)) return false
    const title = ` ${normaliseClientText(task.title)} `
    const named = directory.filter(c => [c.name, ...c.aliases].some(label => title.includes(` ${normaliseClientText(label)} `)))
    const identity = matchClient(task.title, named)
    return !identity.ambiguousBetween.length && (!identity.clientId || identity.clientId === client.id)
  }
  const coverage = bucket => !bucket.error && bucket.read_complete === true && Array.isArray(bucket.tasks)
    && Number.isInteger(bucket.expected_count) && bucket.expected_count === bucket.tasks.length
    && (nativeMaster?.plan_id===bucket.plan_id ? nativeBucketMatches(bucket,nativeMaster)
      : captured.has(bucket.plan_id) ? capturedBucketMatches(bucket) : bucket.tasks.length < 100)
    && new Set(bucket.tasks.map(t => t.id)).size === bucket.tasks.length
    && bucket.tasks.every(t => typeof t.id === 'string' && t.id.trim() === t.id && t.id && typeof t.title === 'string'
      && t.plan_id === bucket.plan_id && t.bucket_id === bucket.id)
  function capturedBucketMatches(bucket) {
    const source=captured.get(bucket.plan_id),records=source.records.filter(r=>r.source_bucket_id===bucket.id),client=exactClient(bucket.name)
    if(!client||records.length!==bucket.tasks.length)return false
    const byId=new Map(records.map(r=>[r.source_task_id,r]))
    return bucket.tasks.every(task=>{
      const row=byId.get(task.id),slot=deliverableIdentity(task.title)
      return row?.evidence_state==='numbered_source_reference_only'&&row.client_id===client.id&&row.client_name===client.name
        &&row.code===slot.code&&row.deliverable_type===slot.deliverable_type&&row.instance_number===slot.instance_number
        &&row.percent_complete===task.percent_complete&&taskScope(task,client)
        &&['start_date','due_date','completed_date'].every(key=>row[key]===(task[key]??null))
    })
  }
  const master = input.master
  const planCoverage = plan => plan?.bucket_list_complete === true && Array.isArray(plan.buckets)
    && plan.expected_bucket_count === plan.buckets.length && plan.buckets.length < 100
    && new Set(plan.buckets.map(b => b.id)).size === plan.buckets.length
    && plan.buckets.every(b => typeof b.id === 'string' && b.id.trim() && typeof b.plan_id === 'string' && b.plan_id.trim() && typeof b.name === 'string' && b.name.trim())
    && plan.buckets.every(b => Array.isArray(b.tasks))
    && new Set(plan.buckets.flatMap(b => b.tasks.map(t => `${b.plan_id}/${t.id}`))).size === plan.buckets.reduce((n,b) => n+b.tasks.length,0)
    && plan.buckets.every(coverage)
  const masterVerified = Boolean(master && master.authority?.kind === 'owner_confirmed_master'
    && typeof master.authority.source_ref === 'string' && master.authority.source_ref.trim()
    && typeof master.plan_id === 'string' && master.plan_id.trim())
  const planUses = input.months.flatMap(m => [...new Set(m.buckets.map(b => b.plan_id))])
  const months = input.months.map(month => {
    const planIds = [...new Set(month.buckets.map(b => b.plan_id))]
    const periodVerified = /^\d{4}-(0[1-9]|1[0-2])$/.test(month.month) && month.period_authority?.kind === 'owner_confirmed'
      && month.period_authority.month === month.month && typeof month.period_authority.source_ref === 'string'
      && Boolean(month.period_authority.source_ref.trim()) && planIds.length === 1 && typeof planIds[0] === 'string'
      && month.period_authority.plan_id === planIds[0] && planIds[0] !== master?.plan_id && planUses.filter(id => id === planIds[0]).length === 1
    const buckets = month.buckets.map(b => {
      const identityEvidence = matchClient(b.name, directory)
      // Canonical recognition can offer shortened/distinctive suggestions. They are not
      // sufficiently exact for an audit receipt or an import approval; leave them for review.
      const client = exactClient(b.name)
      const match = client ? { status: 'matched', client } : { status: 'unresolved', client: null }
      const counts = { dp: 0, photo: 0, video: 0, reel: 0 }
      const slots = new Map(), unrecognised = [], duplicateSlots = []
      for (const t of b.tasks ?? []) {
        if(containsRestrictedPlannerContent(t)){unrecognised.push({id:t.id,reason:'private_review_held'});continue}
        const identity = deliverableIdentity(t.title)
        if (!identity.deliverable_type) { unrecognised.push({ id: t.id, title: t.title }); continue }
        counts[identity.deliverable_type]++
        if (identity.code) { const prior = slots.get(identity.code); if (prior) duplicateSlots.push([prior, t.id]); slots.set(identity.code, t.id) }
      }
      const settings = match.client?.package_settings ?? {}
      const exactBuckets = month.buckets.filter(bucket => exactClient(bucket.name)?.id === client?.id)
      const allocationHeld = duplicateSlots.length > 0 || unrecognised.length > 0
        || (b.tasks ?? []).some(t => !deliverableIdentity(t.title).code || !taskScope(t, client)) || exactBuckets.length !== 1
      const comparison = Object.entries(types).map(([type, field]) => {
        const state = settings.verification?.field_states?.[field] ?? 'unknown'
        const confirmed = settings.verification?.status === 'confirmed' && state === 'known' && Number.isInteger(settings[field]) && settings[field] >= 0
        const expected = confirmed ? settings[field] : null
        return { type, field, package_state: state, confirmed_quantity: expected,
          teams_cards: b.error ? null : counts[type], verdict: b.error ? 'source_unavailable' : !coverage(b) || !planCoverage(month) ? 'source_incomplete'
            : !client ? 'identity_review_held' : !periodVerified ? 'period_unverified' : allocationHeld ? 'allocation_review_held'
              : expected === null ? 'package_unresolved' : counts[type] === expected ? 'count_aligned_only' : 'discuss_difference' }
      })
      return { bucket_id: b.id, bucket: b.name, plan_id: b.plan_id, client_id: match.client?.id ?? null, client: match.client?.name ?? null,
        identity: match.status, match_confidence: identityEvidence.confidence, source_complete: coverage(b),
        package_sources: settings.verification?.source_references ?? [],
        task_count: b.error ? null : b.tasks?.length ?? null, comparison, duplicate_slots: duplicateSlots, unrecognised,
        dynamics_rows: match.client ? input.schedule.filter(s => s.client_id === match.client.id && String(s.month).startsWith(month.month)).length : null }
    })
    const slotReview = directory.flatMap(client => {
      const monthlyBuckets = month.buckets.filter(b => exactClient(b.name)?.id === client.id)
      const masterBuckets = (master?.buckets ?? []).filter(b => exactClient(b.name)?.id === client.id)
      if (!monthlyBuckets.length && !masterBuckets.length) return []
      const reviewReady = periodVerified && masterVerified && monthlyBuckets.length === 1 && masterBuckets.length === 1
        && planCoverage(month) && planCoverage(master) && masterBuckets[0].plan_id === master.plan_id && coverage(monthlyBuckets[0]) && coverage(masterBuckets[0])
      const slots = new Map(), unallocated = []
      for (const [role, sourceBuckets] of [['monthly', monthlyBuckets], ['master', masterBuckets]]) {
        for (const bucket of sourceBuckets) for (const task of bucket.tasks ?? []) {
          // Completed master history is not a current capacity instruction. Still retained in raw source evidence.
          if (role === 'master' && task.percent_complete === 100) continue
          if (!taskScope(task, client)) { unallocated.push({ role, task_id: task.id, reason: 'identity_or_private_scope_held' }); continue }
          if (role === 'master' && ![0, 50].includes(task.percent_complete)) { unallocated.push({ role, task_id: task.id, reason: 'unknown_master_progress' }); continue }
          const identity = deliverableIdentity(task.title)
          if (!identity.code || !Number.isSafeInteger(identity.instance_number) || identity.instance_number < 1) {
            unallocated.push({ role, task_id: task.id, reason: 'no_exact_numbered_slot' }); continue
          }
          const key = `${identity.deliverable_type}/${identity.instance_number}`
          if (!slots.has(key)) slots.set(key, { slot: key, master_task_ids: [], monthly_task_ids: [] })
          slots.get(key)[`${role}_task_ids`].push(task.id)
        }
      }
      return [{ client_id: client.id, client: client.name, month: month.month,
        state: reviewReady && !unallocated.length && [...slots.values()].every(slot => slot.master_task_ids.length <= 1 && slot.monthly_task_ids.length <= 1) ? 'ready_for_exact_review' : 'held',
        scope: 'Master active reference versus monthly cross-check; never additive capacity, posting dates or publication proof.',
        slots: [...slots.values()].map(slot => ({ ...slot,
          verdict: !reviewReady ? 'coverage_or_identity_or_period_held' : slot.master_task_ids.length > 1 || slot.monthly_task_ids.length > 1 ? 'duplicate_slot_review'
            : slot.master_task_ids.length && slot.monthly_task_ids.length ? 'same_slot_cross_check_only'
              : slot.master_task_ids.length ? 'not_observed_in_monthly' : 'not_observed_in_master',
          proposed_schedule_writes: 0 })), unallocated }]
    })
    return { month: month.month, period_verified: periodVerified, bucket_count: buckets.length, task_count: month.buckets.reduce((n,b) => n + (b.tasks?.length ?? 0), 0),
      source_complete: planCoverage(month) && buckets.every(b => b.source_complete), buckets,
      slot_review: slotReview,
      multiple_buckets_for_one_client: directory.flatMap(c => {
        const matched = buckets.filter(b => b.client_id === c.id)
        return matched.length > 1 ? [{ client_id: c.id, client: c.name, buckets: matched.map(b => b.bucket), review: 'Do not infer separate packages or double-count monthly capacity; exact bucket allocation needs review.' }] : []
      }),
      active_clients_without_resolved_bucket: directory.filter(c => !buckets.some(b => b.client_id === c.id)).map(c => ({ id:c.id,name:c.name })) }
  })
  const result = { cutoff: input.cutoff, input_sha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'), active_clients: directory.length,
    package_authority_cutoff: input.package_authority_cutoff ?? input.cutoff,
    package_readback_required: input.package_readback_required === true, source_capture_scope: input.evidence_scope ?? null, apply_ready: false,
    native_master_export_proof: nativeMaster?.proof ?? null,
    captured_source_receipts:[...captured.values()].map(({records,...receipt})=>({...receipt,held_records:records.filter(r=>r.evidence_state!=='numbered_source_reference_only').length})),
    master_authority_verified: masterVerified, writes: 0, source_authority: 'Dynamics active client directory + explicit verified package fields; Teams cards are planning evidence, not contract changes. Master and monthly plans are non-additive cross-checks.', months }
  const outputIndex = process.argv.indexOf('--output')
  if (outputIndex !== -1) {
    const path = process.argv[outputIndex + 1]
    const canonical = value => {const full=existsSync(value)?realpathSync(value):resolve(value);return process.platform==='win32'?full.toLowerCase():full}
    if (!path || !isAbsolute(path) || !relative(canonical(process.cwd()), canonical(path)).startsWith('..')) throw new Error('Keep private generated evidence outside the repository, at an absolute output path.')
    if ([process.argv[2],authorityIndex === -1 ? null : process.argv[authorityIndex+1]].filter(Boolean).some(source=>canonical(source)===canonical(path))) throw new Error('Private output must never overwrite the approved input or authority receipt.')
    writeFileSync(path, JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ output: path, active_clients: result.active_clients, writes: 0, input_sha256: result.input_sha256, months: months.map(m => ({ month:m.month, period_verified:m.period_verified, observed_tasks:m.task_count, buckets:m.bucket_count, complete:m.source_complete,
      held_package_comparisons:m.buckets.reduce((count,b)=>count+b.comparison.filter(c=>['source_unavailable','source_incomplete','period_unverified','identity_review_held','allocation_review_held'].includes(c.verdict)).length,0),
      identity_review:m.buckets.filter(b=>!b.client_id).map(b=>({bucket:b.bucket,confidence:b.match_confidence})), multiple_buckets:m.multiple_buckets_for_one_client,
      differences:m.buckets.filter(b=>b.client_id&&b.comparison.some(c=>c.verdict==='discuss_difference')).map(b=>({client:b.client,bucket:b.bucket,diffs:b.comparison.filter(c=>c.verdict==='discuss_difference')})) })) }))
  } else console.log(JSON.stringify(result))
} finally { await server.close() }

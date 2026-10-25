import { createHash } from 'node:crypto'

// Point reads corroborate identities; they cannot select a duplicate survivor.
export function reviewPlannerCollisionEvidence(review, metadata) {
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  if (review.contract !== 'teams_held_evidence_review_v1' || review.writes !== 0 || review.apply_ready !== false
    || metadata.contract !== 'planner_exact_task_metadata_readback_v1' || metadata.read_only !== true
    || metadata.writes !== 0 || metadata.apply_ready !== false || metadata.source_review_sha256 !== sha(review)
    || !Array.isArray(metadata.rows) || !metadata.rows.length) throw Error('Exact zero-write reviewed source binding required')
  const scope = new Set(metadata.rows.map(r => r.expected?.client_id)), expected = new Map(), groups = new Map()
  for (const r of review.reviews.filter(r => scope.has(r.client_id))) {
    for (const format of r.formats) for (const slot of format.duplicate_slots) for (const role of ['master', 'monthly']) {
      const ids = slot[`${role}_task_ids`]
      if (ids.length < 2) continue
      const key = `${r.client_id}/${role === 'master' ? 'master' : r.month}/${slot.slot}`
      const members = ids.map(id => {
        const matches = r.source_evidence.filter(s => s.task_id === id && s.role === role)
        if (matches.length !== 1) throw Error('Exact source collision membership required')
        const s = matches[0], value = { id, plan_id: s.plan_id, bucket_id: s.bucket_id, title: s.title, progress: s.progress,
          client_id: r.client_id, client: r.client, role }
        const sourceKey = `${s.plan_id}/${id}`
        if (expected.has(sourceKey) && sha(expected.get(sourceKey)) !== sha(value)) throw Error('Conflicting exact source identity')
        expected.set(sourceKey, value)
        return sourceKey
      })
      if (groups.has(key) && sha(groups.get(key).source_keys) !== sha(members)) throw Error('Master collision differs between months')
      groups.set(key, { client_id: r.client_id, client: r.client, month: role === 'master' ? null : r.month, role, slot: slot.slot, source_keys: members })
    }
  }
  if (metadata.rows.length !== expected.size) throw Error('Missing or additional contending source receipts')
  const seen = new Set(), rows = metadata.rows.map(r => {
    const key = `${r.expected?.plan_id}/${r.expected?.id}`, reference = expected.get(key)
    if (!reference || seen.has(key) || sha(reference) !== sha(r.expected)) throw Error('Foreign, edited or repeated source receipt')
    seen.add(key)
    const current = r.retry ?? r
    if (!Number.isFinite(Date.parse(r.observed_at)) || !Number.isFinite(Date.parse(current.observed_at))) throw Error('Exact read timestamps required')
    const fields = ['id', 'plan_id', 'bucket_id', 'title']
    const drift = current.source ? fields.filter(f => current.source[f] !== reference[f]) : []
    if (current.source && current.source.percent_complete !== reference.progress) drift.push('percent_complete')
    return { source_key: key, client_id: reference.client_id, task_id: reference.id,
      state: current.error || !current.source ? 'read_failed_held' : drift.length ? 'source_drift_held' : 'exact_metadata_match_still_contested',
      changed_fields: drift, observed_at: current.observed_at, source: current.source,
      survivor: null, proposed_writes: 0 }
  })
  const byKey = new Map(rows.map(r => [r.source_key, r]))
  return { contract: 'planner_contested_source_review_v1', source_review_sha256: sha(review), metadata_sha256: sha(metadata),
    clients: [...scope], rows, groups: [...groups.values()].map(g => ({ ...g,
      state: g.source_keys.some(k => byKey.get(k).state !== 'exact_metadata_match_still_contested') ? 'read_or_drift_held' : 'all_identities_verified_still_contested',
      survivor: null, proposed_writes: 0 })), writes: 0, apply_ready: false,
    limitations: ['Exact task point reads are not complete plan refreshes or deletion proof.',
      'Creation/completion timestamps and matching titles do not establish reporting period, publication or a safe survivor.',
      'No client/package decision, source deletion, canonical slot assignment or date is authorised.'] }
}

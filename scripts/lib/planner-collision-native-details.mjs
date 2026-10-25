import { createHash } from 'node:crypto'
import { preparePlannerCollisionResolutionPacket } from './planner-collision-resolution-packet.mjs'

// Read-only evidence enrichment. Matching notes never chooses a survivor.
export function reviewPlannerCollisionNativeDetails(review, metadata, input, authority, exports) {
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const base = preparePlannerCollisionResolutionPacket(review, metadata, input.native_master_export)
  if (authority?.relationship !== 'monthly_cross_check_of_master_not_additional_capacity'
    || !authority.source_ref || authority.master?.kind !== 'owner_confirmed_master'
    || authority.master.plan_id !== input.native_master_export.binding.plan_id
    || !Array.isArray(authority.monthly) || !Array.isArray(exports)
    || exports.length !== authority.monthly.length + 1) throw Error('Exact owner-confirmed source authority required')
  const bindings = [{ ...authority.master, month: null }, ...authority.monthly]
  if (new Set(bindings.map(b => b.plan_id)).size !== bindings.length) throw Error('Repeated source authority')
  const sources = new Map(), progress = { 'Not started': 0, 'In progress': 50, Completed: 100 }
  const date = v => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)
  for (const entry of exports) {
    const r = entry.receipt, plan = r?.plan?.['Plan ID'], binding = bindings.find(b => b.plan_id === plan)
    if (!binding || sources.has(plan) || !Number.isFinite(Date.parse(entry.observed_at))
      || r.contract !== 'planner_native_export_v1' || r.writes !== 0 || r.apply_ready !== false
      || r.consolidated_task_identity_and_source_fields_match !== true || !/^[a-f0-9]{64}$/.test(r.file_sha256 ?? '')
      || r.plan['Plan name']?.trim() !== binding.source_name || !date(r.plan['Date of export']) || r.plan['Date of export'] === null
      || !Array.isArray(r.tasks) || !Array.isArray(r.buckets) || r.task_count !== r.tasks.length || r.bucket_count !== r.buckets.length) throw Error('Incomplete native detail receipt')
    const old = binding.month === null ? input.master : input.months.find(m => m.plan_id === plan && m.month === binding.month)
    if (!old || old.plan_id !== plan || old.bucket_list_complete !== true || old.expected_bucket_count !== old.buckets.length
      || old.buckets.length !== r.buckets.length || old.buckets.some(b => b.read_complete !== true || b.expected_count !== b.tasks.length
        || b.tasks.some(t => t.plan_id !== plan || t.bucket_id !== b.id))) throw Error('Exact source month/bucket coverage required')
    const oldBuckets = new Map(old.buckets.map(b => [b.id, b])), buckets = new Map()
    for (const b of r.buckets) {
      const prior = oldBuckets.get(b['Bucket ID'])
      if (!prior || prior.plan_id !== plan || prior.name !== b['Bucket Name'] || buckets.has(b['Bucket ID'])) throw Error('Source bucket identity drift')
      buckets.set(b['Bucket ID'], b)
    }
    const priorTasks = old.buckets.flatMap(b => b.tasks), before = new Map(priorTasks.map(t => [t.id, t])), rows = new Map()
    if (before.size !== priorTasks.length || before.size !== r.tasks.length) throw Error('Source membership changed; re-enumerate, never infer deletion')
    for (const t of r.tasks) {
      if (!before.has(t['Task ID']) || before.get(t['Task ID']).bucket_id !== t.Bucket || rows.has(t['Task ID']) || !buckets.has(t.Bucket)
        || typeof t['Task Name'] !== 'string' || !Object.hasOwn(progress, t.Status)
        || !['Start date', 'Due date', 'Completed Date'].every(k => date(t[k]))
        || !['Notes', 'Checklist Items', 'Completed Checklist Items', 'Labels'].every(k => Object.hasOwn(t, k) && (t[k] === null || typeof t[k] === 'string'))) throw Error('Missing, foreign or malformed exact task details')
      rows.set(t['Task ID'], t)
    }
    sources.set(plan, { ...entry, rows, binding })
  }
  const groups = base.groups.map(g => {
    for (const context of g.contexts) for (const a of context.master) {
      const t = sources.get(a.plan_id)?.rows.get(a.task_id)
      if (!t || t['Task Name'] !== a.title || t.Bucket !== a.bucket_id || t.Notes !== a.notes
        || t['Start date'] !== a.start_date || t['Due date'] !== a.due_date) throw Error('Master context changed; rebuild reviewed evidence before correspondence')
    }
    const members = g.members.map(m => {
      const source = sources.get(m.source_key.split('/')[0]), t = source?.rows.get(m.task_id)
      if (!t || source.binding.month !== g.month) throw Error('Exact contender plan/month binding required')
      const changes = ['title', 'bucket_id', 'percent_complete'].filter(k => m.metadata?.[k] !== ({ title: t['Task Name'], bucket_id: t.Bucket, percent_complete: progress[t.Status] })[k])
      return { ...m, notes: t.Notes, notes_state: 'native_export_observed', checklist_state: 'native_export_observed',
        checklist: t['Checklist Items'], completed_checklist: t['Completed Checklist Items'], labels: t.Labels,
        start_date: t['Start date'], due_date: t['Due date'], completed_date: t['Completed Date'],
        native_export_observed_at: source.observed_at, native_export_date: source.receipt.plan['Date of export'],
        native_file_sha256: source.receipt.file_sha256, source_revision: null, changes_since_metadata: changes,
        attachments_state: 'not_in_native_export', context_note_matches: g.role === 'monthly' && typeof t.Notes === 'string' && t.Notes.trim()
          ? [...new Set(g.contexts.flatMap(c => c.master.filter(a => a.notes === t.Notes).map(a => a.task_id)))] : [] }
    })
    const state = members.some(m => m.changes_since_metadata.length || m.metadata_state !== 'exact_metadata_match_still_contested') ? 'source_drift_or_read_failure_held'
      : g.role === 'master' ? 'distinct_master_records_no_supersession_evidence'
        : members.every(m => !m.notes?.trim()) ? 'observed_blank_notes_no_identity_discriminator'
        : members.some(m => m.context_note_matches.length) ? 'master_note_correspondence_not_survivor_authority' : 'different_content_preserve_all_identities'
    return { ...g, members, native_detail_state: state, survivor: null, proposed_writes: 0,
      flags: [...g.flags.filter(f => !['monthly_notes_checklists_attachments_not_retrieved', 'monthly_cards_undated'].includes(f)),
        ...(g.role === 'monthly' && members.every(m => m.start_date === null && m.due_date === null) ? ['monthly_cards_undated'] : []),
        'attachments_and_revisions_not_in_native_export'],
      required_evidence: ['Exact source-intent or durable-link evidence identifying any superseded record; richer notes alone are insufficient.',
        'Before any separately authorised apply: current source revisions, full exact-client/month canonical target including unscheduled rows and current package/template authority.'] }
  })
  return { ...base, contract: 'planner_collision_native_details_review_v1', base_packet_sha256: sha(base),
    source_authority_sha256: sha(authority), exports_sha256: sha(exports), groups,
    source_cutoff_note: 'Provider Excel exports observed at individual timestamps; source date precision only, no ETags or posting-date inference.',
    source_exports: exports.map(e => ({ plan_id: e.receipt.plan['Plan ID'], observed_at: e.observed_at,
      file_sha256: e.receipt.file_sha256, task_count: e.receipt.task_count, bucket_count: e.receipt.bucket_count })),
    limitations: [...base.limitations, 'Notes/checklists/labels are observed, not missing. Attachments and task revisions are not represented in these exports.'],
    resolved_groups: 0, held_groups: groups.length, writes: 0, apply_ready: false }
}

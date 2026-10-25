import { createHash } from 'node:crypto'
import { reviewPlannerCollisionEvidence } from './planner-collision-evidence.mjs'
import { verifyNativePlannerExport } from './native-planner-export.mjs'

// Evidence preparation only. A copied card or richer notes cannot authorise a
// deletion, choose a survivor, assign a month/date or increase package capacity.
export function preparePlannerCollisionResolutionPacket(review, metadata, nativeProof) {
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const collisions = reviewPlannerCollisionEvidence(review, metadata)
  const native = verifyNativePlannerExport(nativeProof.receipt, nativeProof.binding, nativeProof.anchors)
  const nativeRows = new Map(native.buckets.flatMap(b => b.tasks.map(t => [t.id, t])))
  const checked = new Map(collisions.rows.map(r => [r.source_key, r]))
  const groups = collisions.groups.map(group => {
    const reviews = review.reviews.filter(r => r.client_id === group.client_id && (group.month === null || r.month === group.month))
    if (!reviews.length || reviews.some(r => r.client !== group.client)) throw Error('Exact client/month review required')
    const contexts = reviews.map(r => {
      const formats = r.formats.filter(f => f.duplicate_slots.some(s => s.slot === group.slot
        && JSON.stringify(s[`${group.role}_task_ids`].map(id => `${group.source_keys[0].split('/')[0]}/${id}`)) === JSON.stringify(group.source_keys)))
      if (formats.length !== 1) throw Error('Exact reviewed slot and contender set required')
      const format = formats[0], slot = format.duplicate_slots.find(s => s.slot === group.slot)
      const master = slot.master_task_ids.map(id => {
        const references = r.source_evidence.filter(s => s.role === 'master' && s.task_id === id)
        const row = nativeRows.get(id), reference = references[0]
        if (references.length !== 1 || !row || reference.plan_id !== native.plan_id
          || ['title', 'bucket_id'].some(k => reference[k] !== row[k]) || reference.progress !== row.percent_complete
          || reference.source_date !== (row.due_date ?? row.start_date)
          || reference.source_notes !== row.description) throw Error('Master context drift; keep held')
        return { task_id: id, plan_id: row.plan_id, bucket_id: row.bucket_id, title: row.title,
          start_date: row.start_date, due_date: row.due_date, notes: row.description,
          date_precision: 'native_export_date_only', export_date: native.proof.export_date,
          date_inheritance_authorised: false }
      })
      return { month: r.month, package_field: format.field, package_state: format.package_state,
        confirmed_quantity: format.confirmed_quantity, source_card_counts: format.source_card_counts,
        package_receipt_sha256: hash(r.package_evidence), full_structured_package_readback_required: true, master }
    })
    const members = group.source_keys.map(key => {
      const row = checked.get(key)
      const master = group.role === 'master' ? contexts[0].master.find(m => m.task_id === row.task_id) : null
      return { source_key: key, task_id: row.task_id, metadata_state: row.state,
        metadata_observed_at: row.observed_at, metadata: row.source,
        notes: master?.notes ?? null, notes_state: master ? 'native_export_observed' : 'not_retrieved',
        checklist_state: 'not_retrieved', attachments_state: 'not_retrieved', survivor: null }
    })
    const flags = []
    if (members.some(m => m.metadata_state !== 'exact_metadata_match_still_contested')) flags.push('metadata_read_or_drift_hold')
    for (const field of ['title', 'percent_complete', 'start_date_time', 'due_date_time']) {
      if (new Set(members.map(m => m.metadata?.[field])).size > 1) flags.push(`${field}_differs`)
    }
    if (group.role === 'monthly') {
      flags.push('monthly_notes_checklists_attachments_not_retrieved')
      if (members.every(m => m.metadata && m.metadata.start_date_time === null && m.metadata.due_date_time === null)) flags.push('monthly_cards_undated')
      if (contexts.some(c => c.master.some(m => (m.due_date ?? m.start_date)?.slice(0, 7) !== c.month))) flags.push('master_reference_not_same_calendar_month_no_date_inheritance')
    } else {
      if (new Set(members.map(m => m.notes)).size > 1) flags.push('master_notes_differ')
      if (new Set(contexts[0].master.map(m => `${m.start_date}/${m.due_date}`)).size > 1) flags.push('master_dates_differ')
    }
    if (members.some(m => /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/i.test(m.metadata?.title ?? ''))) flags.push('title_period_marker_not_period_authority')
    return { ...group, contexts, members, flags,
      disposition: 'preserve_all_identities_slot_resolution_held', survivor: null, proposed_writes: 0,
      required_evidence: ['Exact contender notes/checklists/attachments and any durable task linkage, with read timestamps and revision guards.',
        'Evidence establishing whether these exact identities are separate work, copied checklists or an explicitly superseded record.',
        'Before any later authorised apply: full exact-client/month target including unscheduled rows, current package/templates and all source revisions.'] }
  })
  return { contract: 'planner_collision_resolution_packet_v1', source_review_sha256: hash(review), metadata_sha256: hash(metadata),
    collision_review_sha256: hash(collisions), native_proof_sha256: hash(nativeProof),
    source_cutoff_note: 'Existing non-atomic receipts, not a fresh source scan. Native date-only export is not a posting or reporting-period authority.',
    group_count: groups.length, contender_count: collisions.rows.length, groups,
    resolved_groups: 0, held_groups: groups.length, writes: 0, apply_ready: false,
    limitations: ['No automatic winner, package change, inferred posting date, duplicate deletion or production apply.',
      'Null source notes observed in an export are distinct from monthly details not retrieved.',
      'The three separately held package questions are unchanged.'] }
}

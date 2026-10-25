// Evidence-only sidecar to the strict numbered-slot audit. Never an import plan.
export function reviewHeldScheduleEvidence(input, audit, packet, parse) {
  if (audit.writes !== 0 || audit.apply_ready !== false || packet.writes !== 0 || packet.apply_ready !== false
    || packet.contract !== 'teams_full_source_package_review_v1' || !audit.master_authority_verified
    || audit.native_master_export_proof?.kind !== 'native_planner_export') throw Error('Zero-write complete native source review required')
  const fields = { dp: 'design_posters_per_month', photo: 'photo_posts_per_month', video: 'professional_videos_per_month', reel: 'reels_per_month' }
  const reviews = []
  for (const month of audit.months) {
    const source = input.months.filter(m => m.month === month.month)
    if (source.length !== 1 || !month.source_complete || !month.period_verified) throw Error('Exact complete owner-confirmed month required')
    for (const held of month.slot_review.filter(r => r.state === 'held')) {
      const clients = input.clients.filter(c => c.active === true && c.id === held.client_id && c.name === held.client)
      const receipts = packet.clients.filter(c => c.client_id === held.client_id && c.client === held.client)
      const buckets = month.buckets.filter(b => b.client_id === held.client_id && b.source_complete)
      if (clients.length !== 1 || receipts.length !== 1 || buckets.length > 1) throw Error('Exact isolated client and package receipt required')
      if (buckets.length && held.slots.some(s => s.verdict === 'coverage_or_identity_or_period_held')) throw Error('Master/source coverage remains held')
      const client = clients[0], settings = client.package_settings ?? {}, receipt = receipts[0]
      const monthly = buckets.length ? source[0].buckets.filter(b => b.id === buckets[0].bucket_id && b.plan_id === buckets[0].plan_id) : []
      // Master IDs must come from this client's original numbered/unallocated audit, not title similarity.
      const masterIds = new Set([...held.slots.flatMap(s => s.master_task_ids), ...held.unallocated.filter(u => u.role === 'master').map(u => u.task_id)])
      const master = input.master.buckets.filter(b => b.tasks.some(t => masterIds.has(t.id)))
      if (monthly.length !== buckets.length || master.length !== 1) throw Error('Exact unique source bucket required')
      const sources = { master: master[0].tasks.filter(t => t.percent_complete !== 100), monthly: monthly[0]?.tasks ?? [] }
      const unsafe = new Set(held.unallocated.filter(u => u.reason !== 'no_exact_numbered_slot').map(u => `${u.role}/${u.task_id}`))
      const refs = Object.entries(sources).flatMap(([role, tasks]) => tasks.map(t => ({ role, task_id: t.id, plan_id: t.plan_id, bucket_id: t.bucket_id,
        title: t.title, source_date: t.due_date ?? null, progress: t.percent_complete, source_notes: t.description ?? null,
        type: unsafe.has(`${role}/${t.id}`) ? null : parse(t.title).deliverable_type ?? null })))
      if (refs.some(r => !r.task_id || r.plan_id !== (r.role === 'master' ? input.master.plan_id : buckets[0].plan_id)
        || r.bucket_id !== (r.role === 'master' ? master[0].id : monthly[0].id))) throw Error('Foreign source membership')
      const issues = []
      if (!monthly.length) issues.push({ field: null, verdict: 'exact_monthly_bucket_not_observed' })
      const formats = Object.entries(fields).map(([type, field]) => {
        const known = settings.verification?.status === 'confirmed' && settings.verification.field_states?.[field] === 'known'
          && Number.isSafeInteger(settings[field]) && settings[field] >= 0
        const confirmed = known ? settings[field] : null
        const rows = refs.filter(r => r.type === type)
        const counts = Object.fromEntries(['master', 'monthly'].map(role => [role, rows.filter(r => r.role === role).length]))
        const duplicates = held.slots.filter(s => s.slot.startsWith(`${type}/`) && (s.master_task_ids.length > 1 || s.monthly_task_ids.length > 1))
        const numbered = rows.every(r => Boolean(parse(r.title).code))
        const singleton = ['video', 'reel'].includes(type) && confirmed === 1 && counts.master === 1 && counts.monthly === 1
        const current = receipt.package_readback === 'numeric_mix_and_confirmation_timestamp_match'
        const verdict = !current ? 'package_readback_held' : !known ? 'unknown_or_flexible_not_zero'
          : unsafe.size ? 'unsafe_source_scope_held' : duplicates.length ? 'duplicate_source_slot_held'
            : counts.master !== confirmed || counts.monthly !== confirmed ? 'source_quantity_differs_from_confirmed_scope'
              : singleton && !numbered ? 'singleton_format_evidence_resolved_no_slot_assigned'
                : !numbered ? 'format_count_aligned_numbered_allocation_held' : 'numbered_format_count_aligned'
        if (['package_readback_held', 'unsafe_source_scope_held', 'duplicate_source_slot_held', 'source_quantity_differs_from_confirmed_scope', 'format_count_aligned_numbered_allocation_held'].includes(verdict)) issues.push({ field, verdict })
        return { type, field, package_state: settings.verification?.field_states?.[field] ?? 'unknown', confirmed_quantity: confirmed,
          source_card_counts: counts, source_refs: rows.map(r => ({ role: r.role, plan_id: r.plan_id, task_id: r.task_id })),
          duplicate_slots: duplicates, verdict, canonical_slot_assignment: null }
      })
      const other = refs.filter(r => !r.type)
      if (other.length) issues.push({ field: null, verdict: 'noncanonical_card_purpose_or_scope_held', source_refs: other.map(r => ({ role: r.role, task_id: r.task_id })) })
      for (const format of formats.filter(f => f.confirmed_quantity === null && (f.source_card_counts.master || f.source_card_counts.monthly))) {
        issues.push({ field: format.field, verdict: 'source_cards_do_not_confirm_unknown_or_flexible_package' })
      }
      reviews.push({ client_id: client.id, client: client.name, month: month.month, original_slot_state: held.state,
        evidence_state: issues.length ? 'remaining_source_or_scope_review' : 'evidence_resolved_no_client_decision',
        formats, issues, source_evidence: refs, package_evidence: { frozen_settings: settings, current_numeric_receipt: receipt },
        canonical_slot_state: 'unchanged_held', posting_dates_assigned: 0, proposed_package_changes: 0, proposed_schedule_writes: 0 })
    }
  }
  return { contract: 'teams_held_evidence_review_v1', reviews, writes: 0, apply_ready: false,
    limitations: ['Capacity evidence is not an exact numbered-slot assignment or an import approval.',
      'Completed monthly cards remain evidence; completion does not prove publication, historical period or safe deduplication.',
      'Master and monthly sources are non-additive and non-atomic. No dates, slots or package changes are inferred.',
      'Current numeric receipts do not replace full structured package/template/revision readback before any future apply.'] }
}

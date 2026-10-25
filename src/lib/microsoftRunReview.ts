// Read-only journal review. A reviewed journal is never an apply plan.
export function microsoftRunCount(summary: object, keys: string[]): number | null {
  const values = keys.filter(key => Object.hasOwn(summary, key)).map(key => (summary as Record<string, unknown>)[key])
  return values.length && values.every(v => Number.isSafeInteger(v) && (v as number) >= 0) && new Set(values).size === 1 ? values[0] as number : null
}
export const microsoftConflictCount = (summary: object) => microsoftRunCount(summary, ['conflicts', 'conflict', 'conflictsUntouched'])
export const microsoftRunOutcome = (run: { status: string; summary: object }) => `${run.status} · ${microsoftRunCount(run.summary, ['applied']) ?? 'Unknown'} applied · ${microsoftConflictCount(run.summary) ?? 'Unknown'} conflicts held for review`
export type ReviewRun = { id: string; snapshotExportedAt: string; finishedAt: string | null; status: string; summary: object }
export type ReviewItem = { id: string; itemKey: string; sourceType: string; sourceContainerId: string; sourceItemId: string; sourceName: string; destination: string; destinationId: string | null; action: string; resultStatus: string; sourceComplete: boolean; details: { conflict_code?: unknown } }
export function buildMicrosoftRunReview(run: ReviewRun, items: ReviewItem[]) {
  const expected = microsoftConflictCount(run.summary)
  const conflicts = items.filter(item => item.action === 'conflict')
  const rows = conflicts.map(item => ({ journal_id: item.id, item_key: item.itemKey, source_type: item.sourceType,
    source_container_id: item.sourceContainerId, source_item_id: item.sourceItemId, source_name: item.sourceName,
    destination: item.destination, destination_id: item.destinationId, result_status: item.resultStatus,
    source_complete: item.sourceComplete,
    conflict_code: typeof item.details.conflict_code === 'string' && /^[a-z_]{1,100}$/.test(item.details.conflict_code) ? item.details.conflict_code : 'uncoded',
    resolution: 'fresh_canonical_preview_required' as const, proposed_writes: 0 as const }))
  return { contract: 'microsoft_conflict_review_v1', run_id: run.id, source_exported_at: run.snapshotExportedAt,
    finished_at: run.finishedAt, expected_conflicts: expected, observed_conflicts: rows.length,
    coverage: expected === null ? 'summary_unavailable' : expected !== rows.length ? 'count_mismatch' : 'journal_count_matches_only',
    count_gap: expected === null ? null : expected - rows.length, uncoded: rows.filter(row => row.conflict_code === 'uncoded').length,
    rows, writes: 0, apply_ready: false,
    rule: 'No force apply. Re-read exact source and current target revisions through the existing canonical preview; preserve staff edits, private work and source-removal approval. Journal count agreement is not source completeness or approval.' }
}

export interface PlannerTaskOwnership {
  assignment_review_state?: string | null
}

export function isVerifiedPlannerTaskOwner(
  task: PlannerTaskOwnership,
  assignedProfileIds: readonly string[],
  profileId: string,
): boolean {
  if (!profileId || task.assignment_review_state !== 'ok') return false
  return assignedProfileIds.includes(profileId)
}

export function canReadPlannerTask(
  task: PlannerTaskOwnership,
  assignedProfileIds: readonly string[],
  profileId: string,
  role: string,
): boolean {
  if (role === 'admin' || role === 'manager') return true
  return isVerifiedPlannerTaskOwner(task, assignedProfileIds, profileId)
}

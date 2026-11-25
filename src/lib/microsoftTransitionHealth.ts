// Collection permission and mirror freshness are separate facts. A recent run
// cannot prove that collection is enabled today, nor can Active prove freshness.
export function describeMicrosoftTransition(value: unknown, verified: boolean) {
  if (!verified || !['active', 'paused', 'complete'].includes(String(value))) return {
    state: 'unverified', canCollect: false, label: 'Microsoft status unavailable',
    message: 'Microsoft collection status could not be verified. Use live Microsoft for current work; the saved mirror is not proof of freshness.',
  }
  if (value === 'paused') return {
    state: 'paused', canCollect: false, label: 'Microsoft collection paused',
    message: 'Microsoft collection is paused. Existing Dynamics records are retained, but no new reconciliation can start until collection is resumed.',
  }
  if (value === 'complete') return {
    state: 'complete', canCollect: false, label: 'Microsoft transition ended',
    message: 'The Microsoft transition has ended. Existing records are retained; automatic collection is no longer active.',
  }
  return {
    state: 'active', canCollect: true, label: 'Microsoft available',
    message: 'Microsoft collection is enabled. Check the latest source coverage and reconciliation result before relying on the Dynamics mirror.',
  }
}

export function withMicrosoftTransitionHealth<T extends { state: string; degraded: boolean; reason: string }>(
  health: T, value: unknown, verified: boolean,
) {
  const transition = describeMicrosoftTransition(value, verified)
  return {
    ...health,
    freshness_state: health.state,
    transition_status: transition.state,
    ...(transition.canCollect ? {} : { state: transition.state, degraded: true, reason: transition.message }),
  }
}

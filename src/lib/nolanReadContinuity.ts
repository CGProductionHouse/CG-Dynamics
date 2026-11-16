/** Ephemeral display continuity only; never lifecycle or permission authority. */
export type RetainedRows<T> = { data: T[]; lastSuccessAt: string | null; stale: boolean };
export function retainNolanRows<T>(incoming: T[], failed: boolean, checkedAt: string,
  prior: RetainedRows<T> | undefined): RetainedRows<T> {
  if (!failed) return { data: incoming, lastSuccessAt: checkedAt, stale: false };
  return { data: prior?.data ?? [], lastSuccessAt: prior?.lastSuccessAt ?? null, stale: !!prior?.lastSuccessAt };
}
export function nolanReadScope(userId: string | undefined, profileId: string | undefined, role: string | undefined, month: string): string | null {
  return userId && profileId && userId === profileId && role && ['admin', 'manager'].includes(role)
    ? JSON.stringify([userId, profileId, role, month]) : null;
}

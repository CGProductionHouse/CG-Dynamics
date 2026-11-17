import { getProfile } from './db/profiles'

type Viewer = { userId: string; profileId: string; role: string }
const unavailable = () => new Error('Current account authorization changed or is unavailable. Refresh your signed-in profile before reading workbook sources.')

/** Display boundary only. Canonical source RLS must independently enforce access.
 * Recheck after awaited reads so revocation during a refresh discards all rows. */
export async function withNolanVerifiedViewer<T>(viewer: Viewer, read: () => Promise<T>, profileReader = getProfile): Promise<T> {
  if (!viewer.userId || viewer.userId !== viewer.profileId || !['admin', 'manager'].includes(viewer.role)) throw unavailable()
  const verify = async () => {
    const { data, error } = await profileReader(viewer.userId)
    if (error || !data || data.id !== viewer.userId || data.role !== viewer.role || data.is_active !== true) throw unavailable()
  }
  await verify()
  const result = await read()
  await verify()
  return result
}

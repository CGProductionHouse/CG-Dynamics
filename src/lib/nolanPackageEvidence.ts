import { listClients } from './db/clients'
import { loadActiveClientPackageEvidenceMatrix } from './packageEvidence'
import { withNolanVerifiedViewer } from './nolanVerifiedViewer'

export function loadVerifiedNolanPackageEvidence(
  viewer: { userId: string; profileId: string; role: string },
  read = loadNolanPackageEvidence,
) {
  return withNolanVerifiedViewer(viewer, read)
}

export async function loadNolanPackageEvidence(
  readClients = () => listClients('active'),
  readMatrix = loadActiveClientPackageEvidenceMatrix,
  now = () => new Date().toISOString(),
) {
  const clients = await readClients()
  if (clients.error) throw clients.error
  const result = await readMatrix(clients.data)
  if (result.error) throw result.error
  return { data: result.data, checkedAt: now() }
}


import { listClients } from './db/clients'
import { loadActiveClientPackageEvidenceMatrix } from './packageEvidence'

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


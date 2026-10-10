import { getWebsiteLeadMetrics, listWebsiteLeads } from './db/websiteLeads'
import { currentReportingMonth, monthWindow } from './websiteLeads'

/** A disconnected form is not a client destination unless earlier enquiries remain. */
export async function hasClientLeadsDestination(
  clientId: string | null,
  readMetrics: typeof getWebsiteLeadMetrics = getWebsiteLeadMetrics,
  readHistory: typeof listWebsiteLeads = listWebsiteLeads,
): Promise<boolean> {
  const period = monthWindow(currentReportingMonth())
  if (!period) return true // A date/read failure is not proof the service is absent.
  try {
    const metrics = await readMetrics(clientId, period.from, period.to)
    if (metrics.state !== 'ready' || metrics.data.state !== 'not_connected') return true
    const history = await readHistory(clientId ?? undefined, 1)
    return history.state !== 'ready' || history.data.length > 0
  } catch {
    return true
  }
}

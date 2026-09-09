import { classifyError, metaFetch, MetaFactRetryableError, readMetaError, type MetaSyncControl } from './meta.ts'

// Resolve only the explicitly mapped Page. Account discovery is an onboarding
// operation, never a prerequisite for syncing every client-month.
export async function fetchMappedPageToken(
  baseUrl: string,
  userToken: string,
  pageId: string,
  instagramAccountId: string | null,
  control?: MetaSyncControl,
): Promise<string> {
  if (!/^\d+$/.test(pageId) || (instagramAccountId !== null && !/^\d+$/.test(instagramAccountId))) {
    throw new Error('Meta asset mapping contains an invalid provider identity.')
  }
  const url = new URL(`${baseUrl}/${pageId}`)
  url.searchParams.set('fields', 'id,access_token,instagram_business_account')
  const response = await metaFetch(url.toString(), { headers: { Authorization: `Bearer ${userToken}` } }, 8_000, control)
  if (!response.ok) {
    const error = await readMetaError(response, [userToken])
    const detail = `Mapped Page access failed (HTTP ${response.status}, code: ${error.code ?? 'unknown'}): ${error.message}`
    const rateLimited = response.status === 429 || ['4', '17', '32', '341', '613'].includes(error.code ?? '')
    if (rateLimited || classifyError(error) === 'error') throw new MetaFactRetryableError(detail, rateLimited)
    throw new Error(detail)
  }
  const body = await response.json()
  if (body.id !== pageId) throw new Error('Meta returned a different Page identity. Review the asset mapping.')
  if (instagramAccountId && body.instagram_business_account?.id !== instagramAccountId) {
    throw new Error('The mapped Instagram account is not linked to the mapped Facebook Page. Review the asset mapping.')
  }
  if (typeof body.access_token !== 'string' || !body.access_token.trim()) {
    throw new Error('Meta did not grant a Page token for this mapped Page. Reconnect with the required Page access.')
  }
  return body.access_token
}

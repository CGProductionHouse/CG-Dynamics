import { supabase } from '../../lib/supabase'
import type { ClientPortalLibraryState } from './types'

type ApiResult<T> = { data: T | null; error: string | null }

export async function loadClientPortalLibrary(): Promise<ApiResult<ClientPortalLibraryState>> {
  const { data, error } = await supabase.functions.invoke('client-onboarding', {
    body: { action: 'portal_library_load' },
  })
  if (error || !data?.ok) {
    return { data: null, error: 'Your client-safe library is unavailable right now. Please try again.' }
  }
  return { data: data.data as ClientPortalLibraryState, error: null }
}

export async function openClientPortalAsset(
  assetId: string,
  disposition: 'open' | 'download',
): Promise<{ data: Blob | null; filename: string | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { data: null, filename: null, error: 'File access failed.' }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-onboarding`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'portal_library_file', assetId, disposition }),
    })
    if (!response.ok) return { data: null, filename: null, error: 'File access failed.' }
    return {
      data: await response.blob(),
      filename: decodeFilename(response.headers.get('x-client-filename')),
      error: null,
    }
  } catch {
    return { data: null, filename: null, error: 'File access failed.' }
  }
}

function decodeFilename(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

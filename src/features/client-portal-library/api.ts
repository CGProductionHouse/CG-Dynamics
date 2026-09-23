import { supabase } from '../../lib/supabase'
import type {
  ClientPortalAssetAccess,
  ClientPortalAssetPurpose,
  ClientPortalLibraryCategory,
  ClientPortalLibraryFilesPage,
  ClientPortalLibraryState,
} from './types'

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

export async function loadClientPortalLibraryFiles(
  category: ClientPortalLibraryCategory,
  year: number | null,
  month: number | null,
  offset = 0,
): Promise<ApiResult<ClientPortalLibraryFilesPage>> {
  const { data, error } = await supabase.functions.invoke('client-onboarding', {
    body: { action: 'portal_library_month', category, year, month, offset },
  })
  if (error || !data?.ok) return { data: null, error: 'These files are unavailable right now. Please try again.' }
  return { data: data.data as ClientPortalLibraryFilesPage, error: null }
}

export async function getClientPortalAssetAccess(
  assetId: string,
  purpose: ClientPortalAssetPurpose,
): Promise<ApiResult<ClientPortalAssetAccess>> {
  try {
    const { data, error } = await supabase.functions.invoke('client-onboarding', {
      body: { action: 'portal_library_access', assetId, purpose },
    })
    if (error || !data?.ok) return { data: null, error: 'File access failed.' }
    return { data: data.data as ClientPortalAssetAccess, error: null }
  } catch {
    return { data: null, error: 'File access failed.' }
  }
}

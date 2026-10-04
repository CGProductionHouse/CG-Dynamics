import { supabase } from '../../lib/supabase'
import { projectLibraryFiles, projectLibraryState } from './projection'
import type {
  ClientPortalAssetAccess,
  ClientPortalAssetPurpose,
  ClientPortalLibraryCategory,
  ClientPortalLibraryFilesPage,
  ClientPortalLibraryState,
} from './types'

type ApiResult<T> = { data: T | null; error: string | null }

export async function loadClientPortalLibrary(previewClientId?: string): Promise<ApiResult<ClientPortalLibraryState>> {
  try {
    const { data, error } = await supabase.functions.invoke('client-onboarding', {
      body: previewClientId ? { action: 'staff_preview_portal_library_load', clientId: previewClientId } : { action: 'portal_library_load' },
    })
    if (error || data?.ok !== true) {
      return { data: null, error: 'Your client-safe library is unavailable right now. Please try again.' }
    }
    const projected = projectLibraryState(data.data)
    return projected ? { data: projected, error: null } : { data: null, error: 'Your client-safe library is unavailable right now. Please try again.' }
  } catch {
    return { data: null, error: 'Your client-safe library is unavailable right now. Please try again.' }
  }
}

export async function loadClientPortalLibraryFiles(
  category: ClientPortalLibraryCategory,
  year: number | null,
  month: number | null,
  offset = 0,
  previewClientId?: string,
): Promise<ApiResult<ClientPortalLibraryFilesPage>> {
  try {
    const { data, error } = await supabase.functions.invoke('client-onboarding', {
      body: { action: previewClientId ? 'staff_preview_portal_library_month' : 'portal_library_month', ...(previewClientId ? { clientId: previewClientId } : {}), category, year, month, offset },
    })
    if (error || data?.ok !== true) return { data: null, error: 'These files are unavailable right now. Please try again.' }
    const projected = projectLibraryFiles(data.data, category, offset)
    return projected ? { data: projected, error: null } : { data: null, error: 'These files are unavailable right now. Please try again.' }
  } catch {
    return { data: null, error: 'These files are unavailable right now. Please try again.' }
  }
}

export async function getClientPortalAssetAccess(
  assetId: string,
  purpose: ClientPortalAssetPurpose,
  previewClientId?: string,
): Promise<ApiResult<ClientPortalAssetAccess>> {
  try {
    const { data, error } = await supabase.functions.invoke('client-onboarding', {
      body: { action: previewClientId ? 'staff_preview_portal_library_access' : 'portal_library_access', ...(previewClientId ? { clientId: previewClientId } : {}), assetId, purpose },
    })
    if (error || !data?.ok) return { data: null, error: 'File access failed.' }
    return { data: data.data as ClientPortalAssetAccess, error: null }
  } catch {
    return { data: null, error: 'File access failed.' }
  }
}

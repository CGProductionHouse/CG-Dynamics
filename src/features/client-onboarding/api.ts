import { supabase } from '../../lib/supabase'
import type {
  ClientOnboardingState,
  OnboardingPlatform,
  OnboardingSavePatch,
  StaffOnboardingSummary,
  UploadCandidate,
  UploadCategory,
  UploadSession,
  UploadedDriveItemReference,
} from './types'
import { uploadFileToGraphSession } from './upload-session'

type ApiResult<T> = { data: T | null; error: string | null }

async function invoke<T>(body: Record<string, unknown>, token?: string): Promise<ApiResult<T>> {
  const { data, error } = await supabase.functions.invoke('client-onboarding', {
    body,
    headers: token ? { 'x-onboarding-token': token } : undefined,
  })
  if (error) return { data: null, error: 'Welcome to CG is unavailable right now. Please try again.' }
  if (!data?.ok) return { data: null, error: String(data?.error ?? 'This welcome link is no longer available.') }
  return { data: data.data as T, error: null }
}

export function loadPublicOnboarding(token: string) {
  return invoke<ClientOnboardingState>({ action: 'load' }, token)
}

export function savePublicOnboarding(token: string, patch: OnboardingSavePatch) {
  return invoke<ClientOnboardingState>({ action: 'save', patch }, token)
}

export function completePublicOnboarding(token: string) {
  return invoke<ClientOnboardingState>({ action: 'complete' }, token)
}

export function initOnboardingUpload(token: string, category: UploadCategory, file: UploadCandidate) {
  return invoke<UploadSession>({ action: 'upload_init', category, filename: file.name, mimeType: file.type, sizeBytes: file.size }, token)
}

export function completeOnboardingUpload(token: string, uploadId: string, driveItem: UploadedDriveItemReference) {
  return invoke<ClientOnboardingState>({ action: 'upload_complete', uploadId, driveItemId: driveItem.id }, token)
}

export function cancelOnboardingUpload(token: string, uploadId: string) {
  return invoke<null>({ action: 'upload_cancel', uploadId }, token)
}

export function initStaffUpload(sessionId: string, category: UploadCategory, file: UploadCandidate) {
  return invoke<UploadSession>({ action: 'upload_init_staff', sessionId, category, filename: file.name, mimeType: file.type, sizeBytes: file.size })
}

export async function uploadOnboardingFile(
  token: string,
  category: UploadCategory,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ApiResult<ClientOnboardingState>> {
  const initResult = await initOnboardingUpload(token, category, {
    name: file.name,
    type: file.type,
    size: file.size,
  })
  if (initResult.error) return { data: null, error: initResult.error }

  const session = initResult.data!
  onProgress?.(0)
  const uploadResult = await uploadFileToGraphSession(session.uploadUrl, file, onProgress)
  if (uploadResult.error || !uploadResult.item) {
    void cancelOnboardingUpload(token, session.uploadId)
    return { data: null, error: uploadResult.error }
  }

  return completeOnboardingUpload(token, session.uploadId, uploadResult.item)
}

export async function downloadOnboardingFile(uploadId: string): Promise<{ data: Blob | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { data: null, error: 'Download failed.' }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
    const functionUrl = `${supabaseUrl}/functions/v1/client-onboarding`
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'portal_download', uploadId }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      return { data: null, error: String(err?.error ?? 'Download failed.') }
    }
    const blob = await response.blob()
    return { data: blob, error: null }
  } catch {
    return { data: null, error: 'Download failed.' }
  }
}

export function loadPortalSetup() {
  return invoke<ClientOnboardingState>({ action: 'portal_load' })
}

export function listStaffOnboarding() {
  return invoke<StaffOnboardingSummary[]>({ action: 'staff_list' })
}

export function generateOnboardingLink(clientId: string, platforms: OnboardingPlatform[]) {
  return invoke<{ token: string; expiresAt: string }>({ action: 'staff_generate', clientId, platforms })
}

export function updateStaffAccess(sessionId: string, platform: OnboardingPlatform, state: 'verified' | 'failed') {
  return invoke<StaffOnboardingSummary>({ action: 'staff_update_access', sessionId, platform, state })
}

export function revokeOnboardingLink(sessionId: string) {
  return invoke<StaffOnboardingSummary>({ action: 'staff_revoke', sessionId })
}

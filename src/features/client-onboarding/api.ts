import { supabase } from '../../lib/supabase'
import type {
  ClientOnboardingState,
  OnboardingPlatform,
  OnboardingSavePatch,
  StaffOnboardingSummary,
  UploadCandidate,
  UploadCategory,
  UploadSession,
} from './types'

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

export function completeOnboardingUpload(token: string, uploadId: string) {
  return invoke<ClientOnboardingState>({ action: 'upload_complete', uploadId }, token)
}

export function cancelOnboardingUpload(token: string, uploadId: string) {
  return invoke<null>({ action: 'upload_cancel', uploadId }, token)
}

export function initStaffUpload(sessionId: string, category: UploadCategory, file: UploadCandidate) {
  return invoke<UploadSession>({ action: 'upload_init_staff', sessionId, category, filename: file.name, mimeType: file.type, sizeBytes: file.size })
}

export async function uploadFileToSession(uploadUrl: string, file: File): Promise<{ error: string | null }> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) return { error: 'File upload failed. Please try again.' }
    return { error: null }
  } catch {
    return { error: 'File upload failed. Please check your connection and try again.' }
  }
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
  const uploadError = await uploadFileToSession(session.uploadUrl, file)
  if (uploadError.error) {
    void cancelOnboardingUpload(token, session.uploadId)
    return { data: null, error: uploadError.error }
  }
  onProgress?.(100)

  return completeOnboardingUpload(token, session.uploadId)
}

export async function downloadOnboardingFile(uploadId: string): Promise<{ data: Blob | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('client-onboarding', {
    body: { action: 'portal_download', uploadId },
  })
  if (error) return { data: null, error: 'Download failed.' }
  if (!data?.ok) return { data: null, error: String(data?.error ?? 'Download failed.') }
  const blobData = data.data
  if (blobData instanceof Blob) return { data: blobData, error: null }
  if (typeof blobData === 'string') return { data: new Blob([blobData]), error: null }
  return { data: new Blob([JSON.stringify(blobData)]), error: null }
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

import { supabase } from '../../lib/supabase'
import type {
  ClientOnboardingState,
  OnboardingPlatform,
  OnboardingSavePatch,
  StaffOnboardingSummary,
  UploadCandidate,
  UploadCategory,
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

export async function uploadOnboardingFile(
  token: string,
  category: UploadCategory,
  file: UploadCandidate,
): Promise<ApiResult<never>> {
  void token
  void category
  void file
  return {
    data: null,
    error: 'Secure file transfer is not connected yet. Your file was not uploaded.',
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

export const ONBOARDING_PLATFORMS = [
  'facebook',
  'instagram',
  'meta_business',
  'linkedin',
  'tiktok',
  'website',
  'google',
  'outlook',
] as const

export type OnboardingPlatform = typeof ONBOARDING_PLATFORMS[number]
export type ClientAccessChoice = 'connect_now' | 'do_later' | 'not_needed'
export type ConnectionState =
  | 'not_started'
  | 'instructions_opened'
  | 'submitted'
  | 'awaiting_verification'
  | 'verified'
  | 'failed'

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'reopened'
export type UploadCategory = 'logo' | 'services' | 'optional'
export type UploadStatus = 'pending' | 'received' | 'failed'

export interface SafeOnboardingUpload {
  id: string
  category: UploadCategory
  originalFilename: string
  mimeType: string | null
  sizeBytes: number
  uploadStatus: UploadStatus
  uploadedAt: string | null
}

export interface PlatformAccessState {
  platform: OnboardingPlatform
  clientChoice: ClientAccessChoice | null
  connectionState: ConnectionState
  submittedAt: string | null
  verifiedAt: string | null
}

export interface ClientOnboardingState {
  clientName: string
  clientLogoUrl: string | null
  status: OnboardingStatus
  currentStep: number
  startedAt: string | null
  completedAt: string | null
  lastActivityAt: string
  expiresAt: string | null
  vectorUnavailable: boolean
  uploads: SafeOnboardingUpload[]
  typedDescription: string
  serviceItems: string[]
  platformAccess: PlatformAccessState[]
  additionalNotes: string
}

export interface StaffOnboardingSummary extends ClientOnboardingState {
  sessionId: string
  clientId: string
  revokedAt: string | null
}

export interface OnboardingSavePatch {
  currentStep?: number
  vectorUnavailable?: boolean
  typedDescription?: string
  serviceItems?: string[]
  platformAccess?: Array<{
    platform: OnboardingPlatform
    clientChoice: ClientAccessChoice
    clientConfirmed?: boolean
  }>
  additionalNotes?: string
}

export interface UploadCandidate {
  name: string
  type: string
  size: number
}

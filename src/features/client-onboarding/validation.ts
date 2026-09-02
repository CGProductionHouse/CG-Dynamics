import type { ClientOnboardingState, UploadCandidate } from './types'

const ALLOWED_LOGO_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'svg', 'ai', 'eps', 'webp', 'tif', 'tiff', 'psd', 'zip',
])

const ALLOWED_SERVICES_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv',
  'png', 'jpg', 'jpeg', 'zip',
])

const BLOCKED_EXTENSIONS = new Set([
  'app', 'bat', 'cmd', 'com', 'cpl', 'exe', 'hta', 'js', 'jse', 'msi', 'ps1', 'scr', 'vbs', 'wsf',
])

export const MAX_ONBOARDING_FILE_BYTES = 250 * 1024 * 1024

function extensionOf(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim())
  return match?.[1]?.toLowerCase() ?? ''
}

export function validateLogoCandidate(file: UploadCandidate): string | null {
  const extension = extensionOf(file.name)
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) return 'This file type is not safe to upload.'
  if (!ALLOWED_LOGO_EXTENSIONS.has(extension)) return 'Use a PDF, image, design file, or ZIP containing your logo.'
  if (file.size <= 0) return 'This file appears to be empty.'
  if (file.size > MAX_ONBOARDING_FILE_BYTES) return 'This file is larger than 250 MB.'
  return null
}

export function validateServicesCandidate(file: UploadCandidate): string | null {
  const extension = extensionOf(file.name)
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) return 'This file type is not safe to upload.'
  if (!ALLOWED_SERVICES_EXTENSIONS.has(extension)) return 'Use a PDF, document, spreadsheet, image, or ZIP.'
  if (file.size <= 0) return 'This file appears to be empty.'
  if (file.size > MAX_ONBOARDING_FILE_BYTES) return 'This file is larger than 250 MB.'
  return null
}

export function hasReceivedUpload(state: ClientOnboardingState, category: 'logo' | 'services') {
  return state.uploads.some(upload => upload.category === category && upload.uploadStatus === 'received')
}

export function logoRequirementSatisfied(state: ClientOnboardingState) {
  return hasReceivedUpload(state, 'logo')
}

export function servicesRequirementSatisfied(state: ClientOnboardingState) {
  return state.typedDescription.trim().length > 0
    || state.serviceItems.some(item => item.trim().length > 0)
    || hasReceivedUpload(state, 'services')
}

export function coreOnboardingComplete(state: ClientOnboardingState) {
  return logoRequirementSatisfied(state) && servicesRequirementSatisfied(state)
}

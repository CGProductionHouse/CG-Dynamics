// Maps raw Supabase auth errors to friendly, staff-safe messages.
//
// The most common confusing failure is "email rate limit exceeded" (HTTP 429),
// returned when too many confirmation / reset emails are requested in a short
// window — often because the project is using Supabase's built-in email sender
// without custom SMTP configured. We never surface that raw text to users.

export interface AuthErrorLike {
  message?: string
  code?: string
}

export const EMAIL_RATE_LIMIT_MESSAGE =
  'Too many authentication emails were sent recently. Please ask an admin to activate your account or try again later.'

// Shown after sign up specifically, where the account may already exist server
// side even though the confirmation email could not be delivered.
export const SIGNUP_RATE_LIMITED_MESSAGE =
  'Your account may have been created, but the confirmation email could not be sent because the email limit was reached. Ask an admin to help activate or resend later.'

export const ALREADY_REGISTERED_MESSAGE =
  'This email may already be registered. Try signing in, reset your password, or ask an admin to resend confirmation.'

// True when Supabase is telling us the email/request rate limit was hit.
export function isEmailRateLimit(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false
  const code = (error.code ?? '').toLowerCase()
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return true
  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('too many requests')
  )
}

// True when the error indicates the address is already registered.
export function isAlreadyRegistered(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false
  const code = (error.code ?? '').toLowerCase()
  if (code === 'user_already_exists' || code === 'email_exists') return true
  return /already|registered|exists/i.test(error.message ?? '')
}

// A friendly message for any auth error. Rate-limit failures are always
// replaced so the raw Supabase text never reaches staff; other errors keep
// their (already user-readable) message, falling back when absent.
export function friendlyAuthError(
  error: AuthErrorLike | null | undefined,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!error) return fallback
  if (isEmailRateLimit(error)) return EMAIL_RATE_LIMIT_MESSAGE
  if (isAlreadyRegistered(error)) return ALREADY_REGISTERED_MESSAGE
  return error.message?.trim() || fallback
}

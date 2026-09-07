// Email adapter for client onboarding welcome links.
// Currently disabled. Enable by setting CLIENT_ONBOARDING_EMAIL_ENABLED=true
// and providing the required SMTP/API credentials.
//
// This adapter is a fail-closed stub. No email is sent unless explicitly enabled
// with valid credentials. The adapter documents the intended interface but does
// not integrate with any external mail provider until one is approved.

export interface WelcomeEmailParams {
  to: string
  clientName: string
  magicLinkUrl: string
  expiresAt: string
}

export interface EmailResult {
  sent: boolean
  error?: string
}

export function isEmailConfigured(): boolean {
  return Deno.env.get('CLIENT_ONBOARDING_EMAIL_ENABLED') === 'true'
    && Boolean(Deno.env.get('ONBOARDING_SMTP_HOST') || Deno.env.get('ONBOARDING_RESEND_API_KEY'))
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, error: 'Email is not configured. Copy the link manually.' }
  }

  // TODO: Implement when a mail provider is approved.
  void params
  // Options considered: Resend, Postmark, SendGrid, SMTP via Deno.
  // All require CA approval for cost, compliance and deliverability.
  return { sent: false, error: 'Email sending is not yet implemented. Copy the link manually.' }
}

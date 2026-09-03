import type { OnboardingPlatform } from './types'

export interface PlatformGuide {
  label: string
  summary: string
  steps: string[]
  completionLabel?: string
  secureCredentialBoundary?: string
}

export const PLATFORM_GUIDES: Record<OnboardingPlatform, PlatformGuide> = {
  facebook: {
    label: 'Facebook',
    summary: 'Give CG access to your Facebook Page. This is separate from Meta Business access.',
    steps: [
      'Open your Facebook Page settings and find Page access.',
      'Choose to add a person with Facebook access.',
      'Grant the CG contact named in your welcome message full control.',
      'Confirm the invitation using your Facebook password if asked.',
    ],
    completionLabel: "I've done this",
  },
  instagram: {
    label: 'Instagram',
    summary: 'CG will confirm the secure login handoff with you directly.',
    steps: [
      'Have your Instagram username or login email ready.',
      'Use the secure credential handoff CG sends you. Do not add a password to this form.',
      'Let us know here when the secure handoff is complete.',
    ],
    secureCredentialBoundary: 'Instagram passwords are never stored in onboarding, emails, logs, analytics, or browser storage.',
  },
  meta_business: {
    label: 'Meta Business',
    summary: 'Add CG to the Business Portfolio and assign only the assets we manage.',
    steps: [
      'Open Business Settings in Meta Business Suite.',
      'Open Partners and choose Add.',
      'Use the CG business details from your welcome message.',
      'Assign the relevant Page, Instagram account, ad account, and required permissions.',
    ],
    completionLabel: "I've done this",
  },
  linkedin: {
    label: 'LinkedIn',
    summary: 'Add the CG contact as an administrator of your Company Page.',
    steps: [
      'Open your Company Page as a super admin.',
      'Open Settings, then Manage admins.',
      'Add the CG contact named in your welcome message with the requested Page role.',
    ],
    completionLabel: "I've done this",
  },
  tiktok: {
    label: 'TikTok',
    summary: 'Use the access method confirmed by your CG account manager.',
    steps: [
      'Open the TikTok access instructions sent with your welcome message.',
      'Invite or securely hand over access using that method.',
      'Return here and mark the step done so CG can verify it.',
    ],
    completionLabel: "I've done this",
  },
  website: {
    label: 'Website',
    summary: 'Invite CG as a collaborator or use the secure login handoff when an invite is not available.',
    steps: [
      'Open your website user or collaborator settings.',
      'Invite the CG contact named in your welcome message with the agreed role.',
      'If your website has no invitations, ask CG for the secure credential handoff.',
    ],
    completionLabel: "I've done this",
    secureCredentialBoundary: 'Website passwords must use the separate secure credential handoff, never this form.',
  },
  google: {
    label: 'Google',
    summary: 'CG will confirm which Google services need access for your package.',
    steps: [
      'Open the Google service named in your welcome message.',
      'Invite the CG Google account with the requested role.',
      'Repeat only for the listed services: Business Profile, Ads, Analytics, or Search Console.',
    ],
    completionLabel: "I've done this",
  },
  outlook: {
    label: 'Email / Outlook',
    summary: 'Use the CG Outlook Classic setup guide if CG hosts or manages your email.',
    steps: [
      'Open the permanent Outlook Classic IMAP guide supplied by CG.',
      'Use your client-specific mailbox details from the separate secure message.',
      'Complete the send and receive test, then return here.',
    ],
    completionLabel: "I've done this",
    secureCredentialBoundary: 'Mailbox credentials remain client-specific and are never embedded in this universal guide.',
  },
}

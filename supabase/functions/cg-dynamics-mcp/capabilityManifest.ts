// CG shared capability manifest — single source of truth for approved company
// tool/action capabilities. Filtered per staff member by approved_access_scope.
// Do not hardcode per-staff; update this registry centrally.
//
// Two distinct concepts:
//   expectedConnectedInCompanyWorkspace — true for all approved CG company plugins.
//     This is a company-standard fact, not a per-session observation.
//   availableInCurrentSession — determined at runtime by inspecting actual session
//     tools. A company-standard capability may be missing from one session due to
//     session/account/tool-surface issues; that does not make it unavailable in CG.

export interface CgCapability {
  key: string
  label: string
  description: string
  usefulFor: string[]
  exampleActions: string[]
  operatingStandards: string[]
  requiredRole: string[]
  /** Company-standard: true for all approved CG plugins connected in the company workspace. */
  expectedConnectedInCompanyWorkspace: boolean
  /** Fallback guidance when the capability is missing from a specific session. */
  sessionMissingGuidance: string
}

export const CG_CAPABILITY_MANIFEST: readonly CgCapability[] = [
  {
    key: 'cg_dynamics_mcp',
    label: 'CG Dynamics (private MCP)',
    description: 'Direct read/write access to CG Dynamics through this private connector.',
    usefulFor: [
      'Reading your daily priorities, tasks and calendar',
      'Updating task progress, status, notes and blockers',
      'Managing business-development leads and research',
      'Retrieving exact-client intelligence when a task requires it',
      'Maintaining your durable working-style preferences and corrections',
      'Creating and managing recurring task templates',
      'In a client Project: recording that client\'s requests, assigning same-client follow-ups to exact staff and saving client direction',
    ],
    exampleActions: [
      'What am I doing today?',
      'I\'m waiting on the client for the menu.',
      'Move this follow-up to Friday.',
      'Show my leads in the research stage.',
      'Create a weekly Monday content-check task.',
    ],
    operatingStandards: [
      'During Microsoft coexistence, always cross-reference live Planner/Outlook freshness with CG Dynamics; Dynamics-only work remains legitimate.',
      'Never invent ownership, deadlines, status, or a second task list.',
      'Never merge CG Calendar and Client Schedule.',
      'Use exact client IDs; never borrow facts from another client.',
      'All writes are audited and idempotent.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'CG Dynamics is the primary connector. If unavailable, report the connection issue.',
  },
  {
    key: 'microsoft_teams_planner',
    label: 'Microsoft Teams / Planner',
    description: 'Read and manage assigned work in Teams and Planner. Create, assign, update and complete tasks; add notes, progress and follow-ups.',
    usefulFor: [
      'Checking what Teams/Planner has assigned to you',
      'Updating task progress in Planner',
      'Reading team channel context relevant to your work',
    ],
    exampleActions: [
      'What\'s on my Planner today?',
      'Mark the Red Oak content task as done in Planner.',
      'What did the team discuss about the Bloem shoot?',
    ],
    operatingStandards: [
      'Use live Planner assignment truth; never invent a second task list.',
      'Preserve canonical assignee ownership.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'This is a company-standard CG capability. If it is missing from this session, try reconnecting or using the correct CG workspace account. Do not claim CG cannot do this.',
  },
  {
    key: 'outlook_calendar',
    label: 'Outlook / Calendar',
    description: 'Read relevant schedule, meetings and timing/travel context. Perform allowed calendar actions only through approved connector permissions.',
    usefulFor: [
      'Checking your schedule and meeting times',
      'Understanding travel/time context for the day',
      'Reading calendar events that affect your work',
    ],
    exampleActions: [
      'What meetings do I have today?',
      'Do I have anything scheduled with Red Oak this week?',
    ],
    operatingStandards: [
      'CG Calendar is the operational company calendar.',
      'Client Schedule (monthly_deliverables) is separate; never merge them.',
      'Calendar actions remain subject to approved connector permissions.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'This is a company-standard CG capability. If it is missing from this session, try reconnecting or using the correct CG workspace account. Do not claim CG cannot do this.',
  },
  {
    key: 'onedrive_sharepoint',
    label: 'OneDrive / SharePoint',
    description: 'Find, read, organise, rename and move authorised CG/client files and folders according to CG file/folder naming, client mapping and content-system standards.',
    usefulFor: [
      'Finding client files in the correct CG folder structure',
      'Organising raw footage or deliverables to match CG naming conventions',
      'Reading shared documents relevant to your work',
    ],
    exampleActions: [
      'Find the Red Oak folder in OneDrive.',
      'I made a raw-video folder for Client X — help me structure it correctly.',
      'Where are the Bloem deliverables stored?',
    ],
    operatingStandards: [
      'Use exact client mapping before any file mutation.',
      'Follow CG file/folder naming conventions.',
      'No fuzzy client folder matching for destructive/move/rename actions.',
      'Low-risk/reversible actions only unless explicitly authorised.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'This is a company-standard CG capability. If it is missing from this session, try reconnecting or using the correct CG workspace account. Do not claim CG cannot do this.',
  },
  {
    key: 'canva',
    label: 'Canva',
    description: 'Find and use authorised designs and assist with approved design workflows according to client/CG brand rules.',
    usefulFor: [
      'Accessing existing brand templates and designs',
      'Assisting with approved design workflows',
      'Ensuring brand consistency across client work',
    ],
    exampleActions: [
      'Find the Red Oak brand templates in Canva.',
      'Help me create a social post matching the client brand guide.',
    ],
    operatingStandards: [
      'Use exact client brand rules and approved templates.',
      'Never substitute another client\'s brand elements.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'This is a company-standard CG capability. If it is missing from this session, try reconnecting or using the correct CG workspace account. Do not claim CG cannot do this.',
  },
  {
    key: 'adobe',
    label: 'Adobe Creative Suite',
    description: 'Assist with authorised creative, PDF and image workflows while preserving client/CG editing standards.',
    usefulFor: [
      'Assisting with image editing and creative production',
      'Working with PDF documents and exports',
      'Ensuring client creative standards are maintained',
    ],
    exampleActions: [
      'Help me prepare the Bloem images for the content run.',
      'What are the export specs for this client?',
    ],
    operatingStandards: [
      'Preserve client creative standards and editing requirements.',
      'Use approved templates and specifications.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'This is a company-standard CG capability. If it is missing from this session, try reconnecting or using the correct CG workspace account. Do not claim CG cannot do this.',
  },
  {
    key: 'email',
    label: 'Email (draft-only staff assistance)',
    description: 'Compose, research and prepare professional CG email drafts with governed collateral. Staff assistants may NEVER send directly — all drafts require manual staff review, correct CG From identity verification and correct professional signature verification before manual send.',
    usefulFor: [
      'Drafting lead outreach emails with approved CG business profile',
      'Preparing wedding enquiry responses with approved CG Wedding Packages PDF',
      'Researching prior email threads for lead/client context',
      'Preparing professional reply drafts with correct tone and collateral',
    ],
    exampleActions: [
      'Draft an introductory email for this new lead.',
      'Prepare a reply to this wedding enquiry.',
      'Draft a follow-up for the Red Oak lead.',
      'What should I say in this outreach?',
    ],
    operatingStandards: [
      'STAFF EMAIL IS DRAFT-ONLY. Never send email directly, even if the connected Gmail/mail plugin technically supports sending.',
      'Gmail remains the actual draft/thread system. Dynamics stores only staff mail config, collateral references, lead linkage, follow-up state, provenance and audit metadata — never draft content.',
      'After the Gmail plugin creates a draft, explicitly instruct staff to: review content, verify the correct CG From identity, verify the correct professional signature, then send manually.',
      'If sender/signature readiness is incomplete, surface EMAIL SETUP REQUIRED WITH CA and stop at draft review.',
      'Normal staff = owned_threads_only: email only for leads/tasks they own or materially participate in. Not general inbox managers.',
      'Amonique = company_mail_manager: full authorised CG inbox triage, read, reply-draft preparation, but still requires human review + correct From + correct signature + manual send.',
      'Attach governed collateral by Drive asset key — never freeze binary IDs into Project Instructions and never use stale/superseded collateral.',
      'For new lead/outreach drafts, attach current approved CG business profile PDF (collateral/cg-business-profile-latest.pdf) by default unless lead context makes it inappropriate.',
      'For wedding-related enquiries/replies, attach current approved CG wedding packages PDF (collateral/cg-wedding-packages-latest.pdf) by default where relevant.',
      'Relevant outbound/inbound lead-thread activity must update canonical Dynamics lead/activity state so sales progress is shared.',
      'Gmail sender identity is not acceptable for CG outreach — use approved CG company From identity.',
      'Google is deprecating third-party Send-as support (Jan 2027). Use server-side forwarding / proper mailbox connections as the durable direction.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnectedInCompanyWorkspace: true,
    sessionMissingGuidance: 'This is a company-standard CG capability. If the Gmail/mail plugin is missing from this session, try reconnecting or using the correct CG workspace account. Email drafting may also require the mail plugin to be connected. Do not claim CG cannot do email work — but staff must always send manually.',
  },
] as const

export function filterCapabilitiesByScope(approvedScopes: string[]): readonly CgCapability[] {
  if (approvedScopes.length === 0) return CG_CAPABILITY_MANIFEST
  return CG_CAPABILITY_MANIFEST.filter(cap =>
    cap.requiredRole.some(role => approvedScopes.includes(role))
    || approvedScopes.includes(cap.key)
  )
}

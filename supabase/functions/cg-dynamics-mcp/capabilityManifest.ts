// CG shared capability manifest — single source of truth for approved company
// tool/action capabilities. Filtered per staff member by approved_access_scope.
// Do not hardcode per-staff; update this registry centrally.

export interface CgCapability {
  key: string
  label: string
  description: string
  usefulFor: string[]
  exampleActions: string[]
  operatingStandards: string[]
  requiredRole: string[]
  expectedConnected: boolean
  fallbackGuidance: string
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
    ],
    exampleActions: [
      'What am I doing today?',
      'I\'m waiting on the client for the menu.',
      'Move this follow-up to Friday.',
      'Show my leads in the research stage.',
      'Create a weekly Monday content-check task.',
    ],
    operatingStandards: [
      'CG Dynamics is the durable source of truth.',
      'Never invent ownership, deadlines, status, or a second task list.',
      'Never merge CG Calendar and Client Schedule.',
      'Use exact client IDs; never borrow facts from another client.',
      'All writes are audited and idempotent.',
    ],
    requiredRole: ['admin', 'manager', 'staff', 'team'],
    expectedConnected: true,
    fallbackGuidance: 'This is the primary CG Dynamics connector. If it is unavailable, report the connection issue.',
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
    expectedConnected: true,
    fallbackGuidance: 'If Teams/Planner is not connected in this session, report the connection issue. This capability is expected in the CG workspace.',
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
    expectedConnected: true,
    fallbackGuidance: 'If the Outlook/Calendar connector is not available in this session, report the connection issue.',
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
    expectedConnected: true,
    fallbackGuidance: 'If OneDrive/SharePoint is not connected in this session, report the connection issue. File operations should use the CG client mapping.',
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
    expectedConnected: false,
    fallbackGuidance: 'Canva is an approved CG tool but may not be connected in every session. If unavailable, report the connection issue and offer to prepare the design brief.',
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
    expectedConnected: false,
    fallbackGuidance: 'Adobe is an approved CG tool but may not be connected in every session. If unavailable, report the connection issue and offer to prepare creative specifications.',
  },
] as const

export function filterCapabilitiesByScope(approvedScopes: string[]): readonly CgCapability[] {
  if (approvedScopes.length === 0) return CG_CAPABILITY_MANIFEST
  return CG_CAPABILITY_MANIFEST.filter(cap =>
    cap.requiredRole.some(role => approvedScopes.includes(role))
    || approvedScopes.includes(cap.key)
  )
}

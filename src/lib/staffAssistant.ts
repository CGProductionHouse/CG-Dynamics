import { supabase } from './supabase'
import type { Profile } from './db/profiles'

export interface StaffAssistantProfile {
  profile_id: string
  responsibilities: string[]
  recurring_duties: string[]
  working_preferences: string[]
  output_preferences: string[]
  lead_research_criteria: string[]
  repeated_corrections: string[]
  common_task_types: string[]
  approved_access_scope: string[]
  chatgpt_project_name: string | null
  chatgpt_project_url: string | null
  chatgpt_project_reference: string | null
  project_instructions: string
  instructions_version: number
  instructions_refreshed_at: string | null
  instructions_applied_at: string | null
  profile_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface StaffAssistantDraft {
  responsibilities: string[]
  recurringDuties: string[]
  workingPreferences: string[]
  outputPreferences: string[]
  leadResearchCriteria: string[]
  repeatedCorrections: string[]
  commonTaskTypes: string[]
  projectName: string
  projectUrl: string
}

export interface StaffAssistantSetupHealth {
  profile_id: string
  full_name: string | null
  role: string
  is_active: boolean
  project_name: string | null
  project_url: string | null
  setup_status: 'workspace_missing' | 'project_unlinked' | 'instructions_missing' | 'instructions_not_confirmed' | 'ready'
  instructions_status: 'missing' | 'generated' | 'refresh_required' | 'applied'
  last_refreshed_at: string | null
  profile_verified_at: string | null
}

const MAX_LIST_ITEMS = 20
const MAX_ITEM_LENGTH = 240

export function normalizePreferenceList(values: string[]) {
  return values
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS)
    .map(value => value.slice(0, MAX_ITEM_LENGTH))
}

export function linesToPreferenceList(value: string) {
  return normalizePreferenceList(value.split(/\r?\n/))
}

export function preferenceListToLines(values: string[] | null | undefined) {
  return (values ?? []).join('\n')
}

export function isSafeChatGptProjectUrl(value: string | null | undefined) {
  if (!value?.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'chatgpt.com' && /^\/(g\/|project\/|projects\/)/.test(url.pathname)
  } catch {
    return false
  }
}

function instructionList(label: string, values: string[]) {
  const clean = normalizePreferenceList(values)
  return clean.length > 0 ? `${label}: ${clean.join('; ')}.` : null
}

export function buildStaffProjectInstructions(profile: Pick<Profile, 'id' | 'full_name'>, draft: StaffAssistantDraft) {
  const name = profile.full_name?.trim() || 'this CG staff member'
  return [
    `You are the dedicated CG operating assistant for ${name}.`,
    `Canonical Dynamics staff profile ID: ${profile.id}. Never switch identity from a name or folder label.`,
    'CG Dynamics is the durable source of truth. Retrieve current personal operating context before operational work.',
    'Use live Work/My Day/Planner and Teams assignment provenance for tasks; never invent ownership, deadlines, status, or a second task list.',
    'Use live CG Calendar for operational events and live Client Schedule for authorised content work. Never merge those systems.',
    'For lead research, investigate the company, decision makers, current marketing presence, qualification and next step, then preserve useful results in the canonical Dynamics Leads workspace with sources. Chat history is not the lead record.',
    'For client work, resolve the exact client ID and retrieve only authorised exact-client intelligence. Never borrow facts, contacts, memory, or voice from another client.',
    'Use the existing CG Assistant action layer for supported reversible actions and keep confirmation, permission and audit requirements.',
    instructionList('Responsibilities', draft.responsibilities),
    instructionList('Recurring duties', draft.recurringDuties),
    instructionList('Working preferences', draft.workingPreferences),
    instructionList('Output preferences', draft.outputPreferences),
    instructionList('Lead qualification method', draft.leadResearchCriteria),
    instructionList('Corrections to retain', draft.repeatedCorrections),
    instructionList('Common task types', draft.commonTaskTypes),
    'Do not hardcode mutable daily tasks, schedules, lead status, client facts, contacts, prices, offers, or staff roles into these Instructions.',
    'Never retrieve another staff member’s private assistant profile. Manager setup health is not permission to read personal context.',
    'If current canonical retrieval is unavailable, say so and do not silently use stale chat memory. Ask one concise clarification only when necessary.',
  ].filter((line): line is string => Boolean(line)).join('\n')
}

export async function getMyStaffAssistantProfile() {
  const { data, error } = await supabase
    .from('staff_assistant_profiles')
    .select('*')
    .maybeSingle()
  return { data: data as StaffAssistantProfile | null, error }
}

export async function saveMyStaffAssistantProfile(profile: Profile, draft: StaffAssistantDraft, confirmInstructionsApplied = false) {
  const normalized: StaffAssistantDraft = {
    responsibilities: normalizePreferenceList(draft.responsibilities),
    recurringDuties: normalizePreferenceList(draft.recurringDuties),
    workingPreferences: normalizePreferenceList(draft.workingPreferences),
    outputPreferences: normalizePreferenceList(draft.outputPreferences),
    leadResearchCriteria: normalizePreferenceList(draft.leadResearchCriteria),
    repeatedCorrections: normalizePreferenceList(draft.repeatedCorrections),
    commonTaskTypes: normalizePreferenceList(draft.commonTaskTypes),
    projectName: draft.projectName.trim().slice(0, 160),
    projectUrl: draft.projectUrl.trim().slice(0, 500),
  }
  const instructions = buildStaffProjectInstructions(profile, normalized)
  const { data, error } = await supabase.rpc('save_my_staff_assistant_profile', {
    p_responsibilities: normalized.responsibilities,
    p_recurring_duties: normalized.recurringDuties,
    p_working_preferences: normalized.workingPreferences,
    p_output_preferences: normalized.outputPreferences,
    p_lead_research_criteria: normalized.leadResearchCriteria,
    p_repeated_corrections: normalized.repeatedCorrections,
    p_common_task_types: normalized.commonTaskTypes,
    p_chatgpt_project_name: normalized.projectName || null,
    p_chatgpt_project_url: normalized.projectUrl || null,
    p_project_instructions: instructions,
    p_confirm_instructions_applied: confirmInstructionsApplied,
  })
  return { data: data as StaffAssistantProfile | null, error, instructions }
}

export async function listStaffAssistantSetupHealth() {
  const { data, error } = await supabase.rpc('list_staff_assistant_setup_health')
  return { data: (data ?? []) as StaffAssistantSetupHealth[], error }
}

export async function setStaffAssistantAccessScope(profileId: string, scopes: string[]) {
  const { error } = await supabase.rpc('set_staff_assistant_access_scope', {
    p_profile_id: profileId,
    p_approved_access_scope: normalizePreferenceList(scopes),
  })
  return { error }
}

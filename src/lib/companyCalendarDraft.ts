import type { CompanyCalendarEvent, CompanyEventPatch } from './companyCalendar'

// Minute-resolution inputs must never rewrite unchanged source timestamps.
export function changedCompanyEventFields(
  original: CompanyCalendarEvent,
  draft: CompanyEventPatch,
  changed: Partial<Record<keyof CompanyEventPatch, boolean>>,
): CompanyEventPatch {
  const patch: CompanyEventPatch = {}
  for (const key of Object.keys(draft) as Array<keyof CompanyEventPatch>) {
    if (changed[key] !== true) continue
    if (draft[key] !== original[key]) Object.assign(patch, { [key]: draft[key] })
  }
  return patch
}

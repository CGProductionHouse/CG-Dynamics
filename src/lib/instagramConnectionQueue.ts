export interface InstagramFleetEvidence {
  clientName: string
  verifiedHandle: string | null
  evidence: 'verified_official' | 'no_verified_account'
  reviewNote: string
}

export const INSTAGRAM_FLEET_EVIDENCE: readonly InstagramFleetEvidence[] = [
  { clientName: 'Bloem Action Sports', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Reviewed evidence does not resolve an exact owner-controlled Instagram handle; do not infer one from the client name.' },
  { clientName: 'Bohemia Quick Stop', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Resolve the Quick Stop / Quick Shop identity before binding any account.' },
  { clientName: 'Bouwer & Coetzee', verifiedHandle: 'bouwer_coetzee_attorneys', evidence: 'verified_official', reviewNote: 'Official handle is supported by reviewed client intelligence.' },
  { clientName: 'Central Canvas', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact owner-controlled account with the client.' },
  { clientName: 'Daisy & Co', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Same-name businesses exist; client confirmation is required.' },
  { clientName: 'Ehrlich Park Butchery', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm whether an official Instagram account exists.' },
  { clientName: 'Emmanuel Funerals', verifiedHandle: 'emmanuelfunerals', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'Emoya Estate Driving Range', verifiedHandle: 'emoyadrivingrange', evidence: 'verified_official', reviewNote: 'Exact handle is supported by current reviewed client evidence.' },
  { clientName: 'Forklift Trucks', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Reviewed evidence does not resolve an exact owner-controlled Instagram handle; do not infer one from the client name.' },
  { clientName: 'Hino Trucks', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Reviewed evidence does not resolve the exact local owner-controlled account; do not substitute another Hino account.' },
  { clientName: 'HMHI', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact client identity and official handle.' },
  { clientName: 'Human Auto', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Reviewed evidence does not resolve the exact dealer account; do not infer one from the client name.' },
  { clientName: 'Jenkor', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Reviewed evidence does not resolve an exact owner-controlled Instagram handle; do not infer one from name variants.' },
  { clientName: 'Neshora Oxygen', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'No exact owner-controlled Instagram identity has been reviewed; do not guess a handle.' },
  { clientName: 'Novus Steel', verifiedHandle: 'novus_steel', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'Piek Group', verifiedHandle: 'piekgroup', evidence: 'verified_official', reviewNote: 'Use the reviewed Piek Group account only.' },
  { clientName: 'PSG Bloemfontein', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm branch versus national reporting scope before binding.' },
  { clientName: 'Red Oak', verifiedHandle: 'official.redoak', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'Supa Quick BFN', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact Bloemfontein franchise and account.' },
  { clientName: 'Supa Quick Centurion', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact Centurion store and account.' },
  { clientName: 'The Staffordshire', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Historical handle is not current verified identity.' },
  { clientName: 'Tobich Optics', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact practice/location and owner-controlled account.' },
  { clientName: 'Toyota Bloemfontein', verifiedHandle: 'cfaomobilitytoyotabloemfontein', evidence: 'verified_official', reviewNote: 'Exact handle is supported by current reviewed client evidence.' },
  { clientName: 'We Ar Fuels', verifiedHandle: 'we_ar_fuels', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'WiseRide', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Reviewed evidence does not resolve an exact owner-controlled Instagram handle; do not infer one from shared-content relationships.' },
] as const

function normalized(value: string): string {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
}

const aliases = new Map<string, string>([
  [normalized('Bohemia Quick Shop'), normalized('Bohemia Quick Stop')],
  [normalized('Bouwer & Coetzee Attorneys'), normalized('Bouwer & Coetzee')],
])

export function instagramFleetEvidenceFor(clientName: string): InstagramFleetEvidence | null {
  const key = aliases.get(normalized(clientName)) ?? normalized(clientName)
  return INSTAGRAM_FLEET_EVIDENCE.find(item => normalized(item.clientName) === key) ?? null
}

export function exactHandleMatches(expectedHandle: string | null, providerHandle: string): boolean {
  return expectedHandle !== null && expectedHandle.toLowerCase() === providerHandle.toLowerCase()
}

export interface InstagramPageRouteInput {
  facebookPageId: string | null
  providerAssetsLoaded: boolean
  providerPagesAvailable: boolean
  providerPages: readonly { id: string; instagramAccount: { id: string } | null }[]
}

/** A successful discovery response does not prove a missing saved Page was checked. */
export function instagramPageRouteEvidence(input: InstagramPageRouteInput) {
  const page = input.facebookPageId
    ? input.providerPages.find(item => item.id === input.facebookPageId)
    : null
  if (!input.providerAssetsLoaded) {
    return { state: 'not_checked', canStartStandalone: false, text: 'The Page-linked route has not been checked yet. Load Page-linked assets before choosing standalone OAuth.' } as const
  }
  if (!input.providerPagesAvailable) {
    return { state: 'unavailable', canStartStandalone: false, text: 'Page-linked discovery is unavailable. Resolve provider access before choosing standalone OAuth; missing evidence is not proof of no linked account.' } as const
  }
  if (!input.facebookPageId) {
    return { state: 'no_saved_page', canStartStandalone: true, text: 'No saved Facebook Page route is available for this client. This does not prove the professional account is unlinked; exact owner evidence is still required.' } as const
  }
  if (!page) {
    return { state: 'saved_page_not_returned', canStartStandalone: false, text: 'The saved Facebook Page was not returned by discovery. Page access or inventory coverage is unresolved; do not start standalone OAuth.' } as const
  }
  if (page.instagramAccount?.id) {
    return { state: 'page_linked_available', canStartStandalone: false, text: 'An exact Instagram account is available through this client’s saved Facebook Page; use the Page-linked workflow.' } as const
  }
  return { state: 'no_account_observed', canStartStandalone: true, text: 'The exact saved Facebook Page was returned without an Instagram account in this observation. This is not global unlinking or professional-type proof; exact owner evidence is still required.' } as const
}

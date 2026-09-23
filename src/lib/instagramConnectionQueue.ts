export interface InstagramFleetEvidence {
  clientName: string
  verifiedHandle: string | null
  evidence: 'verified_official' | 'no_verified_account'
  reviewNote: string
}

export const INSTAGRAM_FLEET_EVIDENCE: readonly InstagramFleetEvidence[] = [
  { clientName: 'Bohemia Quick Stop', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Resolve the Quick Stop / Quick Shop identity before binding any account.' },
  { clientName: 'Bouwer & Coetzee', verifiedHandle: 'bouwer_coetzee_attorneys', evidence: 'verified_official', reviewNote: 'Official handle is supported by reviewed client intelligence.' },
  { clientName: 'Central Canvas', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact owner-controlled account with the client.' },
  { clientName: 'Daisy & Co', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Same-name businesses exist; client confirmation is required.' },
  { clientName: 'Ehrlich Park Butchery', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm whether an official Instagram account exists.' },
  { clientName: 'Emmanuel Funerals', verifiedHandle: 'emmanuelfunerals', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'First Technology Central', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Do not substitute a national account for the Central branch.' },
  { clientName: 'HMHI', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact client identity and official handle.' },
  { clientName: 'Novus Steel', verifiedHandle: 'novus_steel', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'Piek Group', verifiedHandle: 'piekgroup', evidence: 'verified_official', reviewNote: 'Use the reviewed Piek Group account only.' },
  { clientName: 'PSG Bloemfontein', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm branch versus national reporting scope before binding.' },
  { clientName: 'Red Oak', verifiedHandle: 'official.redoak', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
  { clientName: 'Supa Quick BFN', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact Bloemfontein franchise and account.' },
  { clientName: 'Supa Quick Centurion', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact Centurion store and account.' },
  { clientName: 'The Staffordshire', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Historical handle is not current verified identity.' },
  { clientName: 'Tobich Optics', verifiedHandle: null, evidence: 'no_verified_account', reviewNote: 'Confirm the exact practice/location and owner-controlled account.' },
  { clientName: 'We Ar Fuels', verifiedHandle: 'we_ar_fuels', evidence: 'verified_official', reviewNote: 'Official handle is linked from the current first-party website.' },
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

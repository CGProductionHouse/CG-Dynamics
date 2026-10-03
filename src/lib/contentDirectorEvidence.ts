/** Stored guidance provenance, resolved by the server, never certified by a model. */
export interface DirectorKnowledgeReference {
  card_id: string
  title: string
  source_id: string
  source_reference: string
  confidence_level: string | null
  evidence_label: string | null
  safe_claim: string | null
  prohibited_overclaim: string | null
  updated_at: string | null
}

export function directorKnowledgeReceipt(reference: DirectorKnowledgeReference): string {
  return [
    `CG guidance: ${reference.title} [card ${reference.card_id}]`,
    `Source: ${reference.source_reference} [source ${reference.source_id}]`,
    `Evidence: ${reference.evidence_label ?? 'not recorded'}; confidence: ${reference.confidence_level ?? 'not recorded'}`,
    reference.safe_claim ? `Safe claim: ${reference.safe_claim}` : '',
    reference.prohibited_overclaim ? `Do not claim: ${reference.prohibited_overclaim}` : '',
    reference.updated_at ? `Card observed revision: ${reference.updated_at}` : '',
  ].filter(Boolean).join('\n')
}

/** DB-owned material-content fingerprints. An observed revision alone is never approval. */
export function isSkillCardContentApproved(contentHash: unknown, reviewedContentHash: unknown): boolean {
  return typeof contentHash === 'string' && /^[a-f0-9]{64}$/.test(contentHash)
    && typeof reviewedContentHash === 'string' && reviewedContentHash === contentHash
}

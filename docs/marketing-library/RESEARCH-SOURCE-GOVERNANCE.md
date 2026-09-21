# Research Source Governance Contract (#448)

Read-only governance layer over the existing Marketing Library source registry. No second Library, no write path, no activation.

## Source identity authority

- Stable identifier = canonical URL, else `repo:<path>#<slug>` (cited sources) or `repo:<path>` (containers).
- Never a guessed database ID.
- Dedupe is by exact `sourceIdentifier` — never fuzzy title matching.

## Seed vs research-preview distinction

- **Seed-backed**: sources in `REGISTRATION_MANIFEST` (phase-28a seed).
- **Research-preview-only**: sources from #426 audience-lifecycle, #441 commerce-evidence, #444 competitive-creative bridges that are NOT in the seed.
- Research-preview-only items are NOT registered, NOT activated, NOT in phase-28a.

## Registration state vs review state

- **Registration state**: whether a source exists in the live Marketing Library (exact `source_identifier` match).
- **Review state**: governance freshness — when does this source need human re-review?
- These are independent. A source can be registered but overdue, or unregistered but current.

## Access coverage vs freshness

- **Access coverage** (`accessCoverage`): what level of the source was actually accessed (full_read, abstract_only, interface_shell_only, etc.). Preserved exactly from the source ledger; never upgraded.
- **Freshness** (`FreshnessState`): when does this source need re-review? Derived from `reviewDue` metadata.
- These are independent. A source can have full_read access but be overdue for re-review.

## Publication date vs accessed date vs review due

- `pageDate` / `publicationDate`: when the source was published. Exact ledger value; never inferred from file modification time.
- `accessedAt`: when the source was last accessed/verified. Exact ledger value; never fabricated.
- `reviewDue`: when the source should be re-reviewed. Exact ledger value; missing = unscheduled.

## Freshness states

| State | Meaning |
|---|---|
| `overdue` | `reviewDue` < today |
| `due_today` | `reviewDue` === today |
| `due_soon` | `reviewDue` within configurable window (default 30 days) |
| `current` | `reviewDue` beyond due-soon window |
| `unscheduled` | No `reviewDue` supplied |
| `needs_reverify` | Source metadata explicitly says so, or access state warrants it |

Freshness is **governance state**, not automatic truth activation/deactivation.

## Conflict behavior

- Same `sourceIdentifier` from multiple origins → check for material metadata conflicts.
- Conflicting fields: `sourceType`, `canonicalUrl`, `title`, `author`, `rightsNote`, `accessCoverage`, `reviewContext.*`.
- Optional fields that are null/absent on one side do NOT conflict — richer value survives.
- Conflicts are surfaced with exact `ConflictVariant` objects per origin for human review.
- Never auto-resolve. Never prefer seed simply because it is seed. Never prefer newer.

## Human-review boundary

- All governance data is read-only admin display.
- No Apply, Register, Activate, Resolve, Approve, or Merge controls.
- Conflict review shows exact variants by origin with conflicting fields visible.
- Resolution is a human editorial decision, not a code path.

## No auto-activation

- Freshness state does not activate/deactivate cards.
- Freshness state does not change Assistant retrieval.
- Registration state does not imply trust or activation.
- All sources remain `needs_review` / `metadata_reference` only.

## No provider/write behavior

- No live Meta/Google/TikTok API calls.
- No scraping, no competitor media ingestion.
- No production DB mutations.
- No schema/migration changes in this governance layer.
- phase-28a SQL remains byte-for-byte unchanged.

## Files

| File | Purpose |
|---|---|
| `sourceRegistry.ts` | Seed manifest, `RegistrationCandidate` type, `classifyRegistrations()` |
| `sourceFreshness.ts` | Pure freshness classifier with injected `today` |
| `unifiedResearchPreview.ts` | Derived preview with governance queues, conflict variants |
| `audienceLifecycleBridge.ts` | #426 bridge with governance metadata |
| `commerceEvidenceBridge.ts` | #441 bridge with governance metadata |
| `competitiveCreativeBridge.ts` | #444 bridge with governance metadata |
| `MarketingWorkspacePage.tsx` | Admin governance UI (Registration section) |

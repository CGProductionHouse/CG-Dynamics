# #426 implementation contract and acceptance plan

Version 2026-09-19.1. Extends the existing Marketing Library, not a new application. This document is a proposed implementation contract, not evidence that the named future integrations are live.

## Delivered checkpoint

The README is the master decision framework. The source ledger stores official references and explicitly blocked verification leads. Reference code validates bounded brief/evidence conditions and calculates synthetic order contribution without network access or side effects. An offline HTML reader is generated from the same files; it is not an authenticated Dynamics screen.

Only `docs/marketing-library/audience-lifecycle/` is changed. No production code, schema, client records, providers, OneDrive folders, permissions or launch routes are changed. No worker has been dispatched. The Control Centre read returned 403, so application implementation requires ownership reconciliation before it begins. The base commit is `ba53baf9f224684171c686d674725d7b1efcd795`; later work must refresh main and #381.

## 1. Authority map

| Concern | Reuse | Extension, not replacement |
|---|---|---|
| Research metadata | `marketing_library_sources`, `sourceRegistry.ts`, cited-source generator | Add distinct primary references with provenance and stable identifiers. |
| Reusable guidance | Existing skill-card model and review lifecycle | Add reviewed stage/intent/creative/measurement cards. |
| Exact-client grounding | Current `get_client_context` and #241 boundaries | Retrieve only applicable current facts and reviewed client learnings. |
| Marketing UI | `MarketingWorkspacePage.tsx` existing sections | Show guidance and relevance within current Library / AI surfaces. |
| Monthly game plan | #391 canonical exact-client/month strategy | Add structured audience rationale to the existing strategy payload after schema inspection. |
| Planned deliverables | `monthly_deliverables` | Reference exact existing IDs; never create a duplicate schedule. |
| Shoot and brief | Existing Content Guideline / Content Run | Attach strategy rationale and proof requirements to canonical items. |
| Approved media | Existing immutable content-review versions | Preserve the approved asset/version used by each campaign or observation. |
| Performance | Existing provider contracts | Keep provider scope, timezone, currency, attribution and missing states. |
| Enquiry quality | #405 canonical transaction and downstream outcome evidence | Join enquiry/qualification/won evidence only where authorised and available. |
| Private evidence | Existing private Dynamics and client storage authorities | Keep access-controlled pointers rather than copying private content into Git. |

Do not claim the exact future field/table names below already exist. Inspect the current schema and API adapters before any migration. No new learning table should be created before checking the existing internal-learning mechanisms.

## 2. Proposed bounded brief payload

Reference input shape, not a production schema:

```json
{
  "clientId": "server-resolved exact client",
  "month": "2026-10",
  "channel": "organic",
  "platform": "meta",
  "objective": "qualified_enquiry",
  "audience": {
    "relationship": "warm",
    "intent": "consideration",
    "basis": "research_inference",
    "lifecycle": "lead",
    "deliveryMode": "organic_mixed",
    "evidenceRefs": []
  },
  "message": "Answer the actual decision obstacle",
  "proofPlan": "Capture the real process or product evidence",
  "cta": "The approved next action",
  "landingExperience": "The matching approved destination",
  "outcome": "A defined business outcome, not a proxy",
  "measurement": "Data source, window, limitation and owner",
  "deliverableIds": [],
  "claims": []
}
```

`clientId`, `month`, permissions, source status and canonical deliverable inventory must be resolved on the server from the authorised request. Do not trust a browser or AI to supply its own approval or identity. The reference validator does not authenticate, authorise, verify evidence content or replace RLS.

Additional production fields, subject to schema review: strategy ID/version; client objective source; obstacle; current offer approval and expiry; immutable creative version; shot-list requirements; asset rights; provider capability snapshot reference; reviewer and approval; hypothesis; experiment ID; outcome contract; previous learning IDs; exact source/card IDs; model and prompt version; input-context hash; creation actor; status transitions. Save references, not customer-level personal data, in the creative brief.

`cold` is a planning label. Preserve unknown exposure. `strict` records intended provider selection, not proof that every recipient belongs to a clean CRM cohort. Actual measured composition is a separate field and may be unavailable.

## 3. Review-candidate import, not silent activation

1. Read existing live sources and current generated manifest through an authorised route.
2. Reconcile each ledger URL with the existing canonical identifier. Use established canonicalisation, not fuzzy title matching or guessed database IDs. Account for legitimate aliases before creating a duplicate.
3. Register eligible full-read references as metadata only, preserving publisher, URL, page date, access date, rights and provenance. Blocked URLs remain discovery leads, not verified product evidence.
4. Keep source trust and candidate cards at `needs_review`. Retrieval date is not approval. Do not mark an AI synthesis as a primary source.
5. Compare candidate concepts with existing cards and synonyms. Enrich or version the existing concept when equivalent rather than inserting another copy.
6. Review factual claim, applicability, limitations and source freshness. Record human reviewer, date and accepted scope.
7. Activate only reviewed guidance through the current approval path. Verify staff retrieval returns active shared cards, exact-client retrieval adds only that client's eligible cards and stale/deprecated guidance disappears.
8. Prove idempotency: a second dry run reports no duplicate references or cards. Return actual record IDs and a read-back receipt before describing ingestion as complete.

`sources.json` is a portable preparation format. It is not directly insertable into the database and deliberately has no fake UUIDs. `candidateKey` values are local keys, never production row IDs. The known existing `SourceType`, `KnowledgeLayer`, `SkillCardStatus`, `ConfidenceLevel` and `EvidenceLabel` vocabularies are reused, while a reviewed adapter must map the remaining fields to actual current models.

The current generator reads research packs under `docs/ai-workforce`. This new folder is NOT automatically included. Extend the existing extractor/registration path with tests, or use its existing approved metadata path; do not hand-patch generated TypeScript or execute generated production SQL.

## 4. Staff workflow: two videos next month

Resolve exact client and month. Read that client's current guide, approved strategy, recent canonical deliverables, available performance and reviewed Library knowledge. Declare missing audience or outcome evidence rather than silently substitute another client's data.

Propose two different concepts with one business job each. For each, state relationship/intent, evidence basis, question or obstacle, message/proof, exact required shots, CTA, destination and measurable result. Check recent concepts to avoid repeating the same creative under different wording. Preserve the client's language and banned phrases.

Present a draft for staff review. Saving uses the existing Content Guideline and canonical deliverable linkage, not a standalone text blob or second schedule. Changes to approved creative invalidate dependent approval as the existing contract requires; do not silently keep an old approval on a new message. Client-facing strategy should display the approved rationale, not internal confidence scores, source-control URLs or other clients' observations.

Human review is not a ceremonial button: reviewers check claims, offer currency, creative distinctiveness, real shoot feasibility, audience eligibility, privacy, budget and measurement. Research should make the brief more useful without making a quick caption request require an entire planning ritual.

## 5. Implementation missions and gates

### A. Reference foundation — this checkpoint

Deliver research/game plan, sources, bounded validation code, tests and offline reader in an isolated draft PR. No runtime imports. Acceptance: files are retrievable, code executes locally, tests exercise behaviour, private data scan passes and the final report distinguishes reference work from production activation.

### B. Library readiness and review integration — first product step

Dependencies: reconcile #381/Control Centre; inspect current schema; establish exact implementation owner; inspect live approved-card coverage.

Implement dry-run source reconciliation and card deduplication using existing models. Add clear states: discovered, reference registered, card needs review, reviewed/active, stale. These may be UI projections of existing states rather than new database enums. Include citations and limitations in staff detail views.

Acceptance: repeated preview is idempotent; source/container counts remain separate; blocked sources never become authoritative; staff cannot read unapproved/private cards; an authorised reviewer can approve one card and retrieve its exact approved version. Any production import requires its own authorised write/read-back receipt.

### C. Audience-aware Content Guidelines — practical creative value

Dependencies: B, approved context rules, existing production workflow owner.

Add a compact optional strategy panel to the existing brief flow: objective, audience label + intent, obstacle, proof, CTA, outcome and rationale. Keep captions fast; only request missing information that materially changes the brief. Persist against the existing guideline/deliverable and immutable version rules.

Acceptance: exact client/month binds every reference; selected approved cards and evidence are recoverable; stale offer text is blocked; the original schedule count does not change; a second save is idempotent; approved creative cannot be altered without a new review version. Test useful actual examples with staff rather than only string snapshots.

### D. Monthly Plan explanation — client-visible value

Dependencies: C and current canonical monthly-strategy read/write/publish contracts.

Display who, why, creative, destination, outcome, previous learning and next decision within the existing monthly Strategy/Plan view. Separate planned focus from measured delivered audience. An organic-only plan must work without ad accounts. Preserve selected month, draft/published state, previous published versions and server-derived client identity.

Acceptance: staff drafts are invisible to the client until published; correct month on mobile and desktop; no sibling-client leakage; honest missing-data states; no new calendar; no research-source approval automatically publishes a plan. Require authenticated visual acceptance before merge/deploy.

### E. Outcome and learning integration — trustworthy reporting

Dependencies: accepted provider reporting and #405 outcome authority where applicable.

Attach stable creative/deliverable references to observations, preserve attribution settings, and retain provider values unchanged. Display measured business outcomes separately. Store a draft learning with comparison, uncertainty, scope, limitation and reviewer. Suppress generic winner claims when data is insufficient.

Acceptance: no summing multi-platform attributed revenue into business sales; unavailable stays null; purchases adjusted for known refunds in the business view without rewriting provider history; a CTA never auto-becomes a qualified lead; repeated provider events do not duplicate outcomes; a client observation is not silently promoted to shared doctrine.

### F. Three controlled pilots — evidence before scaling

Choose one eligible restaurant/local-experience client, one physical retailer and one service business, subject to exact identity, consent, staff capacity and client approval. Ecommerce can use a synthetic/prelaunch plan until a real eligible shop exists.

For each pilot agree one outcome, one decision obstacle, one principal creative comparison, the measurement window, expected minimum practical effect, cost/quality guardrails and an owner for outcome feedback. Select an appropriate design for available volume; do not invent universal sample targets. A paid test additionally needs explicit budget and campaign approval. Record no-spend organic experiments as such.

Acceptance: the client can explain the plan; staff can shoot the specified proof; outcomes are collected within known coverage; the review produces continue/change/stop or insufficient-evidence, with reasons. Roll out based on evidence and operational feasibility, not a promised universal uplift.

### G. Provider execution — separately approved, not implied

Complete current account-specific Meta, Google and TikTok documentation, regional eligibility, credentials, roles, consent, measurement, budgets, assets and destination acceptance. Reuse existing integrations. Campaign creation, spending, publishing and production provider changes remain explicit actions with approvals, idempotency, receipts and reversible controls.

### H. Industry depth and ongoing stewardship

Turn successful pilot lessons into scoped cards after review, then revisit the 18 existing industry packs. Each industry release should include customer jobs, constraints, source register, decision-stage creative examples, economics, measurement, prohibited claims and a test plan. Appoint a human knowledge reviewer and define source recheck triggers.

A proposed initial freshness policy is 30 days for mutable platform guidance, plus verification before launch; 180 days for stable methodological guidance; task-time checks for offers, price, stock and events. These are CG governance proposals, not provider rules. Record a checked date and valid-until date explicitly; missing dates do not mean evergreen.

## 6. Minimum release acceptance matrix

The reference tests cover only bounded editorial/evidence conditions. Production acceptance must additionally cover real RLS and role permissions; exact-client month retrieval; approved-only source/card versions; immutable creative approvals; duplicate import and save retries; concurrent edits; stale source/offer rejection; suppression and permitted-use verification; unsupported provider capabilities; organic mixed delivery; missing metrics; publisher/creator rights; local-device rendering; safe rollback; and real read-back evidence after an authorised write.

No `planningComplete` result authorises execution. `executionAllowed` and `publicationAllowed` are always false in the reference module. A production adapter must use existing server-side capabilities and approvals, not flip these flags because a draft passed editorial checks.

## 7. How to reproduce the local artefacts

From this folder with Node.js available:

```sh
node --test reference.test.mjs
python3 build_hub.py
```

The builder uses the Python standard library and local Node test runner, reads only this folder, and emits `CG_Marketing_Intelligence_Hub.html`. It contains generic scenarios, sources and implementation status, no client records. Do not deploy it as a production client portal.

A review/merge decision is separate from this checkpoint. The application build was not executed here because no application code was changed and the full checkout was unavailable. Local reference tests do not substitute for app tests, production integration acceptance or visual approval of actual Dynamics screens.

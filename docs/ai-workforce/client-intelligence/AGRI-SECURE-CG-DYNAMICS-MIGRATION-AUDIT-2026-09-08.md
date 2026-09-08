# Agri-Secure CG Dynamics Migration Audit — 2026-09-08

## Scope

This audit records the client-specific migration performed for CG Dynamics Issue #263. It is intentionally limited to Agri-Secure client intelligence and migration state. It does not modify or redefine the shared client-memory runtime coordinated under Issue #241, and it does not import facts, preferences, contacts, workflows, or creative rules from unrelated clients.

## Authority reviewed

The migration reconciled the following available sources before writing new client state:

1. CG Dynamics Issue #263, including its branch, isolation, migration, provenance, freshness, and completion requirements.
2. Repository-wide `AGENTS.md` instructions.
3. Issue #241 coordination truth only to understand the existing shared-memory architecture and isolation boundary. No #241 runtime files were changed.
4. Issue #248 guidance for compact ChatGPT Project Instructions and Dynamics-first retrieval behavior.
5. `docs/ai-workforce/CLIENT-MEMORY-FRESHNESS-AND-VERIFICATION-PROTOCOL.md` for mutable-fact freshness, conflict handling, PII, and fail-closed rules.
6. `docs/ai-workforce/client-intelligence/AGRI-SECURE-FARM-ARMED-RESPONSE-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`, the existing Agri-Secure human-marketing research pack dated 2026-08-24.
7. Current repository search/tree truth for Agri-Secure-related material.
8. Accessible uploaded/File Library search for an Agri-Secure Project Source or other client-specific source file. No Agri-Secure Project Source file was located at migration time.
9. Accessible prior-context retrieval for Agri-Secure-specific persistent rules. No separate Agri-Secure-specific stable rule set was recovered; unrelated security-client context was explicitly excluded.

## Reconciliation result

### Existing research is retained, not duplicated

The August 2026 Agri-Secure intelligence pack is the authoritative human-marketing/cultural intelligence layer for this migration. This audit and the companion client guide point to it instead of re-performing or copying its research in full.

A legacy repository reference that characterized Agri-Secure as still needing research is older and less specific than the completed 2026-08-24 client intelligence pack. For this migration, the later client-specific pack wins on research maturity. The legacy reference is not rewritten from this client branch because doing so would cross the requested client-only scope.

### Stable identity and positioning retained

The following are supported by the existing client-specific intelligence pack and may be used as stable client context unless newer client evidence supersedes them:

- Client name: Agri-Secure.
- Market context: South African farms, smallholdings, and rural agricultural businesses.
- Marketing category: farm/rural security, armed-response-adjacent and agricultural protection messaging.
- Preferred strategic framing: layered rural risk management, controlled readiness, practical protection, operational competence, and site-specific assessment rather than fear theatre or one-size-fits-all promises.

The category wording above is marketing/sector context. It does **not** by itself verify that Agri-Secure directly supplies every security capability commonly associated with that category.

## Memory classification

### 1. Stable client identity / brand layer

Store or retrieve as durable client context:

- Agri-Secure name and rural/agricultural security market orientation.
- Calm, direct, practical, rural-aware, competent, restrained messaging.
- Avoid fear-heavy crime theatre, militaristic supremacy language, urban-home-security assumptions, and unsupported absolutes.
- Prefer real rural operating context: distance, access points, perimeter scale, family/workforce safety, farm assets, livestock, fuel, vehicles, equipment, night exposure, and isolation where relevant to the task.
- Human dignity and practical risk framing take priority over sensational farm-attack rhetoric or political identity framing.

### 2. Persistent preferences layer

No separate user-confirmed Agri-Secure footer convention, fixed contact block, mandatory social hashtag set, mandatory bilingual split, or named CTA rule was recovered from the audited sources.

Therefore:

- Do not invent a fixed footer or contact format.
- Do not inherit formatting or contact conventions from another CG client.
- English/Afrikaans audience fit from the research pack is strategy evidence, not a permanent language mandate.
- A consultation/site-assessment CTA is strategically appropriate when the task allows it, but the actual contact route must be verified before publication.

### 3. Recent context / active-task / sensitive layer

No current campaign brief, active offer, pricing, sensitive operational plan, personal contact detail, or verified emergency workflow was promoted into durable memory during this migration because no authoritative Agri-Secure source for those facts was available in the audited corpus.

Task-specific future evidence should stay in recent/sensitive memory until it is confirmed to be a reusable long-term rule.

### 4. Human-marketing / cultural intelligence layer

Use the existing August 2026 Agri-Secure intelligence pack as the canonical research layer. Important operating implications include:

- Farm security should be explained as a system rather than a single device.
- Content should move from awareness and risk understanding toward consultation or property-specific assessment.
- Service education should distinguish assess, detect/deter, verify/escalate, respond, and review conceptually, while avoiding claims that Agri-Secure offers a specific component unless that capability is verified.
- Creative should look recognizably rural and operational rather than generic urban security stock.
- Crime incidence, response-time, service-area, licensing/accreditation, monitoring, operating-hours, and specific capability claims require current evidence.

### 5. Source inventory layer

Canonical Agri-Secure research:

- `docs/ai-workforce/client-intelligence/AGRI-SECURE-FARM-ARMED-RESPONSE-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`

Migration provenance:

- this audit
- `docs/ai-workforce/client-intelligence/AGRI-SECURE-CG-DYNAMICS-CLIENT-GUIDE.md`

Shared behavior references, read-only for this migration:

- `AGENTS.md`
- `docs/ai-workforce/CLIENT-MEMORY-FRESHNESS-AND-VERIFICATION-PROTOCOL.md`
- Issue #241 coordination material
- Issue #248 Project Instructions guidance

No Agri-Secure Project Source file was available in the accessible File Library at migration time. If one is supplied later and the user identifies it as stable client truth, ingest it with provenance and reconcile it against existing memory rather than treating it as generic campaign evidence.

## Mutable facts that remain unresolved

The existing Agri-Secure pack explicitly identifies the following as unresolved/current-verification items. They remain unresolved after this migration:

- legal/trading-name details beyond the client name used in the pack
- public phone numbers, email addresses, website, social handles, or fixed footer
- exact service areas or municipalities
- exact products and services directly offered
- whether armed response, monitoring, or related functions are provided directly or by partners
- response model and response-time commitments
- operating hours and emergency/support process
- registration, licensing, accreditation, or association memberships
- pricing, packages, promotions, or contract terms
- named hardware stack, integrations, or power/connectivity resilience claims
- approved proof assets, partner names, staff/face permissions, and testimonial permissions

These facts must not be guessed, inherited from another client, or converted from sector research into public-facing claims.

## Evidence hierarchy and conflict handling

For Agri-Secure client facts, use this order when sources conflict:

1. Current explicit user/client confirmation for Agri-Secure.
2. Current live verification from an authoritative Agri-Secure/public source when verification is appropriate and available.
3. Approved Agri-Secure Project Source or other client-authored source with clear provenance.
4. Existing approved Agri-Secure Dynamics memory/research with confidence and date metadata.
5. Older chat/campaign evidence.
6. Generic model knowledge or unrelated-client material: never a source of Agri-Secure facts.

For mutable public-facing facts, stored memory is not automatically live truth. Preserve uncertainty when verification fails. If a conflict remains unresolved, block the dependent claim rather than choosing the convenient value.

## Duplicate suppression

Before adding new Agri-Secure research or durable memory:

1. retrieve existing Agri-Secure Dynamics memory;
2. check the August 2026 intelligence pack and this guide;
3. update or supersede the existing fact/rule with provenance when genuinely new evidence exists;
4. do not create a second copy of the same rule simply because it appeared again in a new chat.

Campaign examples should remain campaign evidence unless the user confirms that they establish a lasting rule.

## Zero-leakage rule

Agri-Secure must remain isolated from every other client. Similar industry category, security terminology, rural audience, shared staff, or prior ChatGPT memory is never sufficient reason to copy another client's phone number, email, address, slogan, service list, offer, tone rule, footer format, legal claim, or creative convention into Agri-Secure.

## Completion boundary

This migration changes client documentation only. It does not alter #241 shared runtime, schemas, routing, client selection, shared state, or unrelated client intelligence.
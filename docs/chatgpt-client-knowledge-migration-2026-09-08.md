# ChatGPT client knowledge migration — 2026-09-08

Status: **in progress**

Purpose: migrate durable client knowledge from existing ChatGPT Projects into CG Dynamics before conversation history is wiped. CG Dynamics becomes the durable operational source of truth; ChatGPT Projects become working spaces only.

## Core rules

1. Work one exact client Project at a time.
2. Use the CG Hours canonical client name as the identity anchor.
3. Never fuzzy-match one client to another.
4. Read `AGENTS.md`, the client-research progress ledger, the client-memory freshness protocol, the canonical naming decisions, and every existing CG Dynamics source for that exact client before writing.
5. Review all useful Project chats and Project sources/files available for that client.
6. Extract durable knowledge, not every historical post/caption/request.
7. Verify mutable public facts against current authoritative sources before storing them: website, Facebook/Instagram, phone, email, address, hours, services, key contacts and current positioning.
8. Preserve provenance: public verified, client-confirmed, CA/CG-confirmed internal, historical, inferred/uncertain.
9. If sources conflict, record the conflict and prefer the newest authoritative source unless CA/client confirmation overrides it.
10. Keep each client isolated. Do not pull unrelated information from loose chats or other Projects.
11. Update/create the appropriate client intelligence / operational memory in CG Dynamics and retain the repo's freshness protocol.
12. Do not change CG Hours billing/history, client UUIDs, time entries or financial records during this knowledge migration.
13. Do not merge billing umbrellas with content identities. Example: Wiseman Group may be the invoice umbrella, while WiseRide, Supa Quick BFN and Supa Quick Centurion remain separate content/client intelligence identities.
14. Use branch `client-directory-reconciliation-2026-09-08` for this migration until CA approves final merge to main. Client-specific migration branches may be based on that branch when CA explicitly requests isolated work.

## Durable knowledge to capture

- Canonical identity and approved aliases
- Current official/public contact information
- Website and social profile links/handles
- Current service/product scope
- Target audiences and buying context
- Brand positioning
- Tone/language/caption rules
- Visual/content preferences
- Recurring promotions, events or operational requirements
- Explicit CA/client corrections and rejected approaches
- Package/deliverable realities that matter operationally
- Known sensitivities, compliance constraints or mistakes to avoid
- Useful historical lessons
- Mutable facts requiring future freshness checks

Do **not** treat temporary campaigns, one-off captions, obsolete prices, old dates or unverified guesses as permanent client memory.

## Migration status

| Client | ChatGPT Project | Status | Notes |
|---|---|---|---|
| WiseRide | WiseRide | IN PROGRESS | Separate content identity from Wiseman Group billing umbrella. |
| Piek Group | Piek Group | **SYNCED** | Canonical Piek umbrella preserved; Engen, Sasol, Get Together and named branches/partners remain distinct operational/content entities. Project PDFs, accessible Project history and current public facts were reconciled with explicit freshness/provenance states. |
| Cape Lumber | Cape Lumber | **SYNCED** | Canonical CG name remains Cape Lumber; public trading style is Cape Lumber Marketing. Existing August intelligence was converted into one permanent evolving human record, with accessible Project chats/source file, CG corrections, supplier-only boundaries, current product/service verification and unresolved phone/email/location/social freshness issues explicitly reconciled. |

## Completion standard

A client is `SYNCED` only when:

- current CG Dynamics material has been read;
- useful ChatGPT Project knowledge has been reviewed;
- current contact/public facts have been verified where possible;
- contradictions/stale facts have been resolved or explicitly flagged;
- durable knowledge has been committed to this branch;
- the final response states exactly what files/records changed and the commit SHA.

Only after all important current-client Projects are `SYNCED` should ChatGPT conversation history be wiped.

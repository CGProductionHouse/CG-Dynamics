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
8. Preserve provenance: public verified, client-confirmed, CG Production House-confirmed internal, historical, inferred/uncertain.
9. If sources conflict, record the conflict and prefer the newest authoritative source unless direct client or CG Production House confirmation overrides it.
10. Keep each client isolated. Do not pull unrelated information from loose chats or other Projects.
11. Update/create the appropriate client intelligence / operational memory in CG Dynamics and retain the repo's freshness protocol.
12. Do not change CG Hours billing/history, client UUIDs, time entries or financial records during this knowledge migration.
13. Do not merge billing umbrellas with content identities. Example: Wiseman Group may be the invoice umbrella, while WiseRide, Supa Quick BFN and Supa Quick Centurion remain separate content/client intelligence identities.
14. Use branch `client-directory-reconciliation-2026-09-08` as the migration base. Individual client migrations may be completed in their own clean child branch/worktree and merged back only after review.
15. Classify every discovered contact into the private canonical contact model: public marketing, internal only, client-portal only, unverified hold, or historical/superseded. Record exact client and optional entity/branch scope, provenance, freshness, allowed purpose, platform/content-mode applicability, and footer order.
16. Project Instructions are recoverable behaviour artifacts only. Never hardcode mutable phone/email/address/website values, prices, stock, hours, promotions, daily tasks, or named current contact people. Retrieve current approved values from exact-client Dynamics at task time.
17. When a client has entities, sub-brands, offices, dealerships, or branches, assign an exact `scope_key`. Scoped retrieval must never silently fall back to an unscoped, group, national, or sibling record.

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
- Explicit client/CG Production House corrections and rejected approaches
- Package/deliverable realities that matter operationally
- Known sensitivities, compliance constraints or mistakes to avoid
- Useful historical lessons
- Mutable facts requiring future freshness checks
- Caption/footer requirement (`mandatory`, `optional`, or `omitted`) by content mode/platform and the ordered canonical contacts it may use

Do **not** treat temporary campaigns, one-off captions, obsolete prices, old dates or unverified guesses as permanent client memory.

## Migration status

| Client | ChatGPT Project | Status | Notes |
|---|---|---|---|
| WiseRide | WiseRide | **COMPLETE** | Separate content identity from Wiseman Group billing umbrella. **#294 contact/footer audit complete** (see WiseRide section below): standalone Dynamics identity confirmed, website mandatory, default address/phone/email held as an unresolved conflict for CA. Contact backfill migration `20260909130000_client_contact_wiseride_backfill.sql`. |
| Piek Group | Piek Group | **SYNCED** | Canonical Piek umbrella preserved; Engen, Sasol, Get Together and named branches/partners remain distinct operational/content entities. Project PDFs, accessible Project history and current public facts were reconciled with explicit freshness/provenance states. |
| Cape Lumber | Cape Lumber | **COMPLETE** | Permanent Dynamics intelligence reconciled; social/content audit incorporated; `CAPE-LUMBER-CG-DYNAMICS-CLIENT-GUIDE.md` is the canonical ChatGPT working guide; current Project Sources audited with REPLACE decision for stale-risk business PDF; short staff-facing Project Instructions supplied. |
| Bloem Action Sports | Bloem Action Sport | **COMPLETE** | Final ChatGPT Project architecture completed on 2026-09-08. Permanent Dynamics intelligence remains `BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md`; social/content audit incorporated; canonical working guide at `BLOEM-ACTION-SPORTS-CG-DYNAMICS-CLIENT-GUIDE.md`; existing Project Source `Bloem Action Sport business info.pdf` marked **REPLACE** with canonical guide; short staff-facing Project Instructions supplied. |
| Dulux Paint & Paper Bloemfontein | Dulux; Dulux Paint & Paper Bloemfontein | **COMPLETE** | Final ChatGPT Project architecture completed on 2026-09-08. Permanent Dynamics intelligence at `DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`; canonical working guide at `DULUX-PAINT-PAPER-BLOEMFONTEIN-CG-DYNAMICS-CLIENT-GUIDE.md`; Project Source decisions: `Dulux Business profile.pdf` REPLACE, `Dulux Tone of Voice.pdf` REMOVE, canonical guide KEEP as single everyday grounding source; social/content audit incorporated; short staff-facing Project Instructions supplied; unverified mutable facts remain explicitly freshness-gated. |

## Base migration completion standard

A client is `SYNCED` when:

- current CG Dynamics material has been read;
- useful ChatGPT Project knowledge has been reviewed;
- current contact/public facts have been verified where possible;
- contradictions/stale facts have been resolved or explicitly flagged;
- durable knowledge has been committed to the client migration branch;
- the final response states exactly what files/records changed and the commit SHA.

## Final ChatGPT Project architecture completion standard

A client is `COMPLETE` under the final architecture only when:

- permanent detailed CG Dynamics intelligence is correct;
- the completed social/content audit is incorporated into that intelligence or its derived working guidance;
- one canonical practical ChatGPT working guide derived from Dynamics exists;
- every existing client Project Source has an explicit `KEEP`, `REMOVE` or `REPLACE` decision;
- stale/superseded Project grounding is removed or replaced rather than left beside the canonical guide;
- Project Instructions are reduced to short operating instructions that point staff/ChatGPT to the canonical guide;
- unresolved facts are explicitly freshness-gated instead of guessed;
- documentation changes are committed on the isolated client migration branch.
- canonical contact/footer records are prepared for private Dynamics backfill, with conflicts held unresolved rather than guessed;
- final Project Instructions contain no mutable contact values or named current contacts.

## Mandatory contact audit return (#294)

Generic "verify contacts" wording is not sufficient. Every client migration (completed,
in-progress and future) MUST return a deterministic contact audit with these exact
sections — an empty section is stated explicitly, never omitted:

1. **Confirmed public-marketing contacts** — exact value, contact type, entity/branch scope, footer order, provenance and freshness.
2. **Confirmed internal-only contacts** — recorded but never eligible for caption packets.
3. **Stale / superseded contacts** — retained with `historical`/`superseded` + `superseded_by` provenance, excluded from grounding.
4. **Unresolved conflicts** — two plausible current values, or an unverified value, held `unverified_hold`/`possible_change` and surfaced for a CA decision. Never guessed.
5. **Exact caption/footer rule** — the `mandatory`/`optional`/`omitted` requirement per content mode/platform and the ordered canonical contacts it may use, at the exact client/entity scope.

A client is **not** fully runtime-ready if a contact/footer requirement used in normal CG
captions is unresolved. Before any production apply, run the deterministic preflight
(`src/lib/clientContactBackfill.ts` → `preflightContactBackfill`) so the operator sees
clients covered, contacts/policies to insert, records skipped as already present,
stale/superseded values, unresolved conflicts and the exact entity/branch scopes — with no
mutation. All backfill migrations are idempotent (`on conflict do nothing`).

### WiseRide contact/footer audit — 2026-09-09

Exact canonical identity: WiseRide (`504113ee-fba9-4993-807e-a86066615212`). This is
a standalone client and never falls back to Wiseman Group, Supa Quick BFN, Supa Quick
Centurion, another Wiseman business, or a billing umbrella.

1. **Confirmed public-marketing contacts** — general WiseRide captions use only
   `wisemangroup.co.za` (unscoped client-wide website, footer order 10,
   `current_verified`). The Project rule, recent CG captions and current official page
   agree that the website is mandatory. No address, phone or email is approved while
   the conflicts below remain open.
2. **Confirmed internal-only contacts** — none evidenced in the recovered WiseRide
   source material. No private contact is fabricated or inserted.
3. **Stale / superseded contacts** — none can yet be deterministically classified as
   superseded. Both plausible contact sets remain active `possible_change` evidence
   until CA resolves them; neither set is silently demoted or deleted.
4. **Unresolved conflicts** — address: `80 Nelson Mandela Street, Bloemfontein` versus
   `88 Nelson Mandela Dr, Bloemfontein Central, Bloemfontein, 9323`; phone:
   `073 340 5302` versus `051 1011 600`; email: `sonja@wisemangroup.co.za` and
   `wiseride@wisemangroup.co.za` versus `info@wisemangroup.co.za`. Every candidate is
   caption-ineligible and stored `possible_change`; the runtime must not choose one.
   Langenhoven Park has no verified address, phone or email and must not inherit the
   Nelson Mandela values.
5. **Exact caption/footer rule** — for unscoped general WiseRide captions, the footer is
   `mandatory` and its exact template is `{website}`. Address, phone and email remain
   excluded pending resolution. No Langenhoven Park `scope_key` or fallback policy is
   created without exact branch evidence.

### Cape Lumber final architecture — 2026-09-08

- Permanent source of truth: `docs/ai-workforce/client-intelligence/CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md`
- Canonical ChatGPT working guide: `docs/ai-workforce/client-intelligence/CAPE-LUMBER-CG-DYNAMICS-CLIENT-GUIDE.md`
- Project Source decision: stale-risk business PDF → **REPLACE** with the canonical working guide.
- Social/content audit: incorporated into the permanent intelligence and canonical working guide.
- Short Project Instructions: supplied in the final completion handoff.

### Bloem Action Sports final architecture — 2026-09-08

- Permanent source of truth: `docs/ai-workforce/client-intelligence/BLOEM-ACTION-SPORTS-CLIENT-OPERATIONAL-INTELLIGENCE.md`
- Canonical ChatGPT working guide: `docs/ai-workforce/client-intelligence/BLOEM-ACTION-SPORTS-CG-DYNAMICS-CLIENT-GUIDE.md`
- Project Source decision: `Bloem Action Sport business info.pdf` → **REPLACE** with the canonical working guide.
- Social/content audit: incorporated into the permanent intelligence and canonical working guide.
- Short Project Instructions: supplied in the final completion handoff.

### Dulux Paint & Paper Bloemfontein final architecture — 2026-09-08

- Permanent source of truth: `docs/ai-workforce/client-intelligence/DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`
- Canonical ChatGPT working guide: `docs/ai-workforce/client-intelligence/DULUX-PAINT-PAPER-BLOEMFONTEIN-CG-DYNAMICS-CLIENT-GUIDE.md`
- Social/content audit: incorporated into the permanent intelligence and canonical working guide.
- Short Project Instructions: supplied in the final completion handoff.

Only after all important current-client Projects are `COMPLETE` under the final architecture should ChatGPT conversation history be wiped.

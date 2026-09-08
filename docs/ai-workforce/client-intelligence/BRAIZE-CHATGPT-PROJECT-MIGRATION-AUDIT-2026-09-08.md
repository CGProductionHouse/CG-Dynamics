# Braize — ChatGPT Project Migration Audit

Date: 2026-09-08 SAST  
Issue: #268  
Branch: `client-migration-braize-2026-09-08`  
Canonical client: **Braize**  
Canonical client ID: `6b67a2df-e2ab-418b-bcee-03aef5963d37`  
Scope: Braize client-specific intelligence/audit only. No #241 runtime/shared architecture, unrelated clients, CG Hours, billing, IDs, package/time history or production-data mutation.

## 1. Current GitHub / architecture authority reviewed

Reviewed before client-specific writes:
- `AGENTS.md`;
- `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`;
- `docs/ai-workforce/AUTONOMOUS-CODING-ORCHESTRATION.md`;
- `CONTINUE-HERE.md`;
- `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`;
- `docs/cg-dynamics-page-vision-and-milestones.md`;
- `docs/current-product-game-plan.md`;
- `docs/vision/CURRENT-MILESTONE.md`;
- `docs/ai-workforce/CLIENT-MEMORY-FRESHNESS-AND-VERIFICATION-PROTOCOL.md`;
- `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`;
- Issue #268;
- Issue #248 Human creative standard;
- Issue #241 current comments and draft PR #247 for ownership/runtime boundary;
- current client migration workflow on the #241 branch, with later #241 comments treated as authoritative where they supersede the older static-guide wording;
- existing Braize intelligence at `docs/ai-workforce/client-intelligence/BRAIZE-EVENT-STAFFING-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`.

Current `main` was rechecked immediately before branch creation:
`0a50ee61577ac7f1dcc79598d824855112f16b8e`.

The required migration branch did not exist before this run and was created from that exact current `main` SHA.

Shared runtime ownership remains #241 / PR #247. This migration intentionally does not edit its runtime, migrations, tests, common workflow/control docs or shared ledgers.

## 2. Exact live Dynamics identity — read only

Read-only checks against the CG Dynamics Supabase project found:
- active canonical row: **Braize**;
- exact active client ID: `6b67a2df-e2ab-418b-bcee-03aef5963d37`;
- active tier: premium;
- separate inactive row: **Braize Promotions**;
- the active Braize `client_industry_profiles` row exists but is `needs_research` and contains no substantive populated business profile;
- Braize-specific Skill Cards for the active client: none.

No production data was changed. The inactive Braize Promotions record was not touched, renamed, merged or reactivated.

## 3. Existing Braize intelligence reconciled

The pre-existing August pack was read rather than duplicated:

`docs/ai-workforce/client-intelligence/BRAIZE-EVENT-STAFFING-CLIENT-MARKETING-INTELLIGENCE-2026-08.md`

Useful durable strategy retained:
- event-staffing / promotional-personnel positioning;
- not-a-catering-company distinction;
- planners, venues, corporate/activation and private-host buying context;
- proof-of-work, event recap, staff-feature, education and short-form-video concepts;
- website/conversion, partnership and operational-system recommendations;
- trust barriers around punctuality, presentation, briefing, replacement and supervision;
- brand direction: energetic, capable, polished, young/premium without stiffness;
- warnings against over-sexualised staffing imagery and unproven `best`/`elite`/`fully trained` claims.

The migration adds the missing current-architecture distinction: **recommendation / desired service standard is not automatically current Braize capability**. Proposed roles, training, backup, supervision, national reach, staffing scale and operational systems are now explicitly claim-gated.

## 4. Accessible Braize Project history / CG corrections reviewed

Accessible Project context included recurring Braize work from April–September 2026, especially caption and text-on-post iterations.

Durable user/CG corrections captured:
- captions must not repeat what is already on the artwork/video;
- copy should be about the actual service/work, not generic promotion language;
- strong preference for one focused thought instead of stacked lists of traits/services;
- short, punchy wording often fits better than polished paragraph copy;
- Braize should feel playful, confident and energetic when the creative supports it;
- witty service-led lines work better than generic `professional event staff` filler;
- busy-bar / serving / crowd-pressure moments are strong creative territory when actually shown;
- `Braize girls` is approved in specific staff-celebration/playful contexts, not as a universal recruitment/legal/service label;
- natural Afrikaans is appropriate when requested; translated/stiff Afrikaans is not;
- local/event-specific language can be fun when the exact town/event is real;
- Heritage/celebration copy should still have one specific angle rather than generic occasion filler;
- exploratory option requests should produce genuinely distinct routes, while final copy should remain focused.

No durable user correction was promoted into a factual service claim unless independently supported by the client/source material.

## 5. Project Source reviewed

Accessible File Library search exposed one identifiable Braize-specific Project Source:

### `Braize Marketing.pdf` — KEEP

Why keep:
- original client-supplied business description;
- service labels for waitstaff, bartenders/bar support, promoters/brand ambassadors, event hosts/front-of-house;
- manifesto/brand-language evidence including `We hit different`;
- client-supplied caption-footer convention: Bloemfontein, `www.braize.co.za`, `promotions@braize.co.za`;
- useful evidence for corporate/private/activation/event positioning.

Freshness / alias cautions:
- it calls the company `Braize Promotions` in one section; this is preserved as historical/source wording only and does not override the exact active Dynamics identity;
- `Premium event staffing across South Africa` is client positioning from that source, not current proof of national operational coverage;
- `trained`, `arrive prepared/on time` and related lines are desired service-standard/marketing language, not evidence of a currently audited training or guarantee system;
- the PDF says Braize is **expanding into mobile bar services**; that is future/strategic language, not proof of a currently bookable mobile-bar service;
- contact/footer values are mutable and must still pass task-time freshness checks.

Project Source decision set for actually exposed sources:
- **KEEP:** `Braize Marketing.pdf` as original client evidence with the above provenance/freshness guardrails.
- **REMOVE:** none.
- **REPLACE:** none.

No source was physically deleted. No unseen Project Source name or deletion decision was invented. A static generated Client Guide is not required as the replacement under the current #241 architecture.

## 6. Current public-source verification attempt

On 2026-09-08, exact web searches for:
- Braize event staffing / `braize.co.za`;
- `braize_za`;
- the `braize.co.za` domain;

did not reliably surface the correct South African Braize business. Search results were dominated by unrelated businesses/places/products with the same word.

Therefore this migration does **not** claim that the following were freshly reverified on 2026-09-08:
- website;
- Instagram handle;
- email;
- Bloemfontein footer/location;
- other social profiles.

The latest strong official evidence remains the CA-supplied Instagram screenshot used in the 2026-08-06 intelligence plus the 2026-02-05 client PDF. Mutable facts are explicitly freshness-gated rather than silently promoted to `current_verified`.

## 7. Fact reconciliation

| Topic | Decision |
|---|---|
| Canonical active identity | Braize |
| Exact active ID | `6b67a2df-e2ab-418b-bcee-03aef5963d37` |
| Braize Promotions | Separate inactive Dynamics record; historical/source alias wording only when provenance requires it |
| Website | `www.braize.co.za`, last strong official verification 2026-08-06; current revalidation unavailable |
| Instagram | `braize_za`, last strong official verification 2026-08-06; current revalidation unavailable |
| Email | `promotions@braize.co.za`, direct client PDF source; revalidate before current public use |
| Caption location/footer | Bloemfontein per direct client PDF; formatting preference retained, mutable value still freshness-gated |
| Core strongest service categories | Waitresses, bartenders, promo girls/promotional staff from 2026-08 official Instagram evidence |
| Additional client-supplied role labels | Waiters, bar support, promoters/brand ambassadors, event hosts/front-of-house from client PDF |
| Catering | Do not market Braize as catering under current reviewed intelligence |
| Mobile bar | Expansion direction only; current launch/capability unresolved |
| National coverage | Source positioning only; current operational coverage unresolved |
| Training/vetting/supervision/backup | Desired/recommended system language; current operational truth unresolved |
| Staffing numbers/availability | Mutable/unresolved; never infer |
| Prices/packages/terms | Mutable/unresolved; never infer |
| Named client/brand relationships | Use only with exact event/client evidence; never infer from generic staffing content |

## 8. Human creative / caption conclusions

Braize output should be recognisably different from generic event-agency copy.

Durable rules:
- human, energetic, specific and commercially useful;
- one focused thought is stronger than a three-item stack;
- captions add a new angle to the creative instead of paraphrasing it;
- real service pressure, serving/pouring, crowd flow, event context or team performance can provide the hook when visible/verified;
- B2B booking content should address the event problem or job being done;
- staff/celebration content can be more playful and personality-led;
- `Braize girls` is context-specific, not universal;
- use natural English or natural Afrikaans as requested; do not force language mixing;
- humour may be cheeky but should not sexualise staff or imply drinking on shift;
- avoid interchangeable filler such as `bringing brands to life`, `making every event memorable`, `professional staff for every occasion`, `elevate your event`, `experience the difference`, `your trusted event partner` and empty adjective stacks.

## 9. Dynamic SEO / hashtags

Default maximum: **5 hashtags**.

No fixed hashtag bank was made canonical. Current output should choose tags at task time from exact Braize identity + exact verified staffing/event topic + platform + relevant true location/industry + current reliable search evidence.

Historical tags/keywords are seeds only. Do not label a tag `trending` without current evidence. Natural searchable nouns should also appear in the caption where they fit without keyword stuffing.

## 10. Image generation / editing conclusion

No additional detailed Braize-specific image-edit history was exposed strongly enough to create claims beyond the current Project/Issue evidence.

Apply these durable preservation rules:
- preserve real staff identity/appearance unless the requested edit specifically changes something permitted;
- preserve real uniforms and Braize logo/wording/colours;
- preserve client/event/venue branding shown in the source unless the requested edit explicitly targets it;
- preserve plausible products/drinks/service objects, proportions and composition;
- for cleanup/enhancement, change only what was requested;
- never fabricate a client relationship, event attendance, staff role, scale or service capability through an edit;
- never add alcohol consumption by working staff.

## 11. Current Project Instructions audit / final replacement

A distinct editable Braize Project-Instructions document/UI value was not exposed as a separate retrievable source in this tool session, so a literal line-by-line comparison of the Project UI instructions could not be performed without inventing unseen text.

The migration therefore prepares this short durable replacement for manual application:

### Final short Project Instructions

Work only on Braize. Before factual, caption, content or image work, retrieve the current exact-client CG Dynamics/GitHub context for client_id `6b67a2df-e2ab-418b-bcee-03aef5963d37` and use the freshest reviewed evidence. Keep Braize separate from the inactive Braize Promotions record unless exact historical provenance is needed. Write human, energetic, specific and commercially useful marketing; captions must add a fresh angle to the artwork/video, not repeat it. Use natural English or Afrikaans as requested and no more than 5 dynamically relevant hashtags for the exact topic/platform. Preserve real staff, uniforms, client/event branding and composition in edits. Never invent or freeze services, staffing capability or numbers, clients, national coverage, availability, pricing, contacts, hours, recruitment/employment terms, training/supervision claims or event results. Flag stale or conflicting facts instead of guessing.

Character count: 935.

## 12. Inaccessible / partially inaccessible evidence

- The actual Braize ChatGPT Project UI's current editable Instructions were not exposed as a distinct source, so no invented line-by-line current-instruction audit is claimed.
- No Braize-specific Project Source other than `Braize Marketing.pdf` was exposed through the accessible File Library. If the Project UI contains additional sources not surfaced to the connected library, they remain inaccessible rather than guessed.
- The current live `www.braize.co.za` website and official Instagram page could not be reliably retrieved through current public web search in this session.
- Current Facebook, LinkedIn and Google Business Profile presence was not verified.
- Current phone/WhatsApp, physical address, public hours, service area, recruitment pathway and contact roles were not verified.
- Current staffing roster/depth, exact availability, national coverage, mobile-bar launch, training/vetting/supervision/backup systems, client relationships, packages/pricing, wages/employment terms, insurance and guarantees remain unverified.
- Some prior Project chat history is available through accessible project-history/context summaries rather than a raw export of every historical assistant/user turn. Durable user corrections that were actually exposed were captured; unseen turns were not invented.

## 13. Unresolved CG decisions / future freshness gates

No new product/architecture decision is required from CG for this client-specific migration.

Operational facts that must be resolved only when current evidence is available or a task requires them:
- whether Braize still wants the public `Braize girls` terminology beyond specific social contexts;
- current public contact/footer set;
- current operational service area / national coverage;
- exact currently bookable role list;
- mobile-bar-service status;
- current recruitment/application pathway;
- current training/vetting/supervision/replacement model;
- current prices/packages/terms and employment/payment conditions;
- current named client/partner proof.

Shared exact-client live retrieval/mapping and reusable readiness remain #241 / PR #247 ownership and are not implemented from this branch.

## 14. Acceptance / handoff status

Client-specific migration work completed on the isolated Braize branch:
- current GitHub/architecture authority reviewed;
- exact active Dynamics identity resolved read-only;
- inactive similarly named row protected from fuzzy matching;
- existing Braize intelligence reconciled rather than duplicated;
- accessible Project history and durable human creative corrections captured;
- `Braize Marketing.pdf` audited with explicit source decision;
- current public-source revalidation attempted and uncertainty recorded honestly;
- services/contact/national/training/mobile-bar claims freshness-gated;
- client-specific caption/poster/video/image/SEO rules added;
- final short Project Instructions prepared;
- no shared runtime, unrelated client or production-data mutation performed.

**Manual handoff gate:** `MIGRATION COMPLETE / PROJECT INSTRUCTIONS NOT YET CONFIRMED`.

Do not report Braize as fully Project-ready until the final short Project Instructions above have actually been pasted/applied in the Braize ChatGPT Project and the CG user confirms that manual step.
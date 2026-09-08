# Econofoods — ChatGPT Project Migration Audit

Date: 2026-09-08 SAST  
Issue: #251  
Branch: `client-migration-econofoods-2026-09-08`  
Canonical client: **Econofoods**  
Canonical client ID: `61acf81b-1011-404e-9fae-2e209be65fca`  
Scope: Econofoods client-specific audit/intelligence only. No #241 shared runtime files, Bohemia #250 files, unrelated client files, CG Hours, billing, time-history or production-data mutation.

## 1. GitHub/current-system authority reviewed

Reviewed before writing:
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
- Issue #251;
- Issue #248;
- Issue #241 plus current draft PR #247 for architecture/ownership boundaries only;
- current migration workflow on `feat/client-intelligence-integration`: `docs/chatgpt-client-knowledge-migration-2026-09-08.md`;
- existing reviewed Econofoods intelligence: `ECONOFOODS-SOUTH-AFRICA-VIDEO-COMMERCIAL-PLAYBOOK-2026-08.md`.

Current `main` was rechecked before branch creation at:
`c72431efc30687ecd950bb4d6b277b6dda06c11c`.

The required branch did not exist before this migration and was created from that exact `main` SHA.

No shared progress/control/runtime file was edited. The alphabetical #210/#184 pointer remains Human Auto and was not advanced.

## 2. Exact live Dynamics identity and read-only state

Read-only production checks against the CG Dynamics Supabase project found:

### `clients`
- exact active row: `Econofoods`;
- exact ID: `61acf81b-1011-404e-9fae-2e209be65fca`;
- tier: `standard`;
- active: `true`.

### Existing `client_industry_profiles`
One exact-client row exists, but it is not current usable intelligence:
- `client_name`: `Econo`;
- official website: null;
- official channels: empty;
- industry/business/audience/product fields: null;
- confidence: `needs_research`;
- review state: `needs_research`;
- research date: null;
- last update: 2026-07-25.

Decision:
- preserve it as stale/low-information system evidence;
- do not use `Econo` as the public canonical name;
- do not mutate production during this migration;
- #241/PR #247 remains the owner of shared registration/review/runtime projection.

### Exact-client `skill_cards`
- count: `0`.

No skill card was created or activated in production.

## 3. Current CG service-scope verification

The previous August playbook said CG worked with Econofoods primarily through video production. Issue #251 required that statement to be reverified rather than accepted on memory.

Read-only `monthly_deliverables` provides strong current proof:
- 36 Econofoods deliverables exist from January through September 2026;
- all 36 have `deliverable_type = video`;
- September 2026 contains four video deliverables;
- no other deliverable type appears for Econofoods in 2026 through the migration date.

Decision:
- **current CG scope is video-first**;
- the canonical intelligence supports concepts, scripts, shoot/edit guidance and related video work;
- occasional Project caption/poster/FAQ assistance does not prove CG owns full-service marketing;
- any future scope expansion must be reverified from live package/client evidence.

This is the most important correction/confirmation added to the older playbook.

## 4. Accessible Econofoods Project history reviewed

Accessible current-Project history included the following durable evidence.

### 2026-03-09 — Econofoods overview / in-store concepts

Project work included:
- ready-made meal video concepts;
- requests for funny, short, on-camera product content;
- staff walking through frame/product handoff mechanics;
- request for completely different in-store employee ideas;
- FAQ-led ready-made-meal content with more questions;
- a new-look/rebrand reassurance concept;
- explicit restriction that products not be opened/tasted for that concept;
- two people speaking to the camera/customer rather than acting a dialogue to each other;
- request to preserve the playful `glow-up` idea while changing the speaking setup;
- a question about Econofoods retail-store count.

Durable conclusions:
- practical in-store execution matters as much as concept novelty;
- product handoffs/movement can create energy without complicated acting;
- FAQs are useful only when exact product facts are supplied/verified;
- rebrand continuity can be a creative mechanism but must not become a permanent `same taste` claim;
- old store counts are mutable and must not be carried forward as fixed truth.

### 2026-08-13 — 30-year anniversary script

The user requested:
- approximately 30 seconds;
- excited/happy/grateful tone;
- a more personal version;
- a stronger ending.

Current first-party LinkedIn evidence now independently confirms the 30-year milestone on 4 September 2026.

Durable conclusion:
- milestone/thank-you content should feel personal and emotionally earned, not corporate or generic.

### 2026-08-28 — Cape Town shop and central-office ideas

The user requested:
- multiple fun, out-of-the-box approximately 30-second shop ideas;
- more ideas rather than minor rewrites of the first batch;
- employee-led central-office content;
- content focused on how employees help grow/support the company, not generic meetings;
- concepts using employees only, without buyers/customers.

Durable conclusions:
- CG often needs ideas designed around real staff availability rather than actors/extras;
- central-office content must connect to actual business contribution, not generic office B-roll;
- when asked for more ideas, change the creative mechanism, not just the wording/product;
- Econofoods content can be playful without being a customer skit every time.

### Existing reviewed August playbook

The full reviewed `ECONOFOODS-SOUTH-AFRICA-VIDEO-COMMERCIAL-PLAYBOOK-2026-08.md` was read and reconciled rather than duplicated.

## 5. Previous video-commercial playbook reconciliation

### Retained as durable

- video-first relationship model — now independently verified from 2026 Dynamics schedule data;
- cheeky, quick, commercially clear brand direction;
- humour as delivery, not strategy;
- product-essential comedy test;
- craving/value/discovery/store-traffic/basket/B2B/brand-affection commercial jobs;
- strong first-two-second hook rule;
- spoken, conversational script language;
- fast edit/hard-cut/product-sound/reaction principles;
- food/product beauty still matters;
- regional-vs-national promotion discipline;
- staff/customer-truth mechanisms;
- foodservice/reseller mode;
- event/store-opening capture principles;
- performance learning tied to videos rather than views alone;
- guardrails for price, claims, competitors and customer humour.

### Reframed

- `Econo Maths`, `Freezer Problems`, `Want ___ with that?`, `Econo Test`, `Meal Rescue`, `Bulk Behaviour`, `Freezer Rich`, `Month-End Olympics`, `Econo Emergency Services` and related campaign territories are now explicitly **historical seed mechanisms**, not a reusable template bank.
- the previous four-video monthly mix remains a useful planning model, while current Dynamics now independently proves the live four-video rhythm through September 2026.
- old public/business facts were rechecked where material rather than left as presumed current.

### Demoted / freshness-gated

- old prices, pack sizes, promotions and campaign dates;
- store-opening locations from old projects;
- old branch/store counts;
- old product/flavour availability;
- old social audience counts;
- old delivery/stock assumptions;
- historical public discussion as anything stronger than directional customer-language evidence.

### Explicit creative upgrade from #248

The migration adds permanent human-copy rules that were not sufficiently explicit in the August video-only pack:
- captions/scripts add rather than repeat supplied creative;
- no generic AI/corporate filler;
- sentence rhythm/openings/CTA must vary;
- published brand copy is evidence, not the creative ceiling;
- no permanent hashtag bank;
- default maximum five dynamically relevant hashtags;
- compact task-specific retrieval rather than loading the entire playbook.

## 6. Current public/fact verification

### Current first-party website

Verified 2026-09-08:
- `https://econofoods.co.za/`;
- `https://shop.econofoods.co.za/`;
- frozen/chilled foods and groceries remain current business positioning;
- current categories include poultry, dairy/eggs, red meat, fish, seafood, pork, frozen vegetables, groceries and desserts;
- current site supports online shopping, store locator, regional/monthly specials, app, click-and-collect and selected-area delivery;
- foodservice/reseller servicing remains current;
- the official site currently displays general number `+27 87 087 3658`;
- contact/FAQ content explicitly warns that prices/availability change, hours vary by store and delivery conditions depend on area/store capacity.

### Current first-party LinkedIn

Verified current page:
`https://www.linkedin.com/company/econo-foods`

Current evidence includes:
- 30-year anniversary post dated 4 September 2026;
- current public brand/culture language around customers, team, value and improving lives.

### Current store/specials context

The official current specials/store pages show a wide multi-region footprint and many individual store promotions/locations. Because that roster changes, the migration does **not** store a fixed national store count/list as permanent caption truth.

## 7. Recent public/social content audit

Direct Facebook and Instagram post retrieval could not be completed from the available browser surface. TikTok access was blocked by robots. Therefore the audit uses:
- first-party website/current specials/current LinkedIn as factual authority;
- current indexed/mirrored public post copies only for observational voice/format patterns.

Recent late-August/early-September 2026 public Econofoods content showed:
- energetic store-opening language;
- freezer/bulk/value framing;
- direct product/meal occasions;
- anniversary/partner/campaign content;
- emoji-rich retail posts;
- clear price/date/store conditions on promotions;
- conversational South African retail phrasing.

Creative judgement:
- the energy is useful evidence;
- generic/repeated public retail phrases are **not** the target copy standard;
- CG should be more product/customer-specific and less formulaic while respecting the brand's directness.

## 8. Human creative/caption/script conclusions

Econofoods work should:
- feel quick, human, specific and commercially sharp;
- use cheekiness when the product/customer moment earns it;
- make the product/offer/store/meal behaviour essential to the joke;
- keep dialogue natural and easy for real employees to perform;
- use fast visual mechanics rather than relying on complicated acting;
- change creative mechanism when the user asks for fresh ideas;
- open with product/action/tension rather than routine logo/store establishing shots;
- make food/products look appealing even in comedy-led work;
- add in captions/scripts rather than repeat the visual/dialogue;
- avoid generic `quality + affordability` filler;
- avoid forced slang/bilingual copy;
- never invent mutable facts for a punchline.

Default language: natural English unless the brief requests otherwise. Local/Afrikaans phrasing can be used naturally where it fits; it is not a mandatory mixed-language rule.

Emoji use is contextual. Current public posts often use many emojis, but there is no evidence that every CG caption must.

## 9. Dynamic SEO/hashtag decision

Default maximum: **5 hashtags**.

No permanent Econofoods hashtag bank is created.

At generation time choose the strongest set for the exact:
- Econofoods identity;
- product/topic;
- platform;
- verified relevant location/category;
- reliable current search/trend context where meaningful.

Historical/public tag sets are seed/reference material only. Do not call a tag `trending` without current evidence and do not create false branch/stock/promotion claims through hashtags.

## 10. Image/edit conclusions

Durable rules:
- preserve real Econofoods logos/brand marks unless explicitly changed;
- preserve real product packaging, labels, colours and proportions;
- preserve identifiable real people unless the edit specifically changes them;
- preserve key composition when the user requests cleanup/quality enhancement only;
- do not invent promotion stickers, prices, stock, products, branch signage, uniforms or packaging;
- do not make a historical promotion look current through retouching;
- use current supplied packaging/rebrand references when identity has changed.

The accessible storefront cleanup source supports a `polish, do not silently redesign` rule.

## 11. Project Source audit

Connected File Library searches were run for Econofoods and known naming variants.

One identifiable Econofoods-specific Project/File Library source was exposed:

### KEEP

`Econofoods Storefront Under Night Lights.png`
- created 2026-07-29;
- source context: user asked to make the picture more appealing and clean;
- useful as original visual/edit-history evidence;
- keep as an original creative asset, not as a source for current prices/store hours/branch facts.

### REMOVE

None exposed.

### REPLACE

None exposed.

No static Client Guide replacement is required by Issue #251. The long-term source of truth is current exact-client Dynamics/GitHub intelligence, with future task-specific retrieval under #241.

If the ChatGPT Project UI contains additional files that were not surfaced by the connected File Library, they are inaccessible evidence and are not guessed here.

## 12. Current Project Instructions audit

No separate detailed Econofoods Project Instructions document/text was exposed through the connected Project file/history surfaces for a reliable line-by-line replacement audit.

The migration therefore does not pretend to remove or rewrite unseen instructions. It produces a short replacement instruction set aligned to #251/#248 for CA to paste and confirm manually.

### Final short Project Instructions

Work only on Econofoods. Before factual, script, caption, content or edit work, retrieve the current exact-client CG Dynamics/GitHub context for Econofoods and use the freshest reviewed evidence plus the supplied asset/brief. CG's current relationship is video-first; do not assume full-service marketing. Keep creative quick, human, specific, commercially sharp and recognisably Econofoods: cheeky when the product/customer moment earns it, never generic retail filler. Scripts and captions must add to the asset, not repeat it. For hashtags, use no more than 5 by default and choose them dynamically for the exact product/topic, platform and verified location. In edits, preserve real products, packaging, logos, people and key composition unless a change is explicitly requested. Never invent or freeze prices, promotions, stock, branch availability, product facts, contacts, hours, delivery or campaign terms. Treat old posts/scripts as evidence, not current truth; flag conflicts or stale facts instead of guessing.

Manual confirmation gate: **not yet completed**.

## 13. Inaccessible / partially inaccessible evidence

- Direct current Facebook posts/page details could not be independently retrieved from the browser surface.
- Direct current Instagram posts/page details could not be independently retrieved.
- TikTok retrieval was blocked by robots.
- Exact official Facebook/Instagram/TikTok handles therefore remain unresolved rather than guessed.
- The File Library surfaced only one identifiable Econofoods-specific asset; additional Project UI sources, if any, were not exposed to the connected search.
- Full Meta/TikTok performance and watch-retention data was not available.
- Current paid-vs-organic split was not available.
- Current Econofoods CI/brand-language document, music/licensing rules and any national-agency framework were not exposed.
- Current exact national store count was not fixed from current authoritative evidence and is intentionally not guessed.
- Current product-priority/margin guidance was not available.
- The public website parser redacted the general email value, so no email was promoted into the canonical public footer.

## 14. Unresolved CG decisions / future confirmation points

These are not migration blockers but must remain explicit:
- whether Econofoods later expands CG beyond the currently verified video-first relationship;
- whether the client has a formal approved cheekiness/brand-language do/don't document;
- whether there is a mandatory Econofoods social caption footer/contact convention;
- exact official Facebook/Instagram/TikTok identities;
- current music/licensing constraints;
- performance data needed to identify proven top video mechanisms;
- current national campaign/agency frameworks that CG must align with;
- current product/category priorities for future video cycles.

## 15. Acceptance result

Completed client-specific work:
- current GitHub/issues/PR ownership audit;
- mandatory continuity/freshness/migration workflow reads;
- full existing Econofoods video-commercial playbook reconciliation;
- exact Dynamics client-ID resolution;
- current service-scope verification from live `monthly_deliverables`;
- accessible Project-history audit;
- current first-party website/LinkedIn fact verification;
- recent public/social-pattern audit with access limitations stated;
- human creative/caption/script rules under #248;
- dynamic SEO/hashtag rules;
- image/edit preservation rules;
- exact accessible Project Source KEEP/REMOVE/REPLACE decisions;
- compact #241 task-retrieval readiness in the canonical intelligence;
- final short Project Instructions prepared for manual paste/confirmation.

No #241 shared runtime file was edited. No Bohemia #250 file was edited. No unrelated client file was edited. No production data was mutated. No CG Hours, billing, client UUID, time-entry or financial record was changed.

Project handoff is **not** marked complete until CA pastes/confirms the short Project Instructions.

# All Around PVC — ChatGPT Project Migration Audit

Date: 2026-09-08 SAST  
Issue: #249  
Branch: `client-migration-all-around-pvc-2026-09-08`  
Canonical client: **All Around PVC**  
Scope: client-specific audit/intelligence only. No #241 runtime/shared architecture, unrelated client, CG Hours, billing, IDs, time-history or production-data mutation.

## 1. GitHub/current-system authority reviewed

Reviewed before writing:
- `AGENTS.md`
- `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`
- `docs/ai-workforce/AUTONOMOUS-CODING-ORCHESTRATION.md`
- `CONTINUE-HERE.md`
- `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`
- `docs/cg-dynamics-page-vision-and-milestones.md`
- `docs/current-product-game-plan.md`
- `docs/vision/CURRENT-MILESTONE.md`
- `docs/ai-workforce/CLIENT-MEMORY-FRESHNESS-AND-VERIFICATION-PROTOCOL.md`
- `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`
- Issue #249 and current ownership comment
- Issue #248
- Issue #241 and draft PR #247 for architecture/ownership boundary only
- Current migration workflow document on PR #247 branch where it is not yet present on `main`
- `docs/ai-workforce/BUILDING-MATERIALS-HUMAN-MARKETING-GOLDMINE-2026-08.md`

Current `main` base rechecked immediately before branch creation:
`c72431efc30687ecd950bb4d6b277b6dda06c11c`.

No existing All Around PVC client-specific intelligence file was found on current CG Dynamics `main`.

## 2. Exact live Dynamics identity/read-only state

Read-only production checks:
- `clients`: exact active row `All Around PVC`
- client ID: `fd16ebae-a50b-4920-afe0-94c2631f8f06`
- tier: `standard`
- exact-client `client_industry_profiles`: none
- exact-client `skill_cards`: none

No production mutation was performed. Shared runtime registration remains #241/PR #247 ownership.

## 3. Accessible All Around PVC Project history reviewed

Accessible Project evidence covered these threads:

1. **2026-09-02 — Instagram bio writing**
   - Confirms current social-profile work for the client.
   - No new mutable business fact was promoted from the bio request alone.

2. **2026-08-26 — Gloss PVC / product-service copy review**
   - Practical benefit-led copy was preferred over vague promotion.
   - User specifically checked that Gloss copy made sense and asked for consumer-friendly wording.
   - User corrected poster wording from `length` to `size`.
   - User asked that service/product information be grounded in the client's Facebook page.
   - Durable lesson: factual product wording should be direct and natural, not decorative.

3. **2026-08-19 — PVC text-on-post and captions**
   - Captions requested in English with SEO-relevant hashtags.
   - User repeatedly asked for shorter wording without losing the useful point.
   - User rejected generic/fancy headings and asked for more human, concrete wording.
   - User instructed captions not to repeat the words already on the poster.
   - Stock/immediate-availability wording appeared in a specific current-stock post context only.
   - Historical product marketing included Matt PVC ceilings, SPC flooring and luxury PVC wall panels.
   - Technical claims from that historical work remain freshness-gated by the newer website source record.

4. **2026-08-25 — short All Around PVC service script**
   - Confirms recurring need for concise service-overview video copy.
   - No new service was made permanent unless independently verified.

5. **2026-08-28 — logo quality enhancement**
   - Explicit correction: improve sharpness/quality only; do not change wording, colours or other logo elements.
   - Durable image-edit rule: identity-critical assets must be preserved exactly unless the user requests a specific change.

6. **2026-08-19 — installation image generation**
   - Realistic home-context installation visuals requested for Matt PVC ceilings, SPC flooring and PVC wall panels.
   - User did not want faces shown.
   - Dynamic action/material detail was preferred, with wider/zoomed-out framing when needed.
   - Durable image rule: believable installation process and product preservation matter more than generic staged imagery.

### Cross-client contamination check

A targeted prior-context search found electric fencing, gates/access systems and palisade attributed to unrelated security work, not All Around PVC. Those product families are explicitly excluded from this client's current scope unless new direct evidence appears.

## 4. Recent current CG website/social evidence reviewed

Current CG-maintained website repo: `CGProductionHouse/allaroundpvc-website`, current `main`.

Reviewed:
- Issues #1, #2, #3, #4 and #5.
- `src/data/site.ts`.
- `src/app/page.tsx`.
- `docs/CONTENT-SOURCE.md`.
- `docs/DECISIONS.md`.
- `docs/STATUS.md`.
- Recent current-site commit history from 2026-09-02.

Current product hierarchy from the strongest current evidence:
1. PVC ceilings and polystyrene cornices.
2. SPC flooring.
3. Luxury PVC wall panels.

Current ceiling/cornice detail:
- 3.9 m Normal.
- 3.9 m Groove.
- 6.0 m Normal.
- 6.0 m Groove.
- 2 m polystyrene cornices, multiple shapes.

The 2026-09-02 Facebook screenshot preserved in Issue #1 is current first-party evidence for those ceiling/cornice options. It is also a stock post, so stock remains mutable.

Current contact/entity truth in the CG-maintained website:
- canonical business: All Around PVC
- canonical origin: `https://www.allaroundpvc.co.za`
- Bloemfontein, Free State
- Jeanique
- `+27 76 111 0486`
- `info@allaroundpvc.co.za`
- Facebook: `https://www.facebook.com/PVCALLAROUND/`

Website copy deliberately uses cautious wording around product guidance and installation options and avoids unsupported in-house installation, warranty, stock, price, delivery, address/hours and service-radius claims.

## 5. Direct client evidence reviewed

Two duplicate CG Production House Wix notifications received on 2026-08-18 contained the same direct intake submission:
- business name: `All Around PVC Group`
- email: `pvcceilingwarehouse@gmail.com`
- address: `2A Bright Street, Hospitaalpark`
- phone: `+27 76 111 0486`

Reconciliation:
- phone agrees with newer website truth -> current verified.
- `All Around PVC Group` retained as an alias only; canonical remains All Around PVC under #249/current website.
- intake Gmail retained as historical/internal contact; newer public website email supersedes it for marketing.
- street address is direct client-supplied but public/showroom use remains unresolved because the newer website source explicitly kept public address pending.

## 6. Current fact reconciliation

| Topic | Decision |
|---|---|
| Canonical name | All Around PVC |
| Facebook name conflict | Preserve `PVC All Around` as alias/possible-change; do not rename canonical identity |
| Website | Current CG-maintained truth: `https://www.allaroundpvc.co.za`; external live-page fetch was unavailable in this tool session |
| Phone/WhatsApp | Current verified: `+27 76 111 0486` |
| Public email | Current verified: `info@allaroundpvc.co.za` |
| Street address | Direct client-submitted evidence exists; public-use confirmation still required |
| Core products | PVC ceilings/cornices; SPC flooring; luxury PVC wall panels |
| Ceiling sizes/variants | 3.9 m + 6.0 m; Normal + Groove; current 2026-09-02 first-party evidence |
| Cornices | 2 m polystyrene; multiple shapes; current 2026-09-02 first-party evidence |
| Stock | Never permanent; verify at task time |
| Installation | Options language supported; operating model/in-house status unresolved |
| Delivery | Unresolved |
| Warranty | Unresolved |
| Prices/promos | Mutable; no permanent value stored |
| SPC technical claims | Historical only until current range/spec verification |
| Wall-panel technical claims | Historical only until current range/spec verification |
| Fencing/gates | Excluded as unsupported/cross-client contamination |

## 7. Human creative/caption conclusions

All Around PVC content should:
- sound direct, practical and human;
- default to English unless the task says otherwise;
- explain one real surface/product/customer decision at a time;
- add information/personality beyond poster/video wording;
- use concise, varied sentence structures;
- use technical detail only as far as evidence supports it;
- use humour lightly and contextually;
- avoid generic home-improvement AI filler;
- use current stock/price urgency only when freshly confirmed.

Durable rejected patterns include:
- generic `transform/elevate/upgrade your space` copy;
- `quality meets style`;
- `your trusted partner`;
- `discover the difference`;
- `great move` / `smart move` style filler;
- fancy headings with no concrete point;
- captions that restate the poster.

## 8. Dynamic SEO/hashtag decision

Default maximum: **5 hashtags**.

No permanent hashtag bank is created. Hashtags must be selected at generation time using the exact product/topic, platform, relevant location/category and reliable current search/trend evidence. Historical tags are seeds only. Natural searchable wording belongs in the caption itself.

## 9. Project Source audit

Accessible File Library searches were run for:
- `All Around PVC`;
- `PVCALLAROUND`;
- `All Around PVC.png`;
- `pvcceilingwarehouse@gmail.com`;
- business/product/source terms.

Result: **no identifiable All Around PVC-specific current Project Source file was exposed by the accessible File Library**. Returned files were unrelated image-generation assets from other work.

Therefore the exact accessible Project Source decision set is:
- **KEEP:** none exposed.
- **REMOVE:** none exposed.
- **REPLACE:** none exposed.

Do not claim a deletion/replacement for a source that was not actually exposed. If the ChatGPT Project UI contains source files that are not surfaced to the connected File Library, those remain inaccessible evidence rather than guessed source names.

Useful original evidence is instead preserved in current CG-maintained GitHub/client records and project-history audit. The long-term truth remains CG Dynamics/current GitHub client intelligence, not a manually uploaded static guide.

## 10. Current Project Instructions audit

The accessible Project instruction surface identifies this as the All Around PVC Bloemfontein project but does not contain a complete durable client fact/creative rule set. The migration therefore supplies the following short replacement instruction aligned to #249/#248.

### Final short Project Instructions

Work only on All Around PVC. Before factual, caption, content or image work, retrieve the current exact-client CG Dynamics/GitHub context and use the freshest reviewed evidence. Keep marketing human, specific, practical and useful; captions must add a new layer to the artwork/video instead of repeating it. Default to English unless the task asks otherwise. Use natural searchable wording and no more than 5 dynamically relevant hashtags by default, chosen for the exact product, topic, platform and relevant location. Preserve real products, logo wording, colours, proportions and composition in image edits. Never invent or freeze mutable product ranges, stock, prices, installation capability, delivery, warranties, technical claims, addresses, hours or service areas. Treat old posts as evidence, not automatic current truth. Flag conflicts or stale facts instead of guessing.

Character count: 881.

## 11. Inaccessible / partially inaccessible evidence

- A current live HTTP fetch of `www.allaroundpvc.co.za` could not be independently completed from the web/container tools in this session; current CG-maintained website `main` and its 2026-09-02 launch evidence were used instead.
- The Facebook page itself was not directly retrievable live through search/open tools. Current first-party screenshot evidence and attributable historical Facebook links are preserved in the website repo's Issue #1 / `CONTENT-SOURCE.md`.
- No All Around PVC-specific Project Source file was exposed through the connected File Library. This prevents claiming file-level Project Source changes that cannot be observed.
- Some older ChatGPT assistant outputs are only available as Project history summaries rather than full verbatim transcripts; durable user corrections and factual lessons that were accessible were captured.
- Current public address/hours/service radius, current product catalogues/spec sheets, installation operating model, delivery, warranty, price/promotion data and approved project gallery remain unverified.

## 12. Acceptance result

Completed client-specific work:
- full accessible Project history audit;
- current GitHub/architecture authority review;
- recent website/social/content audit;
- current contact/product/freshness reconciliation;
- exact Dynamics client-ID resolution read-only;
- client-specific #248 human creative/caption rules;
- dynamic SEO/hashtag rules;
- image-generation/editing rules;
- Project Source audit;
- final short Project Instructions;
- one canonical All Around PVC intelligence record.

No #241 runtime/shared architecture file was edited. No production data was mutated.

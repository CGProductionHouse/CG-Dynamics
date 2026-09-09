# CG Graphic Design / Social Poster Lane

This isolated lane defines the production standard for ChatGPT-assisted CG Production House static social design without changing CG Dynamics runtime behaviour yet.

## Continuation checkpoint

Start future sessions with [`STATUS.md`](./STATUS.md). It records current progress, CA feedback, immediate goals, known gaps and the next action so this system does not depend on one chat thread.

Supporting specifications:

- [`poster-onedrive-naming-standard.md`](./poster-onedrive-naming-standard.md) — canonical DP/file/month naming and OneDrive production structure aligned with existing CG video + Dynamics identities.
- [`staff-poster-production-sop.md`](./staff-poster-production-sop.md) — dummy-proof monthly staff workflow, including the amendment decision tree that prevents generative decay.
- [`launch-now-chat-pack-workflow.md`](./launch-now-chat-pack-workflow.md) — current normal-browser ChatGPT production bridge and batch-generation workflow.
- [`monthly-chat-pack-contract.md`](./monthly-chat-pack-contract.md) — exact launch-now handoff contract for `CHAT_ATTACH`, manifest, prompt, generation waves and clean amendment restarts.
- [`tool-handoff-gaps.md`](./tool-handoff-gaps.md) — real tested limitations between Adobe, OneDrive, Canva and the internal image generator; read this before claiming a handoff is automated.
- [`social-poster-workflow.md`](./social-poster-workflow.md)
- [`asset-usage-ledger.md`](./asset-usage-ledger.md)
- [`creative-strategy-gate.md`](./creative-strategy-gate.md)
- pilot records under [`pilots/`](./pilots/)

## Product intent

The goal is not merely faster poster output. The system must add visible client value: fresh, client-specific, human-feeling design built from canonical client truth, real client media, approved brand assets, recent creative history, and intentional content rotation.

Target orchestration:

`CG Dynamics client/schedule truth -> canonical OneDrive month + edited source -> Canva creative history -> ChatGPT creative direction + design -> internal approval -> Canva editable handoff -> publish/schedule -> usage recorded back to Dynamics`

Normal browser ChatGPT must remain a supported production surface for CA and staff. Do not make Work mode a prerequisite for routine graphic-design production.

## Existing system alignment

Do not invent poster-only content identities. Extend the existing package/deliverable system:

- `DP` — Designed Poster
- `F` — Photo
- `Video`
- `Reel`

A designed poster's human-readable production identity follows the same grammar as the established video folder convention:

`YYYY_MM_CLIENT_DP_XX`

Example: `2026_11_PIEK_DP_01`.

The immutable `monthly_deliverables.id` remains the actual Dynamics/database identity. OneDrive production names, manifests, Canva page linkage and later usage history all resolve to that one canonical deliverable rather than creating a parallel social record.

New production month folders use the canonical three-letter English month tokens `JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC`. Historical OneDrive naming drift is resolved by actual folder/durable IDs rather than silently renamed or assumed.

## Source responsibilities

- **CG Dynamics**: exact client, monthly deliverables, content schedule, client voice, services/products, restrictions, approvals, content rotation, performance learning, and eventual usage ledger.
- **OneDrive**: canonical client-owned photos, videos, logos, brand identity files, canonical `Posters/<YYYY>/<YYYY_MM_MON>/` production, edited source derivatives, plus a staff-friendly `CG Creative Assistant` helper workspace.
- **Canva**: existing CG creative history, approved visual language, editable production handoff, exact-page linkage, and current workflow stages.
- **ChatGPT**: research, media selection, strategy, concepting, copy hierarchy, art direction, design production, freshness checks, QA and rationale.
- **Adobe/Photoshop-style tooling**: preferred precision path for non-generative correction, crop, cutout and compositing of real human photography when available.
- **Internal image generation**: preferred creative engine for rich, layered poster composition when stronger than document/layout rendering.

## Non-negotiables

1. Use exact client logos/assets. Never redraw, reinterpret, regenerate, approximate, or replace a logo with an AI version.
2. Prefer real client-owned media. Generated people, premises, products, work or stock must not falsely represent a client.
3. Do not alter identity-defining human features. Professional photographic correction is allowed; identity redesign is not.
4. Temporary blemishes may be cleaned up only as a professional photographer/retoucher reasonably would. Preserve permanent traits such as beauty marks, facial structure, nose, eyes, body shape and other normal identifying features.
5. Selected poster source photos should normally be professionally edited non-destructive derivatives before they enter the design/generation batch; raw originals remain in the canonical photo library.
6. Before a new batch, inspect recent Canva work and the Dynamics content history so the result does not look like a recycled prior month.
7. Avoid repeating the exact photo, near-duplicate from the same burst/shoot, person, product/service, creative message, and design mechanism unless there is a deliberate reason.
8. A repeated service/product is allowed when requested, seasonally relevant, campaign-required, or sufficiently separated in time; the creative execution must still be fresh.
9. Parent clients with multiple brands require separate style-reference scopes. Never mix Engen/Sasol/Get Together/Piek corporate references into one generation feed simply because they share one client/Canva file.
10. Branch/location claims must come from exact current client truth. Never use one branch's photo as if it depicts another branch.
11. Use UK/South African English where the client standard requires it.
12. If a required logo/font/source cannot be accessed exactly, stop that production detail and flag the limitation rather than faking it.
13. Every poster needs a marketing reason before a visual execution: audience, buying situation, one useful proposition, proof, intended emotion, and intended action/memory.
14. Reject vague AI language that cannot explain why it exists or what response it is meant to create.
15. Design mobile-first and review the monthly batch as a grid. Brand consistency must not come from repeating one template.
16. Creative approval and production approval are separate: exact font/logo/copy/source fidelity must be verified before final/client-ready status.
17. Do not recursively regenerate failed poster bitmaps for routine amendments; classify the failure and return to exact source/strategy when a creative restart is required.

## Freshness model

Dynamics should ultimately record independent dimensions per published/scheduled static item:

- exact source media item ID;
- exact/perceptual media fingerprint;
- near-duplicate/shoot grouping;
- person usage tags or recent-person repetition flags;
- product/service/topic;
- headline/concept;
- creative mechanism/layout;
- brand scope / branch/location;
- stable production ID + canonical monthly deliverable ID;
- Canva exact design/page;
- publish/schedule record and reuse reason.

A candidate should be selected against the full set, not just whether its filename has been used before.

## Human QA gate

AI output is not accepted because it rendered successfully. Each design must be reviewed for:

- factual truth;
- exact branding;
- source-media provenance;
- human identity preservation;
- strategic purpose and headline quality;
- visual hierarchy and typography;
- readability at phone size;
- composition/crop quality;
- design depth/craft appropriate to CGPH;
- fresh concept vs recent client work;
- accidental repetition across the same batch;
- monthly grid balance;
- overall CG creative standard.

## Current integration boundary

This lane deliberately does not create a shadow client database, social calendar, or canonical media library. `monthly_deliverables` remains Client Schedule truth and OneDrive remains production-file truth. The private CG Dynamics ChatGPT connector should expose canonical client/schedule/usage/performance truth once available. Until then, pilots may use the existing authorised OneDrive, Canva and repository sources directly and must state any gaps honestly.

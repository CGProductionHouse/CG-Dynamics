# CG Graphic Design / Social Poster Lane

This isolated lane defines the production standard for ChatGPT-assisted CG Production House static social design without changing CG Dynamics runtime behaviour yet.

## Continuation checkpoint

Start future sessions with [`STATUS.md`](./STATUS.md). It records current progress, CA feedback, immediate goals, known gaps and the next action so this system does not depend on one chat thread.

Supporting specifications:

- [`social-poster-workflow.md`](./social-poster-workflow.md)
- [`asset-usage-ledger.md`](./asset-usage-ledger.md)
- [`creative-strategy-gate.md`](./creative-strategy-gate.md)
- pilot records under [`pilots/`](./pilots/)

## Product intent

The goal is not merely faster poster output. The system must add visible client value: fresh, client-specific, human-feeling design built from canonical client truth, real client media, approved brand assets, recent creative history, and intentional content rotation.

Target orchestration:

`CG Dynamics client/schedule truth -> OneDrive source media -> Canva creative history -> ChatGPT creative direction + design -> internal approval -> Canva editable handoff -> publish/schedule -> usage recorded back to Dynamics`

Normal browser ChatGPT must remain a supported production surface for CA and staff. Do not make Work mode a prerequisite for routine graphic-design production.

## Source responsibilities

- **CG Dynamics**: exact client, monthly deliverables, content schedule, client voice, services/products, restrictions, approvals, content rotation, performance learning, and eventual usage ledger.
- **OneDrive**: canonical client-owned photos, videos, logos, brand identity files, edited source media, and a staff-friendly `CG Creative Assistant` workspace for curated current/unused/used/blocked references.
- **Canva**: existing CG creative history, approved visual language, editable production handoff, and current workflow stages.
- **ChatGPT**: research, media selection, strategy, concepting, copy hierarchy, layout, photo treatment, design production, freshness checks, QA and rationale.
- **Adobe/Photoshop-style tooling**: preferred precision path for non-generative correction, crop, cutout and compositing of real human photography when available.
- **Internal image generation**: preferred creative engine for rich, layered poster composition when stronger than document/layout rendering.

## Non-negotiables

1. Use exact client logos/assets. Never redraw, reinterpret, regenerate, approximate, or replace a logo with an AI version.
2. Prefer real client-owned media. Generated people, premises, products, work or stock must not falsely represent a client.
3. Do not alter identity-defining human features. Professional photographic correction is allowed; identity redesign is not.
4. Temporary blemishes may be cleaned up only as a professional photographer/retoucher reasonably would. Preserve permanent traits such as beauty marks, facial structure, nose, eyes, body shape and other normal identifying features.
5. Before a new batch, inspect recent Canva work and the Dynamics content history so the result does not look like a recycled prior month.
6. Avoid repeating the exact photo, near-duplicate from the same burst/shoot, person, product/service, creative message, and design mechanism unless there is a deliberate reason.
7. A repeated service/product is allowed when requested, seasonally relevant, campaign-required, or sufficiently separated in time; the creative execution must still be fresh.
8. Branch/location claims must come from exact current client truth. Never use one branch's photo as if it depicts another branch.
9. Use UK/South African English where the client standard requires it.
10. If a required logo/font/source cannot be accessed exactly, stop that production detail and flag the limitation rather than faking it.
11. Every poster needs a marketing reason before a visual execution: audience, buying situation, one useful proposition, proof, intended emotion, and intended action/memory.
12. Reject vague AI language that cannot explain why it exists or what response it is meant to create.
13. Design mobile-first and review the monthly batch as a grid. Brand consistency must not come from repeating one template.

## Freshness model

Dynamics should ultimately record independent dimensions per published/scheduled static item:

- exact source media item ID;
- exact/perceptual media fingerprint;
- near-duplicate/shoot grouping;
- person usage tags or recent-person repetition flags;
- product/service/topic;
- headline/concept;
- creative mechanism/layout;
- branch/location;
- schedule slot and Canva output.

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

This lane deliberately does not create a shadow client database, social calendar, or canonical media library. The private CG Dynamics ChatGPT connector should expose canonical client/schedule/usage/performance truth once available. Until then, pilots may use the existing authorised OneDrive, Canva and repository sources directly and must state any gaps honestly.

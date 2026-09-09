# CG Graphic Design Assistant — Status

Last updated: 2026-09-09
Branch: `feat/graphic-design-social-poster-lane`
Draft PR: #312

## Why this file exists

This is the continuation checkpoint for the CG Production House graphic-design system. A future ChatGPT conversation must be able to resume the work from this file plus the linked graphic-design docs without relying on the original chat transcript.

## North-star outcome

Build a repeatable browser-chat graphic-design system that consistently produces client-approvable CG Production House social posters at scale. The goal is not merely speed. It is higher client value, better creative judgement, stronger design craft, fresher media usage, measurable learning and progressively better output over time.

The workflow must remain usable from normal ChatGPT chat for CA and staff. Do not make ChatGPT Work mode a requirement for ordinary poster production.

## Immediate goal

Produce three strong, mobile-first, genuinely designed social posters for a client using:

- real client photography from OneDrive;
- exact client/partner logos as imported assets;
- exact brand fonts and colours;
- existing Canva work as brand/creative history, not as a template to clone;
- internal image generation for richer creative composition when appropriate;
- Adobe/Photoshop-style non-generative editing for real human photography wherever identity preservation matters;
- a deliberate marketing objective, audience, emotional result and single-minded message before visual execution.

A successful immediate result should feel like CGPH staff designed it with care in Canva/Photoshop, not like a Word/PowerPoint layout or generic AI poster.

## CA feedback that is locked as system guidance

### Creative quality

- The first Piek/Engen Python-rendered pilot was too flat and document-like. It lacked gradients, effects, masking, depth and graphic-design love.
- Do not use Python/layout rendering as the primary creative route for high-love social posters.
- Use the internal image generator for richer art direction and composition; use exact source images/assets as references.
- For real people, prefer Adobe/Photoshop-style edits and compositing over generative reinterpretation where possible.
- Every poster in a batch must feel designed from scratch. A grid of the month must complement, not expose one repeated template.
- Vary headline position, image treatment, crop, visual weight, light/dark balance, composition and graphic devices while preserving brand grammar.
- Design mobile-first. Headings and key information must remain readable and attention-grabbing on a phone.
- Exact logos are never regenerated or reinterpreted.
- Exact fonts and brand colours must be used in production.

### Human-photo integrity

- Never change the features that make a real person themselves.
- Do not alter nose, eyes, facial structure, body shape, age identity, beauty marks or permanent traits.
- Professional retouching is allowed: temporary blemishes, obvious fresh scratches/redness, exposure, white balance, colour, crop, sharpness and similar photographer-grade corrections.
- When generative tools are used around a human image, preserve the real person as an imported photographic element whenever possible instead of asking the model to recreate them.

### Marketing/content strategy

Every poster must answer before design:

1. Who exactly are we speaking to?
2. What buying situation or real moment are we entering?
3. What is the one useful idea/proposition?
4. Why should someone stop scrolling?
5. What should they feel: hunger, trust, relief, curiosity, humour, urgency, local familiarity, desire, pride, reassurance, etc.?
6. What should they know/do after seeing it?
7. What proves the message or makes it believable?
8. Why is this relevant now, in this month, place and client context?

Reject vague AI-sounding lines such as abstract 'human' or 'experience' language that has no concrete meaning. If a headline cannot explain its purpose and intended response, kill it.

The system should use the CG Dynamics marketing research model:

`Business objective -> buying situation -> audience/problem -> single-minded proposition -> proof -> distinctive brand signals -> creative idea -> platform execution -> exposure/memory -> action -> verified outcome`

Do not skip from generic client info straight to caption/design.

### Freshness and repetition

Freshness must be checked at multiple levels:

- exact photo;
- near-duplicate/burst image;
- same shoot/angle;
- same person;
- same product/service/topic;
- same headline idea;
- same creative mechanism/layout.

A repeat is allowed only for a reason: client request, required campaign/service, seasonal relevance, long enough separation, or a deliberately transformed creative reinterpretation.

## OneDrive workspace direction

For every client onboarded to the Graphic Design Assistant, create a visual staff-friendly workspace under the client folder while preserving canonical originals elsewhere.

Working name: `CG Creative Assistant`.

Recommended structure:

```text
CG Creative Assistant/
  00_README/
  01_READY_UNUSED/
  02_USED_REFERENCE/
  03_BLOCKED_DO_NOT_USE/
  04_CURRENT_MONTH/
  05_APPROVED_EXPORTS/
  manifests/
```

Important: canonical originals should not be destructively moved just to satisfy this workspace. The assistant/staff workspace may contain curated copies, exports, manifests and references. Dynamics remains the eventual canonical usage ledger.

Bootstrap for a new client is a one-time historical audit:

1. inspect Canva POSTED/SCHEDULED history;
2. identify the source images used where possible;
3. match them to OneDrive exact/near-duplicate assets;
4. record unmatched legacy/external assets rather than pretending they map;
5. seed the Dynamics social/media usage ledger;
6. create the initial READY_UNUSED / USED_REFERENCE workspace state;
7. thereafter record every newly produced poster automatically.

## Universal poster naming

Use a stable human-readable naming rule tied to the Dynamics schedule slot:

`CLIENT-SUBBRAND_YYYY-MM_P##_[SHORT-TOPIC]`

Example:

`PIEK-ENGEN_2026-11_P01_SUMMER-TRAVEL`

Rules:

- `P##` maps to the exact packaged/static deliverable slot for that month;
- once-off work uses `X##` if it is outside the recurring package;
- Dynamics stores its own immutable schedule/content item ID separately;
- Canva design/page, exported file and usage ledger should all carry the stable human-readable name where practical.

## Performance-learning direction

Long term, each month should read:

- previous month strategy;
- previous visual/content mix;
- Meta/platform performance available through Dynamics;
- comments/interactions;
- boosted/paid-supported posts;
- client approval/rejection feedback;
- content that the client specifically requested to reuse or amplify.

The system should learn, but must not equate likes/views with commercial effectiveness. Use performance as evidence alongside client/business objectives and brand-building needs.

## Current technical direction

- Dynamics = canonical client/schedule/strategy/usage/performance brain.
- OneDrive = canonical client media and brand files + staff-friendly creative workspace.
- Canva = creative history, editable handoff and team production surface.
- ChatGPT internal image generation = high-design creative composition engine.
- Adobe/Photoshop-style tools = preferred precision path for non-destructive real-photo correction, cutouts, crops and compositing when available.
- Publishing/scheduling = future Dynamics action layer.

## Current known gaps

- historical media-use ledger has not yet been bootstrapped per client;
- current browser ChatGPT does not yet read live Dynamics client/schedule truth through the final private connector in every conversation;
- exact Canva-page insertion/handoff remains imperfect;
- exact fonts/logos must be materialised into the creative environment instead of substituted;
- the design QA loop needs repeated client pilots until output is consistently CGPH-level, not just occasionally impressive.

## Next action

Redo the Piek Group / Engen November pilot using the richer image-generation route, with stronger strategy first, exact photography/brand assets, mobile-first craft, and three genuinely different poster mechanisms that still work as an Instagram grid.

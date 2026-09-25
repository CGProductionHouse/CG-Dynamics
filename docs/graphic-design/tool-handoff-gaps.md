# Current creative-tool handoff gaps

Last tested: 2026-09-09

This file records product/tool limitations discovered through real Piek/Engen production tests so future chats do not re-discover or overclaim them.

## 1. Adobe edit -> OneDrive save-back

### What works

From normal ChatGPT, a real client photo surfaced as a chat file can be passed to Adobe/Photoshop tooling. We successfully tested:

- global photographic adjustment;
- subject selection;
- subject-only brightness/shadow correction;
- visual preview of the result;
- no generative reconstruction of the employee's facial identity.

The Piek/Engen source-prep pilot successfully corrected:

- Engen Northridge drone photography;
- Engen Crossing real staff photography;
- Engen Crossing convenience/store photography.

### Current gap

The Adobe image-edit action currently returns an Adobe output URL/short URL. The connected OneDrive upload action expects a mounted ChatGPT file reference/path for the bytes. Passing the Adobe output URL directly into the OneDrive upload action fails schema validation.

Therefore:

- **professional source editing is proven**;
- **automatic edited-pixel persistence back into OneDrive is not yet proven**.

Do not claim `01_SOURCE_EDITED` is automated until a supported Adobe output-download/materialisation path exists.

### Temporary safe fallback

If launch is required before the bridge exists, staff may save/export the approved Adobe-edited source and upload it to the canonical `01_SOURCE_EDITED` folder using the required DP filename. Do not replace this step by regenerating the photograph.

### Long-term target

Find a supported private handoff:

`OneDrive source -> ChatGPT/Adobe edit -> downloadable file reference -> OneDrive canonical derivative`

No public temporary hosting should be introduced.

## 2. Canva page -> physical style-reference screenshot

### What works

The Canva connector can:

- locate the exact design;
- enumerate exact page numbers/IDs;
- inspect page text;
- return private page thumbnails;
- distinguish Piek corporate / Engen / Sasol / Get Together by auditing exact pages/content;
- link exact Canva design/page back to Dynamics in the future.

### Current gap

The current connector surface does not yet expose a clean private `Canva page thumbnail/export -> mounted ChatGPT image file -> OneDrive` materialisation action in this chat.

The thumbnail URL returned by Canva is private/time-limited and is not itself the durable OneDrive style-reference file needed by the internal image generator.

### Temporary safe fallback

Keep an indexed list of exact Canva design/page IDs in the brand-scope reference folder. If required for launch, staff performs the one-time screenshot/export of the selected 3–6 pages into that folder.

This is an onboarding/bootstrap task, not monthly manual work forever.

### Long-term target

Automate:

`Canva selected page -> private image export/materialisation -> OneDrive CG Creative Assistant/02_STYLE_REFERENCES/<BRAND_SCOPE>/`

## 3. Internal image generator hidden QA loop

The current normal-browser image-generation flow does not reliably support an invisible `generate -> inspect -> score -> reject -> regenerate` loop before the first result is surfaced to staff.

Mitigation:

- strategy/prompt quality is front-loaded;
- generate the planned batch;
- `03_WAVE_1` is internal CG review;
- only failed DP IDs are regenerated from original edited source + references + revised strategy;
- accepted work stays locked.

Research target: candidate generation/scoring/retry that remains usable from ordinary ChatGPT, not Work mode.

## 4. Image generator reference ingestion

The internal image generator responds best when actual source/reference images are attached as image files in the current chat. A ZIP or remote OneDrive/Canva identifier alone is not currently equivalent.

Therefore `02_CHAT_PACK` carries both:

- portable ZIP/archive;
- `CHAT_ATTACH` individual files for staff multi-select.

Remove this manual step when a reliable direct Dynamics/OneDrive image-reference ingestion surface exists.

## 5. Canva exact finishing / page insertion

Canva remains useful for exact typography, exact logos, final production fixes, editable handoff and creative history.

Current promising handoff: image-to-design / Magic Layers can attempt to separate a strong flat external social design into editable elements.

Still requires production testing for:

- exact font fidelity;
- exact logo replacement;
- large-batch reliability;
- clean insertion into the existing per-client marketing design/page workflow;
- preserving the stable DP identity on the exact Canva page.

Do not position Canva's AI generator as the primary CG creative engine unless later testing materially improves its art-direction quality.

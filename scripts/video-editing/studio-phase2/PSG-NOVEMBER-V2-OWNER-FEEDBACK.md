# PSG November V2 — withdrawn failure record

25 October 2026, issue #872 / draft PR #875. **OWNER REJECTED V2. WITHDRAWN FROM REVIEW.** This file records why the private render failed and must not be used as a PSG concept, approved film or music/graphics reference. V1 and V2 remain preserved in ignored `output/psg-872/` only as failure evidence. Apply the [editorial continuity gate](NOLAN-EDITORIAL-CONTINUITY-GATE.md) before any new source or story decision.

## Subsequent owner verdict overrides the V2 construction notes below

1. **Repeated soundtrack:** V2 used Mixkit asset 32, the same cue used in the posted October PSG film. A different source in-point did not make it new. The owner had already rejected asset 580. Neither is eligible for the redo.
2. **Repeated visual cluster and poor moment selection:** the `0L8A0554.MP4` team insert belongs to the same recognisable April 2025 office/table session as the posted film. The private preflight had already warned against neighboring office takes. Other nearby takes contain awkward rising/reaching gestures. A different file or shorter crop does not fix a reused setting or failed performance; only a screened, contextually useful moving moment from a distinct approved source can pass.
3. **Weak explanatory graphic:** the four-topic wheel was a crude static-looking board despite licensed imported icons. Its design and hierarchy did not meet the owner's professional-graphics requirement. Do not reuse it or present an animation/decode check as design validation.
4. **Wrong ending:** V2 substituted a staged/static brand card for the required official PSG animated logo outro. The official animation already exists in the client package, with a proven portrait adaptation in the approved October project.

The owner should not be asked to review another export until the source, concept, cue, graphic treatment and logo are screened against the established Nolan workflow. This is a correction to the earlier optimistic wording below, which is retained to show the actual failed construction.

## Owner feedback, retained as an edit constraint

The owner rejected V1's **Mixkit “Sun and His Daughter”**: it sounded like a Viking ritual and had been disapproved before. The decision to reuse it was a sound-selection failure; its passing decode, LUFS and peak checks did not establish creative fit. Do **not** use this track again for PSG. Owner also found the solid blue `BEFORE` opening distracting, the word unconvincing, the script insufficiently intentional, the captions too static and punctuated with full stops, and the film boring too quickly. They want the real PSG team, especially the short-haired blonde woman, to feature; more motivated effects and animated explanation; professional imported assets rather than improvised icons; and a specific feeling and action that makes a potential client contact PSG. These are durable directions for subsequent PSG revisions, not one-off comments to discard after a render.

## Buyer intention and V2 story

**Viewer:** a local grower considering the next planting season. **Feeling:** recognise a timely planning decision, see a real local PSG person who can discuss it, and feel that contacting the office is a practical next step. **Single action:** phone PSG Donald Murray at **051 813 9300** to discuss crop insurance. This is a conversation invitation, not a promise about hazards, payouts, cover or eligibility. The number was checked against PSG's public Donald Murray adviser profile; current client approval is still needed.

Hook A was `PLAN` revealing planting footage against the same moving field, with “Before you plant / plan for the season” as the follow-through. Hook B was “What will the season bring?” Rejected B because the owner and prior VIDEO APPROVALS feedback already ruled out another repetitive question-led opening. V2 uses A. After the hook, an animated planning wheel names **CROP / AREA / INPUTS / RISK** as discussion topics, then a moving PSG team shot connects the abstract planning idea to a human adviser, followed by crop/work/weather footage and a direct phone CTA. The wheel does not enumerate insurance products or imply those are covered perils. All on-screen captions omit terminal full stops.

## Actual protected revision

Private ignored project: `output/psg-872/v2/`. `render_v2.py` is the repeatable one-off source and does not write to the V1 file or any client original. Output: `PSG-NOVEMBER-STUDIO-REVIEW-V2.mp4`, SHA-256 `0255ceb0e4c56eba82e6d603ece9cbfef5e0a73b44c4e5ae7f1129faec3231a7`.

| Film time | Editorial role and source |
|---|---|
| 0–2.2 s | `PLAN` footage-in-type over dimmed moving planting footage, Adobe Stock 1553691006; no solid blue opening |
| 2.2–5.5 s | Continued planting shot, practical planning message |
| 5.5–10.3 s | Crop-geometry shot, animated four-topic wheel using imported Lucide SVG icons |
| 10.3–14 s | Real blonde PSG team member and colleague, local raw `0L8A0554.MP4` at 1.2–4.9 s, rotated upright |
| 14–17.2 s | Wheat/work detail, “What you grow matters” |
| 17.2–21 s | Weather/field, crop-insurance invitation |
| 21–24 s | Farmer/field illustrative stock, PSG conversation turn |
| 24–30 s | Moving planting shot under staged PSG Insure brand, topic and office-number reveals |

Lucide icon sources are the official repository's `sprout`, `scan-line`, `coins`, and `cloud-sun` SVGs, rasterised locally with a separately isolated headless Chrome profile. Lucide's [ISC licence and notice](https://lucide.dev/license) are preserved as `v2/icons/LICENSE-LUCIDE.txt`. This is a free licensed import, with no plugin installation or new production dependency. The source Adobe clips were recorded as licensed free assets for the November job in Nolan's private source audit. The team take is a different raw file from the posted October edit, but **the same April 2025 office/table scene family is visibly familiar**. The brief's wish for fresh team footage remains only partly met; do not tell PSG this is a new shoot or wholly unseen team scene.

V2 removed the rejected 580 cue. It uses **“Driving Ambition” by Ahjay Stelino, Mixkit asset 32**, from a different 15-second source in-point. This cue was used in the approved October film, so repetition is an explicit weakness, not a creative win. The source and licence record remain in the PSG client's `audio/AUDIO_INDEX.md`. The chosen 30-second excerpt and picture/sound fit **have not been heard by an independent editor**; objective audio QC cannot turn this into an approved soundtrack. No camera sound from the PSG office conversation is implied in this music-backed cut, and no fake farm ambience was added.

## Verification and open gates

- **Witnessed technically:** output H.264/AAC, 1080×1920, 30 fps, 30.000 s; full FFmpeg decode passed; 17 sampled moving-film frames were inspected at phone proxy size, including the woman, four wheel highlights, and final CTA. The final end card reveals logo, proposition and number in staggered stages.
- **Audio technical only:** 48 kHz AAC; measured approximately −16.26 LUFS integrated, −4.26 dB true peak, 2.60 LU LRA; no ≥0.25 s interval below −45 dB reported by silence detection. These checks do not judge the cue's mood, loop or phrase ending. The owner already identified why that distinction matters.
- **Unverified:** normal-speed picture and actual headphone/phone listening by an independent editor; client approval of crop-insurance wording, local number/CTA, team likeness and office take; staff-editable native handover; true freshness of team coverage; final music selection. Keep this private and PR draft, do not publish or send to PSG.

## Historical next-decision note — superseded by owner rejection

The previous text suggested V2 could be compared for possible approval. The owner has now rejected it. Restart source and story selection from the posted-content audit and live client context. Do not rework V2 merely by swapping music, hiding the office scene, or adding the logo. Record exact moving-footage in/out ranges and rejected neighbors, independently hear the final soundtrack, and use the official animated logo in any later eligible edit.

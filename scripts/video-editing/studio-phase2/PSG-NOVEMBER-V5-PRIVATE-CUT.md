# PSG November V5 — corrected person beat, still private

25 October 2026. Issue #872; draft PR #875. This protected local revision replaces one misleading shot in V4. It is **not an approved November film or a staff-editable handover**.

## What changed

At 16.17–18.50 s in V4, the July raw take `0L8A1828.MP4` showed the short-haired PSG adviser visibly addressing the camera while her speech was muted. A 4 fps contact of the exact 2.33 s source range confirmed sustained mouth movement. Paired with unrelated crop-insurance copy, the shot could falsely imply that she delivered this message. Technical decode and a pleasant still frame had missed the editorial problem.

V5 uses the same person's earlier `0L8A1826.MP4` at source **0.90–2.30 s** as a brief PSG identity beat. A 4/8 fps source screen and seven rendered samples show a natural smile and transition into movement before the apparent speaking section. It is cropped closer in the 9:16 film, with `PSG / DONALD MURRAY` appearing earlier to fit the 42-frame beat. The 28 freed frames extend the following clean crop shot. The total remains 900 frames. The July location must not be presented as a farm visit or current crop-insurance testimonial. The final range still needs a full-speed human check for a stray lip movement or awkward down-glance.

All other picture choices, copy and the official animated logo remain as in the [V4 record](PSG-NOVEMBER-V4-PRIVATE-CUT.md). The V5 one-off recipe and exact source receipt are in ignored `output/psg-872/v5/`; the original V4 and all client media were preserved. V5's private MP4 SHA-256 is `8eac6f900d3413ad04adb1191ef2b835eff81fccacd3e860ae3412bdd9669aea`, 49,660,725 bytes. FFprobe counted **900 decoded H.264 frames**, 1080 × 1920 at 30 fps, exactly 30.000 s, with AAC audio; a complete FFmpeg audio/video decode returned no error.

## Exact sound gate

The V5 export retains the distinct Mixkit 85 *Break Away* music-only mix, including its unchanged 11–41 s source range. The exact-export `audio_review.py prepare` packet is stored privately under `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\PSG-Nov-V5-audio-review`. Signal QC measured **−17.03 LUFS**, **−4.79 dBTP**, and no detected silence. These measurements do not assess musical fit.

A separate signed-in **CG company** Google AI Studio temporary tab accepted an upload of only V4's licensed music-only `Mix.mp3` (no client picture, voice or text; no API key, upgrade or payment). Running a neutral music critique returned **“Failed to generate content: permission denied” / “The caller does not have permission.”** There is no model listening response to use. The model was not rerun through another account or paid route. A local attempt to present the exact V5 mix through the tool's audio content channel returned **“audio content omitted because you do not support audio input.”** No human/editor listening verdict was obtained, so do not claim the sound passed or that the owner should review another blind music choice.

## Remaining acceptance gates

- **Creative picture and sound:** watch the complete V5 film at normal speed on a phone and listen on headphones/speakers. Check whether the shortened staff shot feels natural, whether the stock-to-PSG shift is credible, whether the track evokes the right crop-insurance mood, and whether the end phrase resolves with the official logo. The browser's local `file:` video open was explicitly blocked by its URL security policy; no alternate browser workaround was used.
- **Staff editability:** the repeatable Python/FFmpeg recipe is source-editable for this research lane, but no saved/reopened native Premiere/CapCut project with separate titles and sound was made. Nolan's active project was untouched.
- **Business release:** verify current adviser likeness/role, number, wording, exact November job state and internal/client approval. October's posted sources and rejected music remain excluded; older-month reuse was permitted by the owner but does not equal endorsement of this particular take.

**Decision:** V5 fixes the identified false-dialogue problem in the private candidate. It does not clear the film for owner/client delivery. Preserve this failure and await a conflict-free independent visual/audio audition and native handover rather than treating a clean render as creative acceptance.

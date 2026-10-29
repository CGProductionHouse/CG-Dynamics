# Photo-studio exposure cut screen — office background study, 29 October 2026

This advances the existing [exposure-flash-transition card](skills/exposure-flash-transition/SKILL.md) in draft PR #910. It is a silent, stock-source experiment, not a client edit or an approved transition. No visible desktop application, paid service, client media or storage worker was used.

## Source and rights

The [Mixkit #50635 camera-lens/photographer clip](https://mixkit.co/free-stock-video/view-of-a-camera-lens-held-by-a-photographer-50635/) and [Mixkit #50627 studio-model clip](https://mixkit.co/free-stock-video/model-poses-as-camera-lights-flash-in-a-studio-50627/) each show the Stock Video Free License for commercial/personal use on their item pages. Their actual 720-tier files are respectively 3,545,412 and 3,292,819 bytes, with SHA-256 `CF83E51E7B8E0C0F2F1A19752F6C13B3A15C479D3C511494FA920E5332EB79B3` and `DCE6CF2BC9F4E4FDA7B1FA286C5EE4C2B6343AED5D4D52087B3`. Both are upright 1280×720, 24000/1001 fps, silent video; the decoded sources contain 218 and 221 frames. Full-source contacts and exact flash frames were inspected before choosing windows. The two shots share a photographic-studio subject, but the footage does **not** verify that this photographer and model were filmed together. Do not imply one continuous session or a documentary event.

The photographer source has a real one-frame strobe peak at source frame 143. The model source peaks at frame 59. The private originals, scripts, contacts, QA JSON and rendered MP4s live under `work/research-continue/photo-flash/`; only this evidence is committed. The picture stays landscape and upright before any effect. There is no invented white frame or licensed sound.

## Controls and protected revisions

Six 960×540, 24000/1001 fps, 76-frame H.264 outputs fully decode. Each was inspected in an ordered contact at output frames 0/25/31/32/35–40/45, with separate full-size natural-cut frames 35–40. The decoded frames advance from the source windows without an inserted still. Constant-QP all-intra encoding permits exact comparison of decoded protected frames in this experiment; it does not prove general editor or codec behavior.

| Private output | SHA-256 | Source windows and finding |
|---|---|---|
| `early.mp4` | `02ebdec6b6dba464c40de97bc933ce8e1489f3bc500120d97ed140c5e8dc9856` | Photographer 106–137, model 53–96; cuts six frames before the model flash. The model plays dark, then flashes. Weakly motivated as a flash *cut*. |
| `natural.mp4` | `57abd305c148efc50df53dfeb8121690b44331f1e383f161d59a961b38c4002e` | Photographer 106–143, model 59–96; cuts at output 38. Two photographed bright frames land consecutively at 37–38, about 83 ms total. Plain picture control. |
| `pulse-r01.mp4` | `79d64cf4cdb009fe4fc42db399f32365db95ecbc62b8154c8f0ed63a1af2a40d` | Adds 4%/12% gain around the same cut; **reject** for clipped detail. |
| `pulse-r02.mp4` | `260e319ec5883ea71f43d8004b73ca768c1c9cf34c2fc1d5e8a01aaf2c4203d7` | Protected revision: first 36/36 frames equal R01, with just 3% gain on 37–38. **Reject**: even this raises near-white clipping. |
| `single-incoming-r03.mp4` | `4e644dfe2cab78ef6336c011d519b0f93e50aa0dc3c8d8eeeb3bd789af451fd5` | Photographer 106–142, model 59–97; cuts *onto* the model's actual strobe at output 37. First 37/37 decoded frames exactly match natural. One bright frame; the incoming model is visible in the flash. Best bounded candidate, not approved. |
| `single-outgoing-r04.mp4` | `ec57093b16ff235675720667fb67a8de7396d52544babb984528aa8bd5ed0cb1` | Photographer 106–143, model 60–97; cuts *after* the photographer flash. First 38/38 frames equal natural. One bright frame, but it belongs to the outgoing photographer and the incoming model arrives dark. Less legible as a model reveal. |

The natural frame 37 has grayscale mean 187.22, 27.83% of pixels at or above 235, and 0.14% at or above 250. R01 raises its ≥250 fraction to 31.02%; R02 still raises it to 26.42%. On natural frame 38, ≥250 is zero, versus 9.95% in R01 and 4.81% in R02. This is measured encoded-picture damage, so neither added gain is a usable default. R03 retains the model's original frame-59 flash without any added exposure; only 5.2% of its output frame 37 is ≥235 and none is ≥250. R04 preserves the much broader photographer flash (27.83% ≥235) instead. Adjacent full-picture mean-absolute difference around R03's handoff is 125.42 then 129.94 gray levels; a single bright frame remains a substantial jump. No brightness metric by itself certifies comfort or narrative quality.

The picture evidence supports a source-led one-frame flash cut as a *candidate* and rejects overlaid exposure gain for these already flashing sources. The normal-speed, physical-phone, accessibility/comfort, heard cue, client-story, native Premiere save/reopen/export and second-editor relink gates remain open. The 45-family library remains unmastered; this screen adds one existing-family study and six unique outputs, not a new skill family.


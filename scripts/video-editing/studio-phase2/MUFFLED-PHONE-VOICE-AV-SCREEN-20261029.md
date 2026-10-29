# Muffled voice against licensed moving phone picture — 29 October 2026

This is an existing [muffled-perspective family](skills/muffled-perspective/SKILL.md) background screen under [PR #910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), #874 and #903. It is a technical picture/signal comparison, not an approved phone-call scene. No client media, upload, paid credit or visible desktop application was used.

## Source and rights

[Mixkit #42630](https://mixkit.co/free-stock-video/copying-from-a-cell-phone-to-the-computer-42630/) explicitly offers this 10-second phone/laptop stock clip under its Stock Video Free License for commercial or personal use. The local original hashes `0B1F1EC15A30B59FA06240B03ADAD50E3F6CEF38EC6A3A8D8587D983644A7418`, 251 frames, 1280×720, 24000/1001 fps. The study reuses the already checked portrait controlled-screen derivative `keyed-plane.mp4`, hash `c409f83f3181b2381dde70511d7cac820fd282bc57fa5a316bbbd3c3d7efeb91`; its artwork is original local test art. It copies the first 120 synchronous frames (540×960, 5.005 s) without picture retiming. The private source and results live under `work/research-continue/muffled-phone-av`, outside Git.

The voice is the library's original local Windows SAPI synthetic WAV, hash `0f450927a2aec5e2a451391235da19520996957ffc0ce4468b1602287b13a2bc`, speaking “Listen to the room. Then step outside.” It is neither the photographed person's voice nor client narration. The stock clip has no production sound.

## Plain control and protected variants

`render.py` preserves the same 120-frame H.264 picture in three private AAC MP4s: dry, 600 Hz second-order low-pass, and 1,600 Hz second-order low-pass. The 48 kHz mono voice starts at 0.60 s. The processed versions ramp from dry at 1.35–1.48 s, remain filtered until 3.20 s and return to dry by 3.34 s. Working PCM samples before 1.35 s and after 3.34 s match dry exactly. The source screen and voice were separately pinned by SHA before processing. An initial `-shortest` mux produced only 117 picture frames and was rejected; the repaired mux has 120.

| Output | SHA-256 | Decoded picture vs dry | High band 2.5–7 kHz vs dry, 1.6–3.1 s | First AAC difference |
|---|---|---:|---:|---:|
| Dry | `08548467e94e9d3d3586f6aeca53b59fa57ddfb33acd68fbe99ffca00568f0a4` | baseline 120 frames | baseline | — |
| Heavy 600 | `3ad6b0a4bfda9c0269005adaa985efa4d7c98e2703ce55d508d20860f3cf4748` | 120/120 exact | −59.75 dB | sample 63,505 |
| Restrained 1600 | `15b88c48223b7219ab7bdc9e3ba53c178a4f5c89580cee6938809a2090aa82c9` | 120/120 exact | −26.72 dB | sample 63,503 |

All three fully decode to 120 upright moving frames at 24000/1001 fps and 240,240 mono audio samples; mean adjacent decoded picture difference is 2.237 levels. Frames 12, 40, 75 and 110 were inspected in a contact sheet for each output; phone rim, hand, device text and changing laptop/hand position remain legible. Encoded AAC begins changing about 1,297 samples before the 1.35 s control boundary, so **encoded protected-prefix equality fails**; 63,488 of 64,800 samples match exactly. Sample peak is −3.84 dBFS in each decoded stream. No true-peak or loudness acceptance was measured here. Private `qa.py`, `qa.json`, PCM controls, frame contact and MP4 hashes retain the evidence.

## Decision and remaining gates

The heavy filter is rejected as a reusable voice setting: its measured high-band loss is extreme. The 1,600 Hz version is only a restrained technical comparator. The picture displays “FIELD NOTES / MAKE SPACE,” not a call, voice note or doorway; no visible action motivates the filter onset. Thus **story/perspective gate fails for both variants** even though the mechanism is measurable. The source remains a good phone-surface technical control, not a credible filmed phone-audio narrative. A future cleared scene needs an actual speaking/listening perspective and a visible timing cue, dry comparison at matched level, human listening for consonants/pumping on headphones/speakers/physical phone, and verified native editable automation with current project/output state. This screen does not resolve the separate native EQ export-state mismatch, demonstrate hearing, or establish creative mastery.

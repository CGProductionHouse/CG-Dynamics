# Daisy & Co November R04 — stabilised amendment

27 October 2026. This protected R04 responds to the exact 17:32–17:34 CG Nolan Approvals feedback on R03. The owner liked the new storefront intro but flagged an upside-down sweets shot, unstable red homeware camera movement, and a rushed last store clip saying `PRELLER SQUARE` instead of `DAISY & CO`. Their direct instruction makes stabilisation a default for ordinary footage, with an exception only for an intentionally rough sport/action beat and motivated transition. Nolan acknowledged the amendments in the group at 17:37. R03 and all originals remain intact.

## Picture decisions

| R03 issue | Protected R04 correction | Evidence |
| --- | --- | --- |
| `199A5403.MP4` packaged sweets appeared upside down | Replaced with upright `199A5392.MP4` floral-cookie take, source about 0.08–1.71 s at 0.65× for the same 75-frame sweets slot | Full-size 10.6 s R04 frame and one-second whole-film contact checked; no upside-down label/bag remains |
| `199A5416.MP4` red pots drifted into a rapid camera move | Used only source about 0.15–1.67 s, slowed 0.60× from 50 fps to the 30 fps sequence; rejected the 2.1–4.3 s camera whip | Dense source contact across 5.6 s and plain-versus-stabilised 0–2 s output strip reviewed; 13.5 s export frame remains upright and in frame |
| Last Daisy store clip too brief, with `PRELLER SQUARE` title | Extended `199A5418.MP4` from 76 to 105 frames (2.53→3.50 s), 0.60× from the 50 fps source; changed title to `KOM LOER IN / BY DAISY & CO` | Full-size 24.1 s export frame and contact through the title-to-logo handoff reviewed |

All **nine ordinary Daisy camera selections**, including the storefront source under the designed opening, were oriented per source, trimmed, and processed with FFmpeg's existing `vidstabdetect`/`vidstabtransform` filters (`shakiness=3`, `accuracy=15`, `stepsize=6`, `smoothing=12`, `optzoom=1`, `zoom=2`). Each has a separate private source/rotation/in-point/speed/frame-count JSON, `.trf` and oriented control in `private-repurpose-v4/r04-cut/`; see [render_r04.py](daisy-november-repurpose/render_r04.py). Stock, graphic layers and supplied logo were not falsely described as handheld camera footage. The red-pot control and stabilised strip show less drift without a black border or gross crop. The stabilisation remains baked into this review MP4; the originals and settings are preserved for staff retuning. No rough-action exception was used in this film.

The approved Romantic 03 music, action-linked effects, yellow/white text and official picture-only logo remain. The proposed caption now invites viewers to Daisy & Co by name and makes no promise about exact present stock. The photo-led HD cover is the unchanged R03 artwork, versioned with the new package; the owner did not request a new cover.

## Export and internal delivery

The exact private MP4 is `C:\Users\chris\Videos\CG-AI-Editing\Daisy-Nov-2026\private-repurpose-v4\r04-cut\r04-package\2026_11_DAISY_VIDEO_01_SE_DANKIE_R04.mp4`, 20,765,912 bytes, SHA-256 `39FAF996F5FB53141B5D7BF9A4AC1D1E0057DB425F3DEBA816369D65DE786B9C`. It is 1080 × 1920 H.264/AAC, 924 video frames, 30.846 s. Full FFmpeg decode passed. EBU R128 measured about −14.6 LUFS integrated and −4.0 dBFS true peak; no silence longer than 0.2 s below −43 dB was detected. The full one-second contact and selected full-resolution frames were inspected. These are picture and signal checks, **not** an independent normal-speed creative sound verdict or physical-phone test.

At **17:45 SAST**, the exact CG Nolan Approvals group received the R04 MP4 as a **document with only the proposed post caption**. At **17:46**, the unchanged cover was sent separately as a caption-free photo with WhatsApp **HD 1440 × 2560** selected. A separate Nolan note marked R03 superseded and requested review before client forwarding. The video message-info panel showed delivery to Amonique, KG and Sydney with two remaining; the cover panel showed Amonique read at 17:47, KG/Sydney delivered and two remaining. The row status was still `Sent`. Do not claim every participant received/read it. This is internal review only, not client/public approval.

## Remaining gates

Independent normal-speed sound/picture judgement and physical-phone playback remain unwitnessed. Selected product/current-stock suitability, complete Facebook/Instagram publication comparison through November and staff-native editability remain open from R03. No client or public message was sent. Do not resend R03 or forward R04 externally on technical decode alone.

# TBS November equipment cover V5 — internal review handoff

26 October 2026, 18:10–18:11 SAST. V5 supersedes the rejected short V3 and the private V4 proof. The withdrawn general advice and farm edits remain withdrawn.

## Actual delivery

- The named `2026_11_TBS_VIDEO_01_EQUIPMENT_COVER_V5_REVIEW.mp4` was sent **as a document** to the exact `CG Nolan Approvals` WhatsApp group, with only the proposed post caption in the same document message. The group showed **Delivered** at 18:10.
- `2026_11_TBS_VIDEO_01_EQUIPMENT_COVER_V5_COVER.png` followed as a separate **caption-free photo**. The group showed **Delivered** at 18:11. Source image is 1080 × 1920. WhatsApp's HD toggle reported “This media is not HD resolution”, so the photo was sent without that toggle. Do not claim WhatsApp HD transfer; the private original remains at full resolution in the review package.
- A separate `From Nolan` note at 18:11 asked the team to check full-speed picture/sound and compare the seated adviser moment against the July TBS public reel before client forwarding. It showed **Delivered**.
- This is internal review, not owner, client or public approval. Do not resend unchanged media.

## Protected package and exact result

Private folder: `C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\review-package-equipment-v5`. It holds the named MP4, PNG cover, `proposed-caption.txt`, source ledger, protected render/mix/cover recipes and `README.md`. Media stays outside Git. The named MP4 is byte-identical to the protected V5 mix, SHA-256 `CA136C7E09E1538E8D0811E87A67CD505AE94B8F2F96E21ACF610BC876079471`.

V5 is 29.500 s / 885 frames / 1080 × 1920 / 30 fps / H.264 and stereo AAC, with exactly two streams and complete FFmpeg decode. The visual story is added/replaced/upgraded equipment, a three-part equipment/value/use checklist, upright real TBS sign, original-speech adviser CTA and supplied picture-only logo. The stock work scenes are illustrative, not represented as TBS customers. B-roll camera sound was muted; music and selected licensed effects continue through the official logo. Cut points follow the verified 80 BPM music phase within half a frame. No detected ≥0.25 s silence below −45 dB. These are technical checks, not an independent listening verdict.

## Open review gates

An additional read-only [first-three-second screen](VISUAL-HOOK-FIRST-SECONDS-20261026.md) found that the exact delivered V5 export's first ten seconds decode around −27 to −31 dBFS RMS per two-second window, versus roughly −19.5 dBFS at 12–16 s. This may be an intentional build, but the opening could feel quiet on a phone. No creative listening occurred. Include the opening level and sound transition in the independent full-speed review; do not silently normalize or resend the already delivered file from this measurement alone.

A 27 October **whole-film still-frame screen** of the same protected export, sampled every 1.5 s and more densely from 17.0–20.2 s, confirms the checklist composite at 16.767–20.500 s reuses the table-saw picture from 0–2.500 s and coffee-machine picture from 4.767–7.000 s within this same film. The checklist adds new information (`EQUIPMENT / VALUE / USE`), but the second appearance adds no new photographed action. At a 270 × 480 proxy, the three rows finish by about 19.4 s and hold through about 20.2 s. This is an **editorial repetition and energy review gate**, not proof that the scene is wrong: staff should watch the whole section at normal speed before approving or deciding on a new V6. Private contacts are `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\tbs-whole-film-screen-20261027.jpg` and `tbs-checklist-20261027.jpg`; no client picture was committed. The current delivered file was not changed or resent.

A separate source-inpoint screen compared the opening Mixkit carpenter take at 1.0–3.5 s (the V5 select) with 5.0–8.5 s of the same original, in half-second frames. The earlier select keeps glove, board and saw blade in the portrait frame as the board advances; by the later range the hand and active blade relationship moves toward the edges. This **supports retaining the current in-point over a blind later shift**, despite the film's other energy questions. Private contact: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\carpenter-action-select-20261027.jpg`. It is sampled picture evidence only; it does not establish a full-speed hook or validate the stock saw sound.

**27 October sound-design level audit:** The protected `mix-v5.py` cues were decoded from their actual licensed local sources at the script's gain and timeline offsets, in mono at 48 kHz, and compared with the same-length music windows before the final limiter. RMS is a diagnostic, not a listening verdict; a short sound may be perceptible even when its window RMS is lower. The comparisons expose a concrete balance risk:

| Cue and time | Cue RMS | Music RMS | Cue below music |
| --- | ---: | ---: | ---: |
| Saw at 0 s (first 1.5 s) | −26.6 dBFS | −31.9 dBFS | cue is 5.3 dB **above** music |
| Keyboard at 10 s (1.5 s) | −60.5 dBFS | −31.0 dBFS | 29.5 dB |
| Three checklist clicks at about 17.57/18.32/19.07 s (0.3 s each) | −36.3 dBFS each | −17.4/−17.9/−16.6 dBFS | 18.4–19.7 dB |
| Slide into sign at 20.35 s (1.2 s) | −52.0 dBFS | −17.4 dBFS | 34.6 dB |

The keyboard and slide also have lower **sample peaks** than the coincident music (keyboard −32.9 versus −14.8 dBFS; slide −29.4 versus −6.3 dBFS). This does not prove they are inaudible after mixing, but it undermines a claim of consistently present transition sound. Staff should specifically hear the keyboard, three list ticks and sign slide on headphones and a phone, then choose whether to rebalance or remove weak cues in a protected V6. Do not simply raise all effects by one preset amount; preserve the strong early saw, adviser intelligibility and true-peak/mono checks. The exact delivered V5 was not changed or resent.

**Protected sign-slide A/B, 27 October:** To make the sound question reviewable, a 1.700 s excerpt starting at V5 timeline 20.35 s was rendered twice from the same picture, the same Mixkit music at source 20.60 s and the same 1.2 s slide sound. The sole mix variable is the slide gain: V5's `0.085` versus a test `1.2` (the latter puts the source's nominal window RMS about 11.6 dB below the music, instead of 34.6 dB below). Both private H.264/AAC 540 × 960 / 30 fps excerpts fully decode, contain exactly video plus audio after removing an incidental timecode data stream, and have byte-identical decoded video frames. Current versus candidate measure −19.3 versus −18.6 LUFS and −6.9 versus −3.1 dBTP over the short excerpt. The clean A/B files and hashes are outside Git in `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs`: `tbs-sign-slide-current-clean.mp4` (`EBCECF9FD82DC066CA31A47AED02894B3CA9059B8EFFA3ECF634BFB3BFC1BA7C`) and `tbs-sign-slide-candidate-clean.mp4` (`783F6CCA88B3283DD04E9A9011CDFD7A65CC3306923B179BAF976ACF1B9E0E80`). **Do not treat the louder candidate as approved:** no one in this lane heard either excerpt, and the full-film balance, sound identity and phone impression remain open. Staff can compare the two at matched playback level before deciding whether a V6 should change or remove this one cue.

- The visible seated adviser setup matches TBS's [20 July public reel](https://www.instagram.com/reel/DbC5UQ1kXml/). The new equipment-cover story is different; exact picture/audio reuse remains unverified. Staff must compare before client forwarding. The older shot is **not** described as unused.
- Full-speed human picture and headphone/phone sound review, creative effects/music fit, client/owner approval and native editor timeline editability are unproven. The private Python/FFmpeg recipes and source ledger support revision, but they are not a Premiere or CapCut project.
- The WhatsApp image was a separate 1080 × 1920 photo, but the service did not offer its HD mode for this image. If the team needs the uncompressed cover, use the private original or send it as a document in a separate approved handoff; do not silently substitute that for the requested photo format.

Next: await concrete CG Nolan Approvals amendments, address them in a protected V6 if needed, then reconfirm full-speed review and publication reuse before any client forwarding.

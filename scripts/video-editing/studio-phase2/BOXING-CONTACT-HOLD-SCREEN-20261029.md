# Office background screen — contact-frame hold on portrait boxing stock, 29 October 2026

**Existing family:** [fight contact punctuation](skills/fight-contact-punctuation/SKILL.md). This is stock research only. It does not touch the MSI Fight project or establish a real event hit, client rights, heard impact or creative approval.

## Source and selection

- [Mixkit #40974, two men fighting in a boxing ring](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/) lists the Stock Video Free License for commercial/personal use. Private source `work/research-continue/fight-vertical/mixkit-40974-720.mp4` SHA-256 `938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634`, 720×1280, 24000/1001 fps, 336 frames, no audio stream. The earlier [portrait framing screen](FIGHT-PORTRAIT-FRAMING-SCREEN-20261029.md) rejected added crops on this source; this study keeps full original framing.
- Source frames 126–146 were separately screened frame by frame. A red glove appears against the blue-gloved fighter's cheek/neck around frames 127–135; his eyes close and head/hair move through frames 134–140. This is an **apparent contact** in stock footage, not an independently verified event strike. Source frame 134 was chosen for the hold because glove, face and reaction coexist. The source movement already looks slow; repeating it may create an obvious stall.

## Plain and protected revision

`work/research-continue/fight-contact/render.py` takes every original source frame 104–175. The plain control stays 72 frames. R01 adds two copies of source frame 134 after the original, then resumes frame 135 and retains all later source frames (74 output frames). R02 reduces that to one added copy (73 frames); no original frame is omitted. Both insertions therefore lengthen the shot by 83.4 ms or 41.7 ms respectively rather than stealing its response. This is a same-source picture-only comparison; there is no new sound effect.

| Private output | SHA-256 | Decode |
|---|---|---:|
| `contact-plain.mp4` | `c1ae93ab0dd70bf5baa242e81e4c1be0577a063d3b73e49b8dcc9f72acc3c74a` | 72/72 |
| `contact-hold2.mp4` | `25ea043e219796bfb8bce7b8a8f8767b8bb37d502fb79a5d0d0c8b71f0d16d03` | 74/74 |
| `contact-hold1-r02.mp4` | `57885d958974b3c365817ed18692294464872217712c0805b2a3da3a0593ab06` | 73/73 |

All three have a pixel-identical 31-frame decoded opening through the selected source frame 134. Private `inspect.py` decoded the entire exports, compared adjacent motion around the hold and produced `decoded-contact.jpg` covering output frames 25/28/29/30/31/32/33/34/36/40, plus full-size decoded contact frames. In the plain version, the minimum adjacent-frame mean absolute RGB difference over output steps 27–37 is 8.759 levels. Each hold reaches 0.357 levels at the repeated frame (codec residual), a conspicuous near-static step. The full-size plain frame confirms the glove/face relationship; the contact sheet shows the reaction is continuous in the control while R01/R02 delay it.

**Decision: reject both holds for this shot.** R02 is a protected technical improvement over R01 but still creates a pause in a slow-looking, silent close-up, and no heard impact or normal-speed physical-phone review supports it. The plain shot is the stronger candidate for this stock test. The correct next gate remains genuine event footage with verified chronology/contact and original sound, then a same-sound normal-speed/phone comparison with the untouched shot. No native project, staff reopen, client trailer or mastery claim follows from these decodes.

# Grounded freeze frame — dog and clean plate screen

29 October 2026. This background-only office test checks whether a real subject can be held against an empty frame from the **same** shot while retaining a convincing contact with its support. It is a source-specific screen, not an approved effect or editable client asset.

## Source and rights

The exact [Mixkit #1555 dog standing on a log](https://mixkit.co/free-stock-video/dog-standing-on-a-log-1555/) item page identifies its download as Mixkit Stock Video Free License for commercial and personal use. The private 720 × 1280, 24 fps, 388-frame source hashes to SHA-256 `847340F0C58031EBD55026B26853A992C8D611815678ED78749639A3C878412B`. It has no audio. Source frame 312 gives a lifted front paw and visible rear-paw/log contact; frame 387 is genuinely empty. Frame 373 still contains the dog's rump and is **not** a clean plate. The camera and background are nearly locked: the upper-region mean pixel difference from frames 312 to 387 is about 0.86 on an 8-bit scale.

## Bounded controls and revision

Private scripts and media are under `work/research-continue/grounded-freeze-dog/`; none enter Git. `render_ab.py` exports four H.264 controls at 540 × 960, 24 fps:

| Output | Frames | SHA-256 | Change |
| --- | ---: | --- | --- |
| `plain.mp4` | 96 | `babaafbaf9e5d7e74214ea5d024e190e418004e6dc76a4eec738515fa920fe31` | Continuous source frames 289–384. |
| `whole-hold.mp4` | 120 | `d6c362b0edfaff2783834d88d63ff6accc02e5b0c255bf55e119c76e7718473e` | Insert 24 repeats of source frame 312. |
| `cutout-r01.mp4` | 120 | `a87c723011fff6b3c45b87ec0a167ab53603e1fe9ac3783897861c154d537a79` | Binary dog matte on the empty frame 387 for the same 24-frame hold. |
| `cutout-r02.mp4` | 120 | `265c1e71481b4676a13f199b4002b68c356f9b6c7bb9523c1cf496bfc396cf78` | Protected R01 revision: only the matte edge receives Gaussian feather sigma 1.1. |

The mask comes from a source-specific foreground polygon and GrabCut constrained by the frame-312/frame-387 difference. It covers 171,978 source pixels. All four outputs start with the same 24 decoded frames, pixel for pixel. R01 and R02 differ throughout the 24 held frames; 48 of the 72 resumed decoded frames match exactly. The other tail differences are encode-state differences, so this is **not** a full-tail parity claim. All four outputs decode to the expected frame count, size and rate with no black frames. `receipt.json`, `inspection.json`, `decoded-contact.jpg` and full-size decoded hold frames provide local evidence.

## Visual decision and remaining gates

The decoded contact sheet and full-size R01/R02 held frames show the paws resting on the log; R02 reduces the binary outline at fur and leg edges. No doubled dog remains in the held interval because the plate is empty. Yet all 23 adjacent pairs within each hold have mean decoded pixel difference below 1, including the cutout versions. The plate does not create meaningful motion. At ordinary contact-sheet scale the three holds look almost identical. **Reject this source as a demonstration of moving-background freeze.** The extra matte work does not earn its complexity here; if a simple pause is the story beat, the whole-frame hold is clearer and easier to revise.

The next source must combine a verified clean empty plate with visibly moving independent background, stable camera, credible floor/contact shadow, and a subject whose hair/limbs survive full-size matte review. Test a representative composite before timeline work. Normal-speed phone viewing, heard audio, story approval and native staff save/reopen/export editability remain open; no such claim is made from this silent stock and background-only inspection.

# Fight vertical framing: portrait-source screen and crop rejection

**29 October 2026, Nolan Studio PC.** This is a silent stock-footage study of the existing fight framing family. It does not use or amend the MSI fight project, assert a real event hit, or approve a client trailer.

## Source and rights screen

I checked three portrait Mixkit item pages, each labelled Stock Video Free License for commercial or personal use: [#40970, single boxer](https://mixkit.co/free-stock-video/boxer-skillfully-fighting-in-a-semi-professional-match-40970/), [#40974, two men](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/), and [#40999, two women through a cage](https://mixkit.co/free-stock-video/martial-arts-combat-between-two-women-40999/). The [publisher's Free License](https://mixkit.co/license/modal/videoFree/) permits modification and commercial/social-media use. Local 720p-tier files are all actually 720 × 1280 upright. #40970 is already a tight one-boxer view; it cannot establish the target's reaction. #40999 has lively two-person movement but cage mesh occludes key body and contact cues. #40974 was the least restrictive of these three for a controlled crop screen, yet its two boxers repeatedly meet the left/right boundaries. Its local source is 336 frames at 24000/1001 fps, 14.014 s, SHA-256 `938BBA8C5C586D700BE40E2CABF628713DCC440CAEFB931D8229D1E99F1CE634`. All media and derived outputs remain off Git.

## Same-moment comparison and actual output

The private script `work/research-continue/fight-vertical/render_ab.py` takes source frames 96–191 without changing source time. Three silent 540 × 960 H.264 exports use the same 96 frames at 24000/1001 fps:

| Variant | SHA-256 | Bytes |
| --- | --- | ---: |
| Plain, full portrait source | `dc50708f3315f4c4d110090374bfba699874db959f4086608b0bc7f88c289a65` | 1,735,508 |
| R01, later three-frame ramp to 1.25× | `1b25de178dbd822ef733798c8978a87d1fb72cc8ceaed521e91cb26a44d35eca` | 1,768,985 |
| Protected R02, later ramp to 1.08× | `7c8f5cde517f170dd0f614323f97f450ea94e5c4111f3ee6128d098ceba98b8e` | 1,757,686 |

All 96 frames of every export decoded, with no mean-luma-<8 black frame. The first 48 decoded frames are **pixel-identical across all three**; R02 changes only the later crop strength, and its tail differs from R01. I inspected a whole-source interval sheet, a 96-frame-segment sheet, a decoded-output comparison at 12 output positions and full-size decoded output frame 60 in each variant. At frame 60 the red-gloved fighter's head already abuts the right edge in the plain view. R01 removes more shoulder/body context; R02 returns some room but still cannot recover picture outside the original frame. The blue-gloved striker is also clipped at the left in portions of the segment. **Both additional crops are rejected** as candidate hero-impact framing. The untouched portrait source is less misleading, but it does not give an unambiguous whole action/contact/consequence view across this interval.

## Open gate

Portrait orientation alone did not solve the earlier 16:9 fill-versus-fit failure. Select a different original event camera angle that actually contains both fighters, contact and immediate result through the moving span; verify source chronology and rights, then compare the plain portrait view with any motivated reframe at full speed on a physical phone with the intended original sound. This stock-only test has no such event evidence, heard audio, human full-speed/phone judgment or native editable handover. No client source or approval is inferred.

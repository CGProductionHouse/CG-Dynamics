# Portrait rapid shutter — real dog action screen

29 October 2026. This background-only screen tests the existing rapid-shutter card on an upright real source after its prior landscape dancer failed the fixed 9:16 crop. It compares the plain time skip, a deliberately rejected destination/source/destination glimpse, and a forward-only repair. **It is not an approved transition.**

The exact [Mixkit #1555 dog standing on a log](https://mixkit.co/free-stock-video/dog-standing-on-a-log-1555/) item page grants free commercial/personal use under its Stock Video Free License. Private original SHA-256 `847340F0C58031EBD55026B26853A992C8D611815678ED78749639A3C878412B`; 720 × 1280, 24 fps, 388 frames, silent. Source frames 300–323 show the dog sniffing downward; 336–360 show it descending behind the log. The chronological skip is a real pose change in one take, not two camera angles or a matched event cut.

## Actual controls and protected revision

Private source-specific `shutter_portrait.py`, four MP4s, exact maps, decoded contacts/stills and `shutter-inspection.json` are under `work/research-continue/grounded-freeze-dog/`; no media enters Git. Every H.264 output decodes as 48 frames at 540 × 960, 24 fps, with no black frames. All four decoded openings match pixel for pixel for frames 0–21. R02 and its R03 blur-strength revision match through frame 22; the 24-frame encoded tails differ despite identical later source maps, so no tail parity is claimed.

| Private output | SHA-256 | Exact edit at the jump |
| --- | --- | --- |
| `shutter-plain.mp4` | `da2e0e847d53ef6bad48c21e638f6c6f60ee58c2c0362daadfc9f0243fcc79e0` | Source 300–323 then 336–359. |
| `shutter-return-r01.mp4` | `1925fcc8c24af29222215155a493cc7859baaf3821daf1c18b62d5ad8f08fe36` | Source 300–321, blurred destination 336 at output 22, old source 322 at 23, destination 336–359. **Reject:** back-and-forth dog pose. |
| `shutter-forward-r02.mp4` | `cecb9cd2a370ada44222fdd934753c62e8c1729bd5bdae84506e427b43a91e1f` | Source 300–322, blurred destination 336 at 23 (vertical Gaussian kernel 15), then 337–360. Source order is monotonic. |
| `shutter-forward-r03.mp4` | `00598edcd214e29bf3895d120895a251644b8a003e140f46480edf00beefc444` | Protected R02 revision: only the blur kernel narrows to 7 at output 23. Decoded R02/R03 frame-23 mean pixel difference 2.387; opening 23/23 exact. |

The decoded eight-frame-by-four-version contact and full-size R03 frame 23 show no crop loss: dog, log and exit remain inside the portrait frame. R01 visibly previews the lower pose, jumps back to the earlier sniffing pose, then repeats the lower pose. R02/R03 remove that temporal reversal. R03's blur is restrained; the jump is still abrupt and the effect has no demonstrated narrative or rhythmic advantage over the plain cut. **Prefer the plain cut for this stock action.** The blur is a controlled mechanism, not an aesthetic pass.

No music beat, source sound or listened cue exists in this file. A normal-speed or physical-phone comfort check and native save/reopen/export were not possible in the background-only window. Next test needs a genuinely motivated portrait two-shot or event-action relation, exact beat/source sound, plain-cut comparison, full-speed comfort and editable handover. Do not claim creative mastery from frame-order and decode checks.

The same source was screened for motion-trail clones: standing frames 300/312 overlap, then the dog folds behind the log and nearly vanishes by 348. It offers no spaced three-position path with visible grounded contact. No motion-trail render was promoted from it; the motion-trail card records this source rejection separately.

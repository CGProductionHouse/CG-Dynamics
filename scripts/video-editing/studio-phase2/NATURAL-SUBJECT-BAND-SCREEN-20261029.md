# Natural-scene subject-band screen — dog on log

29 October 2026. This background-only test takes the existing subject-band construction out of the keyed green stage and checks a real, rights-cleared animal against its actual scene. It is a **failed visual screen**, not a client treatment.

The exact [Mixkit #1555 dog standing on a log](https://mixkit.co/free-stock-video/dog-standing-on-a-log-1555/) page identifies the item under the Mixkit Stock Video Free License for commercial/personal use. Private source SHA-256 is `847340F0C58031EBD55026B26853A992C8D611815678ED78749639A3C878412B`, 720 × 1280 at 24 fps, silent. The same-shot dog frame 312 and empty frame 387 were separately inspected in the [grounded freeze screen](GROUNDED-FREEZE-DOG-STUDY-20261029.md). Private source-specific script, six outputs, decoded stills, contact and JSON inspection are under `work/research-continue/grounded-freeze-dog/`; only this documentation enters Git.

## Controls and revision trail

All six H.264 outputs decode completely at 540 × 960, 24 fps, 80 frames, with no black frames. Frames 0–23 decode **pixel-identically** across the six versions. The continuous plain control uses original frames 289–368; the hold/effects use original 289–312, eight held/effected frames based on source 312, and original 313–360. This changes total action time, so it is a picture construction comparison, not a speed-matched claim. The held source is silent; no audio acceptance is implied.

| Private output | SHA-256 | Full-size visual result |
| --- | --- | --- |
| `subject-plain.mp4` | `0963d59ef00836a81b6fe40e47d4e5f8165982e61d52cec01728d011c59d1969` | Natural continuous shot. |
| `subject-whole-hold.mp4` | `53a75d820b98ec1ab068056bc5c132e567e34060213a8838d3d7436b79ae75f2` | Whole-picture eight-frame hold; no matte or graphic. |
| `subject-band-r01.mp4` | `52228154ec7dc0f0f923edc167eee61a49c6c23bdc69fa55ab82baf9de4b4a65` | Full-width strip visibly cuts into the neck/face. Rejected. |
| `subject-band-r02.mp4` | `a153e82e48aafe5e6a5f8e6486670f0e88ef492808071f475dd1884a6d68ef5f` | Torso-limited strip protects face/paws but pale fill appears as a rectangular bar. Rejected. |
| `subject-band-r03.mp4` | `740f90a89691e8879e249857624f497728a2849847b9d03e2ed5fe3745f15b18` | Removing pale fill leaves hard left/right seam. Rejected. |
| `subject-band-r04.mp4` | `b7f8227a0e91e3ad1a5ecae082f3f24a32f92c73be1bab583bfb8b63bcb6af39` | Matte-weighted remap and smooth spatial taper remove the rectangle and preserve paw/log contact. Full-size frame 24 still reads as elastic torso warping; it does not convincingly reproduce the reference's subject fragments. Rejected for creative use. |

R04 is a bounded repair of the same eight effect frames; its protected opening stays exact. Its held frames differ from whole-hold by mean decoded pixel difference 0.55–0.80, while the R02 pale bar reaches about 9.67. This is a magnitude check, **not** a visual quality score. The band versions' 48-frame resumed tails are not decoded-pixel identical to whole-hold because the H.264 encoding state differs after their altered interval; do not claim a protected encoded tail. The private `subject-band-inspection.json` records these checks.

## Decision and next gate

The real subject can be isolated without a duplicate, but this source has nearly static background and no outgoing/incoming story reason for a glitch. R01–R03 expose face, fill and boundary failures; R04 is technically neater but still distorts the animal without a narrative job. **Keep the plain shot or simple pause for this source.** Next test needs two causally related shots where a subject-fragment transition serves a real story cut, verified natural matte at every moving frame, original/licensed sound, normal-speed/physical-phone review, and native staff save/reopen/export proof. Do not generalise this held-frame mask to another source or claim creative mastery.

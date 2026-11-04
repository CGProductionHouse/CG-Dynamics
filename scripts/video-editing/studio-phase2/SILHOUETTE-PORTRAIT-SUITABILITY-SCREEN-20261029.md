# Portrait suitability of incoming silhouette — 29 October 2026

An existing-family background screen for [subject-silhouette-prelap](skills/subject-silhouette-prelap/SKILL.md) under [draft PR #910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), #874/#903. It does not replace the earlier native landscape construction; it asks whether that verified moving shot remains useful when a full-height portrait Reel is required. No GUI, client media, paid service or upload was used.

## Licensed sources and controls

[Mixkit woodland #5040](https://mixkit.co/free-stock-video/huge-trees-in-a-large-green-forest-5040/) and [park woman #4825](https://mixkit.co/free-stock-video/girl-from-the-front-walking-through-a-park-4825/) both state Stock Video Free License commercial/personal use. Rehashed originals: `ea27751d1ad382903511d2f4d0e25ddeddea26233f14ada5348e6fc58e676953` and `3afa22d3acf94f0aa73f2958f70a05842a88a3b62f7784aecee75a40d78a126f`. The already witnessed native study produced the separate plain and nested three-frame silhouette outputs, rehashed here as `c6a91e747d5b829cc225e12827d9dc9f3498d908086775d4a11a71aab6d2b1a1` and `a792b4d88f8dcd0debd6e7c46d737ba02380dd5d796329a7438104ff02c9eef0`. They remain private source dependencies, not Git media. Their native one-PC editability is documented separately; these portrait exports are baked derivatives.

All variants use the same upright 405×720 center crop at source x438, scaled to 540×960 at 30000/1001 fps. Source image order is unchanged for 119 frames. `render.py` and `qa.py` in private `work/research-continue/prelap-portrait` retain the exact pinning, recipe and diagnostics. Plain is the natural hard cut. White-three crops the existing native three-frame matte at output27–29. White-two is a protected local revision replacing only output27 with the plain frame in the working decoded image; its two remaining silhouette frames are28–29, and output30 returns to the person. The first27 frames and all frames28–118 are exactly preserved at the working-pixel stage against white-three.

| Private MP4 | SHA-256 | Decoded frames | Motion pairs >0.5 MAD |
|---|---|---:|---:|
| Plain | `d49343fff545b947b9953f071f0306a55b7b6544b8e82ad83599ff9a12c39a5f` | 119 | 118/118 |
| White-three | `759722000e1dc6a628cbb29352580b186a00f9a4d8bd87a42d59f2a23d449ee1` | 119 | 118/118 |
| White-two | `63e8327344d7a41d10f1956e3793c04ffa5da3f4de92eefde475326802b759d1` | 119 | 118/118 |

All three fully decode to540×960. Actual frames0,25,27,28,29,30,50,118 were inspected in each output, including full portrait contact and the frame at the cut. Frame28 is **83.12% near-white** in white-three versus0.03% in plain. In the 9:16 crop the matte head runs off the top and the shoulders occupy nearly the whole width; the person appears abruptly at30. White-two removes only the earliest white frame. It still reaches83.11% near-white at28, so **both portrait silhouette treatments are rejected against the plain cut**. This is a source/framing failure, not a claim that silhouette prelap can never work.

Encoded protection is narrower than working-pixel protection. White-two versus white-three is exactly equal in only1/27 decoded opening frames, although opening mean absolute difference is1.114 levels. The intended unchanged tail is89/91 exact decoded frames with mean difference0.005. The first QA version asserted strong encoded prefix equality and failed; it was corrected to report the actual failure. This is expected codec-domain cross-frame coupling, not permission to claim exact encoded protection. The source native plain/white outputs also differ after the visible matte because of separate H.264 encoding, so output identity cannot be inferred from shot mapping alone.

The cleared clips are stock scenes, not one verified encounter. The source head/shoulder fit and huge white area defeat this portrait concept. There is no camera audio, licensed accent, heard review, physical-phone viewing, client story need, or second-PC relink here. Keep the landscape native mechanism separate; acquire a portrait-safe subject whose full silhouette and return pose fit the frame before retrying this editorial treatment.

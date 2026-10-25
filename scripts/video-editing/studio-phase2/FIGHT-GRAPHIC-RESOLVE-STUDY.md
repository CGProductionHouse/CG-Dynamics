# Fight reference correction: graphic detail resolving into readable contact

**25 October 2026 — response to owner review.** The owner rejected the [10-second integrated stock exercise](FIGHT-INTEGRATED-STOCK-STUDY.md) as visually weak and its music as horrible. That verdict supersedes its technical pass. It is retained as a failure record only; do not recommend or reuse that soundtrack, square geography insert or repetitive stock sequence in the Staffy trailer.

## What the actual references show

The two owner links were revisited in the existing Chrome TikTok tabs. This was a **visual sampling pass**, not a frame-by-frame or audible analysis; the agent cannot hear browser audio. No reference media was copied.

| Owner reference | Observed visual construction | Transferable test | What does not transfer automatically |
|---|---|---|---|
| [Josiah Lebante motocross film](https://www.tiktok.com/@josiahlebante14/video/7635639920148761876) | The opening moves from a near-abstract, high-contrast black/white wheel detail into warm dusty racing footage. Dirt and riders pass close to lens; a tilted following-camera shot and a wide airborne rider create motion and scale changes. | Short graphic detail → swift release into full readable action, with motion direction and foreground proximity doing much of the transition work. | Its FPV roll, dirt wipe, bike speed and natural airborne slow moment require matching source photography. A boxing clip cannot acquire those simply by adding blur or a preset. |
| [Lumaurya MMA film](https://www.tiktok.com/@lumaurya/video/7634259458025164054) | Dark isolated opening detail, walkout/sparks, cage geography, tighter impact/aftermath, controlled cool shadows and warmer skin/stage lights. | Keep a visual arc and let the decisive contact read; use location and fighter context before/after the close hit. | Its scene access, stage production, distinct fighter angles and timing cannot be recreated from two short stock sparring clips. This visual sampling does not establish its soundtrack or exact transitions. |

The lesson from the references is shot selection, camera movement, contrast control and precise handoffs—not a generic impact flash. The earlier study spent too long on repeated bodies and unrelated framing, then covered it with an unsuitable drum bed. Its equal-picture audio comparison did not test whether the song was good.

## New bounded visual A/B

- [Plain 2.002-second source control](proof-fight-graphic-control.mp4)
- [Graphic glove-detail resolve](proof-fight-graphic-resolve.mp4)
- [Every 0.125 s visual contact sheet](proof-fight-graphic-contact.png)
- [Reproduction source](render_fight_graphic_resolve.py)

Both use the same local, hash-checked [Mixkit #40974 boxing source](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/) under its [free video licence](https://mixkit.co/license/modal/videoFree/) from source 4.65 s. The effect begins with a tightly cropped, posterized monochrome blue-glove detail; it smoothly releases to the full original frame and colour across frames 6–17. A short softened focus streak lives only during that release. **By the actual glove-to-face contact around source 5.375 s, framing and colour are back to the clean source.** There is no added impact freeze, flash, fake hit, floating mask or clipped cutout. Both videos are silent: this experiment explicitly removes the rejected music and does not pretend sound design has been solved.

The contact sheet visually confirms the graphic-to-colour release, the strike approach and an unobscured contact/reaction. Both files fully decode: 1080×1920, 24000/1001 fps, 48 frames, 2.002 s. Control SHA-256 `68451666fba9a3f159d77754e5c192ce156efae568ba74125b4aa937659a2856`; effect SHA-256 `5117e0ada256486521369e75ea782306f457a08b41f8fd71143d0461b68f47e4`. The decoded post-release/contact portion (frames 18–47) measures SSIM 0.994108 across the separately encoded control/effect versions. That compression comparison supports visual preservation; it is not pixel identity or a human judgement of the complete motion.

**Result:** the original visual operation is reproducible with existing Pillow/FFmpeg and is materially different from a plain clip. It is still a **candidate**, not evidence that the trailer has reference-level craft. The stock shot is 24 fps, limiting speed work. The opening graphic is source-specific and may feel excessive at normal playback; a human needs to compare both MP4s at full speed and phone size. It cannot be promoted until a real event glove/body detail leads into a separately verified Staffy contact and the event audio/music is heard and approved. Do not attach a random replacement track to this silent proof.

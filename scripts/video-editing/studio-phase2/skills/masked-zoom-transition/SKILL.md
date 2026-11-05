---
name: nolan-masked-zoom-transition-research
description: Test a short transition through a real scene opening such as glasses using editor-native masks, tracking and keyframed transforms.
---

# Masked opening zoom — tracked local proof, visual review pending

**Lifecycle:** [glasses reference](https://www.tiktok.com/@miracampschool/video/7507285819724500246) and [cutout reference](https://www.tiktok.com/@miracampschool/video/7619009675987520790) visually sampled → [same-shot, tracked stock lens A/B](../../MASKED-LENS-ZOOM-STUDY.md) rendered → full-speed/phone and matched-second-shot gates pending → mastered **NO**.

The [source suitability screen](../../MASKED-OPENING-SOURCE-SCREEN.md) rejects an opaque coffee surface as an automatic portal and identifies a moving magnifying-glass lens as a real aperture candidate. The later [local A/B](../../MASKED-LENS-ZOOM-STUDY.md) tracks that lens across 36 frames, compares an ordinary digital push, an unprotected aperture and an aperture with a separate hand foreground plate. Its first candidate duplicated the rim and was rejected; the corrected interior-only crop removes that second ring. The hand plate visibly keeps the lower finger in front around 0.65 s. A soft left-edge rim remnant and upscale softness remain, so this is a **mechanical proof**, not an accepted transition between two different shots.

The glasses tutorial shows duplicate footage, a held upper frame, an Opacity Pen Tool mask around the lens opening, inversion/nesting and keyframed Transform position/scale with blur. The cutout tutorial shows Premiere Object Mask controls on an upper nested clip over the incoming shot. These are two related but distinct compositions. The visible controls support the stated mechanism; the final edge quality and audio were not critically reviewed.

Before choosing either, confirm the shot offers a convincing physical opening or moving occluder. Use native mask/track controls when an editable Premiere handover is required. Keep a protected source sequence. Track or keyframe across **every transition frame** and verify the incoming shot fills the aperture without black holes. Inspect hair, hands, glasses rims and any object edge at full size and phone size. The cutout must remain anchored to the frame or a plausible object; a mathematically clean alpha with a floating hard edge fails.

Reuse the existing compositor only for a disposable technical proof. A mask on synthetic/green-screen material would not validate natural-footage tracking, and neither tutorial grants permission to reuse its video or SFX.

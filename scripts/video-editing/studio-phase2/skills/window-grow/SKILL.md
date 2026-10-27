---
name: nolan-window-grow-reveal
description: Reveal a continuing scene by growing its framed view into the full picture, while checking spatial continuity against a plain cut.
---

# Window-grow reveal — synthetic mechanism proof

**Reference:** [Gakulange's three-trend post](https://www.tiktok.com/@gakulange/video/7519106258394303765) names a `Grow Effect` and visually samples a small framed view becoming the surrounding picture. That post also names freeze frame and split screen; they need separate source and story tests. The player was muted, and exact reference keyframes/easing were not available.

**Scene prerequisite:** A real framed surface or camera composition must have a reason to become the next scene. Use the *same underlying moving shot* inside and after expansion. Keep its time moving continuously; matching only a still at the join leaves a visible action jump. The growing rectangle must start exactly over the screen/window edges and end over the entire delivery frame. If it covers a client's face, CTA or brand message halfway through, move the effect or retain the plain cut.

**Original A/B:** `py render_synthetic_ab.py proof` generates a three-second [plain cut](proof/plain.mp4), [grow candidate](proof/grow.mp4) and [8-frame comparison](proof/grow-contact.png), all from original vector drawings. Both videos fully decode at 540×960, 30 fps. The candidate starts expanding at frame 36, uses an eased 18-frame move, and settles to full picture by frame 54. The same moving scene is sampled at frame `i` before, during and after the move. The contact sheet shows a coherent rectangle from phone-sized to full-frame; the plain control changes at frame 45. No artificial subject cutout is used: the screen is anchored inside the drawn phone, and the result is a full scene.

**Current judgement:** The geometric reveal works in the synthetic contact sequence. It is still a graphic demonstration, not a real filmed phone or an approved client transition. No full-speed perceptual watch, physical-phone test, audio, native keyframe reopen or staff editability check has happened. The [Arthur last-frame tutorial](https://www.tiktok.com/@iam_arthur7/video/7620855331031141662) is a different **camera-shot** technique requiring the screen physically to cover the lens; this digital grow proof does not establish that one.

**Real-scene gate:** Record or clear two shots with a real visible screen and a related next scene; log exact screen corners at the start and full-frame crop at the finish; compare a clean cut and growth at full speed on a phone. Add only action-registered, licensed sound in separable tracks, and check it with the actual music. Prefer native editor scale/position/crop keyframes for staff revision. No purchased pack or new rendering engine is required.

**27 October real-source screen:** [Four locally held practice clips were screened](../../WINDOW-GROW-REAL-SOURCE-SCREEN-20261027.md). One tablet is visible, but it shows unrelated code; two laptop shots do not expose their display and an equipment shot has no screen. None demonstrates that the incoming scene is genuinely on the filmed device, so no real-screen edit was rendered. Keep the synthetic A/B as a mechanics check and the real capture/continuity gate open.

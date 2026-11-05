---
name: nolan-filmed-last-frame-transition
description: Plan and verify a physical screen-to-location transition whose displayed frame aligns with the previous shot.
---

# Filmed last-frame transition — capture plan, no application proof yet

**Reference:** [Arthur's three-step filmed transition](https://www.tiktok.com/@iam_arthur7/video/7620855331031141662) explicitly describes playing the tail of shot A on a phone/computer, filming shot B as that screen covers the lens, pulling the screen back, and aligning the displayed frame to the cut. The viewed sample shows a physical phone in front of the next location. Its reference sound was not heard.

This depends on **capture**, not just a transition effect in post. The separate [digital window-grow proof](../window-grow/SKILL.md) is not evidence that the physical trick works.

## Capture in a disposable practice shoot

1. Pick two related locations and one clear viewer reason to move between them. Record shot A with a stable, readable final half-second; save its original audio and exact frame rate.
2. Put the actual tail of A on a real phone or monitor. Confirm brightness, orientation, exposure and absence of distracting reflections. Do not substitute an unrelated still or an unlicensed reference frame.
3. Begin shot B with the device screen filling the camera view and its displayed A frame square enough to match. Record the device moving away to reveal the **real** second space in one continuous take. Keep the hand/device attached to the camera/frame edge while it retreats; a detached floating screen fails.
4. Record a clean B tail after the device exits. Capture normal room/camera sound. Make one plain A→B cut as a fallback.

## Editor proof gate

Log the exact outgoing A frame and incoming B frame. Align the *content displayed on the device* to A, checking position, scale, orientation and color over several frames; mask only an edge that truly overlaps. View frame before, cut frame, next two frames and the device exit at full size. Do not conceal a mismatch with a full-frame flash. Keep A and B originals, any corner/mask keyframes and screen-playback asset editable for another staff editor. Compare the plain cut and effect at normal speed/phone scale with original audio first, then test one removable licensed motion cue if it improves the physical action.

**Current status:** No rights-cleared physical screen take or second-location capture has been recorded in this lane. No editor render, sound match, phone playback or staff handover is claimed. A synthetic recreation would not pass the capture gate. Do not label this skill mastered or use it to patch unrelated client shots.

## 27 October filmed-screen prerequisite test

A real, [commercial-use Mixkit #42630](https://mixkit.co/free-stock-video/copying-from-a-cell-phone-to-the-computer-42630/) phone shot was downloaded privately and screened across its complete ~10.47 seconds. The green display remains visible while a person holds the phone next to a laptop; **the phone never covers the lens or reveals another location**. Original SHA-256: `0B1F1EC15A30B59FA06240B03ADAD50E3F6CEF38EC6A3A8D8587D983644A7418`. The incoming moving [Mixkit #39691](https://mixkit.co/free-stock-video/carpenter-slicing-a-wooden-board-in-a-close-up-shot-39691/) shot is also Free License, SHA-256 `186BC1EB994695AF1D7C2312D3F8EA6AAC0A4E23767D24727471066E7CCEB618`. These are generic practice scenes, not client footage or proof of one real office/workshop.

The [bounded tracking renderer](render_real_screen_prerequisite_ab.py) keys only the green pixels and estimates the screen quadrilateral separately on every frame. It places source-synchronous moving saw footage inside the physical phone frame, keeping the handset border, notch and hand. A 60-frame, 2.5-second mute plain-cut control and a digital-grow candidate decode at 720×1280/24 fps. The same incoming scene advances one source frame per output frame both inside the phone and after the join; the generated full-frame at output frame 45 exactly equals its incoming source frame before encode. Private renders, full-size frames and contact: `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\filmed-screen-20261027`.

**Decision:** The tracked phone insert is a useful technical subskill. Full-size frames show no large green hole and preserve the device edge and hand while the screen plays. It is not yet a polished client insert: a simple HSV residual check found 2,282 green-class pixels in a 720×1280 replaced-screen frame, versus 47,926 in the 1280×720 unmodified source frame; inspect and despill the border before use. **Reject the growth transition.** At frame 41 the moving image becomes an unsupported floating rectangle over the holder's lap before it fills frame; this violates the owner's grounded-edge rule and makes the plain cut preferable. A zoom or flash would hide, not solve, the missing camera movement. This test is digitally replaced screen content, not Arthur's filmed last-frame transition. No original source sound exists, no normal-speed/phone audience comfort or native editable handover was verified. The saw source includes a visible `TDM` shirt logo: check client suitability rather than treating stock as generic. For the actual tutorial effect, shoot a real device playing shot A as it covers the lens at the start of shot B, then compare with the plain cut and carry original location sound.

### Bounded edge cleanup

The residual 2,282 green-class pixels were all within nine source pixels of the keyed phone display; none appeared elsewhere in the portrait crop. Full-size one-, two- and three-pixel key-expansion stills were compared privately. A **one-source-pixel** expansion reduced the same-frame count to **839** without visibly eating the handset rim. Two pixels reduced it to 531 but nicked the dark rim near the screen corners, so the renderer now uses one pixel. Both 60-frame exports were regenerated and fully decoded; this improves the insert only. A green-class count is an objective spill screen, not proof that every edge is clean in motion. The digital grow remains rejected, and the physically filmed last-frame reveal remains unproved.

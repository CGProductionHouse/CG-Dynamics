---
name: nolan-stateful-ui-motion
description: Animate real information states with persistent element identities, coordinated layout reflow, focus travel and restrained feedback; use for CA's requested UI treatment in client films.
---

# Stateful UI and information motion

CA5November asks for UI animation in every video. Design one brand-appropriate information interaction for each film: selected term, moving focus, step progression, product option, document annotation or genuine screen demonstration. Do not paste the same dashboard into every client or imply a client owns an invented app. Bind actual frame ranges, components, content and source/effect evidence in the existing production plan.

The [John Bucog reference](https://vt.tiktok.com/ZSpY1XP5j/) is a hosted Vibe Motion/Higgsfield workflow with reference imagery and generated prompts. Its transferable goal is legible purposeful motion, not that vendor or paid generation. Normal public playback/captions inspected; no tool subscription, credit, private-media upload or copied interface/template was used. See [four-reference study](../../CA-MOTION-VOICE-UI-20261105.md).

## Implement locally in the existing renderer

Shared `scripts/ui_motion.py` provides `settle`, `interpolate_rect`, `focus_frame`, `cursor_event`, `reflow_rows`.

1. Author real start/end states. Give each semantic item a persistent ID and keep its font, icon and source attached through the transition. Decide what the viewer learns or selects.
2. Compute all row positions/heights together with `reflow_rows`; interpolate the geometry with `settle`. Expand the selected item's content while neighbouring items move out of its way. Reveal new copy within the new bounds; do not stretch letters or keep a collapsed description visible.
3. Move the same focus frame between targets with `focus_frame`; choose its stroke/radius/colour from the actual brand. Pointer/click feedback belongs only where an interaction is being represented, not as a random pulse on every title.
4. Lock the settled state to exact geometry. Add restrained temporal blur only to fast movement using the existing Transform/camera study; protect the reading hold.
5. Compare with the same content as hard state changes and a timing-only revision. Inspect all moving boundaries, spacing, overflow, text legibility and normal-speed comfort. Continuous raw frame dimensions/mode and final frame count must agree; FFmpeg exit0 alone is insufficient.

Current private generic proof is150frames/6s at1080x1920: question/proof/next-step state changes, persistent IDs, coordinated reflow, focus/disclosure, plain state-cut control and+3frame event revision. It is an explicitly labelled original illustrative UI, not PSG software or a finished client film. PSG application uses a selected policy term, not a fake quote/payout portal. No native-app editable project, device touch interaction or creative mastery is claimed.

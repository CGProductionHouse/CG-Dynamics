---
name: nolan-context-zoom-out
description: Build a time-continuous digital pullback that preserves the action and reveals useful surrounding context, with a plain-shot control.
---

# Context zoom-out — portrait source proof

**Reference:** Collection [#25](https://www.tiktok.com/@ihsangunyasar/video/7504667931322666258) visually shows Transform scale keyframes and attribute copying. Its exact motion timing, sound and full parameter sequence were not established. This is a **single continuous pullback**, separate from the three-frame zoom-cut tutorial. Choose it when moving from tactile detail to context helps the viewer understand the action; do not use it to rescue a poorly framed source.

Before rendering, keep the important hand/tool/contact/result or equivalent action inside **every** crop. Native portrait sources offer more useful room than landscape fill crops. Compare an unscaled shot, a linear move and an eased move with identical source time. A digital pullback cannot reveal picture outside the original frame or recover missed focus. Preserve native source linkage and keyframes in the chosen editor when staff handover is required.

## 27 October bounded proof

`render_ab.py` checks the hash of commercially licensed [Mixkit coffee pour #41865](https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/) (`883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331`). Its native 720×1280 portrait picture selects source 2–5 s, sampling the **same source frame** for plain, linear and eased 540×960/24 fps outputs. No source audio exists. All practice media and crop evidence stay privately in `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\context-zoom-out-20261027`.

The candidate holds 150% scale through output frame 12 (0.5 s), moves to 100% by frame 42 (1.75 s), then holds the original full frame. The crop stays centred. Smoothstep easing changes its crop width by one source pixel at the first and last moving steps, versus five and twelve pixels for the linear-scale control. From frame 42 onward, the pre-encode candidate pixels exactly equal the plain version, proving full-frame recovery without a timing skip. All three three-second H.264 exports decode. Eight-position 180×320 contacts and the 540×960 opening were inspected: both liquid streams and the cup rim remain visible, and the wider ending reveals more cup/machine context without black edges.

**Result:** framing, source-time continuity and endpoint settling pass this bounded test. The eased variant is the useful construction candidate; the numeric easing check does not certify its normal-speed feel. This source is an ongoing pour, so the move adds a macro-to-context settle rather than a new event or an intense hook. Use only for a matching story job. A cropped blade/hand saw source was considered first and rejected rather than forcing the camera move. No motion blur, SFX, music, physical-phone playback or native editor save/reopen/export has passed here.

For a staff recreation, use one linked source clip and native scale keyframes at 0.5 s/150% and 1.75 s/100%, centred anchor, with an eased start/stop; retain the unprocessed original and plain control. Check the actual interpolation at full speed in that editor. The Python renders are baked review media, not native editable effects.

## Native context pullback and protected endpoint revision

The [office native study](../../OFFICE-NATIVE-CONTEXT-ZOOM-STUDY-20261028.md) keeps a linked portrait pour, plain/linear/native EaseOut/EaseIn controls and later endpoint revision. Six72-frame exports; both actual save/close/reopen pairs72/72 decoded equal, revision opening13/13 equal. A six-frame later key also changed native influence, producing a larger final step; do not call an endpoint edit timing-only without checking handles and encoded motion. Keep streams/contact in every crop, retain enlargement softness and ongoing-action limits; native proof is not creative/phone/heard/second-editor approval.

---
name: nolan-planar-3d-camera
description: Move a perspective camera across an approved flat composition with eased settles, temporal motion blur and explicitly timed sound; use for dimensional service/product graphics, including TBS.
---

# Planar 3D camera

CA's [3D camera reference](https://vt.tiktok.com/ZSpFoJYVG/) resolves to [Josh Hoffman7418660690837261575](https://www.tiktok.com/@_joshhoffman/video/7418660690837261575). Actual muted player frames show precomposition, new camera and camera position/point-of-interest controls. The creator describes speed curves, motion blur and SFX. This is a camera viewing a flat precomp, not generated depth, a real 3D room or automatic subject parallax.

Use the existing shared [camera operator](../../../../../.agents/skills/cg-video-story-editor/scripts/camera_plane.py): `render_camera(artwork, size, keys, time, fps=25, shutter=90, samples=33)`. Keys are `(seconds, camera_xyz, target_xyz, roll_degrees)`; artwork pixels are world units on a centred z=0 plane. FOV is vertical. Position and target interpolate with quintic easing; actual time samples integrate the shutter. A fixed pose stays sharp. Reuse the actual brand type/assets; keep the linked source and JSON keys editable.

For After Effects: precompose the approved design, enable its3D layer switch, add a camera, set composition size/rate, animate camera position and point of interest for lateral/depth moves, shape velocity curves to settle on each readable message, and enable layer/composition motion blur. Use [Adobe's camera documentation](https://helpx.adobe.com/after-effects/desktop/work-with-layers/camera-layer/cameras-lights-points-interest.html). Native parameter units/interpolation differ from this Python operator: do not promise automatic numeric or pixel parity. No AE installation/save/reopen proof exists on PC.

## Application and sound

For separately authored photo/type/graphic planes, use the [6November layered-camera extension](../../LAYERED-CAMERA-FINISHING-20261106.md): `depth_layer_rect` / `render_depth_layers` in the SAME camera module. This route permits uniform scale/translation only, checks source aspect ratio and rejects tilt/roll/camera crossings. It gives explicit design planes different parallax without claiming inferred photographic depth or face-mask success. Premultiplied-alpha interpolation prevents dark fringes. Check full-path ink margins and overscan; earlier decoded controls failed those visual gates. Keep current brand assets and real source/face review requirements.

- Choose a move because it connects actual information: detail to context, one service to the next, or a product reveal. Establish readable holds. The move itself is not the hook/purpose of a finished film.
- Arrange each view to fill the intended phone frame. A far overview of a wide board becomes a tiny landscape strip: reject it when labels/product cannot be read.
- Fast travel needs sufficient shutter samples. Five samples at180 degrees produced distinct repeated edges; the tested33-sample90-degree treatment reduces that stepping. Keep source text sharp on settles.
- Mark travel start, velocity peak and settle on the actual timeline. Place a removable air/swish cue across motion and a restrained landing cue at the settle only if it improves the edit. Align measured energy, not the WAV's beginning. Audition against the exact music/voice at normal speed; meters do not prove taste, hearing or masking.
- Copy a beat marker from the actual licensed music before choosing durations. The7.2s technical demo has no music and makes no beat-fit claim. Its36/81/135 settle frames are example camera markers, not mandatory client cut points.

## Current bounded proof and MSI handoff

[5November handoff](../../TBS-3D-CAMERA-HANDOFF-20261105.md) records source hashes, current R03/R04, static/linear controls, rejected R01/R02, sound markers and limitations. MP4 is a rasterized insert; Python+JSON+linked artwork are reproducible layers/parameters, not a native Premiere/AE project. Read exact output evidence before applying to the current film. No final/client/native/hearing/second-PC approval is implied.

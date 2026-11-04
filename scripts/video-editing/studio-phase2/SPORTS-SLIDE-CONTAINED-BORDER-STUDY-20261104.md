# Sports slide: contained border A/B (4 November 2026)

Status: **bounded picture construction proof, not client revision or creative approval**. The private A/B, scripts, contacts and source footage are outside Git at `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Office-Skill-Transfer-20261028\skill-proof-20261104`. R14–R16 client exports and approval-group messages were not changed or resent.

## Question and source

The [R14 slide skill](skills/sports-slide-shake/SKILL.md) used `BORDER_REFLECT_101` across a six-frame real Bloem wide-to-runner join. This prevents black borders but may mirror a body, ball or court line if the transformed crop leaves the original image. Can the same short directional move stay wholly within the genuine source pixels?

The protected source is the existing private R14 graded picture, 1080×1920 at 30 fps. Output frames 404–439 contain the actual join at 418/419. The plain control retains the same monochrome/graphic treatment and cut; only the contained variant adds transform and horizontal blur on 416–421. No client source was added to Git and no TikTok sound or image was copied.

## Construction and result

For a frame of width `W`, centred scale `s` gives horizontal crop margin `(s−1)W/2`. The original R14 peak `s=1.16, dx=102` has an 86.4 px margin, leaving 15.6 px to be supplied by reflected-edge sampling. The candidate uses `s=[1.07,1.13,1.20,1.20,1.13,1.07]` and `dx=[−25,−60,−90,+90,+60,+25]` px. Its minimum margin after displacement is 10.2 px. The affine transform uses constant black as an **exposure diagnostic**: when the coordinates stay in source bounds, the black border is never sampled. A 9×1 horizontal blur follows only the six transformed frames.

Both H.264 controls decode as 36 frames at 1080×1920/30 fps. With fixed-QP all-intra encoding, decoded plain-versus-contained comparison differs at **exactly** global frames 416–421; frames 404–415 and 422–439 match. Plain SHA-256 `DCAC9456B98F2865C9FCA1D9FA6EC79B154AF1D7BDCE17F21AEE47340A9F99A5`; contained SHA-256 `7020FCEBEDF8D98EB2FCA6610CD898BF304F8CF76D208A883FF06C616DB49A5C`.

The 216×384 contact compares plain, original R14 and contained frames 415–422; full-size contained peak frames 418/419 were inspected. The green `MOVE TOGETHER` graphic remains legible, the incoming runner appears immediately, and no diagnostic black border is visible. This is a crop and frame-isolation result. The incoming shot is already soft/close and the montage's creative case for a shake remains unproved; do not promote the effect as a default or retrofit R16 based on this test.

## Reuse gate

Choose a real motion-matched cut and calculate the crop margin for **each** keyframe, including blur radius and any stabilizer crop. Check the actor, ball, text and border at full and phone size, then compare against the plain cut at normal speed with the actual music/source sound and a separately licensed cue. If the shake hides the action or the clean cut reads better, keep the clean cut. Save source timecodes, adjustable transforms and independent sound stems for staff revisions. These perceptual and native-editability gates are still open here.

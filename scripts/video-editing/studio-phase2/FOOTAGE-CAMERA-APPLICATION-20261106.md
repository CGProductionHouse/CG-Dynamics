# Moving-footage application of the camera tutorial — 6 November

This advances the existing [planar camera](skills/planar-3d-camera/SKILL.md),
using the existing camera and measured-type operators. It adds no engine or
family. The [earlier layered artwork](LAYERED-CAMERA-FINISHING-20261106.md)
remains valid geometric evidence; this study adds a real moving image plane.

## Source and useful construction

Rechecked [Mixkit41865](https://mixkit.co/free-stock-video/cup-being-filled-with-coffee-in-a-coffee-machine-41865/)
on6November: item explicitly states commercial/personal Stock Video Free License.
Existing original SHA256
`883b71655e2f2448a03b02f6e318eced58b51bac5b74da86c018995f3c817331`.
Actual original720x1280/24000:1001, upright portrait. Decode frames48–167
once, stabilise with vidstab shakiness2/accuracy15/smoothing6/zoom0.5, then
preserve all120 successive frames. No held photo or reset stream.

The move begins on the actual pouring streams and eases back to reveal the cup.
Original practice copy SMALL DETAILS / DAILY RITUAL enters on measured shared
baselines, with Regular/Bold differentiation and12px visible-ink leading.
Space Grotesk variable font and its OFL are already in the shared repository;
this is not a new brand default or a client campaign. No client media was used.

The coffee image stays one rigid uniformly scaled plane. Type has its own
explicit authored depth180; this does not reconstruct depth inside the machine
or create physical camera footage. Camera travel0.6–2.2s has a readable hold,
then a restrained lateral move3.2–4.3s. No face/person/matte claim is possible
from this source. [Adobe's camera guidance](https://helpx.adobe.com/after-effects/desktop/work-with-layers/camera-layer/cameras-lights-points-interest.html)
explains native camera/point-of-interest concepts; this is a local raster
application, not an After Effects project or numeric native equivalence.

## Reproduce and inspect

Use an existing hash-matching original on either PC. No automatic download:

```powershell
python -X utf8 skills/planar-3d-camera/render_footage_camera_study.py --source ORIGINAL.mp4 --ffmpeg FFMPEG.exe --output FRESH_PRIVATE_DIRECTORY
python -X utf8 skills/planar-3d-camera/inspect_footage_camera_study.py --output FRESH_PRIVATE_DIRECTORY --ffmpeg FFMPEG.exe
```

Run from this phase2 directory, with absolute paths preferred. The renderer
normalises CLI paths before changing working directory. It asserts the original
hash,120 decoded selected frames and source dimensions. Reusing prepared media
requires its exact original/frame-range/output-hash receipt; existing rendered
variants are never overwritten. FFmpeg needs the already used vidstab filters.
`--preview-only` writes source preparation, recipe and six layout auditions
before full output. Inspect them first; a correct neutral still is insufficient.

Current private PC directory: `work/research-20261106/footage-camera-r02`.
Four540x960/120frame/5.005s silent versions: fixed-camera plain control,
single flattened plane with camera, separate image/type depth and protected
revision. The revision changes only final cameraX25→10 after3.2s; first76/76
encoded frames are identical and all40 checked tail frames change. Original
source, type, initial camera move and all timings remain fixed.

All480 current encoded frames were inspected in ordered contacts; full-size
travel/hold comparisons and actual1x muted playback screenshots were inspected.
The three-way comparison played to120frames/5.005s,0dropped, in isolated local
headless Chrome without staff profile or visible windows. This is actual timed
playback with sampled picture evidence, not an independent continuous human
artistic verdict. Each main version has0black/0consecutive duplicate frames.
Image-plane coverage holds throughout shutter sampling. Actual title ink clears
47.886px minimum in the depth version,53.538px in the revision; the fixed control
clears74.055px. The flattened control has no separate title-plane margin metric.

Retained failure: first R01 layout audition placed late title ink around21.7px
from the edge, below the27px study guard. Moved the title plane fromX−20 to15
before full R02 renders. These were six rejected preview images, not four
additional failed full movies. Initial relative-source-path invocation also
failed before media encoding; normalised paths repair it, with no lost source.

## Sound and editorial decision

The inspector creates one original removable sound audition: filtered air shaped
by the first camera move's velocity, and one short graphic settle tick at2.2s.
Measured10ms RMS peak1.42s versus intended velocity peak1.40s; source WAV peak
−23.89dBFS. Encoded video-packet hashes match the silent depth version exactly.
The source video has no useful original sound, so no espresso-machine foley is
invented. Silent controls remain the default comparison.

**Sound is UNHEARD/NOT APPROVED.** This is not a final mix, music choice, heard
beat alignment, client-ready cue or a new calibration result. Hear the actual
optional audition through an authorised proven route before any client use;
replace/omit it if forced. Do not copy this cue into every brand.

The camera pullback helps distinguish detail from context, but the independent
type parallax is modest and the fixed composition is already clear. There is no
evidence that extra depth automatically improves a client's story. For a real
assignment, first reuse its exact assets/font and choose the useful reveal; then
compare against the simpler move. Do not add an unnecessary second drift solely
to advertise an effect. Sharpness is limited by the720px original and crop.

Five existing depth/alpha/aspect guards and canonical/card validators pass.
No shared camera API changed.53documented families remain53; no mastery,
physical-phone, native editor save/reopen, real-face, hearing or client approval
promotion. Next useful gate: a genuinely assigned brand/source reveal and exact
sound audition, or native reconstruction when the desktop is free.

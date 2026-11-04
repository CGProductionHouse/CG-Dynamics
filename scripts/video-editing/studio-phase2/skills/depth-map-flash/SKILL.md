---
name: nolan-depth-map-flash
description: Reconstruct a brief relative-depth grayscale flash with local licensed models, comparing luminance and flat-mask controls; not automatic rotoscoping or measured geometry.
---

# Depth-map flash — new bounded sports-reference study

Use for the depth-like monochrome punctuations observed in the owner's [rugby reference](../../SPORTS-REFERENCES-20261103.md). The creator's exact software is unknown. This is a reconstruction hypothesis, not extracted project layers or a universal sports look.

Ordinary desaturation follows surface brightness. A flat subject mask has two levels. Relative depth can separate near/far planes and retain within-person shoulder/head shape, which is closer to the observed reference's graduated grey forms. Do not mislabel these three mechanisms or call a relative depth image a clean person matte, optical flow or metric distance.

## Inputs and reproduction

The bounded [recipe](render_controls.py) decodes2seconds of the previously verified [Mixkit walker134](https://mixkit.co/free-stock-video/a-man-being-followed-walking-in-a-city-134/) (Free Video License), SHA256 `de17d355543cda1f396361d2e217ae115c9be5eb60efe22cce0fc6a3d517d54d`. The walker is a technical practice subject, not an athlete or Bloem footage. It keeps the full landscape frame/grounded body and never copies the TikTok picture. The existing licensed Mixkit cinematic whoosh1492 is SHA256 `02b8cd40b3761288d54f4d6706983a2f8c110182b669ae2cdf9aab02935a4e7a`; source/licence provenance is retained in the original sound library. This transition cue is not a real contact sound or music selection.

Use **Depth Anything V2 Small**, [official model](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf), revision `5426e4f0f36572d16453bbda7a8389317b1bef99`. Small is Apache-2.0; Base/Large/Giant are CC-BY-NC4.0 and are not interchangeable commercial defaults. Retain the model notices. Weight99,173,660bytes SHA256 `3152477ce0d8d6978d76b995120de97cb5b928701fd0f817769f59e249a16b70` matches publisher LFS SHA. Config/preprocessor hashes are enforced by the recipe too. No weights are committed or silently fetched by this script; `local_files_only`, safetensors, CPU and two inference threads are used, with no remote Python model code.

Run with an isolated existing compatible torch/transformers/Pillow/NumPy environment and FFmpeg; do not change the editor's Python or repo production dependencies:

```powershell
& PATH_TO_ISOLATED_PYTHON render_controls.py --source ABSOLUTE_WALKER_ORIGINAL --cue ABSOLUTE_WHOOSH_ORIGINAL --model-dir ABSOLUTE_PINNED_MODEL_FOLDER --output-dir NEW_PRIVATE_FOLDER
```

The script refuses changed inputs/existing output folder. Model maps are estimated only for output24/25; shared normalisation avoids a separate min/max pumping between these two frames. It renders48frames/24fps plain, luminance-pair, flat-mask-pair and depth-pair controls, plus identical-picture-muxed cue versions for plain/depth. Opposite-polarity two-frame treatment is a stress/reconstruction control, not a client default. Full-length removable WAV targets its measured10ms energy peak to the first visual pulse at1s; encoded AAC timing still requires a fresh measurement.

Inspect full and reduced frames, actual source/subject boundaries, geometry, brightness jump, clean recovery, normal-speed comfort and heard cue fit. Preserve the untreated version when the effect does not add a meaningful reveal. Never apply a burst simply because the reference uses one. Relative-depth errors, sky/body ambiguity, fine edges, temporal flicker and source-specific framing remain limitations. Phone/native/editor/relink and creative sound acceptance are separate tests.

## Current execution record

See [the parent study](../../SPORTS-REFERENCES-20261103.md) for source-access failures and exact review limits. Runtime installation is private/isolated; no paid/API credits, editor plugins or external inference.

The first protected render used CRF18 and a full 1.334s cue. Its independently encoded plain/effect controls changed pixels outside the two intended pulse frames, and the long cue had an unnecessary lead-in. Keep it as a rejected control. Revision02 trimmed the licensed whoosh to a 360ms window around its measured energy peak, added 8ms edge fades and aligned its target peak with the visual pulse; CRF picture spill remained. Revision03 uses x264 fixed QP18 and the same repaired cue. All six revision03 MP4s decoded to 48 frames at 640×360/24fps. Against the decoded plain control, luminance, flat-mask and depth controls differ **only at frames24 and25**; every other decoded frame is exactly equal. Plain/cue and depth/cue pairs have identical decoded picture. The two cue versions have bit-identical decoded PCM (SHA256 `3256842214eabac902bf78f16974ce66f902b6ece39f292a0c2f198d0c135498`), peak -16.107dBFS and maximum 10ms-window energy at 1.005s. These are measurable construction and export results, not a listening verdict.

Full-size contact inspection of the revision03 pair: plain retains the real moving walker; grayscale/inversion follows fabric, cars and building brightness; the flat mask gives a two-level body silhouette; relative depth gives graduated shoulder/head and background planes. The torso is anchored to the lower frame edge and the head is intact. This is a useful **bounded visual mechanism** and a closer *hypothesis* for the rugby reference's grey-plane punctuation. It does not establish the creator's actual method. The input is a walker, not sports contact; no full-speed comfort, perceived cue fit, physical-phone review, editor/native reproduction or second machine result was witnessed. Do not promote it as a mastered sports edit or apply it to a client by default.

# Natural foreground-over-type source screen — rejected

26 October 2026. This is a private, still-frame source decision for the owner-shared [Premiere Object Mask tutorial](https://www.tiktok.com/@solid.coast.editing/video/7552883833503534339). It is **not** a moving mask proof, client shot or native Premiere/CapCut editability test.

## Candidate and method

- [Mixkit walking in front of a colourful screen #1252](https://mixkit.co/free-stock-video/walking-in-front-of-a-colourful-screen-1252/), offered on its page under the [Mixkit Stock Video Free License](https://mixkit.co/license/modal/videoFree/). Official 720 × 1280 preview/original `https://assets.mixkit.co/videos/1252/1252-720.mp4` was downloaded privately, not committed. It is 421 frames at 24000/1001 fps, 17.559 s, 7,144,824 bytes; SHA-256 `3EC4C2AD8F277F41D30F2226DE4F1596161F2DB545DEFA7D2610122FED2A5E56`.
- The static camera and person's full left-to-right traversal give a real moving foreground, an initially empty title area and a lower body that reaches the bottom frame edge. This appeared more suitable than the locally held close-up dancer and cluttered boxing-gym examples.
- A fictional white `MOVE` word was first placed across the source at 4, 7 and 13 s. The control kept the word over the person. For a narrow A/B, three independent OpenCV GrabCut rectangle masks re-overlaid the source person on top of the same title. The private `screen_mask.py`, source, masks and `mask-screen-contact.png` are under `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\object-mask-20261026`, outside Git.

## Observed result and decision

The plain word reads in the three sampled frames. The masked variant loses major letter portions whenever the central person crosses: at 4 s mainly the right `VE` survives; at 7 s the `O` and `V` split; at 13 s the centre disappears. The mask also includes a large triangular patch of **background at the lower right** at 7 s. The feet reach the actual lower frame edge, so the person is physically grounded, but the copied background patch and unreadable title make this source/placement unacceptable. **Reject the treatment here.** A clean encoder or a more accurate mask would not fix the person occupying too much of the word.

This screen does not prove automatic Object Mask tracking, continuous edges, useful sound timing, actual phone playback or staff editability. For a new source, first screen plain title readability across at least entry, overlap and exit; choose more negative space or smaller foreground coverage. Then check that a natural tracked matte preserves hands/hair and connects to the source/frame edge without carrying background. Compare with a clean title at normal speed before adding it to any client film. Do not expand this three-frame GrabCut rectangle into a general person-segmentation tool.

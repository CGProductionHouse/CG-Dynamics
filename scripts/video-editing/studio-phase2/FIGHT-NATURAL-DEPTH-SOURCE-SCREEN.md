# Fight Night natural-footage depth typography: source screen

**Decision: reject this treatment on this source.** This is a stock-only, silent, three-frame still A/B. It is not a moving effect, a Staffy scene, or proof of a general person mask. The [contact](proof-bag-depth-rejected.jpg) pairs untouched frames (left) with a proposed `HIT` title and foreground re-overlay (right) at source times 0.6, 1.2 and 1.8 seconds.

## Source and test

- Pexels [boxing bag video #7986157](https://www.pexels.com/video/7986157/), local ignored `media/fight-practice/pexels-7986157-720.mp4`, SHA-256 `56d9d9b01954509236a5b81bec172f99d513afad9f2e880c33837b2cb06bf803`. Its 720 × 1280 frames are 60000/1001 fps and have no audio. Pexels' [licence](https://www.pexels.com/license/) permits edits, subject to its restrictions. No stock original was committed.
- Framewise OpenCV GrabCut was initialized independently with `(x=270, y=465, w=390, h=230)`. Its candidate foreground was limited to `x=365:560, y=500:690` and feathered by 5 px, then put back over a 130 px Space Grotesk white title starting at `(365,500)`. This is a deliberately narrow glove/forearm trial, not a full-person matte.
- The boxer's legs remain connected to the bottom frame edge and the glove to her arm. No floating cutout was introduced. The title occupies the gray central column and the bag/glove crossing.

## Observed result

At 0.6 s, the bag and extended glove leave only thin letter fragments. At 1.2 s, almost the whole word is hidden by the glove/bag intersection; motion blur further weakens the boundary. At 1.8 s, the glove retreats but the proposed title position reveals only a partial `H`. The cutout looks source-connected, yet the **word never reads clearly as a word** across this screen. This fails the typography's narrative job before a moving render or phone review. A cleaner segmentation model would not solve the bag occupying the type position.

Do not carry this particular word placement or GrabCut rectangle into a trailer. For natural-footage depth type, first find stable negative space and draw a plain title on three or more action phases. It must read without a mask. Only then test whether a *small, meaningful* foreground crossing enhances it. Keep the original shot as the control; inspect every in-between edge and full-speed playback, and reject a mask that leaks background or severs glove/arm contact. Event footage, approved identity and a reason for type are still required before client use. No music, sound cue, staff-editable title or perspective track was tested here.

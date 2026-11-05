# Natural-footage plane type and hand occlusion — source-specific test

**26 October 2026. Status: mechanical candidate, not approved for a client film.** This follows the static grass-plane experiment and rejected cluttered boxing-mat source. It tests text-in-scene and foreground ordering on moving real footage. No TBS client picture or current TBS edit was changed.

## Source and rights

- Existing local Mixkit `mixkit-carpenter-screw-39692.mp4`, SHA-256 `86BC29EDDAB3241BE248C9E5D538CCE713C3F97A76CAD9137E72B4CEBF0E44DB`, 720×1280, 24000/1001 fps, video only. Original remains outside Git under `C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\restart-source`.
- The [official clip page](https://mixkit.co/free-stock-video/screwing-a-board-in-a-carpentry-39692/) assigns the [Mixkit Stock Video Free License](https://mixkit.co/license/modal/videoFree/), including commercial use. No tutorial footage, music, effects pack or new plugin was used.
- Protected test window: source frames 48–83, approximately 2.002–3.462 s. The white board is a visible plane; a hand and drill bit meet it at the screw. This supplies a real, grounded foreground crossing.

## Three equal-picture treatments

[`render_carpenter_plane.py`](skills/scene-perspective-type/render_carpenter_plane.py) uses one hand-fitted board quadrilateral and keeps the original 36 moving frames intact. It renders horizontal `COVER` type, perspective-projected type, and the same projection protected by a narrow manual hand/bit contour. Three 1.5015 s private H.264 renders live in `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Skill-Proofs\object-mask-20261026\carpenter-plane` as `carpenter-flat.mp4`, `carpenter-projected.mp4` and `carpenter-foreground.mp4`. All are 720×1280 / 24000/1001 fps, silent, 36 frames and fully decoded. SHA-256 respectively: `A12C0C8925D62330B38C68786A03D0D3BEC5699BF040C01457BEADFB371B5A32`, `BD65BAA9AD1E91DC9A24BDACB2D9DF449BCF3DBFB24FAEDC3EB6CC70EDD92416`, `645D154E3EFB30DB95D210958A74B5ABC1FF11814F6D7F1B939BF039E890E22F`.

The flat title ignores the board's diagonal. Projection tilts the lettering with the surface, but draws ink across the worker's fingertip. Protecting the contour removes **5.11%** of projected glyph opacity where the finger/drill meets the first letter. Original-size close crops at the first, middle and last test frames show ink yielding to the finger rather than covering it; the screw still reaches the board. The private `edge-time-contact.png` records those frames. This is a visible layer-order improvement, **not** a convincing printed-on-board illusion: the title has no material texture, matching reflection or scene-motivated reveal, and most of the word remains a static graphic overlay.

An initial automatic dark-pixel mask was **rejected**. It punched grey holes through `C` on the pale board and did not distinguish the hand from dark board detail. The final manual contour was fitted only to this 36-frame window; it does not track other takes or prove general segmentation. The title's first letter remains partly hidden, so word choice and legibility still need normal-speed phone review.

## Gate before actual use

Select a real story reason to put exact words on a physical plane. Check the full source and intended cut, track the plane and foreground in the chosen editor, animate a reveal only if the source motivates it, and inspect every mask edge at full size and on a phone with the complete sound mix. This agent inspected still frames and objective decode, not normal-speed playback or native staff editability. Keep flat/projection/foreground treatments separately editable. Do not promote this source-specific Python contour as an editor or as a TBS approval revision.

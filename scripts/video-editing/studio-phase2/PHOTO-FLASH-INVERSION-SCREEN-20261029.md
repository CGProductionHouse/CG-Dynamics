# Colour inversion against a real studio flash — office background screen, 29 October 2026

This is a negative source-motivated screen of the existing color-invert-glitch family. It is not a client photo film, a verified single real shoot, a reference reconstruction or a default flash treatment. Command-line background work only; no visible GUI/editor, paid/API service, MSI client amendment, Central Canvas change, storage worker or WhatsApp send.

## Source rights and control

The [Mixkit #50635 photographer](https://mixkit.co/free-stock-video/view-of-a-camera-lens-held-by-a-photographer-50635/) and [#50627 model](https://mixkit.co/free-stock-video/model-poses-as-camera-lights-flash-in-a-studio-50627/) pages identify their clips as Stock Video Free License for commercial/personal use. The reverified local originals hash to `CF83E51E7B8E0C0F2F1A19752F6C13B3A15C479D3C511494FA920E5332EB79B3` and `DCE6CF2BC9F4E4FDA7B1FA286C5EE4C2B6343AED5D4D52087B3C970A90435E42`. Both are 1280×720, 24000/1001 fps and silent. They do **not** establish that this photographer shot this model.

The exact prior 76-frame natural-flash cut is reused as plain control: #50635 source106–143, then #50627 source59–96, with the cut at output38 and a photographed exposure flash at outgoing output37. Its existing output SHA-256 is `57abd305c148efc50df53dfeb8121690b44331f1e383f161d59a961b38c4002e`. All three new variants rebuild the same source mapping with the same fixed-QP intra-frame encoder. R01 fully inverts preflash frame36; protected R02 applies 35% inversion to that frame; R03 applies 35% inversion to the actual flash frame37. R01/R02/R03 protect the first36 decoded frames exactly. No source time, shot order or other frame is changed.

## Encoded and visual inspection

All three new H.264 outputs fully decode to76 frames at960×540/24000/1001 with one video/no audio and75/75 changing adjacent pairs. Against the reused natural control, R01 and R02 change **only decoded frame36**, and R03 changes **only frame37**; every other frame is pixel identical. Ordered frames34–40, full-size altered frames36/37 and a four-row 240×135 cut comparison were inspected.

The natural control holds the photographer's skin/camera colour at frame36, then shows the real bright flash at37. R01 changes his skin/camera to cyan-white before the flash; its altered frame differs from plain by mean absolute142.84 RGB levels. R02's 35% blend turns the frame grey/washed out (49.93 mean absolute RGB difference), adding a separate brightness step before the real flash. R03 greys the actual flash (46.90 mean absolute RGB difference), reducing its apparent purpose while the next model shot remains bright. Mean Y for natural frames35–39 is85.92/63.44/187.22/178.85/50.48; R01 makes frame36 187.79, R02 107.00 and R03 makes frame37 144.22. Those values describe picture changes, **not** perceptual comfort or a creative score.

All three inversion treatments are **rejected on this source**. The existing in-camera flash and plain cut are clearer and retain natural subject colour. Do not claim that a lower measured single-frame brightness jump makes an effect safer or more cinematic; no normal-speed human/physical-phone viewing or heard sound review occurred.

| New private output | SHA-256 | Decision |
|---|---|---|
| `preflash-strong-r01.mp4` | `acbb8897a03e09c62aefc689ffa34466e3db93d56e30188ad2b56ad49ce0df78` | Rejected cyan-white photographer. |
| `preflash-soft-r02.mp4` | `084b2907ff837c6d0c6b0c1b59378537b3d3c9218c28795213eb933a95de2e4b` | Protected lower blend, still washed out. |
| `flash-soft-r03.mp4` | `069e38ee7d0e49c45550d8943060d3857f59e5368eae8ff489ea0018308ddb11` | Protected onset shift, weakens real flash. |

Private source reference, render/QA scripts, MP4s, contacts and frame evidence remain at `work/research-continue/flash-inversion`; no media is committed. Native one-PC inversion controls exist separately but add no client approval. Story purpose, independently heard/normal-speed/phone comfort, client colour and second-editor relink remain open. **Mastered: no.**

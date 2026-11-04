# Photographer context pullback — office background screen, 29 October 2026

This is a cleared real-motion test of the existing context-zoom-out family, not a client edit or approved generic zoom. Command-line tools only; no visible editor/GUI, paid service, client footage, Central Canvas change, MSI amendment or storage worker.

## Rights, source and controlled construction

[Mixkit #50635](https://mixkit.co/free-stock-video/view-of-a-camera-lens-held-by-a-photographer-50635/) identifies the clip as free stock video for commercial or personal use under the Stock Video Free License. The local 720-tier original is SHA-256 `CF83E51E7B8E0C0F2F1A19752F6C13B3A15C479D3C511494FA920E5332EB79B3`, 1280×720 at 24000/1001 fps, 218 decoded frames and no audio. The source was already screened in the photo-exposure-cut study; this test uses source frames 80–175 in order, once each. It does not imply a real connection to the separately filmed model clip.

Four 960×540/96-frame silent outputs compare: plain full-frame, linear 1.45→1.0 pullback, smoothstep R01, and a protected earlier-end R02. All effects hold 1.45 through frame15. Linear and R01 end at frame70; R02 reaches full frame by62. The crop follows the camera/lens from approximate source centre (500,249) toward full-frame (640,360). The lens and supporting hand stay in sampled full frames, with no black edge; the pullback reveals more arm, chest and studio background. The plain control shows these immediately.

## Actual output inspection and failed gate

All four outputs fully decode to96 H.264 frames at 24000/1001; each has95/95 changing adjacent pairs and only one video stream. R02 protects the first16 decoded frames of R01 exactly. R02's full-source tail matches the plain decoded picture in31/34 frames from62–95 and26/26 frames from70–95. The three frames just after its endpoint fail strict decoded parity despite the raw full-source recipe, consistent with separate CRF encoding history; this is an inference, not a pixel proof. The R01 tail matches plain24/26 frames from70–95. This partial parity is kept as a failed gate, not retitled as an exact-tail pass.

Ordered contacts at frames0/15/16/24/32/48/62/70, full frames0/16/32/48/62/70/95 and a four-way 240×135 reduced comparison were inspected. The initial crop retains the lens and top hand, and the final view is full picture. R01 still looks slightly cropped at frame62 while R02 is full. At reduced size the difference in revealed context is small, and the unscaled source already identifies a photographer taking a picture at frame0. Neither timed pullback earns the delay in context on this shot, so **the plain shot is preferred for this source**. The faster R02 remains a protected technical revision, not a creative acceptance.

| Private output | SHA-256 | Decision |
|---|---|---|
| `plain.mp4` | `2c95a70cd4dd1092976a236c1cfe2a387d4ff5f88504b7e5e4b8d6cc622079a5` | Immediate context control; preferred here. |
| `linear.mp4` | `91394a09a16ee0fcd1e849bd5e2b8c1c06ed9ad50a079a3c547eacf7b5910186` | Same source/endpoint; constant motion control. |
| `eased-r01.mp4` | `dd3c13ea9e74fe3246d52d1f33734c84cbc9328fe50ab9b71545bdfa539e2188` | Eased motion, late endpoint; not preferred. |
| `earlier-end-r02.mp4` | `f3e4f6a9813255ee1f63465eb39aa3119fdddbb39c2094959da92b2c6df1ecbf` | 16-frame protected revision; earlier full context, strict tail parity fails. |

Private source reference, scripts, MP4s, contacts and QA are at `work/research-continue/context-photographer`; no media is committed. The family still needs a source where the reveal adds a real story fact, plus normal-speed/physical-phone viewing, heard sound where appropriate and second-editor native relink. The earlier native coffee proof remains separate. **Mastered: no.**

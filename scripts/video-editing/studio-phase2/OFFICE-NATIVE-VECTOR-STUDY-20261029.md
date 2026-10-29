# Office native icon import and carousel study — 29 October 2026

This advances the existing vector-option-carousel family in draft PR910. It is an original fictional graphic study, not a PSG amendment, verified offer or client brand kit. MSI projects, Central Canvas and storage workers remain untouched. No purchase, paid/API credits, client upload, new renderer or package was used.

## Rights, source and actual application import

The existing [source manifest](skills/vector-option-carousel/assets/SOURCE-MANIFEST.json) and [complete ISC notice](skills/vector-option-carousel/assets/LUCIDE-LICENSE.txt) were reverified byte-for-byte for Lucide commit `2ca268e74888d3506b3319fb8f94aaaaf70ceca9`. House `28216c479005731ef5e382e7d8627eda2b129b019eb1f3d9de9f5915576d448e`, briefcase-business `98388a2bf7b9d102d77772d125d26f59ea3bed0d8573a5fc8907003099ae9a54`, car `6d70bc146ca53b9c140a859319df471616c1ee6758bfb31a346d549d1fe92211`, notice `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`.

Premiere26.5.0.99 actually rejected SVG import: File format not supported. Office has Illustrator2026 already installed. Private derived copies replace the24px viewport with512px and `currentColor` with `#10151a`, retaining viewBox/path/stroke conventions. Illustrator opened each SVG; actual Save As produced three Illustrator2020-compatible, PDF-compatible `.ai` assets. House was actually closed and reopened, with preview and outline view inspected. An earlier screenshot called an outline witness was only an Open dialog; it is retained as failed evidence and superseded by the actual document/outline witness. Do not infer a reopen from a successful key script.

All three saved assets imported into Premiere through actual UI. The rasterized content bounds differ by icon (house427×448, business469×427, car469×299 from displayed anchors), so artboard size is not a shared imported bounding box. Keep each icon's correct centre anchor; size is deliberately adjustable per icon. Retain original vectors, derived `.ai` files and notice beside the project. [Adobe documents the rasterization of imported Illustrator art](https://helpx.adobe.com/premiere/desktop/organize-media/import-files/import-photoshop-and-illustrator-files.html). Native Premiere Position/Scale controls are not editable vector paths or continuous rasterization; vector construction remains in Illustrator. No font/client branding is borrowed: native Arial Bold52 is practice typography only.

## Actual native construction

Private lane `work/research-continue/native-vector` contains the `.prproj`, assets, screenshots, outputs and local QA. No private native files/media/runtime are committed. All sequencing and key changes were made through Premiere UI, not injected project XML. Read-only project inspection checks the saved objects afterward.

Every export is1080×1920,24000/1001fps,108frames,4.5045s, progressive Rec.709 H.264, silent. Native Color Matte `#F3F0E8` fillsV1; independent house/business/car assets occupyV2/V3/V4; editable legend occupiesV5. The inherited empty research sequence is still named mixkit-561-720, but no tree footage is present in this active graphic timeline. Other parked research sequences are not the proof.

- Static plain control: icons centred atx220/540/860,y960,scale60; all options visible together. Native graphic `HOME / BUSINESS / MOTOR` at approximatelyx163.4,y1671.1,Arial Bold52,navy. Deliberately simple, not a client design.
- R01 movement: slots front=(540,1140,85%), left=(220,820,50%), right=(860,820,50%). Home starts front, business left, car right. Holds through18,36–54,72–90; slot changes end36,72,107. The initial native straight routes create icon collisions: rejected.
- R02 protected copy revision: split only the legend at72 and replace MOTOR with VEHICLE in the later native text clip. The first72 decoded frames are exactly equal toR01; all36later frames differ. Icon paths, scales and timing remain intact. The first text-edit attempt did not change the string; actual text readback and encoded frames confirm the successful second attempt.
- R03 path repair: retain R02 copy and scale keys. Add only native Position keys at27,63,99. House passes(860,1100),(540,600),(220,1100); business passes(220,1100),(860,1100),(540,600); car passes(540,600),(220,1100),(860,1100). This routes icons around the perimeter instead of through each other. It is a bounded2D path, not a physical3D wheel or a proven exact ellipse/easing match. Native object sets are identical toR02; the only non-project content objects changed are Position204/215/226. The first19 decoded frames remain exactly equal toR02.

## Inspection, failures and acceptance boundaries

All seven native outputs below fully probe/decode and contain exactly108frames/one silent video stream. R01, R02 and R03 were each actually saved, closed, reopened from the saved `.prproj` and exported again; each pair is108/108decoded-pixel identical. A transient Media Pending picture appeared immediately after one reopen; encoded parity and subsequent native picture readback, rather than that placeholder, establish the pass.

Ordered all108-frame contacts for R01 and R03 were inspected, including transitions27/63/99 and settled full-size81. The1080×680 three-way static/failed-path/repaired-path comparison fully decodes and its full-size27frame was inspected. A complete ffplay comparison run exited0; this demonstrates playback completion, not independent continuous human judgement. Native timed playback witnesses advance from1:20(frame44) to2:22(frame70), through the second move. This is a witnessed playback advance, not an independent full-speed artistic verdict. No hearing/physical-phone/second-PC/creative mastery is claimed.

An encoded dark-component check in the icon-only vertical region350–1449 finds three large separate components in108/108static and108/108R03frames; R01 has three in82/108 and merges into one/two in26frames. The2500px component-area threshold excludes the briefcase's small separate centre dot. This supports the collision diagnosis for these assets; it is not general occlusion/perceptual approval. Component bounds and every frame's count remain in private QA. Visual contacts agree that R03 removes the congested crossing.

Remaining failures/gates: motion is still visibly angular and unapproved at normal speed; the legend is global and static, not active-only per-option labels. R03 changes the legend after72, so it deliberately does not form an exact full-picture loop. Even the static compressed export's first/final decoded frames are not exactly equal; do not claim exact encoded loop identity from equal native endpoint values. No depth ordering, client offer/brand fit, native path edits within Premiere, second-PC asset/font relink, heard sound, phone comfort or artistic acceptance is proved. Retain the static alternative if comparison is the viewer's job.

## Output identities

| Native output | SHA-256 | Actual reopen parity |
|---|---|---|
| vector-orbit-r01-reopened.mp4 | `081604db4c572983c773a6103f46828002378def316296d6f18f80d870178320` | — |
| vector-orbit-r01.mp4 | `7310ad1383c872c49b6c9075a3dbb395153c853233506dde9b41fcf8ccd35ed4` | 108 |
| vector-orbit-r02-reopened.mp4 | `fdc422103e9abb90f9435b8394914a3a8a65380e748762e678ea547452f2a66a` | — |
| vector-orbit-r02.mp4 | `9c9a6e347e8181703e6273232296591c2b49a2658a6cd97495e2195f0ec7f349` | 108 |
| vector-orbit-r03-reopened.mp4 | `ca29189a924ee442469656ef7af62c8fd38c73e7a66912149d37e50ad150166d` | — |
| vector-orbit-r03.mp4 | `d0298667cc341d612b979869f32417f9c220f0b431d0759e98737fa60062f429` | 108 |
| vector-static.mp4 | `9379ca6d3d177a472579de343024830169582a3046562f8edd6485daec695590` | — |

Local QA: `qa.json`, `comparison-qa.json`, `inspect.py`, `compare.py`, native import/save/reopen/playback screenshots. These are private evidence, not installed dependencies. User-facing copies are in `outputs/Nolan-Research-20261028` on the office PC.

## Next distinct useful gate

Continue existing stabilization family: read its source/negative-control card, verify an actual cleared moving source and exact upright selection before native Warp Stabilizer/plain/crop/revision testing. Preserve intended camera motion and reject lost subject/warped edges. Do not retry the city-follow crop that already loses the walker. The45-family count stays45; this is one family advanced, not a mastered family or a count of unbuilt skills.

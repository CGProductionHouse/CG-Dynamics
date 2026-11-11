# M07 source-specific frosted material: desktop qualification
11 November 2026. Existing Nolan Studio **DESKTOP-M1VHEJF**, owner-authorised isolated research. **M07 partial progress, not complete VFX-family qualification.** Same existing PR910/OneDrive/queue, no second client database or production renderer.

## Why this source and what is actually known
The owner submitted a Facebook glass/motion reference (1A5csyUtWy). Its actual video is still UNVIEWED, inaccessible without a permitted signed-in session. Its creator, animation, fonts and sound remain unknown. The independent study dated 10 November produced original `glass.mjs`, `glass.css`, `index.html` and 16 sampled/negative checks. It failed to finish an 8-second render after 47 frames in the isolated container. Reused that *same exact* source on the authorised Desktop; did not copy private third-party video, buy assets or infer how Facebook's video was made.

## Executed repair
The existing `nolan-browser-motion/render.mjs` local server served `.mjs` as `application/octet-stream`, preventing the module from loading; reproduced as `Missing seek(t) contract`. Preserved the original renderer byte-for-byte under M07 `render-before-m07.mjs` (SHA256 `6efe6e8d35001ce56b6a72c7f861abc268f6b0b1630a00c763c9b87dacf42a91`). Scoped repair adds one MIME entry `'.mjs':'text/javascript'` to the existing allowlisted isolated HTTP server. No Cloud, account, employee browser or production deployment changes.
Retested source in the **existing** headless Playwright/FFmpeg adapter, no new browser engine. Source tests were performed on the actual original `glass.mjs` SHA256 `e88fcb71e206fe4ac21af9e1c4aa2785105f6031a82dd5e50804e10aa8db4c49` and CSS SHA256 `94605779ba65bbc4d12e9308024366ed2bfaf01b02ad7f4dd6b7928df1d2b4d3`. Portable copies in `runtime/components/frosted-overlay` SHA-match the fully rendered version.

## Completed exact outputs
| Variant | Output on protected desktop job | SHA256 | Verification |
|---|---|---|---|
| Effect | `qualification-effect/output/NOLAN-M07-GLASS-EFFECT-8S.mp4` | `4a614e0bb8144872a4dc3e443ef727c02fbc4ce37c0042531b32764a0e2e461d` | 8.000s, 1920×1080, 30fps, 240/240 H.264 frames, full decode, BT.709 TV range, deterministic repeat seek |
| Plain (negative/no material) | `qualification-plain/output/NOLAN-M07-GLASS-PLAIN-8S.mp4` | `1e3ad732abe93a6eaebcfcea91a61c923f32ff8cabc236c396e88d92b0c541ee` | Identical time and source layout, only backdrop blur disabled; 8.000s/240 decoded native1080p frames |

Desktop headless source checks: **19/19** positive and negative. They reject ancestor opacity, filter, clip, blend, will-change backdrop boundaries; invalid physical-material claims, invalid dimensions, absent image changes, outside-band changes, non-repeatable seek, page errors and external network. Out-of-order seek3s→6s→3s produced pixel-identical PNG. Original isolated 16 tests remain preserved as separate prior evidence, not recounted as desktop tests.
Independent exact **encoded** inspection: **22/22** verified after both outputs were made, including separate full-stream re-decodes, SHA correspondence, source/video frame clock, and matched picture at n=0/45/135/225/239. At encoded frame135 the panel ROI changes **26.465 mean RGB levels** with blur; protected upper band differs only **0.476** levels from independent H.264 coding. Real movement: mean frame45→135 change17.803 and135→225 change28.477. Source-equivalent n=0 outputs differ0.229 globally. No hidden generic FPS interpolation, visual mastery or owner taste inferred.
Post-change existing core regression: `test_motion_contract` 18/18 and `test_nolan_system` 14/14, **32/32 total**. First PowerShell test invocation treated Python's normal unittest stderr as a terminating error; reran without aborting the tests; resulting exit0, 32 passed. Both failed attempts and successful proof retained.

## Reuse constraints and results
The component is **CSS backdrop-filter** over moving background with independent sharp foreground text; it is not optical refraction, physically thick glass, native Premiere text, photo-real hardware or a mandatory client visual style. The sample intentionally places moving oversized words behind the panel to demonstrate the effect; this is not a normal client composition. Preserve brand-specific fonts and approval, exact client source/proof, the original Nolan story/preflight, music exclusion and audio gates. No listening or client sound was included; both MP4s are SILENT MATERIAL PROOFS. The test tool makes no actual native host save/reopen claim.
The standalone component is installed only on the authorised desktop in `nolan-browser-motion/components/frosted-overlay/`, referenced by a scoped addendum in the existing installed browser-motion skill. Reuse must call `panel.audit().ancestor_issues` and block a non-empty list; do not confuse a fake material label with photography/3D.

## Continuing the original queue
This resolves **one** M07 source-bound material/mask subtask and the ESM-MIME defect. M07 remains `IN_PROGRESS`: future individual Lottie, Three.js actual production animation, chroma/tracking/motion-blur qualifications remain open, each with real media, plain/effect/negative outputs and artifact review. M05 remains account/native-license blocked; M06 remains perceptual-listening blocked. Nine TikToks and the Facebook source have not been visually/audio inspected. No new subscription, paid service, user-profile takeover, Katana/MSI change, client media send, approval or public publication.

## Reproducibility and primary source
- Local job: `C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion\m07-glass-qualification-20261111`; test scripts `test_glass_desktop.mjs`, `verify_encoded_glass.py`; JSON `DESKTOP-GLASS-TESTS.json`, `M07-ENCODED-EVIDENCE.json`; effect/plain `config.json` and `output/REPORT.json`.
- Exact earlier source bundle: `research/2026-11-10-Glass-Reference-1A5csyUtWy/Nolan-Glass-Reference-Study-20261110.zip`, SHA256 `911b96ed0d34857c17910459c218b0c7de286092618d7e1e70510c2ac146e620`.
- MDN original behavior/background-root caveat: https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- Distinct actual 3D transmission reference: https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial

## Source-only preservation
Source/test archive `Nolan-M07-Frosted-Source-Tests-20261111.zip`, 20,615 bytes, SHA256 `d82f33276cab6027c2cf1882601ad4337e283d16abb4eb30d0706e3c70e26b05`, extracted and SHA-readback verified for 10 included source/evidence files plus `SOURCE-MANIFEST.json`. No actual video, font, music, model weights, third-party reference media or application installer is in this package. The full-length effect/plain MP4s remain on the protected desktop under the exact paths and hashes above; do not claim those outputs are inside the ZIP.

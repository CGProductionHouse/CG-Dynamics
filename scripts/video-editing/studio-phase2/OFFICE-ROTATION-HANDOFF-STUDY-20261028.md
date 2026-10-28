# Office rotational optics and registered roll-cut study — 28 October 2026

Continuation [PR910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), owning874/903. [Intake acceptance](OFFICE-RESEARCH-ACCEPTANCE-20261028.md) precedes these new proofs. This extends two existing families, not a new renderer/library or mastery claim.

## Source and reference scope

Licensed [Mixkit561, upward treetops](https://mixkit.co/free-stock-video/view-of-tall-trees-and-clear-sky-561/), public page explicitly Free licence; [official terms](https://mixkit.co/license/modal/videoFree/) read28October. Normal public source-page request and discovered CDN720p file succeeded. A separate direct licence fetch returned403; official web read succeeded, no auth bypass. SHA256 `f56f0c5adbb6d1d7e7f3792ad6707b0fd14f0068d8b2348d96a61cfe52c27dd3`,1280×720,24000/1001fps,468frames. This is new licensed research input, not one of the8 archived masters; reacquire from the recorded page rather than assume old pack contains it. No client/creator media copied into Git.

[Wanderlust558–567](WANDERLUST-DIARIES-STUDY-20261028.md) is the inherited observed rotational-lens target;603–612 is a different directional-smear handoff. Office did not freshly consume the creator video: active staff browser prevented UI study. Exact template/native settings and reference sound remain unknown. Full-source early/mid/late screen and dense selected6–9s states show natural rotation. RANSAC affine estimates over90 sampled frames accumulate approximately−13.06° image roll,88/89 increments negative or effectively zero; no invented camera move or arbitrary face spin.24fps source sampled30fps repeats some real frames; no generated optical flow.

## A — edge-weighted rotational lens pulse

Run `python skills/chromatic-lens-pulse/render_rotation_ab.py --source LOCAL_561_MASTER --output-dir PRIVATE_DIR`.

Four3s/90frame540×960/30fps exports: plain, zoom-only, rotation-sharp, rotation-shutter. Frames24–35 carry a sin-squared pulse; common peak zoom1.18, up to−8° additional picture turn at edges. Radius≤.22 is protected from rotation and equals zoom-only pre-encode. The shutter variant integrates31 angular spatial samples over±1.5° at peak. These are transforms of each actual source frame, not temporal interpolation. Every map lies inside actual1280×720 source pixels: no reflected border/painted frame. All other pre-encode frames equal plain.

First float64 theta maps produced an interpolation precision mismatch in the protected centre; explicitfloat32 repaired the invariant. The first inverse-map sign turned opposite the source; that four-export set remains privately rejected. Corrected incoming sampling sign follows the measured negative picture rotation during attack. The pulse necessarily returns to neutral, so do not claim continuous one-way rotation through its release.

Corrected hashes:
- plain `4aac9ede796928b91f0484438e547a07a67b37769b1608241a948db7589ed39a`
- zoom-only `ff222e559bf87f176076d1c2452da3dfb063b90729eb87b40f7f7f2653afebad`
- rotation-sharp `1d6b2b880f8cee8cb652e922694bcea25fccc3a1280dbc4f36f7cb2ef8f67f18`
- rotation-shutter `40f36f0ce55f7314f8734250053b32c57d1004f5453cb9dd4c7b759988713164`

Full encoded peakf29 and five-state reduced contact inspected. Rotation curves the trunk; shutter softens outer branches while leaving the central sky opening clear. This proves bounded optics, not that distortion improves a nature film. Plain/zoom remain credible simpler controls. No chroma separation added: isolate rotation/shutter rather than combine every earlier effect.

## B — registered release across a declared same-take time cut

Run `python skills/motion-matched-speed/render_roll_handoff_ab.py --source LOCAL_561_MASTER --output-dir PRIVATE_DIR`.

Outgoing6–7.5s, incoming10–11.5s; cut at outputf45. This deliberately omits2.5s, not continuous documentary time, two separate locations, a captured horizontal whip or the rejected coffee action match. Keep all three controls at the same1.35 crop zoom.

SIFT/RANSAC aligns actual incoming branches/trunk to the outgoing frame:1108 inliers of5323 matches, median source-space reprojection error1.0044px, similarity correction+11.8484°/scale.98292 with translation. Release correction to identity throughf45–56 using smoothstep; the picture turns in the existing negative camera-roll direction. Sharp and31-sample spatial-shutter controls preserve plain frames outside45–55. All maps stay within actual source pixels. Source/time ranges and full matrix are in private evidence.json; reproducible parameters remain code-editable.

Hashes:
- plain-cut `826d00a4729b0465271fd29e5002ca16a1c3016807607c6642c3acb89db0fce6`
- registered-release `c834c2c23f910e8c46b2fa6656c498fea55fd651e22e94fd6c465f0a195fe3a3`
- shutter-release `be74e4a75b46a7df168750d983e3af9270942eb14f47c49f3fbe0943e915d858`

Full encoded cutf45 and seven-state reduced contacts inspected. Trunk placement is closer at the cut; the registered release still moves substantially afterwards. Actual decoded RGB mean absolute cut difference drops58.48→20.97 (shutter20.84), not zero: parallax/leaves/exposure and imperfect alignment remain. No seamless-cut claim. Shutter blurs the trunk during release; sharp registration is the necessary clarity control, not an automatically inferior version.

## Verification, location and next distinct gate

Seven corrected current source-based exports fully decode90frames each. Two labelled side-by-side MP4 comparisons are saved under office outputs/Nolan-Research-20261028; originals/frames/receipts and the wrong-direction rejects stay under private work/research-intake. Source hash guards, within-source assertions, outside-window identity, centre invariant and direction assertion execute in the recipes. No full-speed desktop review after staff conflict; physical-phone comfort, independent heard sound and native layers/save/reopen/relink remain unverified. Silent tests do not meet beat or musical-fit gates.

No app code/production dependencies, client amendment, public/WhatsApp send, cloud hosting, security/account or spend changes. No new engine, new technique count or mastery promotion. Next acquire a purposeful genuinely different-shot directional handoff; natural clean-plate/foreground, physical device capture and same-object three-take gates remain separate. Do not reuse a time-cut proof as evidence of those source prerequisites.

Validation: both recipes parse; canonical skill and both amended cards pass quick_validate with Python UTF-8 mode. First validator attempt lacked PyYAML; reviewed official MIT PyYAML6.0.3 Windows wheel (SHA5fcd34e47f6e0b794d17de1b4ff496c00986e1c83f7ab2fb8fcfe9616ff7477b), isolated no-deps install repaired it. Default Windows cp1252 decoding then failed on existing Unicode; process-only -Xutf8 repaired it without changing global settings.45 card rows match both projections;315 local links resolve; diff check passes. An initial row-count assertion included repeated header links, then correctly scoped the tables. Build command initially used the outer chat cwd, then rerun in the actual research worktree; no application failure inferred.

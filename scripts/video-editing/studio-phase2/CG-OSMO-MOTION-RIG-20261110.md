# CG Osmo motion-composition implementation — 10 November 2026

Owner directive: stop recycling simple Osmo BTS montages and actually implement Nolan's motion-graphics craft. Earlier CG R01–R07 are review candidates, not accepted creative benchmarks. Latest owner feedback: boring, missing a team member, awkward camera-facing shots, cheap transitions and unacceptable music. The client/owner feedback overrides aesthetically neutral test passes.

## Connected implementation, not another effect-name checklist

- New reusable module: `.agents/skills/cg-video-story-editor/scripts/cg_motion_graphics.py`
- Existing proven Nolan link: `camera_plane.depth_layer_rect` supplies the rigid 2.5D gallery geometry. This uses source aspect preservation and parallel camera translation, not a generated person depth mask or warped face.
- Operators: `GraphicsRig.background` (moving-source-derived teal/orange gradient plate), `motif` (branded measured grid, animated arc, real official CG logo and progress marker), `card` (moving original footage in rounded image plane with pre-multiplied-like image/alpha and soft shadow), `corners`, `compose_feature` (focus-to-full-frame, rigid-depth gallery and framed split focus).
- A source-specific three-row composition in the private renderer uses three separately filmed, synchronous genuine sources and settles into a full-frame studio scene. It is **not** a general registered panel API or an automatic person cutout.
- Production renderer: `render_r08.py` under the authorised Nolan Desktop PC's private `cg-osmo-20261110` working directory. It consumes the protected R07 19.5s 30fps 1080×1920 video as its frame-clock source, and uses the new operators on selected actual scene ranges. All original Osmo camera media and existing CG approved artwork remain untouched. The official CG outro frames510–584 and studio reveal frames420–509 are intentionally left unadorned.
- Exact input file, linked official logo, versioned module, proof/control hashes and timing segments are kept in private R08 manifests; **no client footage, personal data, music, model weight, font or binary goes to Git**.
- Control and effect: `motion-proof/RIG-PLAIN-90F.mp4` SHA256 `f1b6e7697b3c698ef4b4a2bfae0e01b76c359c40a3ba04915bc814a14d9a4916` and `motion-proof/RIG-PROOF-90F.mp4` SHA256 `d05ca7ea8930d18c96647e8d9139d2148c264d8afc6518afe8ee8b2542e3a516`, both exact 90-frame 540×960/30fps encoded. Control uses the same frame times and real source footage, with only the designed treatment omitted. Full first/middle/last contact examined; first revision with near-empty first frame was rejected and the entry geometry corrected.
- Focused synthetic test contracts: seven passed on Nolan Studio PC using real installed Python/Pillow/OpenCV/NumPy. Dedicated portable tests live in `.agents/skills/cg-video-story-editor/scripts/test_cg_motion_graphics.py`. Covers shape/aspect, rounded alpha, easing, deterministic frame output, movement, actual picture changes and incorrect mode rejection.

## Owner-review R08

The new 1080×1920 picture export has 585 frames/30fps/19.5s. Owner-review MP4 R08 SHA256 `f802ac949d8ff2e4b0ff913da0d25b0936efd4339b0abc29c9f4962a36532ddd`, 23,938,524 bytes, no fully black frame or consecutive exact duplicate decoded frame; actual soundtrack elementary stream was verified *identical to R07* (Rising Forest, Mixkit #471, **not creatively cleared by owner**). Full decoded export contact includes all affected scenes and cut boundaries. Machine proof is `TECHNIQUE_TESTED / CLIENT_CANDIDATE`, not `MASTERED` and not `OWNER_APPROVED`.

## Creative and technical limitations

- The design proof shows real motion-graphics operators executed on the actual encoded CG moving picture. It is not evidence of a normal-speed independently heard music review, physical phone comfort test, native After Effects/Premiere/CapCut editable project, alternate client identity/brand use or public posting permission.
- No machine checkpoint can determine whether the motion design feels premium, restrained, original or non-cringe. An output can pass every code check and still be creatively rejected. The user had repeatedly rejected prior ordinary montage/shallow-transition approaches.
- The module intentionally omits fake apps, client claims, invented depth and guessed fonts. It uses official supplied logo asset and directly owner-supplied CG palette, plus linked source footage. Large full-frame card graphics may not serve all clients or products: compare against plain video at normal speed and mobile size before adopting. The visual system has **no automatic licence to replace the user's actual client art direction**.
- The installed desktop skill may lag the live PR910 head. A GitHub commit does not install this operator on Katana/MSI; each other device must fetch the live branch, preserve its active work, run the matching test, decode one controlled motion output and record its exact dependency/source receipt.
- Existing 53 documented techniques remain 53. This extends the existing planar-depth/framed-composition route, not a newly claimed mastered skill family or a replacement rendering engine.

## Next real improvement gates

1. Obtain owner feedback on R08 actual *video* and music, preserving original R07 and all rejection history. If the same grid/card structure is rejected, retire this particular design rather than forcing it into another film.
2. Qualify actual audio listening, licensed music fit, phrase placement, purposeful sound accents and end-five-second result. Metadata/EBU levels do not certify sound quality.
3. Add stronger source-driven motion where footage permits: genuine subject/plane tracking, polished graphical reveal of useful work, meaningful UI state changes or typography with verified approved font. Do not merely apply panels universally.
4. Validate native staff-editability on the actual target editor after save/close/reopen/export if requested; Python+JSON+MP4 are reproducible graphics, but are not native AE/CapCut text layers.
5. Bind the accepted operation to the *same* source-specific story plan and release manifest; fill no PASS fields retrospectively. Promote only after actual internal owner acceptance.

Documentation/update belongs on existing shared draft PR910; separate MSI PR875 and original owner/client media remain untouched.

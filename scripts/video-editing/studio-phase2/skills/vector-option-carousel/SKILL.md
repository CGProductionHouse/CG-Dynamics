---
name: nolan-vector-option-carousel
description: Present related options through a restrained animated icon carousel using a consistent imported vector family, with readable settled labels and a static control.
---

# Imported-vector option carousel — portable construction proof

**Owner requirement:** PSG feedback asked for an attractive rotating set of service options using existing designed icons, and rejected the earlier weak icon section. This is an original practice composition responding to that requirement. It is not a PSG revision, approved client brand package, verified insurance offer or interactive UI.

Choose the message before the wheel: use sequential emphasis only when one option at a time helps the viewer. Keep a static alternative when all options need to be compared immediately. Use one licensed vector family with matching stroke/viewBox conventions, retain its original files and notices, and replace the practice font/palette with the client's verified assets before any client use. Do not mix unrelated clip-art styles or assume every service represented by an icon is offered.

## Sources and portability

The three imported [Lucide](https://github.com/lucide-icons/lucide) SVGs are `house`, `briefcase-business` and `car`, pinned to commit `2ca268e74888d3506b3319fb8f94aaaaf70ceca9`. For these icons the upstream notice is **ISC**, not an assumed MIT licence; [the full upstream licence](assets/LUCIDE-LICENSE.txt) and [SHA-256 manifest](assets/SOURCE-MANIFEST.json) are committed with the original vectors. Space Grotesk is already present under SIL OFL 1.1. The practice uses fictional navy/cream/lime styling, with no client footage, logo, generated icon, stock scene or audio.

`python render_ab.py` verifies asset hashes and uses the **already installed Inkscape CLI** to rasterize styled copies, without altering the original SVGs or installing a package. It then creates [a static three-option control](proof/static-options.mp4) and [the rotating candidate](proof/orbital-options.mp4), both 540×960, 24 fps, 4.500 s and silent. SVGs, labels, script, [per-frame motion values](proof/motion-keyframes.json), [evidence](proof/evidence.json), [phone contact](proof/phone-contact.jpg) and [actual decoded settled frame](proof/encoded-business.png) are in Git for the office editor. The rasterizer path is Windows-specific and must be checked on another machine; no office runtime is claimed.

## Actual proof result

The carousel uses an elliptical 2D path with depth-ordered size and colour emphasis. It is a graphic depth cue, not a physical 3D wheel. Each option gets a short settled hold; its larger label fades before rotation and appears only after the next option settles. All circle bounds are checked across all 108 frames. First and final pre-encode frames match exactly, so the cycle returns to the same state. Both MP4s fully decode. The nine-phase 180×320 contact, full-size settled picture and decoded MP4 frame were inspected: imported strokes stay consistent, the active `HOME`, `BUSINESS` and `MOTOR` labels read clearly in the sampled holds, and no icon leaves the frame.

**Construction passes; creative use remains conditional.** The candidate makes one option larger at a time, while the static control shows all three labels immediately. That tradeoff must suit the film's story and available reading time. The first contact sampled transition boundaries and missed the settled business/motor labels; it was corrected to inspect the actual holds. No music/SFX has been added or heard, normal-speed/physical-phone comfort has not been judged, and a native editor project has not been reopened. For staff editing, import the same SVGs into the chosen editor and keep each icon, label and position/scale/colour animation separate. The flat MP4 is a preview; the portable source/keyframes are a reconstruction recipe rather than a native editor template.

Add sound only to supported motion events and the actual music phrase. A settled option may warrant a restrained accent, but do not attach an arbitrary whoosh to every label. Preserve approved client fonts/colours and safe areas; the demo styling grants no brand substitution.

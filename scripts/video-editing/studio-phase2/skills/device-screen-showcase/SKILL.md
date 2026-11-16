---
name: nolan-device-screen-showcase
description: Present a client's real website or app screens on correctly proportioned laptop and phone frames, with glass UI, per-scene camera moves and readable headlines, for graphics-led showcase films.
---

# Device screen showcase — owner-reviewed in the CG websites film

**Use when** the story is "we built this" or "here is the product": websites, apps, dashboards. Not for footage-led edits, and never with recreated screens presented as real.

**Inputs:** the client's actual screenshots (ask for them; R02), long enough to scroll; the exact brand palette and verified fonts; a headline per scene.

**Construction (browser route, [study code](../../studies/claude-browser-motion-20261111/cg-websites/build_timeline.py)):**
- Laptop **front-on** with true MacBook Pro proportions: lid about 1000×650 (16:10.3), 16 px side/top bezel, 22 px chin, a 118×20 notch, a slim base 9% wider than the lid with a centre thumb lip, and a soft floor shadow. Tilt the whole flat assembly in 3D (rotateY roughly −18° to +18°). The earlier folded keyboard deck read as squashed and was rejected (R05).
- Phone: rounded titanium frame with dynamic island; screens are crops of the same site, scrolling with a slow ease.
- Screens: background-image scroll plus a fixed diagonal reflection and one soft glare sweep per scene (screen-blend band). No mirrored reflections under devices: they show backwards text (R06).
- Glass UI for labels, buttons and icons: translucent fill, 1.5 px light border, inset top highlight, `backdrop-filter: blur() saturate()`.
- One big headline per scene, fitted to a measured width after `document.fonts.ready`; copy on one side, devices on the other.
- A different camera move per scene: swing in from the side; start inside the screen at about 2.5× and pull back; orbit in with a card-flip phone; rise from blur into focus while a phone drops and lands; power-on flash with screens flying out.

**Evidence:** CG "We build websites and apps" R04–R06 (see [case study](../../../../../.agents/skills/cg-video-story-editor/references/cg-websites-video-case-study.md)); CA said "nice" to R06. Stills and contact sheets inspected at full size; no normal-speed human review recorded; silent.

**Gates still open:** licensed music fit; native editor editability (it is a rendered MP4, not native titles); real names visible in app screenshots need CA's confirmation.

**Rejected:** decorative bubbles, single-line light streaks, corner sun rays, teal-heavy grounds, devices overlapping text.

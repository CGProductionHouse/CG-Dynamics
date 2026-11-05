# Fight trailer scene 1: first-impact timing proof

**Result:** a 1.001 s, 24-frame, vertical *stock practice* impact beat is technically reproducible. [Dry picture](proof-fight-scene1-dry.mp4), [one-cue version](proof-fight-scene1-impact.mp4), and [four-frame contact](proof-fight-scene1-contact.png) use the same video stream. This is a scene-level technique test, **not** the Staffy Fight Night trailer, an audio approval, or proof that the complete trailer has a good opening.

## Source and editorial decision

The practice source is [Mixkit #40974, “Two men on a ring fighting in a boxing match”](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/), 720×1280, 24000/1001 fps, 14.014 s, SHA-256 `938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634`. Its [free stock-video licence](https://mixkit.co/license/modal/videoFree/) permits a modified video end product. The source has **no audio track**. The visible selected hit occurs near source 5.375 s. This was judged from the 5–8 s contact sheet at 8 fps, then the output at 4 fps; a later event select must be checked at original frame rate and sound.

The cue is Mixkit's “Short punch in the face” #2165 from its [punch SFX library](https://mixkit.co/free-sound-effects/punch/), 1.179 s stereo PCM, SHA-256 `540617d4b9f5b2b55527ac148edfdf1eaecb31d1d781ee515b6fbba8b740ce05`, under the [free SFX licence](https://mixkit.co/license/modal/sfxFree/). Its source waveform peaks 0.0328 s after the file starts. An onset at local 0.342 s puts the decoded output peak at **0.3748 s**, near output frame 9 and the visually sampled contact. Gain is 0.4 (about −8 dB before AAC). That is a *timing* result; its perceived texture, fit and mix have not been heard.

`python render_fight_impact_scene.py` checks both source hashes, crops the source to 5.0–6.001 s without changing the 9:16 field of view, adds an on-screen `STOCK PRACTICE` label using the already bundled Space Grotesk font, renders the picture once, then stream-copies it into dry and cue versions. Original source and the SFX WAV live in ignored `media/fight-practice/`; no source asset is committed. The first 3.003 s candidate was inspected and **rejected as a cold-open beat** because it lingered through obscuring gloves after the useful hit. The 1.001 s revision retains approach, contact and initial reaction, leaving the next shot to carry escalation.

| Check | Result |
|---|---|
| Video | Both MP4s have 24 frames at 24000/1001 fps, 1080×1920; full FFmpeg decode returned 0 |
| Picture protection | Extracted video-stream SHA-256 equal in both: `5dc6db623d97a320d2ad455f7aafbd7376714aef1f801013cf7efc9d8978af17` |
| Audio | Dry PCM peak 0; designed AAC peak 12,610/32,768 at 0.3748 s |
| Output files | Dry SHA-256 `ef3f25a715bd3aebe8044dce9b56ddbb4485241d9473caf608c85c8d78b41ea0`; designed SHA-256 `d65e8ecc7920acf6de8dd14140c387aa6201a4cc8116c057d234b5def8419633` |

The stock is an already slowed, 24 fps encoded shot; it cannot demonstrate additional clean slow motion. Its close-up face is readable, but the following gloves obscure both faces. The isolated cue sits in otherwise silent audio because the stock has no production sound; this **does not** represent the intended layered event soundtrack. No full-speed headphone or phone audition was possible here, and a silent dry control versus an added punch is not a matched-loudness creative comparison. The event cut must start with Franco's original camera sound and use a distinct verified hit. A visible landed shot may be strong without an SFX; if a sound layer feels artificial, keep the dry version.

## Next scene gate

When event source arrives, find at least two independent clearly landed moments with their original timecodes. Test a 1–2 s first impact followed by a different, readable continuation shot; keep ring geography and fighter identity coherent. Cut the continuation on genuine motion rather than joining unrelated reactions as if they were one punch. Then compare no-added-effect and designed versions at matched loudness with a listener. Only after that can this scene earn a place in the 30-second trailer.

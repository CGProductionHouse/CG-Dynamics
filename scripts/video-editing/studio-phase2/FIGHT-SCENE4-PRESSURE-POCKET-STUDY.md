# Fight trailer scene 4: pre-contact music pocket, technical A/B

**Status:** a timing/mix mechanism only. [Continuous music control](proof-fight-pocket-control.mp4) and [brief music duck](proof-fight-pocket-duck.mp4) share identical stock picture and the same licensed music excerpt. Their sole change is a smooth 0.55–1.35 s gain envelope, descending to 18% from 0.80–1.15 s just before a visually sampled glove contact at local ≈1.175 s. No punch SFX was added. The source video has no camera audio, so this cannot test a genuine pressure pocket made from ring breath, footsteps or crowd. The audio has **not been heard** at normal speed, and no musical-fit or creative approval is claimed.

Practice picture: [Mixkit #40974](https://mixkit.co/free-stock-video/two-men-on-a-ring-fighting-in-a-boxing-match-40974/), source 4.2–7.2 s, SHA-256 `938bba8c5c586d700be40e2cabf628713dcc440caefb931d8229d1e99f1ce634`, [free video licence](https://mixkit.co/license/modal/videoFree/). Practice music: Grigoriy Nuzhny's “Epical Drums 01” #676 from [Mixkit's percussion-trailer collection](https://mixkit.co/free-stock-music/percussion-trailer/), source 20–23 s, locally downloaded from `https://assets.mixkit.co/music/676/676.mp3`, SHA-256 `47182a9547cbbbbf7d833e60c06fcdc08c7b064d084f4802b1b68557cba5780b`, under the [free music licence](https://mixkit.co/license/modal/musicFree/). This is a rights-cleared practice candidate for web/social end products under the stated licence; no licence or fit decision has been made for the actual event trailer. Originals remain in ignored `media/fight-practice/`.

`python render_fight_pressure_pocket.py` reproduces the A/B. Both H.264/AAC outputs fully decoded, each 1080×1920, 72 frames at 24000/1001 fps and 3.003 s. Copied encoded video-stream SHA-256 is identical in both: `6495841a3317eafae478acb49a505b0b8701c20522e3d0a179e8d0af5cf17f1e`. MP4 SHA-256 values are `a6da6f9a2e56d1448610d11ab182d4c443c974380339f3cf25e52d3622042bd7` (control) and `930809ef60b62caa2f68a6653c95ed696082c595804dfeea180d021e19a2b38b` (duck).

FFmpeg `astats` on matched 0.27 s excerpts confirms the intended audio difference, with AAC encoding variance outside the pocket:

| Local excerpt start | Control RMS dBFS | Duck RMS dBFS |
|---|---:|---:|
| 0.20 s | −24.58 | −24.58 |
| 0.83 s | −25.57 | −40.48 |
| 1.60 s | −21.45 | −21.44 |

The ≈15 dB pocket depth is measurable; whether it feels tense or like a faulty music edit is unknown. A gain curve is not atmosphere. This 3 s stock study is not a scene 4 final, an approved song, or a 30-second trailer. Do not insert it into the event cut as a template.

**Next gate:** choose a verified event moment with original production sound and a suitable legally cleared music phrase. Build an equal-picture continuous-music control and a second version that briefly makes room for true ring sound. Keep music, location ambience, impact and optional SFX on separate editable tracks. Audition matched-level A/B at full speed on headphones and speakers, then phone; reject a drop that breaks the musical phrase, weakens contact, or exaggerates an uncertain blow. Have a second reviewer confirm the source hit.

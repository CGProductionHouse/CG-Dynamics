# Sound-led cut practice: rejected sip cue

**Status: rendered negative test, not mastered.** Compare the [music-only control](proof-sound-cut-dry.mp4), [SFX revision](proof-sound-cut-rejected-sip.mp4) and [11-frame contact](proof-sound-cut-contact.png). This is a fictional stock-only coffee sequence for editing practice, not a client video or advertisement.

The picture has an espresso-machine detail, then two distinct takes of the same woman with a mug. The wide-to-close cut uses a similar cup movement. The videos themselves have **no source audio**. Both variants use the same licensed Mixkit `Cat Walk` excerpt from `project.json`. The revision adds only the separately licensed Mixkit `Sip of water` effect at 4.30 s. Source URLs, licence links, in-frames and SHA-256 values are in [the study manifest](sound-cut-study.json); [the renderer](render_sound_cut.py) verifies every file hash before use. Original stock video/audio stay ignored locally rather than being redistributed as standalone assets.

## Result and editorial decision

The two protected exports are 720×1280, 24000/1001 fps, 130 frames and 5.422 s, H.264/AAC. Both fully decode. Their encoded video-stream SHA-256 is identical: `da365bac8a65fe5b97bc6d4bddaea4da8ac30139d3967472dce60d8ddb552668`. The control measures −20.09 LUFS integrated / −2.70 dBTP; the SFX revision measures −20.04 LUFS / −2.63 dBTP. These measurements check relative level and headroom, **not whether the effect sounds good**. Audio has not been critically heard on speakers, headphones or a phone.

The contact and denser source-frame samples show the woman mouthing or blowing near the cup in the close-up, rather than a clearly visible sip. A stock sip sound would assert an action that the footage does not prove. **Do not use or promote this revision.** The music-only control is the safer of these two technical versions, but it too has not passed a normal-speed creative/audio review. The espresso shot may also imply that the machine produced her mug; do not use this illustrative assembly to claim a real process or location.

The first attempted manifest requested 38 frames from a 185-frame close-up starting at frame 149. FFmpeg ended after 36 available frames, producing 130 output frames while the recipe expected 132. The recipe now requests 36 and rejects any future out-of-range source selection before rendering. This is a concrete source-range check learned from the proof.

## What this exercise changes

For a real sound-led cut, choose a source with a clear visible action and preferably usable camera sound. Audition the dry edit first, then add a cue only if its character matches that action. Compare at equal loudness and review the actual export at normal speed. The next test should use a genuinely visible sound event (for example, a cup touching a surface) and a separately licensed matching recording; it should not try to rescue this ambiguous close-up with louder or more effects. Native staff editability remains a separate handover gate.

# Nolan Studio phase 2: first moving-footage depth-type experiment

This is the bounded #874 **effect development** lane stacked on draft technical PR #873. It does not edit PSG, use its footage, or change Premiere/CapCut. It tests one project-local addition: pinned HyperFrames 0.8.183 with GSAP 3.14.2 for seekable typography. Existing FFmpeg supplies the performer key, layering, audio mix and checks. Review the actual [moving A/B](proof-motion-ab.mp4), [baseline](proof-baseline.mp4), [revision](proof-revision.mp4), [A/B frame](proof-ab.png) and [2 fps motion contact](proof-contact.png). The three transformed proof videos are committed for review; original stock files and render intermediates remain ignored by Git.

**Creative state: rendered, NOT MASTERED.** A real moving performer covers the type, and a precise word revision visibly works. This is **not** a recreation of the owner's PSG reference: that reference uses footage *inside* a text matte. This agent has not heard the audio or watched the final clip at full speed on a target phone; staff/owner judgement of typography, mask hair edges, rhythm and song remains pending. Green-screen stock makes this a chroma-key test, not a natural-footage segmentation test. Do not present it as an approved CG or PSG video.

After this proof was published, an initial canonical-URL attempt in a different Chrome profile returned `net::ERR_HTTP_RESPONSE_CODE_FAILURE`. We stopped when a separate user-owned TikTok tab changed during observation. A later isolated tab in the Chrome profile the owner identified **did play the exact [Solid Coast Editing reference](https://www.tiktok.com/@solid.coast.editing/video/7558410119273549079)**. Visible points at roughly 00:05, 00:19, 00:23, 00:30, 00:50, 01:02 and 01:09 show a 1:13 Premiere tutorial: cyclist/woodland footage inside large `INSIDE` text on black, Track Matte Key on the footage with the text track as matte alpha, then keyframed type scale/position that pushes through the letter to full-frame footage. It is a **footage-in-type reveal**, not a person-covering-text example. The browser player was muted; narration/music were not audibly assessed. No reference frames or audio were copied into this repo.

The separate [reference-matte proof](proof-reference-matte.mp4) and [five-frame contact sheet](proof-reference-contact.png) test the actual effect family at 1080×1920/24 fps/4.5 s. `render_reference_matte.py` reuses the existing licensed Mixkit take, music and whoosh, the local Space Grotesk font, Pillow 12.2 and FFmpeg 8.1; it draws a framewise `MOVE` text alpha mask, reveals moving footage in the glyphs and expands/dissolves into the full shot. It is an original fictional test, not a clone of the tutorial or a PSG edit. The rendered MP4 fully decodes and has AAC audio. The contact sheet confirms the matte at 0–2 seconds and the full moving scene at 4 seconds; a perceptual full-speed/audio and phone review is still pending. The masked performer is keyed from green screen; this does not validate masking an ordinary PSG office shot. The simple dissolve at the end is visibly different from the reference's more polished keyframe push.

A later Chrome inventory located the exact video URL open in the `christie-ann` profile, in the `🎬 Nolan Production Check` tab group. Claiming that existing tab returned “already part of [another] browser session,” so this agent did not read, play, navigate or download it. The earlier HTTP failure was in a different Chrome profile and does **not** mean the owner’s tab cannot play the video. Reference analysis remains pending exclusive tab access or a permitted local copy.

## Source and rights

`project.json` is the source manifest: exact Mixkit performer, Cat Walk music and whoosh source/licence links and SHA-256 values; source in/out timing; fictional ECHOFORM palette; font; reference and missing owner-reference status. Mixkit's [stock-video free licence](https://mixkit.co/license/modal/videoFree/) and [stock-music free licence](https://mixkit.co/license/modal/musicFree/) permit modified social/commercial end products subject to their restrictions. Stock source media is local only; the repo does not redistribute it. `scene/assets/SpaceGrotesk.ttf` is the open [Google Fonts Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) with bundled SIL OFL notice. No client claim, footage, stock-as-client implication, cloud generation, paid API or media upload.

The publicly shared [Herk Edit Kit motion showreel](https://github.com/nateherkai/herk-edit-kit#examples) was downloaded to ignored `media/`, probed as 15 s / 1920×1080 / 60 fps / AAC and sampled at 2 fps. Its observed recurring graphic motif and bold type scale contrast informed the earlier original fictional treatment. The video and audio were **not copied**. Audio of either reference was not perceptually reviewed here. See [AUDIT.md](AUDIT.md) for candidate decisions.

## Local setup and reproduction

Tested on Windows, Node 24.16.0, FFmpeg 8.1.1, installed Chrome, Python 3.13. From this folder, run `npm ci --ignore-scripts --no-audit --no-fund`. This installs only the pinned package tree in local `node_modules`; it does not run package install hooks. On the first render HyperFrames acquired its headless Chromium into a user cache; local output contains its exact version in render logs. The renderer sets `HYPERFRAMES_NO_TELEMETRY=1` and `DO_NOT_TRACK=1` per process, with no global setting change. The original trial's `hyperframes doctor` reported optional local Whisper, TTS and MusicGen absent, which this effect does not require.

Acquire the three files from the exact Mixkit source links in `project.json` and save them at its `media/` paths. The script refuses missing/changed source hashes. Downloading the Herk showreel is optional for rendering; if present, its hash is checked. Then:

```powershell
python render.py baseline
python render.py revision
python verify.py
```

`scene/index.html` is the editable 4.5 s 1080×1920 type source: colour, font, layout, perspective and beat-timed GSAP keyframes. `revision.json` changes only `word-three` from `BASS.` to `BEAT.`; `render.py` checks the old text before substitution, writes a versioned HTML source under ignored `output/<variant>/scene/`, renders its type layer through HyperFrames, composites real footage and music/SFX with FFmpeg, and writes SHA receipts. Reference media and vendor JS remain ignored; the OFL font, HTML and scene manifest are committed. If this experiment is adopted, make the output package portable with authorised media storage rather than placing stock originals in Git.

## Witnessed results and gaps

| Local evidence | Baseline | Word revision |
|---|---|---|
| MP4 | `output/baseline/echoform.mp4` | `output/revision/echoform.mp4` |
| Format | 1080×1920, 24 fps, 108 frames, H.264/AAC, 4.5 s | Same |
| SHA-256 | `d70151640a45e71be1e85b09292ba3747bf6564e749bf8b17352d7a5338fdb64` | `367d0c571ae7e9faaf06c3d29df0fd4ea29eefbe4fdefae317ca0a4528050735` |
| Bytes | 2,895,713 | 2,875,303 |
| Measured end-to-end render | 16.87 s with software Chrome/one worker | 15.90 s |

Both MP4s decoded fully. The static A/B proof at 2.5 s shows **BASS. → BEAT.** and genuine performer-over-type occlusion. Audio decoded PCM is exactly equal between versions (`ea07b1dc6b1eb8082e5f38c439b3a4f43c8ccabaa758302d3921eea96d70ae43`). The output mean/max levels were −26.6/−7.8 dBFS; no black interval ≥0.1 s at the selected threshold or silence ≥0.25 s below −50 dB was reported. Source music's beat tracker estimated 129.2 BPM; first large word entrances were placed near 0.46, 0.92 and 1.38 s after the 10.425 s music start. **This beat alignment is technical, not a listening approval.**

The committed [moving A/B](proof-motion-ab.mp4) puts both 4.5 s renders side by side at 540×960 each, with baseline audio. It decoded completely; SHA-256 `363b68de06eddacb8687a943de3350ae4cf847288280989ed01de817da5c1513`. Judge its motion and sound directly rather than treating the still image as the creative result.

Important revision limit: the first 33 decoded video frames before the revised word appears were **not pixel-identical** across separate HyperFrames HTML renders (0/33 equal; SSIM 0.994555). Re-running the *same* baseline source produced an identical type MP4 hash, so the changed HTML word affected raster/encoding beyond its intended visible time. `verify.py` records this instead of claiming perfect protection. It passes a narrow technical check at SSIM ≥0.99 and exact PCM equality; an accepted-scene byte-preservation guarantee remains for the proven #873 FFmpeg scene cache, not for this within-scene HyperFrames edit.

Two HyperFrames lint warnings about nested structure remained (0 errors); the minimal pilot rendered correctly but should be split into proper sub-compositions if promoted. The stock chroma key has some visible hair/arm spill, and tiny corner labels sit outside conservative TikTok UI safe areas (they are nonessential). No natural-camera tracking, SAM 2 mask, verified 4K output of **this effect**, phone crop check or full-speed audio audition was performed. The later reference-matte proof tests the observed effect family, not a shot-for-shot recreation. PR #873 separately proved 4K FFmpeg export, which does not establish this effect's 4K quality.

## Next precise improvement

The owner reference is now visually accessible. Next, obtain a full-speed headphone/phone review of the proof and apply the footage-in-type reveal only to a rights-cleared, story-appropriate PSG shot after #872's brand, current-content and no-reuse gates are cleared. The reference does not require subject segmentation: its track matte is based on editable type. Keep the earlier [`skills/depth-type/SKILL.md`](skills/depth-type/SKILL.md) at **rendered / human review pending** until a CG reviewer approves a real use.

The later read-only [PSG #872 preflight](PSG-PREFLIGHT.md) reconciles the archived approved master to the local Rev5, tallies source exclusions and records the current brand/reference access gates. It does not clear a client shot or claim an owner-review edit.

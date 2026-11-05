# From shared technique to an actual client edit

3 November 2026. This replaces the disconnected plan/release path, not the existing editor or renderer. Read alongside the client library, production standard and latest owner feedback. System repair does not lift the office production stop.

## One continuous production path

CA's5November effects emphasis is implemented in the [exact-reference execution guide](../../../../scripts/video-editing/studio-phase2/CA-FIVE-EFFECTS-EXECUTION-20261105.md): camera, incoming tonal subject prelap, invert-extract texture and filled/outlined depth type now have explicit operators and rendered controls. Plan text entrance/hold/foreground interaction/exit and the sound job throughout the film. Select mechanisms because they strengthen that client's actual hook/development/payoff; do not substitute a repeated font/fade, effect-name checklist, logo or correction for visible craft. The physical last-frame mechanism requires the linked capture brief at content-guideline time. Unit tests and technical demos do not approve artistic fit.

1. Load the exact client's saved library, approved films and keep/change/reject decisions. Resolve the assignment, audience, current month/location, footage/public-use history and one useful viewer action. Keep the approved parts of previous work. Do not make a generic concept and attach the client's logo afterward.
2. Before encoding a film, choose the music against the real picture, mark its actual phrases/beats and build a roughly30second frame timeline. Write three genuinely distinct hook candidates; choose an opening that shows the subject or tension immediately. Define the viewer change and visible proof for hook, development and payoff. This is an editorial decision; nonempty wording does not prove a good hook.
3. Give **every shot** a visible action, viewer inference, graphic job and sound job. A clean shot or deliberate silence can be the right choice; state why. Check that the middle develops the promise instead of leaving all craft in the intro. Include orientation/stabilisation, per-shot correction/sequence matching, brand/type/safe areas, prior-use and classified B-roll sound. Do not pad to reach30seconds or use muted direct-to-camera speech as B-roll.
4. Open the relevant current technique cards from `scripts/video-editing/studio-phase2/skills`, including their failed controls and source limits. Choose mechanisms that serve this story. Bind the actual implementation and parameters, not a tutorial name or “add effects later.” Test the highest-risk short section on real cleared sources first; compare with a plain control at full and reduced size and in motion through a legitimate local route. Do not use the owner as a routine practice audition service. Do not declare an unobserved listening/phone/native review complete.
5. Run the existing `preflight_story.py` against the private story JSON **before a full render**. It now checks the production frame plan, duration, scene jobs, music stream, cut anchors and selected implementation bindings. Fix failures in the plan rather than filling review boxes after rendering.
6. Use the existing Python/FFmpeg renderer or appropriate native editor. Have that renderer/script emit the `edit_manifest` from the **same plan objects actually used** to make the film. For native work, retain the actual project, settings and witnessed output comparison. Do not retype a plausible manifest after an unrelated render. Export the plain control from the same source/time/layout with just the selected treatment omitted. Preserve text, font, colours, timing, media links and audio stems for revision.
7. Inspect the exact encoded opening, middle, ending and cover; inspect normal-speed picture/sound where legitimately available. For revisions, locate each screenshot/quoted-clip instruction in the **sent export** by visible text/action and output time/frame, then compare the intended range and adjacent frames in the new encode. Check action/beat alignment in the delivered file, not only an offline marker list. Listen for crew direction, truncated speech, wrong musical character, clipping and unintentional silence. Keep failed/pending perceptual gates explicit. Run `check_client_release.py` against the exact revision. Any changed plan, implementation, media or evidence requires fresh bindings/review. A successful command returns **CANDIDATE_FOR_INTERNAL_REVIEW**, never artistic or owner approval and never authorization to resume a rejected film.
8. Only with current assignment/send authority and genuinely completed material gates, use the established delivery rules. Document plus proposed caption in one message; separate caption-free HD cover; internal note separately. Preserve rejection/approval evidence and update the client library. A technical candidate cannot waive the owner stop, rights, musical fit or story judgment.

Run these from the shared skill's `scripts` directory (use absolute private paths):

```powershell
python preflight_story.py C:\private-job\story-plan.json
# Existing renderer/editor uses that plan; no new rendering engine.
python check_client_release.py C:\private-job\release-record.json
```

## Production data added to the existing story/release records

Keep the ordinary fields in `preflight_story.py` (client, goal, audience, hooks, shot rights/prior-use etc.). Add:

- `fps`: numeric constant frame rate. Each shot has integer `timeline_in_frame`/`timeline_out_frame`, end exclusive, contiguous from0. Source `in`/`out` remain seconds. Picture totals27–33seconds for the current roughly30second brief; a new owner-authorised format requires a deliberate contract revision, not a self-approved short-cut reason.
- Each shot's `intent`: strings `visible_action`, `viewer_inference`, `graphic_job`, `sound_job`.
- `story_beats`: `hook`, `development`, `payoff`, each with `frames: [start,end]`, `viewer_change`, `visible_proof`; together cover the timeline.
- `music`: `{path, sha256}` for an actual audio file. Stream presence is not a musical-fit verdict or licence check.
- `cut_anchors`: one per shot boundary, ordered, with `cut_frame`, `anchor_frame`, `kind` (`music_beat`, `source_action`, `dialogue`, `designed_sound`) and `reason`. Cut must be within one frame of its declared anchor. These are declared markers, **not independently detected/heard beats**. Verify against the actual mix; meaningful non-beat cuts must explain their action/dialogue/sound basis.
- `skill_library_root`: absolute path to the checked-out technique-card directory, not a stale machine's path.
- `skill_applications`: selected **visual** applications with unique `id`, safe `skill_id`, card `card_sha256`, `implementation: {path,sha256}`, `purpose`, `mechanism`, nonempty `parameters`, `role` and `frames`. Useful roles include `type`, `composition`, `transition`, `scene_depth`, `motivated_motion`. Logo/basic correction alone does not satisfy the current visual-craft request. Sound stays in the existing cue/stem/audio-review records. No effect-per-second quota is implied.

The release JSON adds `story_plan: {path,sha256}` and `edit_manifest: {path,sha256}`. The manifest contains `plan_sha256`, `video_sha256`, `fps`, the exact `shots` used and `applied_skills`. Each application contains its `id`, exact planned `choice`, `plain_control: {path,sha256}` and integer `control_start_frame`. The checker revalidates the plan and compares decoded output/control frames at the claimed application ranges, with matching dimensions/frame clock. Hashes bind versions; they are not a security signature or proof that a self-authored manifest is truthful. A decoded difference establishes a picture change only: re-encoding or an irrelevant change can differ too. Actual recipe/source inspection remains required.

The creative-review JSON attributes `reviewer_kind` as `author_editorial` or `independent_editor`, never disguising model/metadata checks as independent approval. Existing review areas now also include `hook_and_story`, `skill_application`, `beat_timing`; each evidence artifact needs `evidence_sha256`. Author judgment remains author judgment even when every field says pass. Existing client identity, naming, media and audio gates are retained. Legacy all-pass records intentionally block until genuinely migrated; do not mass-fill new fields on rejected films.

`scripts/test_edit_contract.py` is a complete **synthetic schema/integration example**, not a client story/music template. It runs the portable operators, encodes actual outputs and calls the existing release entry point. Its external identity/audio gates are stubbed only for fixture isolation, and its silent WAV is not accepted creative music.

## Four portable implementations now available

`scripts/visual_treatments.py` extracts four tested image operations from the existing library. Import it into the existing renderer; it does not encode, choose a brand, select music or become another editor. Pillow and NumPy were already in the proof stack. Callers provide the approved font and colours explicitly; no fallback font is substituted. Caller-authored glyph masks/RGBA artwork also support the client's existing exact Canva-rendered type when no local font binary is licensed.

```python
from PIL import Image, ImageFont
from visual_treatments import type_reveal, registered_panels, text_aperture, glyph_shine

font = ImageFont.truetype(approved_font_path, approved_size)
layer = type_reveal(frame.size, [(word, approved_rgb)], font,
                    position=(x, y), time=frame_number/fps,
                    start=start_seconds, fps=fps)
frame = Image.alpha_composite(frame.convert('RGBA'), layer)

# Both images already have the intended output framing and same dimensions.
# All apertures sample one common incoming picture/time canvas.
frame = registered_panels(outgoing, incoming, time=transition_seconds,
                          arrivals=arrivals, centres=centres,
                          half_width=half_width, shear=shear,
                          resolve_at=resolve_at)

# glyph_mask is the actual same-canvas approved type alpha, mode L.
# Keep the same advancing source time before, inside and after the reveal.
frame = text_aperture(current_source_frame, glyph_mask, approved_background_rgb,
                      scale=planned_scale, pivot=inside_filled_letter_stroke)

# Preserve the RGBA title's original alpha; illuminate only its visible glyphs.
title_layer = glyph_shine(approved_title_layer, centre=planned_centre,
                         width=planned_width, shear=planned_shear,
                         strength=planned_strength, highlight_rgb=approved_highlight)
```

Type provides a clipped, staggered vertical resolve with graphic-only shutter integration and a sharp hold; keep the actual approved font/colour, meaningful words, legibility and safe areas. Panels provide registered incoming-picture apertures rather than separately fitted repeated images; select timing/geometry around the source action. The default has no white flash. The aperture scales about an opaque stroke, rejects a letter-counter pivot and resolves to the unchanged current source image. Shine is a soft glyph-confined highlight with unchanged alpha, not a moving white rectangle over footage. None is automatically an improvement; each may lose to its plain control. Their linked cards retain source-specific failures. These code-rendered layers are rasterized in the export, **not native editable text**. Staff handover needs the recipe/source/fonts or a separately witnessed native implementation. The other41 families remain card/recipe/native-proof dependent, not newly converted portable APIs or creative mastery. The new [licensed-source integration controls](../../../../scripts/video-editing/studio-phase2/PORTABLE-TYPE-OPERATORS-20261103.md) record dark-aperture and reading limitations rather than promoting them as client hooks.

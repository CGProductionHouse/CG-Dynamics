# Autonomous sound review — component repair, 3 November 2026

## 6November MSI recovery — documented, not installed on PC

MSI's PR910 comment6685488892 and PR875 comment6685488231 report a working
bounded GPU route. PC read the actual private `MSI-GPU-REUSE.md`, staged trial,
final-review source, qualification and sound manifest in the R06 evidence pack.
The8,082,479byte ZIP matches cloud quickXor; local SHA256 is
`5c25d912b47c5d92c0dae9839ad7f70fa28c62ab41d05352e3eb15d516a994e5`.
Cloud SHA256 was not supplied. Private pack remains in Watch Addict's established
working library; no paths, recordings, raw observations or model binaries are
copied into Git. Its Markdown uses Windows1252; decode explicitly if UTF-8 fails,
retain original bytes and do not rewrite the source archive.

Tested MSI environment: RTX4060Laptop8GB, isolated torch/torchaudio2.9.1+cu128,
Transformers4.57.3, bitsandbytes0.48.2. Ordinary GPU load OOM/CPU-offload failures
remain failures. Working runtime stages only oversized151936x2560 output-head
NF4 quantisation in1,048,576-element CPU blocks, then transfers packed weights;
ordinary matrices retain the vendor CUDA operator. The process-local method is
not an installed vendor-source change. Read the actual pinned audit before use.

Reported guards: driver-free>=7168MiB, process fraction0.72,2CPU threads,
3GiB free system RAM before start/1.5GiB floor,15minute cap; measured peak5.30GiB
for30s. **Do not lower PC's existing9GiB route guard or blindly run MSI scripts.**
They use private absolute paths and read-only dependencies from another isolated
runtime; this is not a portable installation. Target-device inputs, manifests,
dependencies, resource guard and fresh original/held-out calibration must be
verified before using that different route. No GPU/model execution occurred in
this PC reconciliation.

Five actual new controls and19 composed observations support only texture,
pulse/drive and energy. Genre/instrument/melody/stereo/timestamps, human hearing
and taste remain outside the qualification. Preserve signal -> independent ASR
-> acoustic coverage/provenance -> qualified narrow critic -> attributed five-area
picture/sound assessment. R06 consumed full30.016s plus opening4s/tail4.016s;
an acoustic near-tie was retained and explained by actual master provenance,
not a relaxed threshold. Its exact PCM could support R09 only after equality
and a fresh context/picture assessment. It does not clear PC's unheard tutorial
cue or any changed mix. Older broad-model failures remain excluded.

CA explicitly rejected making a staff listener the dependency for finishing an
autonomous edit. A real human route remains optional; do not repeatedly ask staff
to complete the system's work. Repair the actual failed capability. This does not
authorise pretending to hear, relabelling failed controls, or releasing unfinished
films. Continue one existing film at a time.

## Separate the responsibilities

1. Decode the exact final export, retain its picture and audio hashes, and use the
   existing `audio_review.py` signal analysis for full-file silence, early endings,
   loudness and true peak. Do not ask a language model to replace sample timing.
2. Use local ASR as an independent speech guard. Its words and voice evidence are
   useful; its timestamps were wrong even on a known five-second sentence. A
   transcript is not music review. No transcript does not prove no singing or
   every possible vocal distraction.
3. Use the existing offline acoustic encoder for bounded sound-character evidence.
   `local_audio_evidence.py` runs only already-present local models, verifies the
   pinned acoustic weights, limits threads/GPU allocation, and covers the entire
   decoded mix in four-second windows. Long inputs must never go through random
   processor truncation. Neither cosine similarity nor a genre tag is a calibrated
   probability, musical-fit approval, or proof of quality.
4. Keep editorial entrance, continuity, transition, ending and mood decisions
   explicit. Compare the actual source tail and exact output when a reviewer
   alleges a missing ending. Compare music and designed accents with this client's
   pictures and buyer. Do not substitute source metadata or technical compliance
   for the remaining perceptual/creative evidence.

Run the acoustic role in the isolated torch/transformers environment and the voice
role in the existing faster-whisper environment. Both take `--audio`, `--model`
and a **new private** `--output`. Acoustic also requires `--weights-sha256` from
the completed restricted safetensors conversion receipt. They perform no download,
installation, playback, upload or send. Their output explicitly remains evidence,
not release approval. Preserve the staff workstation's resource headroom.

### MSI Windows voice compatibility, 4 November 2026

The shared voice helper previously passed a pathname to faster-whisper. On the
MSI's faster-whisper 1.2.1 / PyAV 19.0.2 combination that raised
`TypeError: av.open() got an unexpected keyword argument 'metadata_errors'`
before inference. The helper now uses the already-required local FFmpeg to
decode mono 16 kHz float32 PCM and passes that array directly to Whisper. This
avoids additional dependencies in the voice environment. A regression checks
the array path and 32 kHz stereo conversion. The real local controls detected
the complete SAPI spoken sentence alone and over a percussion bed, and returned
no credible speech for a sustained instrumental pad or a percussive
instrumental track. On the actual
Action Sports R14 extracted mix it returned `speech_detected: false`, but also
emitted a low-confidence one-word `you` segment. Treat that as a weak negative
speech guard, not proof that every vocal sound is absent. Voice timestamps and
creative music fit remain outside this component's qualification.

### MSI music critic negative control, 4 November 2026

The MSI has an RTX 4060 Laptop GPU with 8,188 MiB total/7,956 MiB free when
idle. The office MOSS character role explicitly requires at least 9 GiB free,
so its qualification cannot simply be copied to this machine. We tested the
official MIT-licensed Microsoft Phi-4 multimodal ONNX int4 build, revision
`295df4cddf8c3740df7cd66e5d05f06a872fcaf5`, with DirectML in a private
Windows virtual environment; every downloaded large weight was checked against
its published LFS SHA-256. The official example loaded and consumed local WAVs.
With the same neutral prompt, however, it called a 12-second smooth sustained
synthetic pad a "pulsating beat" and "energized". It gave almost the same
description to the truly percussive control. The pad's SHA-256 was
`906ffe1188f87ac889fde6e30b88dc9319aa67e2b7adc114363349be708ef841`;
the percussive control's was
`37e5bf900897120f6e88c23e6de011d0b4405123d4c4b3b8b5637576b08d78a4`.
This route **fails music-character qualification** on the MSI. Loading, MIT
licensing and local processing are not enough; do not use its generic prose as
a creative listen or repeat prompt variants until one answer sounds plausible.
No client audio was supplied to this candidate.

An independent, audio-specific **research-only** candidate was then tested:
Liquid AI LFM3-Audio-2B GGUF Q4_K_M plus matching projector at revision
`39670cb5c42e9c4bfe046519ba7ffbe47f9552ad`, with pinned official SHA-256
weights and the official llama.cpp Windows CPU binary `b12099`. The identical
prompt described the smooth pad as a machine running at constant speed and the
percussion as rhythmic clicking. It consumed the files and detected a texture
contrast, but did not identify either musical character reliably. It is **not
qualified** as Nolan's music listener. No client audio was processed. Its LFM
Open License v1.0 also conditions free commercial use on annual company revenue
below US$10 million; do not put it into production without verifying that term.

The Apache-licensed MOSS-Audio-4B GGUF route would have reused the office
model family on the MSI CPU. Its third-party quantized checkpoint and official
CrispASR Windows release were inspected; the `v0.8.50` CPU release archive
matched GitHub's published SHA-256. Windows Application Control then blocked
`crispasr.exe` **before its help command ran**. The 4.11 GB model transfer was
cancelled; no client audio was processed. Do not bypass workstation application
control or present this as a working CPU listener. Reconsider only through an
approved, normally executable runtime or policy-authorised installation.

### MSI acoustic role now runs locally on CPU

`local_audio_evidence.py acoustic` retains the office PC's CUDA default and
minimum GPU headroom. `--device cpu` is an explicit MSI fallback capped at 60 s
per input and four Torch threads. It keeps the same model-source hash checks,
full-file four-second windows and `creative_release: false` result. The MSI's
isolated environment has Torch 2.9.1+cpu, Transformers 4.57.3, SciPy 1.18.0
and SoundFile 0.14.0. The pinned Apache-2.0 LAION
`clap-htsat-unfused` revision is
`8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a`; its original
`pytorch_model.bin` SHA-256 is
`1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb`.
It was loaded with `torch.load(..., weights_only=True)`, checked as a
tensor-only state dict and converted locally to `model.safetensors` SHA-256
`784ef9b12da43186801ffe47bf8df6e5742bef2b59f94256bb84a9a1ba30a14a`.
The pinned source/converted files and a `download-receipt.json` remain private
outside Git. The production helper refuses changed weights or an incomplete
receipt and performs no download itself.

Actual MSI controls: isolated speech classified `speech`; synthetic sustained
triad classified `tones` in all three windows; synthetic kick/snare/bass
classified `uncertain`, `uncertain`, then `music`; speech over percussion was
classified `music` throughout, retaining the known CLAP mixed-speech failure.
The independent Whisper guard detected that mixed speech. The 26.331 s decoded
Action Sports R14 audio stream classified `music` in all seven full-coverage
windows, with margins 0.12–0.43. Its MP4 picture runs 26.433 s; this acoustic
finding does not account for the final 0.102 s of picture or judge musical fit.
The fused CLAP control was also tested and was not promoted because it called
the synthetic pad a machine hum and missed mixed speech. None of these tags
establish an audible creative verdict, beat appeal, cue taste or phone playback.

On the MSI, run the local voice helper on the exact decoded mix, then the
acoustic helper with the pinned private unfused model and `--device cpu`.
Retain the office PC's separate 9 GiB MOSS character route for qualified music
texture/drive review there. No model in this MSI trial passed the equivalent
music-character controls; route that assessment to a qualified workstation
instead of claiming the MSI heard or approved the soundtrack.

## Observed failures and fixes

- General generative reviewers missed a known dropout and invented events. A
  narrower MOSS prompt still described guitars when the input was a voice saying
  words about music. Broad MOSS, Qwen and previous Gemini review failures remain
  failed. Do not solve this by changing prompts until one answer looks plausible.
- Independent CLAP correctly separated the first five speech/music/tones/noise
  controls and distinguished the rock/funk pair. That bounded result did **not**
  qualify full review. A later flat classification compared a broad music label
  against more specific descriptions and wrongly classified electronic music.
- The repaired hierarchy groups specific music prototypes under music. Fresh
  held-out music, speech, tones and noise classified correctly. Mixed speech over
  music was low-margin and still failed the mixed-class requirement. Therefore
  CLAP alone is not the speech guard. Independent Whisper recovered the entire
  held-out sentence in both pure and mixed speech and produced no transcript for
  five music/tones/noise negatives. These are component results, not full creative
  reviewer qualification.
- Original clean/dropout controls and new dropout, clipped, early-ending and blank
  controls all produced the expected signal failures. The three-tone control
  measured three equal 880Hz bursts. Signal analysis owns those facts.
- The exact WiseRide score tail matched the selected source with correlation
  0.99991 and zero measured lag over20.4–23.6s. The unused final source second was
  already near-silent. Do not extend the film with empty logo time because a failed
  model imagined an abrupt cut. This is continuity evidence, not a cadence/taste
  verdict or heard approval.

## Enforce qualification in code

`audio_review.py check` now refuses a model review without a hash-bound calibration
declaration and result. The declaration names the exact reviewer/pipeline version,
required original and held-out controls, their input hashes and review-area scope.
The result binds each control's original raw observation, actual pass/fail outcome,
and the same reviewer identity. Missing/duplicate/substituted controls, failed
results, changed artifacts or partial review-area coverage block release.

Private qualification structure:

```json
{"qualification": {
  "declaration": {"path": "private-declaration.json", "sha256": "actual hash"},
  "result": {"path": "private-result.json", "sha256": "actual hash"}
}}
```

Declaration: `reviewer`, `required_controls` containing `id`, `held_out` boolean,
`input` path/hash binding and `areas` drawn from entrance/continuity/transitions/
ending/mood. Result: `reviewer`, `status`, `observations` containing those exact
IDs, actual `passed` booleans and `raw_observation` path/hash bindings.

Hash/schema checks establish integrity and coverage, not the truth of someone's
assertions. Do not manufacture a passing result, use unit fixtures as calibration,
assign a music tag to all five areas, or retroactively promote a failed method.
Historical records without qualification are not newly recertified by this repair.
Full creative qualification was unfinished at this checkpoint; the later composed
instrumental workflow below supersedes that state within its explicit scope.

## Follow-up findings, 3 November daytime

The same speech control and prompt were tested with the existing MOSS checkpoint
without language quantisation, using bounded GPU/CPU dispatch. All901checkpoint
tensor names/shapes matched the architecture. The unquantised diagnostic still
called pure speech mixed sound and contradicted itself about voice presence.
Compression was not the sole cause; do not run another prompt/model lottery or
promote this route. Retain the failed precision comparison.

On Windows, CUDA's reported free memory can differ substantially from the driver
reading when staff graphics applications are active. The local acoustic helper
now uses the smaller CUDA/nvidia-smi value and refuses unknown driver headroom.
Thread and per-process memory caps remain in place.

Use the exact client's approved sound references without assuming they share one
genre. PSG's two pinned approved exports have different actual acoustic profiles;
their reusable observations are saved in that client's existing audio library.
Similarity to one approved film is descriptive, not permission to copy its music
or proof that a new cue fits. Metadata such as a track title cannot supply the
expected genre for a purported blind test.

Measure a designed cue against the bed around its actual event, not just the whole
film's LUFS or the cue's peak. PSG's existing paper accent peaked exactly at the
current frame200transition but its100ms RMS was28.31dB below the bed. A protected
single-cue16dB increase retained the music and encoded picture, measured-18.03LUFS/
-3.14dBTP, and protected the source PCM24prefix/tail. This remains an unheard local
repair, not an audibility/creative release verdict. Those gain values are specific
to that cue; do not turn them into a blanket SFX preset.

## Composed instrumental review repair — 3 November afternoon

Qualify each tool for the role it actually performs. A generative music critic
that fails event counting, silence timing or speech detection must not own those
tasks. Its broad failed results remain failed. This does not automatically
disqualify a separately tested narrow music-character role.

The existing local workflow now composes these roles, in order:

1. Exact-export FFmpeg/DSP signal checks reject gaps, clipping, blank material
   and early endings before any music assessment.
2. Independent local ASR rejects speech and mixed speech before the music critic.
3. Acoustic windows require continuous coverage and actual music. Uncertain or
   nonmusic windows need exact source/master provenance explaining purposeful
   effects or decay; an unsupported noise window blocks review.
4. A pinned local MOSS critic assesses texture, drive and emotional character
   only after those guards pass. Fresh equal-RMS sustained and percussive controls
   qualify this narrow role. The exact qualified prompt, inputs, raw responses,
   source tree and checkpoint hashes are retained. Genre, physical instruments,
   melody, stereo placement, event counts and timestamps are outside this proof.
5. Nolan records an attributed model-assisted editorial assessment against actual
   pictures, source rights, cut timing and all five existing review areas. A music
   description is evidence for that assessment, not automatic creative approval.

`audio_review.py instrumental-guard --packet ... --voice ... --acoustic ...
--provenance ... --output ...` returns `REVIEWABLE_INSTRUMENTAL_MIX` only. It does
not grant creative release. `local_audio_evidence.py character` additionally
requires the hash-bound character qualification, source audit and passing exact
guards. It uses the complete input up to the supported 30.1-second limit, not a
random excerpt. Inspect help for required artifact paths. Never reuse a review
after the decoded mix changes; unchanged PCM can preserve sound observations,
but new picture/sound relationships need a fresh editorial assessment.

Actual composed calibration passed 16 observations: fourteen original/held-out
routing and signal cases plus two fresh music-character controls. Fresh random
tone/gap DSP observations were saved before opening their hidden truth. Twenty-
five contract tests pass, separately from that empirical calibration. Unit tests
are not listening. Earlier full Qwen/MOSS/Gemini failures remain excluded.

The exact WiseRide R05 mix passed this bounded model-assisted sound gate. The
critic's forward-driving pulse/energy assessment was combined with independent
signal, speech, acoustic, source and picture evidence. Its disputed genre/melody
claims were not promoted. Human listening remains unrecorded. A direct host audio
transport test explicitly reported unsupported audio input; no native hearing is
claimed. This qualification is instrumental-only, not universal audio perception,
human taste, phone playback, client approval or creative mastery.

Sound clearance did not clear WiseRide's film: comparison with an actual recent
public reel then revealed overlapping story and shots. That draft remains held.
Use the client's saved canonical social mapping before repeating public searches.
An unavailable monthly report or partial sync does not mean there are no posted
films. Retrieve the exact mapped post, verify its identity, inspect actual moving
content and save the useful reference in the existing client library. Reuse that
evidence on later jobs rather than rediscovering branding or guessing freshness.

### Reassess changed context without repeating unchanged perception

Keep signal/voice/character observations bound to the actual decoded input. An
added publication-history asset can invalidate a broad context snapshot while
leaving the soundtrack unchanged. Refresh and compare the context explicitly:
prove existing feedback, baseline, source brief and assets unchanged; identify
the exact added record; recheck video/audio/input hashes; then read and reassess
the retained observations and all five audio judgments. Save a new dated context
assessment and packet, preserving the old records. Do not call this a new listen,
new model review, cleared source story or full-film approval. If relevant feedback,
music rights/exclusions, intent, media or the actual sound changes, reconsider the
affected judgments rather than mechanically carrying them forward. WiseRide's
actual additive-history refresh preserved its sound assessment while retaining
the whole-film source/story hold. This prevents unrelated asset registration from
triggering repeated model inference or brand research.

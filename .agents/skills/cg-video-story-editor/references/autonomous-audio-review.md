# Autonomous sound review — component repair, 3 November 2026

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
Full creative qualification remains unfinished at this checkpoint.

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

# Exact-export audio review and feedback gate

Use an actual authorised listening method and bind its evidence to the exact final export. The Gemini route below is optional and requires authorisation for the exact uploaded material; an actual authorised local human listen is also supported. The helper records evidence; it does not upload, send, install, listen or alter an editor automatically. Do not treat an unavailable route as a reason to invent a listening verdict or upload client dialogue/media without explicit approval.

## Before planning: retrieve, do not rely on chat memory

Run `audio_review.py context --client-kit <private-client-kit> --output <new-private-folder>` from this directory, then **read its `READ-BEFORE-EDIT.md`**. It retrieves the current baseline, recorded feedback, brand/audio references and their hashes. If the client is new, populate its existing kit convention first; do not invent approvals. Read the exact current Dynamics guide/plan and recent authorised feedback alongside this snapshot. Use the existing skill's story preproduction gate and source ledger; this is not a second brief/strategy system.

For revisions, name the preferred export and only change the requested areas. For new edits, retrieve the relevant approved/rejected decisions, rather than copying another client's style. Preserve the successful wording/reveals, reject previously flagged awkward ranges, choose actual motion/action payoffs, verify season/project identity, never repeat clips, and select a restrained or energetic sound architecture because it serves this viewer. Each has to be applied to the new footage, not merely copied into a checklist. Store exact choices in the existing story brief/source ledger.

## Prepare from the exact final export

### Qualify the listening route before scoring, not after a batch render

Before committing to a cue or finishing the first film, establish the actual available listening method. A working upload UI or a model saying it heard the attachment is insufficient. After a route/model change or inconsistent response, use a small blind known-clean/known-fault control with acceptance written before inference. Keep expected answers out of the prompt and retain full responses. Validate approximate observations against decoded PCM; meters cannot substitute for musical perception. A failed control excludes that route for the current review, rather than triggering the same test separately for every client.

Audition the candidate's intended beginning, middle and ending against a short scene before expensive finishing. Fix cue character, action timing and closing phrase there, then complete one film and review its exact export. A later picture-only change can retain an unchanged audio stream as historical evidence when encoded/decoded audio identity is proved, but must still receive a current audiovisual sync review; do not call the old entire-film review current.

When the available provider fails calibration, repair the shared dependency once. An already-authorised local listener or a bounded, properly licensed on-device model may be investigated without uploading private media, spending credits or replacing the editing engine. A local model remains unqualified until it passes the declared controls; log its exact weights/runtime, inputs and raw outputs. Neither installation nor an inference response clears this film. Keep final sound/creative gates intact, preserve edits and continue the concrete route repair instead of producing more unreviewed cue variants or repeating unchanged blocked-status reports.

Observed office failure,3November2026: several browser routes missed a known approximately one-second internal mute while asserting audio access. Seven revised pictures accumulated before a reliable listening route was established. That is a dependency-order failure, not seven independent client defects. Local-runtime investigation is not a claimed successful replacement until actual calibration and exact-export review exist.

Further local evidence: Qwen2-Audio consumed distinct clean/fault mel features and identified coarse music/tones, yet missed the mute, invented a three-minute event in24seconds, and gave identical uninterrupted verdicts on matched four-second clean/fault windows. Keeping the audio encoder in full precision did not repair that same test. These routes remain excluded for final review. Successful installation, nonidentical features or a correct sound-class caption do not establish temporal reliability. Preserve these failures rather than turning them into a pass through a changed prompt or acceptance criterion.

1. Finish picture first; deliberately place music/SFX/camera sound on separate native tracks. After every late picture insertion, re-read audio start/end/source ranges and fade keys. A key beyond a truncated clip proves nothing. Check decisive action frames and sound attacks/tails in Premiere; an audio-only model cannot prove sync.
2. Export through Adobe to a new versioned filename. Write a private audio intent JSON:

```json
{
  "buyer": "Exact audience from the story brief",
  "message": "The film's one useful promise and action",
  "music_fit": "Why this mood, texture and song suit the audience",
  "opening_design": "Describe the actual intended entrance/rush/hold, if any",
  "ending_design": "Describe the musical resolve/fade and logo timing",
  "feedback_applied": "Specific current feedback carried into this cut, with private references",
  "allowed_silence": []
}
```

Only add `{ "start": 0, "end": 0.6, "reason": "Intentional opening fade" }` if that describes this actual cut. Do not whitelist a dropout to get a green result. No universal LUFS target, compulsory riser or compulsory rush.

3. Run:

```powershell
python -B audio_review.py prepare --video 'C:\private\final.mp4' --intent 'C:\private\audio-intent.json' --context 'C:\private\startup\context.json' --output 'C:\private\audio-review-v1'
```

The new private directory contains: `Mix.mp3` for review; local analysis WAV; `signal.json` with loudness/true peak, silence and100ms level envelope; exact video/audio hashes in `packet.json`; `gemini-prompt.txt`; pending `review.json`. Unexplained silence over350ms, no audio, clipping and an audio stream ending before picture block handoff. Full picture decode/brand/media checks remain in the existing release workflow. Technical measurements cannot judge song suitability, clicks, masked detail or musical taste.

## Review in the verified company Google AI Studio session

The owner requested ongoing Gemini review as part of the editing workflow. Use the already authorised company session for routine music/SFX-only excerpts from authorised edits. Keep client-kit text, private messages, video and contact details local. If the mix contains confidential dialogue or another unapproved data category, obtain specific upload authorisation or use an authorised local human listener instead; do not silently remove dialogue and claim to have reviewed the full mix. Do not create API keys/billing or spend credits. Existing subscription status does not imply an API entitlement. A new agreement/access expansion remains a separate permission decision.

Use the supported Chrome browser tool and its ordinary file chooser: upload only `Mix.mp3`, paste `gemini-prompt.txt`, disable search grounding, run, and verify a response to the actual attachment. Save the **unaltered full response** as `gemini-response.txt` privately. Do not export browser cookies, call hidden endpoints or automate a login workaround. If quota/upload/perception fails, leave the gate pending and report the concrete blocker; no silent skip or retry loop.

Ask the model about entrance, continuity/dropouts, transitions/tails, ending and mood. Audio-only critique does not establish picture-sync. When the provider/model/input route changes or gives inconsistent feedback, use an authorised anonymised known-defect control without disclosing its fault/winner. Do not upload another client's rejected mix as a new client's reference. Google documents [audio understanding](https://ai.google.dev/gemini-api/docs/audio); support is not proof of accurate judgement on this file.

**Observed calibration,23October:** Gemini detected the old ~24s cutoff/six-second silence and preferred the continuous repair, but placed its riser at0–1s instead of the verified1.88–4.44s. Treat timings as approximate and validate against native tracks/actual PCM. Do not add an impact or EQ merely because it suggests one. No claim that Codex itself can hear.

## Close actual findings before sending

### Authorised local human alternative

The earlier helper required a model response even though this workflow already allowed an authorised human listener. `review_method: "local_human"` corrects that implementation mismatch; it does not permit an unreviewed export. The listener must actually review the complete exact video at normal speed with sound. Codex, a player exit code, a generated transcript, a fixture test or an inferred owner approval is not a human listener.

Keep the same exact-export packet, five checks, finding dispositions and final gate command. Preserve the listener's original full feedback privately in `response_path`, hash it in `response_sha256`, and identify the real feedback message/session in `feedback_source`. Fill `reviewed_at`, `editor`, `audio_sha256` and the actual verdict as usual; omit the model identity rather than inventing one. Set the provider truthfully to a local human. The method-specific fields are:

```json
{
  "review_method": "local_human",
  "human_listening": {
    "status": "recorded",
    "listener": "Actual human name, only after the listen",
    "method": "Actual listening equipment/method",
    "feedback_source": "Actual feedback message or witnessed session reference",
    "complete_export": true,
    "normal_speed": true,
    "video_sha256": "SHA256 of the exact final video actually listened to"
  }
}
```

This is a schema example, not evidence of a listen. Do not populate it speculatively. Missing listener facts, partial/fast playback, a different export, altered feedback, new context, unresolved technical failures or missing sound findings still block release. A human listen clears only its actual audio scope; picture/brand/rights/caption/cover checks remain separate. Legacy model records default to `review_method: "model"` and retain the existing consumed-audio/model/unaltered-response requirements.

### Model evidence

Populate the generated `review.json` from the real response:

- Exact visible model name, actual review time/editor, `audio_received: true` only when the attachment was consumed.
- `response_sha256`: calculate from the saved unaltered response (`Get-FileHash -Algorithm SHA256 ...`).
- `verdict: "no_blocking_issue"` only after resolving substantive findings; otherwise `needs_work` or `unable_to_review`.
- For each generated `checks` area, set `status: "pass"` and concise evidence from the response **plus** independent timing/signal/native checks where relevant. Do not turn uncertainty into approval.
- Put each model issue in `findings`, with its observation, `disposition` (`fixed_and_rechecked`, `not_reproduced`, or `intentional`) and evidence. Unresolved issues remain `needs_work`. Correct an actual defect in Premiere; any resulting new export requires a new packet/review.
- Record an actual human listener separately in `human_listening`, or leave `not_recorded`. Never manufacture human approval.

Run immediately before the authorised send:

```powershell
python -B audio_review.py check --packet 'C:\private\audio-review-v1\packet.json' --review 'C:\private\audio-review-v1\review.json'
```

It returns nonzero for missing/failed review, stale export/audio/response, changed or newly added client feedback, unexplained silence or unresolved checks. A pass is **AUDIO_CHECKED_FOR_OWNER_REVIEW**, not client/publication approval or complete listening certification. Run the existing story/picture/cover/caption/project checks too. Save this result in the release record before WhatsApp attachment; check that the attached filename/hash is the reviewed one. There is no technical interception of arbitrary manual WhatsApp sends: enforcement is the installed skill plus this explicit pre-send check.

Record verified corrections and rejected treatments in the private client kit after the review. Current-context changes deliberately invalidate an old packet; prepare again for a later revision. Share only generic workflow/code through Git. Staff installation uses `install_audio_review_skill.py --skill-root <existing-cg-video-story-editor>`; it patches the existing skill without replacing its craft content, credentials or client assets. Second-workstation acceptance remains untested until run there.

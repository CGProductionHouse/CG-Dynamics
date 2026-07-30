# Content Run voice debrief

The post-run debrief lives inside the selected Content Run in
`/admin/content?tab=runs`. It is available to authenticated workforce roles and
is never exposed in the client portal.

## Workflow

1. Open a Content Run with its canonical Content Guideline.
2. Record a voice note in English, Afrikaans, or both. A typed fallback is
   available when microphone access is unavailable.
3. The `content-run-voice-debrief` Edge Function transcribes the recording and
   maps the transcript only against videos belonging to that exact guideline.
4. Staff review the transcript and every proposed per-video action.
5. Selected actions are applied through `apply_content_run_debrief`.
6. The original transcript, proposal, actor, and approved actions remain in the
   staff-only audit record.

No workflow write happens during transcription or analysis.

## Safe status behaviour

- A clearly filmed video moves from `Not shot` to `Shot`.
- It moves directly to `Ready to edit` only when a verified HTTPS footage link
  already exists.
- On-site changes are appended to the production note. A vague voice summary
  never overwrites a complete approved script.
- A video explicitly moved to next month is reset to `Not shot`, moved one
  calendar month, and detached from its old schedule link. The next Client
  Schedule slot must be selected explicitly; CG Dynamics never guesses one.
- Ambiguous or unmentioned videos are marked for clarification and are not
  selected for application.

## Client calendar link

The client portal calendar continues to use the signed-in client's safe RPC.
For a same-client Content Run, it now receives an opaque guideline key only when
the guideline is published. Selecting that calendar event opens and highlights
the matching published guideline. No internal run, event, guideline,
deliverable, staff, note, or production identifier is returned.

## Required deployment

Apply:

```text
supabase/phase-30a-content-run-voice-debrief.sql
```

Deploy:

```text
supabase/functions/content-run-voice-debrief
```

The function reuses the existing server-side AI provider keys. Optional
transcription settings:

```text
VOICE_TRANSCRIPTION_ORDER=groq,gemini,openai
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

No key is exposed to the browser. Groq is attempted first by default, Gemini is
second, and OpenAI is the final configured fallback. The typed debrief path
still works when no audio transcription provider is available, provided a text
AI provider is configured.

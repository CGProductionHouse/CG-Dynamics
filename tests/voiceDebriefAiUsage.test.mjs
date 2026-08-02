import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const shared = read('supabase/functions/_shared/voiceTranscribe.ts')
const meeting = read('supabase/functions/meeting-debrief/index.ts')
const contentRun = read('supabase/functions/content-run-voice-debrief/index.ts')
const contentUi = read('src/components/content/ContentRunVoiceDebrief.tsx')
const composer = read('src/components/assistant/GlobalAssistantComposer.tsx')
const meetingClient = read('src/lib/meetingDebrief.ts')
const contentClient = read('src/lib/contentRunDebrief.ts')
const requestIds = read('src/lib/voiceDebriefRequest.ts')

test('voice duration is capped at 300 seconds in shared code, both servers, and both recorders', () => {
  assert.match(shared, /export const MAX_VOICE_SECONDS = 300/)
  assert.match(shared, /deriveAudioDurationSeconds\(audio\)/)
  assert.match(shared, /audioDurationSeconds > MAX_VOICE_SECONDS/)
  for (const edge of [meeting, contentRun]) {
    assert.match(edge, /VOICE_DURATION_LIMIT/)
    assert.match(edge, /cannot be longer than 5 minutes/)
    assert.match(edge, /audio\.size > MAX_AUDIO_BYTES/)
    assert.doesNotMatch(edge, /durationSeconds > MAX_VOICE_SECONDS/)
  }
  for (const ui of [contentUi, composer]) {
    assert.match(ui, /MAX_VOICE_SECONDS \* 1000/)
    assert.match(ui, /stopRecording\(\)|stopDebriefRecording\(\)/)
    assert.match(ui, /Recording stopped automatically at the 5-minute limit/)
  }
  assert.match(contentUi, /remaining/)
  assert.match(composer, /Record voice note \(5:00 max\)/)
})

test('browser uses a fresh user-scoped submission ID and reuses it only for a transport retry', () => {
  assert.doesNotMatch(requestIds, /sessionStorage|sha256|fingerprint/i)
  assert.match(requestIds, /crypto\.randomUUID\(\)/)
  assert.match(requestIds, /userId: string/)
  assert.match(requestIds, /attempt < 2/)
  assert.match(requestIds, /FunctionsFetchError/)
  for (const client of [meetingClient, contentClient]) {
    assert.match(client, /invokeVoiceDebriefRequest(?:<[^>]+>)?\(userId/)
    assert.match(client, /requestId/)
    assert.match(client, /durationSeconds/)
  }
})

test('recording countdowns and status messages are announced without shrinking touch controls', () => {
  for (const ui of [contentUi, composer]) {
    assert.match(ui, /aria-live="polite"/)
    assert.match(ui, /role="alert"/)
    assert.match(ui, /min-h-11/)
  }
})

test('shared transcription reserves, records attempts and health, falls back, and always finalizes', () => {
  assert.match(shared, /loadAiProviderRoutes\(client, 'transcription'\)/)
  assert.match(shared, /loadRecentlyDegradedRouteIds\(client\)/)
  assert.match(shared, /reserveAiUsage\(client, \{/)
  assert.match(shared, /action: context\.action/)
  assert.match(shared, /outcome: 'missing_secret'/)
  assert.match(shared, /outcome: 'degraded'/)
  assert.match(shared, /fallback: providerAttempts > 1/)
  assert.match(shared, /audioSeconds: result\.audioSeconds \?\? audioDurationSeconds/)
  assert.match(shared, /result\.audioSeconds \?\? audioDurationSeconds/)
  assert.doesNotMatch(shared, /audioSeconds: context\.audioDurationSeconds/)
  assert.match(shared, /providerAttempts >= MAX_AI_PROVIDER_ATTEMPTS/)
  assert.match(shared, /await finalizeAiUsageWithReplay\(client, \{[\s\S]*status: 'succeeded'/)
  assert.match(shared, /kind: 'debrief_transcript'/)
  assert.match(shared, /await finalizeAiUsage\(\s*client, reservation\.request_id, 'failed'/)
  assert.doesNotMatch(shared, /VOICE_TRANSCRIPTION_ORDER/)
})

test('debrief interpretation supplies canonical complex route context and transcript fingerprints', () => {
  assert.match(meeting, /const fingerprint = await sha256\(`/)
  assert.match(contentRun, /const fingerprint = await sha256\(`/)
  assert.match(meeting, /feature: 'meeting_debrief'[\s\S]*action: 'interpret'[\s\S]*actorId[\s\S]*idempotencyKey: `\$\{requestId\}:interpret`[\s\S]*fingerprint,[\s\S]*complexity: 'complex'[\s\S]*usageClient/)
  assert.match(contentRun, /feature: 'content_run_debrief'[\s\S]*action: 'interpret'[\s\S]*actorId[\s\S]*idempotencyKey: `\$\{requestId\}:interpret`[\s\S]*fingerprint,[\s\S]*complexity: 'complex'[\s\S]*usageClient/)
  assert.match(meeting, /validateContent: content => validateAnalysisContent\(content, meeting, staff, clients\)/)
  assert.match(contentRun, /validateContent: content => validateAnalysisContent\(content, videos\)/)
  for (const edge of [meeting, contentRun]) {
    assert.match(edge, /extractJson\(content\)/)
    assert.match(edge, /normaliseAnalysis\(raw/)
  }
})

test('typed debrief skips transcription while audio gets canonical transcribe context', () => {
  for (const edge of [meeting, contentRun]) {
    const audioBranch = edge.slice(edge.indexOf("if (action === 'analyse_audio')"), edge.indexOf('if (!transcript)', edge.indexOf("if (action === 'analyse_audio')")))
    assert.match(audioBranch, /transcribeAudio/)
    assert.match(audioBranch, /action: 'transcribe'/)
    assert.match(audioBranch, /audioDurationSeconds: durationSeconds/)
  }
  assert.doesNotMatch(meeting.slice(meeting.indexOf("action === 'analyse_text'"), meeting.indexOf("action === 'diagnostics'")), /transcribeAudio/)
})

test('durable debrief IDs return an existing draft before paid calls and duplicate work is safe', () => {
  for (const edge of [meeting, contentRun]) {
    const existingIndex = edge.indexOf(".eq('id', requestId)")
    const transcribeIndex = edge.indexOf('await transcribeAudio', edge.indexOf("if (action === 'analyse_audio')"))
    const interpretIndex = edge.indexOf('await analyseTranscript', existingIndex)
    assert.ok(existingIndex >= 0 && transcribeIndex > existingIndex && interpretIndex > existingIndex)
    assert.match(edge, /deduplicated: true/)
    assert.match(edge, /id: requestId/)
    assert.match(edge, /AI_DUPLICATE_REQUEST/)
    assert.match(edge, /fetchAiUsageReplay/)
    assert.match(edge, /replayKind: '(?:meeting|content_run)_debrief_draft'/)
    assert.match(edge, /buildReplayPayload/)
    assert.match(edge, /deleteAiUsageReplay/)
    const duplicateCatch = edge.slice(edge.lastIndexOf("message === 'AI_DUPLICATE_REQUEST'"))
    assert.match(duplicateCatch, /from\('(?:meeting_debriefs|content_run_debriefs)'\)/)
    assert.match(duplicateCatch, /deduplicated: true/)
  }
})

test('content-run edge has no duplicate provider implementation or raw telemetry payloads', () => {
  assert.doesNotMatch(contentRun, /function transcribe|fetchWithTimeout|bytesToBase64|generativelanguage\.googleapis\.com|api\.groq\.com/)
  const attemptCalls = shared.match(/recordAiAttempt\([\s\S]*?\n\s*\}\)/g) ?? []
  assert.ok(attemptCalls.length > 0)
  for (const call of attemptCalls) assert.doesNotMatch(call, /transcript|audio\s*:/i)
  assert.doesNotMatch(shared, /console\.(log|info|warn|error)/)
})

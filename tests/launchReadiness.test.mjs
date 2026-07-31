import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const PANEL = read('../src/pages/admin/LaunchReadinessPanel.tsx')
const HEALTH = read('../src/pages/admin/ImportHealthPage.tsx')
const NAV = read('../src/pages/admin/adminNavigation.ts')
const DIAGNOSTICS = read('../src/lib/contentRunDebrief.ts')

test('admin system health exposes a real production launch queue', () => {
  assert.match(HEALTH, /<LaunchReadinessPanel/)
  assert.match(NAV, /\/admin\/import-health.*System Health/)
  assert.match(PANEL, /content_runs/)
  assert.match(PANEL, /content_guidelines/)
  assert.match(PANEL, /content_guide_ideas/)
  assert.match(PANEL, /microsoft_sync_runs/)
  assert.match(PANEL, /reports/)
})

test('launch queue never auto-fixes or invents unresolved business data', () => {
  assert.doesNotMatch(PANEL, /\.insert\(|\.update\(|\.delete\(/)
  assert.match(PANEL, /never fabricated/)
  assert.match(PANEL, /Conflicts stay queued/)
  assert.match(PANEL, /human approval/)
})

test('voice provider blockers surface the missing provider names, never secrets', () => {
  assert.match(PANEL, /TRANSCRIPTION_PROVIDERS/)
  assert.match(PANEL, /'groq', 'gemini', 'openai'/)
  assert.match(PANEL, /'openrouter', 'groq', 'gemini', 'openai'/)
  assert.match(PANEL, /missing\.join/)
  assert.match(PANEL, /names only, no keys shown/)
  assert.doesNotMatch(PANEL, /GROQ_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|OPENROUTER_API_KEY/)
})

test('typed debrief stays functional while a provider key is missing', () => {
  assert.match(PANEL, /Typed English\/Afrikaans debriefs still work/)
  assert.match(PANEL, /Typed and voice debriefs both need one interpretation provider/)
  assert.match(DIAGNOSTICS, /getContentRunDebriefDiagnostics/)
})

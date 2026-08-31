import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDevelopmentBranch, assertWritablePath, normalizeRepoPath, redactText } from '../src/safety.js'
import { assertVerifiedPreviewUrl } from '../src/integrations.js'

test('repository paths cannot escape scope or read secret locations', () => {
  assert.equal(normalizeRepoPath('src/lib/assistant.ts'), 'src/lib/assistant.ts')
  assert.throws(() => normalizeRepoPath('../outside'))
  assert.throws(() => normalizeRepoPath('.env.local'))
  assert.throws(() => normalizeRepoPath('.vercel/project.json'))
})

test('protected development-control and migration paths cannot be changed', () => {
  assert.equal(assertWritablePath('src/components/Test.tsx'), 'src/components/Test.tsx')
  assert.throws(() => assertWritablePath('.github/workflows/ci.yml'))
  assert.throws(() => assertWritablePath('supabase/migrations/20260101000000_bad.sql'))
  assert.throws(() => assertWritablePath('dev-bridge/src/auth.ts'))
})

test('only scoped development branches are accepted', () => {
  assert.equal(assertDevelopmentBranch('fix/assistant-voice-pause'), 'fix/assistant-voice-pause')
  for (const branch of ['main', 'master', 'production', 'random', 'fix/x']) assert.throws(() => assertDevelopmentBranch(branch))
})

test('known credential formats and assignments are redacted', () => {
  const text = redactText('token ghp_abcdefghijklmnopqrstuvwxyz123456 password=hunter2 api_key:secret-value')
  assert.doesNotMatch(text, /ghp_/)
  assert.doesNotMatch(text, /hunter2|secret-value/)
  assert.match(text, /\[REDACTED\]/)
})

test('browser targets are locked to CG Dynamics Vercel deployments', () => {
  assert.equal(assertVerifiedPreviewUrl('https://cg-dynamics.vercel.app/'), 'https://cg-dynamics.vercel.app/')
  assert.equal(assertVerifiedPreviewUrl('https://cg-dynamics-abc123-cg-dynamics-projects.vercel.app/'), 'https://cg-dynamics-abc123-cg-dynamics-projects.vercel.app/')
  assert.throws(() => assertVerifiedPreviewUrl('https://example.com/'))
  assert.throws(() => assertVerifiedPreviewUrl('http://cg-dynamics.vercel.app/'))
  assert.throws(() => assertVerifiedPreviewUrl('https://cg-dynamics.vercel.app/admin'))
})

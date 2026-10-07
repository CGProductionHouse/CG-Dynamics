import { createServer } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'

// Only the client-neutral offline fixture. No credentials, model calls, file/data writes or deploy mode.
const contracts = spawnSync(process.execPath, ['--test', 'tests/contentDirectorBenchmark.test.mjs'], { encoding: 'utf8' })
process.stderr.write(contracts.stdout ?? '')
process.stderr.write(contracts.stderr ?? '')
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { creativeBenchmarkReceipt } = await server.ssrLoadModule('/src/lib/contentDirectorBenchmark.ts')
  const modes = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorModes.ts')
  const hash = value => createHash('sha256').update(value).digest('hex')
  const prompt = modes.buildDevelopPrompt({ clientName: 'Neutral fixture', guideExcerpt: 'Verified repair service only; no offer or price supplied.',
    marketingKnowledge: [], targetFields: ['cta'], targets: [{ id: 'fixture-video', position: 1, title: 'Chosen concept',
      objective: 'Explain service', hook: 'Human hook', script: 'Human text-only script', shotBreakdown: '1. Door\n2. Product',
      notes: '15 seconds; text-only.', platform: 'Instagram Reels', format: 'text-only', targetMonth: '2026-10', deliverableLabel: null }] })
  const receipt = creativeBenchmarkReceipt({
    codeSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    fixtureVersion: `client_neutral_v1:${hash(readFileSync('tests/contentDirectorBenchmark.test.mjs'))}`,
    promptHashes: { actualDevelopmentSystem: hash(prompt.system), actualDevelopmentUser: hash(prompt.user),
      modeSource: hash(readFileSync('supabase/functions/suggest-content-videos/directorModes.ts')),
      eligibilitySource: hash(readFileSync('supabase/functions/suggest-content-videos/directorKnowledge.ts')) },
    model: null,
    selectedCardRevisions: [{ id: 'fixture-card', updatedAt: '2026-10-01T08:00:00Z' }],
  }, contracts.status === 0)
  console.log(JSON.stringify(receipt, null, 2))
  process.exitCode = contracts.status === 0 ? 0 : 1
} finally { await server.close() }

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const directory = resolve('docs/ops/strategy-current-next/2026-11')
const fields = [
  'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale',
  'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration',
  'successSignals', 'nextMonthGamePlan',
]
const sections = [
  'professional_video', 'reels', 'photo_content', 'design_poster',
  'animated_poster', 'campaign_recommendation',
]
const capacity = {
  professional_video: 'confirmed_professional_videos',
  photo_content: 'photo_posts',
  design_poster: 'confirmed_design_posters',
  reels: 'reels',
  animated_poster: 'animated_posters',
}

test('November editorial candidates are complete, exact-client and fail closed on unconfirmed scope', () => {
  const files = readdirSync(directory).filter(name => name.endsWith('.json'))
  assert.ok(files.length > 0, 'At least one authored candidate is required')
  const clientIds = new Set()
  for (const name of files) {
    const candidate = JSON.parse(readFileSync(join(directory, name), 'utf8'))
    assert.equal(candidate.schema_version, 1, name)
    assert.equal(candidate.status, 'EDITORIAL_CANDIDATE_NOT_CANONICAL', name)
    assert.equal(candidate.strategy_month, '2026-11-01', name)
    assert.match(candidate.client_id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, name)
    assert.ok(!clientIds.has(candidate.client_id), `Duplicate exact client: ${name}`)
    clientIds.add(candidate.client_id)
    assert.ok(candidate.client_name?.trim(), name)
    assert.ok(candidate.source_refs?.some(ref => ref.includes('artifacts/client-strategy-dossiers/issue-513/')), name)
    for (const source of candidate.source_refs) {
      if (/^https:\/\//.test(source)) continue
      assert.ok(!source.includes('..'), `${name}: source path traversal`)
      const dossier = readFileSync(resolve(source), 'utf8')
      if (source.includes('/issue-513/') && !source.includes('/runtime-guides/') && source.endsWith('.md')) {
        assert.ok(dossier.includes(`Client ID: \`${candidate.client_id}\``), `${name}: dossier identity mismatch`)
      }
    }
    assert.ok(candidate.review_gates?.length, name)

    for (const field of fields) {
      const value = candidate.goldStandard?.[field]
      assert.ok(typeof value === 'string' && value.trim().length >= 80, `${name}: ${field}`)
      assert.doesNotMatch(value, /\b(?:TBD|to confirm|coming soon|published-content record|repository|source_id|client_id|seed_context|dossier|evidence|readback|guardrail)\b/i, `${name}: ${field}`)
    }
    for (const section of sections) {
      const plan = candidate.actionPlan?.[section]
      assert.equal(typeof plan?.enabled, 'boolean', `${name}: ${section}`)
      assert.ok(Array.isArray(plan?.items), `${name}: ${section}`)
      if (plan.enabled) {
        assert.ok(plan.items.length > 0, `${name}: enabled ${section} needs actual work`)
        if (capacity[section]) {
          const confirmed = candidate.package?.[capacity[section]]
          assert.ok(Number.isInteger(confirmed) && confirmed > 0, `${name}: ${section} has no confirmed quantity`)
          assert.ok(plan.items.length <= confirmed, `${name}: ${section} exceeds confirmed capacity`)
        }
      } else {
        assert.equal(plan.items.length, 0, `${name}: disabled ${section} cannot promise work`)
      }
    }
  }
})

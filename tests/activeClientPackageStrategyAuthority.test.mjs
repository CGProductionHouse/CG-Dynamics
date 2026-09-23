import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const packageAuthority = await import('../src/lib/packageAuthority.ts')
const strategy = await import('../src/lib/strategyEngine.ts')
const migration = readFileSync(new URL('../supabase/migrations/20260923110000_active_client_package_strategy_authority.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const clientsPage = readFileSync(new URL('../src/pages/admin/ClientsList.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const manualStrategy = readFileSync(new URL('../src/lib/monthlyStrategy.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const automaticStrategy = readFileSync(new URL('../supabase/functions/_shared/monthlyStrategyAutopilot.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function confirmedPackage(overrides = {}) {
  return {
    professional_videos_per_month: 0,
    reels_per_month: 0,
    photo_posts_per_month: 0,
    design_posters_per_month: 0,
    animated_posters_per_month: 0,
    campaign_management_included: false,
    monthly_campaign_budget: 0,
    shoot_days_per_month: 0,
    website_updates_per_month: 0,
    other_agreed_deliverables: '',
    package_notes: '',
    package_exclusions: '',
    verification: {
      status: 'confirmed', version: 1, confirmed_at: '2026-09-23T08:00:00Z',
      confirmed_by_profile_id: 'admin-a', evidence_note: 'Signed package reviewed',
      inference_note: '', source_references: ['contract-2026'],
    },
    ...overrides,
  }
}

test('blank and partial package data never becomes an authoritative zero package', () => {
  assert.equal(packageAuthority.readPackageAuthority(null).status, 'unverified')
  assert.equal(packageAuthority.readPackageAuthority({}).settings, null)
  const partial = packageAuthority.readPackageAuthority({ professional_videos_per_month: 0 })
  assert.equal(partial.settings, null)
  assert.ok(partial.missingFields.includes('reels_per_month'))
})

test('explicit verified zero remains a real confirmed package value', () => {
  const result = packageAuthority.readPackageAuthority(confirmedPackage())
  assert.equal(result.status, 'confirmed')
  assert.equal(result.settings?.reels_per_month, 0)
  assert.equal(result.verification?.source_references[0], 'contract-2026')
})

test('package verification is active-admin only, exact-client, guarded and auditable', () => {
  assert.match(migration, /profile\.id = auth\.uid\(\).*profile\.is_active.*profile\.role = 'admin'/s)
  assert.match(migration, /where client\.id = p_client_id for update/)
  assert.match(migration, /v_client\.id is null or not v_client\.active/)
  assert.match(migration, /set_config\('app\.client_package_verification_write', 'on', true\)/)
  assert.match(migration, /'client_package_settings', p_client_id, 'package_verified'/)
  assert.match(migration, /'previous_package_settings', v_before/)
  assert.match(migration, /'confirmed_by_profile_id', v_actor\.id/)
  assert.match(migration, /cardinality\(p_source_references\).* = 0/)
  assert.match(migration, /new\.package_settings := coalesce\(new\.package_settings, '\{\}'::jsonb\) - 'verification'/)
  assert.match(migration, /before insert on public\.clients/)
})

test('the review queue defaults to active clients and requires an explicit confirmation action', () => {
  assert.match(clientsPage, /const \[viewFilter, setViewFilter\] = useState<ViewFilter>\('active'\)/)
  assert.match(clientsPage, /clients\.filter\(client => client\.active\)/)
  assert.match(clientsPage, /Confirm this exact current package as authoritative/)
  assert.match(clientsPage, /Use 0 only when zero is confirmed/)
  assert.match(clientsPage, /at least one exact source reference/)
  assert.match(clientsPage, /confirmClientPackage\(/)
  assert.match(clientsPage, /package_settings: pkgResult\.data!\.package_settings/)
})

test('gold-standard quality rejects generic filler and out-of-package work but preserves explicit zero', () => {
  const data = strategy.emptyStrategyData()
  for (const field of strategy.GOLD_STANDARD_FIELDS) {
    data.goldStandard[field.key] = `Client-specific evidence and concrete action for ${field.label}.`
  }
  data.goldStandard.objective = 'Increase engagement'
  data.actionPlan.reels.enabled = true
  const packageSettings = packageAuthority.readPackageAuthority(confirmedPackage()).settings
  const issues = strategy.assessGoldStandardStrategy(data, packageSettings, true)
  assert.ok(issues.some(issue => issue.includes('generic')))
  assert.ok(issues.some(issue => issue.includes('Reels exceeds')))
})

test('database approval gate requires confirmed package, exact-client provenance and all ten specific fields', () => {
  assert.match(migration, /PACKAGE_UNVERIFIED/)
  assert.match(migration, /new\.seed_context ->> 'client_id' is distinct from new\.client_id::text/)
  for (const field of strategy.GOLD_STANDARD_FIELDS) assert.match(migration, new RegExp(`'${field.key}'`))
  assert.match(migration, /Generic strategy filler is not approvable/)
  assert.match(migration, /Reels plan exceeds the confirmed package/)
  assert.match(migration, /Campaign plan exceeds the confirmed package/)
  assert.match(migration, /before update of workflow_status on public\.monthly_client_strategies/)
})

test('manual and automatic preparation consume confirmed package truth rather than schedule inference', () => {
  assert.match(manualStrategy, /readPackageAuthority\(clientResult\.data\.package_settings\)/)
  assert.match(manualStrategy, /throw new Error\('PACKAGE_UNVERIFIED/)
  assert.doesNotMatch(manualStrategy, /function packageFromDeliverables/)
  assert.match(automaticStrategy, /readPackageAuthority\(client\.package_settings\)/)
  assert.match(automaticStrategy, /if \(prepared\.blockers\.length > 0\) \{ blocked \+= 1; continue \}/)
  assert.match(automaticStrategy, /\.eq\('active', true\)/)
})

test('strategy provenance retains exact package, prior-content and governed Skill Card evidence', () => {
  assert.match(manualStrategy, /package_verification_confirmed_at/)
  assert.match(manualStrategy, /previous_post_ids/)
  assert.match(manualStrategy, /marketing_library_cards/)
  assert.match(manualStrategy, /cardTargetsAgent\(agents, 'marketing_strategist'\)/)
  assert.match(automaticStrategy, /confidence_level/)
  assert.match(automaticStrategy, /evidence_label/)
  assert.match(automaticStrategy, /source_id/)
})

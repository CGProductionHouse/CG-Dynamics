import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const packageAuthority = await import('../src/lib/packageAuthority.ts')
const strategy = await import('../src/lib/strategyEngine.ts')
const migration = readFileSync(new URL('../supabase/migrations/20260923110000_active_client_package_strategy_authority.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const unknownMigration = readFileSync(new URL('../supabase/migrations/20260923122616_preserve_unknown_package_confirmation.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const clientsPage = readFileSync(new URL('../src/pages/admin/ClientsList.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const evidenceReview = readFileSync(new URL('../src/components/clients/PackageEvidenceReviewModal.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
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

test('v2 confirmation preserves unknown, explicit zero and known values exactly', () => {
  const settings = {
    ...confirmedPackage(),
    professional_videos_per_month: null,
    reels_per_month: 0,
    photo_posts_per_month: 4,
    campaign_management_included: null,
    other_agreed_deliverables: null,
    package_notes: null,
    package_exclusions: null,
    verification: undefined,
  }
  const fieldStates = packageAuthority.buildPackageFieldStates(settings)
  const raw = {
    ...settings,
    verification: {
      status: 'confirmed', version: 2, confirmed_at: '2026-09-23T08:00:00Z',
      confirmed_by_profile_id: 'admin-a', evidence_note: 'Signed package reviewed',
      inference_note: 'Unknowns retained.', source_references: ['contract-2026'], field_states: fieldStates,
    },
  }
  const result = packageAuthority.readPackageAuthority(raw)
  assert.equal(result.status, 'confirmed')
  assert.equal(result.settings?.professional_videos_per_month, null)
  assert.equal(result.settings?.reels_per_month, 0)
  assert.equal(result.settings?.photo_posts_per_month, 4)
  assert.equal(result.settings?.campaign_management_included, null)
  assert.equal(fieldStates.professional_videos_per_month, 'unknown')
  assert.equal(fieldStates.reels_per_month, 'explicit_zero')
  assert.equal(fieldStates.photo_posts_per_month, 'known')
})

test('v2 receipt fails closed when a field state relabels null or zero', () => {
  const base = confirmedPackage({
    professional_videos_per_month: null,
    other_agreed_deliverables: null,
    package_notes: null,
    package_exclusions: null,
  })
  const states = packageAuthority.buildPackageFieldStates(base)
  const receipt = {
    status: 'confirmed', version: 2, confirmed_at: '2026-09-23T08:00:00Z',
    confirmed_by_profile_id: 'admin-a', evidence_note: 'Signed package reviewed',
    inference_note: '', source_references: ['contract-2026'], field_states: states,
  }
  assert.equal(packageAuthority.readPackageAuthority({ ...base, verification: receipt }).status, 'confirmed')
  assert.equal(packageAuthority.readPackageAuthority({ ...base, verification: { ...receipt, field_states: { ...states, professional_videos_per_month: 'known' } } }).status, 'unverified')
  assert.equal(packageAuthority.readPackageAuthority({ ...base, reels_per_month: 0, verification: { ...receipt, field_states: { ...states, reels_per_month: 'known' } } }).status, 'unverified')
})

test('confirmation UI and RPC preserve blank values as unknown rather than zero or false', () => {
  assert.match(evidenceReview, /numbers\[field\] === '' \? null : Number\(numbers\[field\]\)/)
  assert.match(evidenceReview, /campaign === '' \? null : campaign === 'true'/)
  assert.match(clientsPage, /value === '' \? null : Number\(value\)/)
  assert.match(clientsPage, /campaignValue === '' \? null : campaignValue === 'true'/)
  assert.match(unknownMigration, /'version', 2/)
  assert.match(unknownMigration, /'field_states', v_field_states/)
  assert.match(unknownMigration, /Unknown package field % must remain null/)
  assert.match(unknownMigration, /v_state = 'explicit_zero' and v_numeric <> 0/)
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
  assert.match(clientsPage, /use 0 only when zero is confirmed/i)
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

test('strategy capacity distinguishes unknown from explicit zero and fails closed', () => {
  const data = strategy.emptyStrategyData()
  for (const field of strategy.GOLD_STANDARD_FIELDS) data.goldStandard[field.key] = `Client-specific evidence and concrete action for ${field.label}.`
  data.actionPlan.reels.enabled = true
  const unknown = packageAuthority.readPackageSettings({ reels_per_month: null })
  const zero = packageAuthority.readPackageSettings({ reels_per_month: 0 })
  assert.ok(strategy.assessGoldStandardStrategy(data, unknown, true).includes('Reels capacity is unknown; it cannot be approved.'))
  assert.ok(strategy.assessGoldStandardStrategy(data, zero, true).includes('Reels exceeds the confirmed package.'))
  assert.match(unknownMigration, /capacity is unknown; strategy cannot be approved/)
  assert.match(unknownMigration, /plan exceeds the confirmed package/)
  assert.doesNotMatch(unknownMigration, /coalesce\(\(v_package ->> 'reels_per_month'\)::integer, 0\)/)
})

test('database approval gate requires current package receipt, exact-client evidence and all ten specific fields', () => {
  assert.match(migration, /PACKAGE_UNVERIFIED/)
  assert.match(migration, /new\.seed_context ->> 'client_id' is distinct from new\.client_id::text/)
  assert.match(migration, /package_verification_confirmed_at/)
  assert.match(migration, /package_verification_actor_id/)
  assert.match(migration, /package_source_references/)
  assert.match(migration, /Strategy provenance does not match the current confirmed package receipt/)
  assert.match(migration, /Exact-client intelligence or previous-work evidence is required before strategy approval/)
  for (const field of strategy.GOLD_STANDARD_FIELDS) assert.match(migration, new RegExp(`'${field.key}'`))
  assert.match(migration, /Generic strategy filler is not approvable/)
  assert.match(migration, /Reels plan exceeds the confirmed package/)
  assert.match(migration, /Campaign plan exceeds the confirmed package/)
  assert.match(migration, /before insert or update of workflow_status, strategy_data, seed_context, client_id/)
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


test('approved and published strategy edits cannot bypass the authority gate', () => {
  assert.match(migration, /tg_op = 'UPDATE'/)
  assert.match(migration, /new\.strategy_data is not distinct from old\.strategy_data/)
  assert.match(migration, /new\.seed_context is not distinct from old\.seed_context/)
  assert.match(migration, /new\.client_id is not distinct from old\.client_id/)
  assert.match(migration, /before insert or update of workflow_status, strategy_data, seed_context, client_id/)
})

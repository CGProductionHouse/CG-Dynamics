import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260922154243_meta_post_engagement_truth.sql')
const worker = read('../supabase/functions/meta-sync-worker/index.ts')
const manual = read('../supabase/functions/meta-sync/index.ts')
const reports = read('../src/lib/db/reports.ts')

let server
let engagement
let reportStats
let reportPerformance
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  engagement = await server.ssrLoadModule('/supabase/functions/_shared/metaPostEngagement.ts')
  reportStats = await server.ssrLoadModule('/src/lib/reportStats.ts')
  reportPerformance = await server.ssrLoadModule('/src/lib/reportPerformance.ts')
})
after(async () => { if (server) await server.close() })

const at = '2026-09-22T12:00:00.000Z'

test('component counts preserve missing, invalid, explicit zero and positive states', () => {
  assert.deepEqual(engagement.classifyMetaPostCount(undefined), { state: 'missing', value: null })
  for (const value of ['4', 1.5, -1, 2_147_483_648]) {
    assert.deepEqual(engagement.classifyMetaPostCount(value), { state: 'invalid', value: null })
  }
  assert.deepEqual(engagement.classifyMetaPostCount(0), { state: 'observed', value: 0 })
  assert.deepEqual(engagement.classifyMetaPostCount(42), { state: 'observed', value: 42 })
})

test('Facebook requires reactions comments and shares for a complete direct-field total', () => {
  const missingAll = engagement.buildMetaPostEngagementEvidence('facebook', {}, at)
  assert.equal(missingAll.complete_total, null)
  assert.equal(missingAll.known_subtotal, null)
  assert.equal(missingAll.completeness, 'unavailable')

  const partial = engagement.buildMetaPostEngagementEvidence('facebook', { reactions: 5, comments: 0 }, at)
  assert.equal(partial.complete_total, null)
  assert.equal(partial.known_subtotal, 5)
  assert.deepEqual(partial.coverage, { observed: 2, required: 3 })

  const complete = engagement.buildMetaPostEngagementEvidence('facebook', { reactions: 5, comments: 0, shares: 2 }, at)
  assert.equal(complete.complete_total, 7)
  assert.equal(complete.definition_id, 'facebook_direct_reactions_comments_shares_v1')
})

test('Instagram has its own likes plus comments definition and never uses total_interactions', () => {
  const complete = engagement.buildMetaPostEngagementEvidence('instagram', { likes: 7, comments: 3 }, at)
  assert.equal(complete.complete_total, 10)
  assert.equal(complete.definition_id, 'instagram_direct_likes_comments_v1')
  assert.doesNotMatch(complete.definition_label, /total.interactions/i)
  assert.doesNotMatch(worker, /total_interactions/)
})

test('repeat ingestion is deterministic and an incomplete refresh preserves prior evidence age', () => {
  const good = engagement.buildMetaPostEngagementEvidence('facebook', { reactions: 5, comments: 1, shares: 0 }, at)
  assert.deepEqual(
    engagement.buildMetaPostEngagementEvidence('facebook', { reactions: 5, comments: 1, shares: 0 }, at),
    good,
  )
  const failed = engagement.buildMetaPostEngagementEvidence('facebook', { reactions: 6 }, '2026-09-23T12:00:00.000Z')
  const selected = engagement.chooseMetaPostEngagementEvidence(good, failed)
  assert.equal(selected.evidence.observed_at, at)
  assert.equal(selected.evidence.complete_total, 6)
  assert.equal(selected.refreshAttempt, failed)
})

test('legacy imports retain explicit zero and source identity without inferring column totals', () => {
  const legacy = reportStats.reportPostToStatsPost({
    id: 'saved-import', report_id: 'report-id', meta_post_id: 'imported-meta-id',
    platform: 'facebook', publish_time: null, meta_post_type: 'Photo', caption: null,
    permalink: null, views: 0, reach: 0, reactions: 0, comments: 0, shares: 0,
    total_clicks: 0,
    raw: {
      engagements: 0, imported_meta_post_id: 'imported-row-id',
      import_source: 'meta_business_suite',
    },
    created_at: at,
  })
  assert.equal(legacy.engagements, 0)
  assert.equal(legacy.engagementDefinitionId, 'facebook_legacy_import_engagements_v1')
  assert.equal(legacy.engagementSource, 'meta_business_suite')
  assert.equal(legacy.engagementObservedAt, at)
  const missing = engagement.projectMetaPostEngagement({}, 'facebook', at)
  assert.equal(missing.completeTotal, null)
  const unprovenSource = engagement.projectMetaPostEngagement({
    engagements: 12, source: 'csv_import',
  }, 'facebook', at)
  assert.equal(unprovenSource.completeTotal, null)
  assert.equal(unprovenSource.definitionId, null)
})

test('historical automated numeric engagements fail closed for zero and positive values', () => {
  for (const value of [0, 27]) {
    const projected = reportStats.reportPostToStatsPost({
      id: `automated-${value}`, report_id: 'report-id', meta_post_id: `meta-${value}`,
      platform: 'facebook', publish_time: null, meta_post_type: 'Photo', caption: null,
      permalink: null, views: null, reach: null, reactions: value, comments: 0,
      shares: 0, total_clicks: 0,
      raw: { engagements: value, source: 'meta_sync', synced_at: at },
      created_at: '2026-09-21T12:00:00.000Z',
    })
    assert.equal(projected.engagements, null)
    assert.equal(projected.engagementDefinitionId, null)
    assert.equal(projected.engagementCompleteness, 'unavailable')
    assert.equal(projected.engagementSource, 'meta_sync')
    assert.equal(projected.engagementObservedAt, at)
    const ranked = reportStats.rankPostsByStrength([projected])
    assert.equal(ranked.metric, null)
    assert.deepEqual(ranked.posts, [])
  }
})

const post = (id, platform, total, definition) => ({
  id, caption: null, permalink: null, publish_time: null, reach: null, impressions: null,
  engagements: total, engagementKnownSubtotal: total, engagementDefinitionId: definition,
  engagementDefinitionLabel: definition, engagementSource: 'test', engagementObservedAt: at,
  engagementCoverage: { observed: 2, required: 2 }, engagementCompleteness: total === null ? 'partial' : 'complete',
  post_type: null, platform, imageUrl: null, metaObjectId: id,
})

test('ranking preserves valid zero, excludes partial rows, and requires one definition', () => {
  const definition = 'instagram_direct_likes_comments_v1'
  const ranked = reportStats.rankPostsByStrength([post('zero', 'instagram', 0, definition), post('high', 'instagram', 9, definition)])
  assert.equal(ranked.metric, 'interactions')
  assert.deepEqual(ranked.posts.map(item => item.id), ['high', 'zero'])
  assert.equal(reportStats.rankPostsByStrength([post('missing', 'instagram', null, definition)]).metric, null)
  const withPartial = reportStats.rankPostsByStrength([
    post('complete', 'instagram', 2, definition),
    post('partial', 'instagram', null, definition),
  ])
  assert.deepEqual(withPartial.posts.map(item => item.id), ['complete'])
  assert.equal(reportStats.rankPostsByStrength([
    post('fb', 'facebook', 9, 'facebook_direct_reactions_comments_shares_v1'),
    post('ig', 'instagram', 10, definition),
  ]).metric, null)
})

test('aggregate totals require one definition and one observation time', () => {
  const definition = 'instagram_direct_likes_comments_v1'
  const first = post('first', 'instagram', 2, definition)
  const second = { ...post('second', 'instagram', 3, definition), engagementObservedAt: '2026-09-23T12:00:00.000Z' }
  const mixedAge = reportStats.calculateReportStats([first, second])
  assert.equal(mixedAge.totalEngagements, null)
  assert.equal(mixedAge.knownEngagementSubtotal, null)
  const sameAge = reportStats.calculateReportStats([first, { ...second, engagementObservedAt: at }])
  assert.equal(sameAge.totalEngagements, 5)
  assert.equal(sameAge.engagementDefinitionId, definition)
})

test('missing engagement does not create a weak signal while observed zero remains evidence', () => {
  const performanceFor = engagements => {
    const best = post(
      engagements === null ? 'missing' : 'zero',
      'instagram',
      engagements,
      engagements === null ? null : 'instagram_direct_likes_comments_v1',
    )
    return reportPerformance.buildReportPerformance({
      master: {
        platforms: [{
          platform: 'instagram', label: 'Instagram', source: 'posts', reach: null, views: null,
          engagements, engagementKnownSubtotal: engagements,
          engagementDefinitionId: best.engagementDefinitionId,
          engagementDefinitionLabel: best.engagementDefinitionLabel,
          engagementObservedAt: best.engagementObservedAt,
          postCount: 1, bestPost: best, topPosts: [best], manual: null,
        }],
        totalReach: null, totalViews: null, totalEngagements: null,
        bestPlatform: null, bestPostOverall: best,
      },
      previousMaster: null, currentManual: [], previousManual: [],
      monthLabel: 'September 2026', previousMonthLabel: null,
    })
  }

  const missing = performanceFor(null)
  assert.equal(missing.weakestArea, null)
  assert.equal(missing.topContent.tone, 'baseline')
  const zero = performanceFor(0)
  assert.equal(zero.weakestArea, 'Audience response')
  assert.equal(zero.topContent.interactions, 0)
  assert.equal(zero.topContent.tone, 'learning')

  const platformFor = result => reportPerformance.buildPlatformPerformance({
    view: result.topContent
      ? {
          platform: 'instagram', label: 'Instagram', source: 'posts', reach: null, views: null,
          engagements: result.topContent.interactions,
          engagementKnownSubtotal: result.topContent.interactions,
          engagementDefinitionId: result.topContent.post.engagementDefinitionId,
          engagementDefinitionLabel: result.topContent.post.engagementDefinitionLabel,
          engagementObservedAt: result.topContent.post.engagementObservedAt,
          postCount: 1, bestPost: result.topContent.post, topPosts: [result.topContent.post], manual: null,
        }
      : null,
    previousView: null, previousManual: null,
    monthLabel: 'September 2026', previousMonthLabel: null,
  })
  assert.doesNotMatch(platformFor(missing).recommendations.join(' '), /question-led captions/i)
  assert.match(platformFor(zero).recommendations.join(' '), /question-led captions/i)
})

test('SQL boundary preserves good evidence and exposes only published exact-client rows', () => {
  assert.match(migration, /v_existing_complete and not v_complete/)
  assert.match(migration, /engagement_refresh_attempt/)
  assert.match(migration, /v_component_value > 2147483647/)
  assert.match(migration, /imported_meta_post_id/)
  assert.match(migration, /else 'unavailable' end/)
  assert.match(migration, /r\.status = 'published'/)
  assert.match(migration, /v_client_id is distinct from public\.my_client_id\(\)/)
  assert.match(migration, /profile\.is_active and profile\.role = 'client'/)
  assert.match(migration, /revoke all on function public\.client_published_report_posts\(uuid\) from public, anon/)
  assert.match(migration, /grant execute on function public\.client_published_report_posts\(uuid\) to authenticated/)
  assert.doesNotMatch(migration, /grant execute on function public\.meta_sync_upsert_report_post[^;]+authenticated/)
})

test('both Meta ingestion paths use canonical evidence and never default direct fields to zero', () => {
  for (const source of [worker, manual]) {
    assert.match(source, /buildMetaPostEngagementEvidence/)
    assert.doesNotMatch(source, /like_count as number\) \?\? 0/)
    assert.doesNotMatch(source, /comments_count as number\) \?\? 0/)
  }
  assert.match(reports, /engagement_known_subtotal: number \| null/)
  assert.match(reports, /imported_meta_post_id: post\.id,[\s\S]*import_source: post\.source/)
})

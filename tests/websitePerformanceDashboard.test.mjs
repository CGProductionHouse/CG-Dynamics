// #335 x #405 premium Website Performance: composition rules, with Piek Group October 2026
// (observed live 3 Oct) as the acceptance fixture.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { websitePerformanceDashboardModel } from '../src/lib/websitePerformanceDashboard.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const PIEK_GAPS = [
  'This reporting period is still collecting data.',
  'First-party contact actions are not configured; their total is unavailable, not zero.',
  'Traffic source categories are based on referrer aggregates; stripped referrers remain Direct / Unknown.',
]
const piekReport = (over = {}) => ({
  version: 1, websiteId: 1, generatedAt: '2026-10-03T16:00:00Z',
  identity: { dynamicsClientId: 'piek', canonicalHost: 'www.piekgroup.co.za', environment: 'production' },
  period: { from: '2026-10-01', to: '2026-11-01', timezone: 'Africa/Johannesburg', coverageFrom: '2026-10-01' },
  traffic: {
    visitors: 18, pageviews: 34,
    sources: [{ label: 'Organic Search', visitors: 6, pageviews: 0 }, { label: 'Direct / Unknown', visitors: 13, pageviews: 0 }, { label: 'Instagram', visitors: 1, pageviews: 0 }],
    topPages: [{ label: '/brands', visitors: 0, pageviews: 5 }, { label: '/', visitors: 0, pageviews: 15 }, { label: '/meet-the-family', visitors: 0, pageviews: 4 }, { label: '/email.html', visitors: 0, pageviews: 3 }],
  },
  conversions: { total: null, byType: [] },
  commerce: null,
  dataQuality: { state: 'collecting', gaps: PIEK_GAPS, trafficProvider: 'vercel', sourceReadAt: '2026-10-03T16:00:00Z' },
  ...over,
})
const performance = (report = piekReport(), state = 'collecting') => ({ clientId: 'piek', state, report })
const metrics = (over = {}) => ({
  state: 'ready',
  data: {
    state: 'available', period: { from: '2026-10-01', to: '2026-11-01', timezone: 'Africa/Johannesburg' },
    total: 1, new: 0, contacted: 0, qualified: 0, won: 0, closedLost: 1, lost: 0, good: 0, poor: 1, unreviewed: 0, qualificationRate: 0,
    ...over,
  },
})
const kpi = (model, key) => model.kpis.find((item) => item.key === key)

test('Piek October: real traffic + canonical enquiry/lead metrics on one screen, no dead Unavailable tiles', () => {
  const model = websitePerformanceDashboardModel({ performance: performance(), performanceFailed: false, leads: metrics() })
  assert.equal(model.host, 'www.piekgroup.co.za')
  assert.deepEqual(model.status, { label: 'Month in progress', tone: 'info' })
  assert.deepEqual(model.kpis.map((item) => [item.key, item.value]), [['visitors', 18], ['pageviews', 34], ['enquiries', 1], ['qualified', 0], ['won', 0]])
  assert.equal(kpi(model, 'qualified').hint, '0% qualification rate')
  // Actions: not configured -> compact setup note, never a KPI and never zero.
  assert.equal(kpi(model, 'actions'), undefined)
  assert.equal(model.actions.tracked, false)
  assert.match(model.actions.note, /not configured yet/)
  // Lead pipeline: the pilot enquiry was marked Poor -> Closed / Lost.
  assert.deepEqual(model.leads.pipeline.map((stage) => [stage.label, stage.value]), [['New', 0], ['Contacted', 0], ['Qualified', 0], ['Won', 0], ['Closed / Lost', 1]])
  assert.deepEqual(model.leads.quality, { good: 0, poor: 1, unreviewed: 0 })
  // Traffic ranked by real values; Direct / Unknown preserved.
  assert.deepEqual(model.traffic.sources.map((row) => [row.label, row.value]), [['Direct / Unknown', 13], ['Organic Search', 6], ['Instagram', 1]])
  assert.deepEqual(model.traffic.pages.map((row) => row.label), ['/', '/brands', '/meet-the-family', '/email.html'])
  // Provider limits move to the data-confidence strip.
  assert.match(model.confidence.summary, /still collecting/)
  for (const gap of PIEK_GAPS) assert.ok(model.confidence.notes.includes(gap))
})

test('enquiries come only from canonical #405 truth, never from a provider conversion aggregate', () => {
  const report = piekReport({ conversions: { total: 9, byType: [{ type: 'enquiry_submit', count: 7 }, { type: 'whatsapp_click', count: 2 }] } })
  const model = websitePerformanceDashboardModel({ performance: performance(report), performanceFailed: false, leads: metrics() })
  assert.equal(kpi(model, 'enquiries').value, 1)
  // Tracked actions become a primary KPI and a ranked breakdown.
  assert.equal(kpi(model, 'actions').value, 9)
  assert.deepEqual(model.actions.byType.map((row) => [row.label, row.value]), [['enquiry submit', 7], ['whatsapp click', 2]])
  // Without canonical lead truth there is no enquiry KPI at all (no provider fallback).
  for (const leads of [{ state: 'unavailable' }, metrics({ state: 'not_connected' }), { state: 'error', message: 'x' }, null]) {
    const without = websitePerformanceDashboardModel({ performance: performance(report), performanceFailed: false, leads })
    assert.equal(kpi(without, 'enquiries'), undefined, JSON.stringify(leads))
    assert.notEqual(without.leads.state, 'available')
  }
})

test('missing figures are omitted and explained, never zero', () => {
  const report = piekReport({ traffic: { ...piekReport().traffic, visitors: null } })
  const model = websitePerformanceDashboardModel({ performance: performance(report), performanceFailed: false, leads: metrics() })
  assert.equal(kpi(model, 'visitors'), undefined)
  assert.ok(model.confidence.notes.some((note) => /Visitors are not available/.test(note)))

  const failed = websitePerformanceDashboardModel({ performance: null, performanceFailed: true, leads: metrics() })
  assert.deepEqual(failed.status, { label: 'Reporting unavailable', tone: 'warn' })
  assert.equal(failed.traffic, null)
  assert.equal(failed.actions, null)
  assert.deepEqual(failed.kpis.map((item) => item.key), ['enquiries', 'qualified', 'won'], 'lead truth still renders when traffic is unavailable')

  const notConnected = websitePerformanceDashboardModel({ performance: { clientId: 'x', state: 'not_connected', report: null }, performanceFailed: false, leads: metrics({ state: 'not_connected' }) })
  assert.deepEqual(notConnected.kpis, [])
  assert.ok(notConnected.confidence.notes.includes('No website enquiry form is connected for this client yet.'))
})

test('zero enquiries is a real canonical zero; inconsistent lead figures never fabricate a pipeline', () => {
  const zero = websitePerformanceDashboardModel({ performance: performance(), performanceFailed: false, leads: metrics({ total: 0, closedLost: 0, poor: 0, qualificationRate: null }) })
  assert.deepEqual(kpi(zero, 'enquiries'), { key: 'enquiries', label: 'Website enquiries', value: 0, hint: 'None received yet this month' })
  assert.equal(kpi(zero, 'qualified'), undefined)
  assert.equal(kpi(zero, 'won'), undefined)

  const broken = websitePerformanceDashboardModel({ performance: performance(), performanceFailed: false, leads: metrics({ total: 3 }) })
  assert.equal(broken.leads.pipeline, null)
  assert.ok(broken.confidence.notes.some((note) => /could not be broken down/.test(note)))

  const malformed = websitePerformanceDashboardModel({ performance: performance(), performanceFailed: false, leads: metrics({ won: -1 }) })
  assert.equal(malformed.leads.state, 'error')
  assert.equal(kpi(malformed, 'enquiries'), undefined)

  const good = websitePerformanceDashboardModel({ performance: performance(), performanceFailed: false, leads: metrics({ total: 4, new: 1, contacted: 1, qualified: 2, won: 1, lost: 0, closedLost: 0, good: 2, poor: 0, unreviewed: 2, qualificationRate: 0.5 }) })
  assert.deepEqual(good.leads.pipeline.map((stage) => stage.value), [1, 1, 1, 1, 0])
  assert.equal(kpi(good, 'won').hint, 'Marked won by the business')
  assert.ok(good.confidence.notes.includes('2 enquirys not yet marked Good or Poor.') === false)
  assert.ok(good.confidence.notes.includes('2 enquiries not yet marked Good or Poor.'))
})

test('staff panel uses the shared dashboard, canonical leads and a read-only Lead Inbox preview', () => {
  const panel = read('../src/components/admin/WebsitePerformancePanel.tsx')
  const dashboard = read('../src/components/website/WebsitePerformanceDashboard.tsx')
  const inbox = read('../src/pages/client/ClientLeadsPage.tsx')
  const preview = read('../src/pages/admin/WebsiteLeadsPreviewPage.tsx')
  const app = read('../src/App.tsx')
  // No provider-aggregate enquiry tile, no dead "Unavailable" KPI formatter.
  assert.doesNotMatch(panel + dashboard, /enquiry_submit|'Unavailable'/)
  assert.match(panel, /getWebsiteLeadMetrics\(clientId, period\.from, period\.to\)/)
  assert.match(panel, /websitePerformanceDashboardModel\(/)
  assert.match(panel, /leadInboxHref=\{`\/admin\/website-leads\?client=\$\{clientId\}`\}/)
  assert.match(dashboard, /Open Lead Inbox/)
  assert.match(dashboard, /Data confidence/)
  // Staff route behind RequireStaff; preview is read-only and inert.
  assert.match(app, /<Route path="\/admin\/website-leads" element=\{<WebsiteLeadsPreviewPage \/>\} \/>/)
  assert.ok(app.indexOf('/admin/website-leads') > app.indexOf('<Route element={<RequireStaff />}>'))
  assert.match(preview, /<LeadInbox key=\{client\.id\} clientId=\{client\.id\} preview=\{\{ clientName: client\.name \}\} \/>/)
  assert.match(inbox, /readOnly\s*\? <p className="mt-6 border-t[^"]*">\s*Lead progress:/)
  assert.match(inbox, /: <fieldset className="mt-6/)
  assert.match(inbox, /aria-label="Contact actions \(preview\)"/)
  assert.match(inbox, /read-only, nothing can be changed here/)
})

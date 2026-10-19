import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, ClientPortalErrorState
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  ;({ ClientPortalErrorState } = await server.ssrLoadModule('/src/components/client/ClientPortalStates.tsx'))
})
after(async () => { await server?.close() })

test('read retry is an explicit non-submit action, never invoked by rendering', () => {
  let calls = 0
  const html = renderToStaticMarkup(React.createElement(ClientPortalErrorState, { onRetry: () => calls++ }))
  assert.match(html, /role="alert"/)
  assert.match(html, /<button type="button"/)
  assert.match(html, /Try again/)
  assert.equal(calls, 0)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ClientPortalErrorState)), /<button|Try again/)
  const source = readFileSync('src/components/client/ClientPortalStates.tsx', 'utf8')
  const button = source.slice(source.indexOf('export function ClientPortalRetryButton'), source.indexOf('export function ClientPortalEmptyState'))
  assert.doesNotMatch(button, /useEffect|setTimeout|setInterval|reload|supabase|fetch\(|\.rpc\(/)
})

test('portal retry callbacks reopen existing exact-scope reads, not browser sessions or write workflows', () => {
  const files = {
    'src/pages/client/ClientPortalHome.tsx': /\[clientId, previewClientId, workingMonth, readRevision\]/,
    'src/pages/client/ClientContentGuidesPage.tsx': /\[clientId, currentMonth, readRevision\]/,
    'src/pages/client/ClientContentCalendarPage.tsx': /\[month, clientId, readRevision\]/,
    'src/pages/client/ClientStrategyPage.tsx': /\[embedded, clientId, previewClientId, strategyMonth, readRevision\]/,
    'src/features/client-onboarding/ClientSetupPage.tsx': /\[clientId, previewClientId, readRevision\]/,
  }
  for (const [path, dependencies] of Object.entries(files)) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, dependencies, path)
    assert.match(source, /onRetry=\{\(\) => setReadRevision\(value => value \+ 1\)\}/, path)
    assert.doesNotMatch(source, /location\.reload|setInterval|setSession/, path)
  }
  const approvals = readFileSync('src/pages/admin/ContentReviewsPage.tsx', 'utf8')
  assert.match(approvals, /onRetry=\{onChanged\}/)
  assert.match(approvals, /onChanged=\{\(\) => setRevision\(value => value \+ 1\)\}/)
})

test('Performance separates list and selected-report retries so the chosen report is preserved', () => {
  const source = readFileSync('src/pages/client/Dashboard.tsx', 'utf8')
  assert.match(source, /if \(selectedReportId\) setReportRevision\(value => value \+ 1\)/)
  assert.match(source, /else setReportsRevision\(value => value \+ 1\)/)
  assert.match(source, /scopedClientId, reportsRevision\]/)
  assert.match(source, /scopedClientId, selectedReportId, reportRevision\]/)
  const leads = readFileSync('src/pages/client/ClientLeadsPage.tsx', 'utf8')
  assert.match(leads, /onRetry=\{\(\) => \{\s*setLoad\(null\)\s*void refresh\(\)/)
})

test('workspace recovery is pinned to the signed-in profile and cannot retry a missing identity', () => {
  const source = readFileSync('src/components/client/ClientPortalLayout.tsx', 'utf8')
  assert.match(source, /\[profile\?\.client_id, readRevision\]/)
  assert.match(source, /onRetry=\{profile\?\.client_id \? \(\) => setReadRevision\(value => value \+ 1\) : undefined\}/)
  assert.match(source, /if \(!active\) return/)
  assert.match(source, /result\.data\.id !== profile\.client_id/)
  assert.doesNotMatch(source, /location\.reload|setSession|setInterval|\.rpc\(/)
  const preview = readFileSync('src/pages/admin/ClientPortalPreview.tsx', 'utf8')
  assert.match(preview, /\[profile\?\.role, readRevision\]/)
  assert.match(preview, /onRetry=\{\(\) => \{\s*setLoading\(true\)\s*setFailed\(false\)\s*setReadRevision\(value => value \+ 1\)/)
  assert.match(preview, /if \(!\['admin', 'manager'\]\.includes\(profile\?\.role \?\? ''\)\) return/)
  assert.doesNotMatch(preview, /setSession|signIn|\.rpc\(/)
})

test('approval preview retries are separate from decision errors and staff history', () => {
  const source = readFileSync('src/components/content/ContentReviewCard.tsx', 'utf8')
  assert.match(source, /\[review\.asset_path, assetRevision\]/)
  const retry = source.slice(source.indexOf('<ClientPortalRetryButton'), source.indexOf('{error &&'))
  assert.match(retry, /setPreviewError\(null\)/)
  assert.match(retry, /setUrl\(null\)/)
  assert.match(retry, /setAssetRevision\(value => value \+ 1\)/)
  assert.doesNotMatch(retry, /decide\(|setError|setNote|onChanged|\.rpc\(/)
  assert.match(source, /createSignedUrl\(review\.asset_path, 600\)/)
  assert.match(source, /if \(!active\) return/)
})

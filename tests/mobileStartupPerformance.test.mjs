import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const app = read('../src/App.tsx')
const layout = read('../src/pages/admin/AdminLayout.tsx')

test('non-current route pages are split out of the mobile startup bundle', () => {
  for (const page of ['CgHubPage', 'ClientPerformancePage', 'ClientsList', 'PublishedPreview', 'InternalOnboardingPage', 'ClientSetupPage']) {
    assert.match(app, new RegExp(`const ${page} = lazyRoute\\(\\(\\) => import\\(`), `${page} must be deployment-safe lazy loaded`)
    assert.doesNotMatch(app, new RegExp(`import ${page} from`), `${page} must not be eagerly imported`)
  }
  assert.match(app, /<Suspense fallback=/)
  assert.match(layout, /<Suspense fallback=[\s\S]*<Outlet \/>/)
})

test('Notification work waits until after the critical shell render; composer is retired', () => {
  assert.doesNotMatch(layout, /GlobalAssistantComposer/)
  assert.match(layout, /scheduleWhenIdle/)
  assert.match(layout, /requestIdleCallback/)
  assert.doesNotMatch(layout, /setTimeout\(pollNotifications, 0\)/)
})

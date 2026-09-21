import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const app = read('../src/App.tsx')
const layout = read('../src/pages/admin/AdminLayout.tsx')

test('non-current route pages are split out of the mobile startup bundle', () => {
  for (const page of ['CgHubPage', 'ClientPerformancePage', 'ClientsList', 'PublishedPreview', 'InternalOnboardingPage', 'ClientSetupPage']) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\(`), `${page} must be lazy loaded`)
    assert.doesNotMatch(app, new RegExp(`import ${page} from`), `${page} must not be eagerly imported`)
  }
  assert.match(app, /<Suspense fallback=/)
  assert.match(layout, /<Suspense fallback=[\s\S]*<Outlet \/>/)
})

test('Assistant and notification work wait until after the critical shell render', () => {
  assert.match(layout, /const GlobalAssistantComposer = lazy/)
  assert.match(layout, /scheduleWhenIdle/)
  assert.match(layout, /requestIdleCallback/)
  assert.match(layout, /setBackgroundReady\(true\)/)
  assert.match(layout, /backgroundReady && <Suspense fallback=\{null\}>/)
  assert.doesNotMatch(layout, /setTimeout\(pollNotifications, 0\)/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clients = readFileSync(new URL('../src/pages/admin/ClientsList.tsx', import.meta.url), 'utf8')

test('client search filters the displayed registry only, preserving package and client authorities', () => {
  assert.match(clients, /const \[search, setSearch\] = useState\(''\)/)
  assert.match(clients, /client\.name\.toLocaleLowerCase\(\)\.includes\(query\)/)
  assert.match(clients, /readPackageAuthority\(client\.package_settings\)/)
  assert.match(clients, /confirmClientPackage\(/)
  assert.match(clients, /Showing \{displayClients\.length\} of \{clients\.length\}/)
  assert.match(clients, /No matching clients/)
})

test('exact-client primary routes remain visible and secondary routes remain accessible', () => {
  for (const route of [
    '/admin/client-dashboard?client=',
    '/admin/client-schedule?view=calendar&client=',
    '/admin/package-master?client=',
    '/admin/published?client=',
    '/admin/integrations/meta?client=',
  ]) assert.ok(clients.includes(route), `${route} retained`)
  assert.match(clients, /aria-label=\{`Actions for \$\{client.name\}`\} aria-haspopup="dialog"/)
  assert.match(clients, /<ActionSheet title=\{client.name\}/)
  assert.match(clients, /setOpen\(false\); onArchive\(\)/)
  assert.match(clients, /onArchive=\{\(\) => setConfirmAction\(\{ type: 'archive', client: c \}\)\}/)
  assert.match(clients, /aria-pressed=\{viewFilter === f\}/)
})

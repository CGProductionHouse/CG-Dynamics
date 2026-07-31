import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const nav = read('../src/pages/admin/adminNavigation.ts')
const layout = read('../src/pages/admin/AdminLayout.tsx')

test('Performance zone exposes the five client-intelligence surfaces', () => {
  assert.match(nav, /export const performanceNavItems/)
  assert.match(nav, /to: '\/admin\/client-performance', label: 'Performance Dashboard'/)
  assert.match(nav, /to: '\/admin\/clients', label: 'Clients'/)
  assert.match(nav, /to: '\/admin\/reports', label: 'Reports'/)
  assert.match(nav, /to: '\/admin\/published', label: 'Client Preview'/)
  assert.match(nav, /to: '\/admin\/integrations', label: 'Integrations'/)
})

test('Integrations in the Performance zone stays manager-gated', () => {
  // The integrations entry in performanceNavItems must carry manager access so
  // normal staff never see integration controls.
  const block = nav.slice(nav.indexOf('performanceNavItems'), nav.indexOf('export type NavZone'))
  assert.match(block, /'\/admin\/integrations'[\s\S]*access: 'manager'/)
})

test('Zone resolution auto-selects Performance only for performance-only routes', () => {
  assert.match(nav, /export function resolveNavZone/)
  assert.match(nav, /PERFORMANCE_ONLY_PATHS = \['\/admin\/client-performance', '\/admin\/reports', '\/admin\/published', '\/admin\/integrations'\]/)
  // Clients is shared and must NOT force a zone switch.
  assert.doesNotMatch(nav, /PERFORMANCE_ONLY_PATHS = \[[^\]]*'\/admin\/clients'/)
})

test('Layout renders a Hub/Performance switcher and both zones stay reachable', () => {
  assert.match(layout, /function ZoneSwitcher/)
  assert.match(layout, />Hub<\/button>/)
  assert.match(layout, />Performance<\/button>/)
  // The active zone drives both the sidebar list and the mobile bottom nav.
  assert.match(layout, /const zoneItems = zone === 'performance' \? performanceItems : primaryItems/)
  assert.match(layout, /\{zoneItems\.map\(item => <MobileNavItem/)
})

test('Daily Hub navigation is never hidden — Work stays in the Hub zone', () => {
  // Hub zone keeps the daily primary items (incl. Work), so switching zones
  // never removes daily navigation.
  assert.match(nav, /export const primaryNavItems/)
  assert.match(nav, /to: '\/admin\/work', label: 'Work'/)
  assert.match(layout, /zone === 'performance' \? performanceItems : primaryItems/)
})

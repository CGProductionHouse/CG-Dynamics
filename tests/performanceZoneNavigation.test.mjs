import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const nav = read('../src/pages/admin/adminNavigation.ts')
const layout = read('../src/pages/admin/AdminLayout.tsx')

test('Performance zone exposes onboarding as a first-class client-intelligence surface', () => {
  assert.match(nav, /export const performanceNavItems/)
  assert.match(nav, /to: '\/admin\/client-performance', label: 'Performance Dashboard'/)
  assert.match(nav, /to: '\/admin\/clients', label: 'Clients'/)
  assert.match(nav, /to: '\/admin\/client-onboarding', label: 'Client Onboarding', shortLabel: 'Onboarding', marker: 'ON', access: 'manager'/)
  assert.match(nav, /to: '\/admin\/reports', label: 'Reports'/)
  assert.match(nav, /to: '\/admin\/published', label: 'Client Preview'/)
  assert.match(nav, /to: '\/admin\/integrations', label: 'Integrations'/)
})

test('Onboarding and Integrations in the Performance zone stay manager-gated', () => {
  // The integrations entry in performanceNavItems must carry manager access so
  // normal staff never see integration controls.
  const block = nav.slice(nav.indexOf('performanceNavItems'), nav.indexOf('export type NavZone'))
  assert.match(block, /'\/admin\/integrations'[\s\S]*access: 'manager'/)
  assert.match(block, /'\/admin\/client-onboarding'[\s\S]*access: 'manager'/)
  assert.ok(block.indexOf("'/admin/client-onboarding'") < block.indexOf("'/admin/reports'"), 'Onboarding must be in the first four mobile destinations')
})

test('Zone resolution auto-selects Performance only for performance-only routes', () => {
  assert.match(nav, /export function resolveNavZone/)
  assert.match(nav, /PERFORMANCE_ONLY_PATHS = \['\/admin\/client-performance', '\/admin\/client-onboarding', '\/admin\/reports', '\/admin\/published', '\/admin\/integrations'\]/)
  // Clients is shared and must NOT force a zone switch.
  assert.doesNotMatch(nav, /PERFORMANCE_ONLY_PATHS = \[[^\]]*'\/admin\/clients'/)
})

test('Layout renders a Hub/Performance switcher and both zones stay reachable', () => {
  assert.match(layout, /function ZoneSwitcher/)
  assert.match(layout, />Hub<\/button>/)
  assert.match(layout, />Performance<\/button>/)
  // The selected zone drives both the sidebar list and the mobile bottom nav.
  assert.match(layout, /const zoneItems = zone === 'performance' \? performanceItems : primaryItems/)
  assert.match(layout, /const \[selectedZone, setSelectedZone\] = useState<NavZone>/)
  assert.match(layout, /mobilePrimaryItems\.map\(item => <MobileNavItem/)
})

test('Zone switch navigates to the selected zone landing route', () => {
  assert.match(layout, /navigate\(nextZone === 'performance' \? '\/admin\/client-performance' : '\/admin\/cg-hub'\)/)
  assert.match(layout, /<ZoneSwitcher zone=\{zone\} onChange=\{changeZone\}/)
})

test('shared Clients routes preserve the selected zone while exclusive routes select their zone', () => {
  assert.match(nav, /SHARED_ZONE_PATHS = \['\/admin\/clients', '\/admin\/client-dashboard'\]/)
  assert.match(layout, /const zone = isSharedNavZonePath\(location\.pathname\) \? selectedZone : routeZone/)
  assert.match(layout, /window\.localStorage\.setItem\(ZONE_STORAGE_KEY, zone\)/)
  assert.match(layout, /setSelectedZone\(nextZone\)[\s\S]*navigate\(nextZone === 'performance'/)
  assert.match(layout, /previousPath !== location\.pathname[\s\S]*setSelectedZone\(routeZone\)/)
})

test('Daily Hub navigation is never hidden — Work stays in the Hub zone', () => {
  // Hub zone keeps the daily primary items (incl. Work), so switching zones
  // never removes daily navigation.
  assert.match(nav, /export const primaryNavItems/)
  assert.match(nav, /to: '\/admin\/work', label: 'Work'/)
  assert.match(layout, />\s*More\s*<\/button>/)
})

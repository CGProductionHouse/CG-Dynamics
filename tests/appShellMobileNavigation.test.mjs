import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../src/pages/admin/AdminLayout.tsx', import.meta.url), 'utf8')

test('staff mobile navigation uses visible destinations plus a complete More menu', () => {
  assert.match(layout, /const MOBILE_QUICK_PATHS = \[/)
  assert.match(layout, /MOBILE_QUICK_PATHS\.includes\(item\.to\)/)
  assert.match(layout, /onClick=\{\(\) => setMobileMenuOpen\(true\)\}/)
  assert.match(layout, /aria-controls="staff-mobile-navigation"/)
  assert.match(layout, />\s*More\s*<\/button>/)
  assert.match(layout, /renderNav\(false, closeMobile\)/)
  assert.doesNotMatch(layout, /overflow-x-auto overscroll-x-contain/)
})

test('mobile bottom bar is role-stable: Hub, Work, Calendar, Schedule, More', () => {
  assert.match(layout, /'\/admin\/cg-hub'/)
  assert.match(layout, /'\/admin\/work'/)
  assert.match(layout, /'\/admin\/cg-calendar'/)
  assert.match(layout, /'\/admin\/client-schedule'/)
  // Manager-only work entries never displace Calendar or Schedule from the bar.
  assert.doesNotMatch(layout, /MOBILE_QUICK_PATHS = \[[^\]]*command-centre[^\]]*\]/)
  assert.doesNotMatch(layout, /MOBILE_QUICK_PATHS = \[[^\]]*morning-import[^\]]*\]/)
})

test('staff mobile controls meet touch target and safe-area requirements', () => {
  assert.match(layout, /grid grid-cols-5/)
  assert.match(layout, /min-h-11 min-w-11/)
  assert.match(layout, /group relative flex min-h-11 items-center/)
  assert.match(layout, /max\(0\.375rem, env\(safe-area-inset-bottom\)\)/)
  assert.match(layout, /pb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.match(layout, /aria-label=\{label\}/)
  assert.match(layout, /bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/)
})

test('shell padding clears mobile controls but drops unused desktop assistant space', () => {
  assert.match(layout, /const assistantVisible = location\.pathname !== '\/admin\/assistant'/)
  assert.match(layout, /pb-\[calc\(9rem\+env\(safe-area-inset-bottom\)\)\] md:pb-16/)
  assert.match(layout, /pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\)\] md:pb-0/)
  assert.doesNotMatch(layout, /md:pb-24/)
})

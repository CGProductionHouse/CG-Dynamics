import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../src/pages/admin/AdminLayout.tsx', import.meta.url), 'utf8')

test('staff mobile navigation uses visible destinations plus a complete More menu', () => {
  assert.match(layout, /const mobilePrimaryItems = zoneItems\.slice\(0, 4\)/)
  assert.match(layout, /onClick=\{\(\) => setMobileMenuOpen\(true\)\}/)
  assert.match(layout, /aria-controls="staff-mobile-navigation"/)
  assert.match(layout, />\s*More\s*<\/button>/)
  assert.match(layout, /renderNav\(false, closeMobile\)/)
  assert.doesNotMatch(layout, /overflow-x-auto overscroll-x-contain/)
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

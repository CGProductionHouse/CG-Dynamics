import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const app = read('../src/App.tsx')
const recovery = read('../src/lib/lazyRoute.ts')
const boundary = read('../src/components/RouteLoadBoundary.tsx')

test('every route import uses deployment-safe lazy loading', () => {
  assert.doesNotMatch(app, /\blazy\(\(\) => import\(/)
  assert.match(app, /const ClientsList = lazyRoute\(\(\) => import\('\.\/pages\/admin\/ClientsList'\)\)/)
  assert.match(app, /<RouteLoadBoundary>[\s\S]*<Suspense fallback=/)
})

test('route recovery reloads once and cannot enter a reload loop', () => {
  assert.match(recovery, /attemptedRoute !== routeKey/)
  assert.match(recovery, /window\.sessionStorage\.setItem\(ROUTE_RELOAD_KEY, routeKey\)/)
  assert.match(recovery, /window\.location\.reload\(\)/)
  assert.match(recovery, /window\.sessionStorage\.removeItem\(ROUTE_RELOAD_KEY\)[\s\S]*throw error/)
})

test('a repeated route failure shows a recoverable signed-in error state', () => {
  assert.match(boundary, /role="alert"/)
  assert.match(boundary, /Your sign-in and saved work will stay in place\./)
  assert.match(boundary, /onClick=\{\(\) => window\.location\.reload\(\)\}/)
})

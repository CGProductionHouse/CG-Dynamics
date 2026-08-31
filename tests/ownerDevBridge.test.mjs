import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const tools = await readFile(new URL('../dev-bridge/src/tools.ts', import.meta.url), 'utf8')
const safety = await readFile(new URL('../dev-bridge/src/safety.ts', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/owner-dev-bridge.yml', import.meta.url), 'utf8')
const vercel = await readFile(new URL('../dev-bridge/vercel.json', import.meta.url), 'utf8')

test('owner bridge has no arbitrary shell, SQL, production deploy or merge tool', () => {
  assert.doesNotMatch(tools, /dev_(?:exec|shell|run_sql|deploy_production|merge_pr)/)
  assert.match(tools, /High-impact operations are not executable through this bridge/)
  assert.match(tools, /Arbitrary SQL and row mutation are not available/)
})

test('write tools require OAuth write scope and protected development branches', () => {
  assert.match(tools, /requireWriteScope\(identity\)/)
  assert.match(safety, /DEFAULT|main|master|production/i)
  assert.match(safety, /supabase\\\/migrations/)
})

test('remote runner exposes an enum allowlist rather than command input', () => {
  assert.match(workflow, /options: \[typecheck, lint, test, build, full, browser\]/)
  assert.doesNotMatch(workflow, /inputs:\s*\n\s*(?:command|script|shell):/)
  assert.match(workflow, /permissions:\s*\n\s*contents: read/)
  assert.match(workflow, /run-name: Owner Dev Bridge \$\{\{ inputs\.request_id/)
})

test('companion exposes only the intended stable public routes', () => {
  assert.match(vercel, /"source": "\/health", "destination": "\/api\/health"/)
  assert.match(vercel, /"source": "\/mcp", "destination": "\/api\/mcp"/)
  assert.match(vercel, /"source": "\/\.well-known\/oauth-protected-resource\/mcp"/)
})

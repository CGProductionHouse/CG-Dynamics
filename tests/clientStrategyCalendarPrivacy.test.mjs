import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const previous = read('20261013225255_client_strategy_gold_projection.sql')
const next = read('20261117150038_client_strategy_selected_calendar_privacy.sql')
const definition = text => text.slice(text.indexOf('create or replace function'), text.indexOf('\nrevoke all'))

test('calendar privacy patch changes only the canonical selected-entry predicate', () => {
  const predicate = "\n        and selection.value -> 'use' = 'true'::jsonb"
  assert.equal(next.split(predicate).length, 2)
  assert.equal(definition(next).replace(predicate, ''), definition(previous))
})

test('calendar privacy rollout preserves existing rows, public-call denial and the Gold contract', () => {
  assert.doesNotMatch(next, /\b(insert\s+into|update|delete\s+from|alter\s+table|create\s+policy|grant\s+execute)\b/i)
  assert.match(next, /revoke all on function public\.client_safe_strategy_data\(jsonb\) from public, anon, authenticated/)
  assert.match(next, /client-safe gold-standard projection contract failed/)
  assert.match(next, /client-safe selected calendar projection contract failed/)
})

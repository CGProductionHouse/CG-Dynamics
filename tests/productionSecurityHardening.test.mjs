import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/phase-29b-production-security-hardening.sql', import.meta.url),
  'utf8',
)

test('refresh queue uses caller rights and remains admin-only', () => {
  assert.match(migration, /security_invoker\s*=\s*true/i)
  assert.match(migration, /security_barrier\s*=\s*true/i)
  assert.match(migration, /where\s+public\.is_admin\(\)\s+and\s*\(/i)
  assert.match(
    migration,
    /revoke all on public\.platform_knowledge_refresh_queue from public, anon/i,
  )
  assert.match(
    migration,
    /grant select on public\.platform_knowledge_refresh_queue to authenticated/i,
  )
})

test('role helpers have fixed paths and are not anonymously executable', () => {
  for (const helper of ['is_staff', 'is_manager', 'is_admin', 'my_client_id']) {
    assert.match(
      migration,
      new RegExp(
        `alter function public\\.${helper}\\(\\) set search_path = public, pg_temp`,
        'i',
      ),
    )
    assert.match(
      migration,
      new RegExp(
        `revoke execute on function public\\.${helper}\\(\\) from public, anon`,
        'i',
      ),
    )
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${helper}\\(\\) to authenticated`,
        'i',
      ),
    )
  }
})

test('auth trigger function is not directly exposed as an RPC', () => {
  assert.match(
    migration,
    /revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated/i,
  )
})

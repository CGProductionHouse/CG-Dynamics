import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

test('Assistant entry typing repair preserves emitted handlers, auth, queries and action behavior', () => {
  const source = readFileSync('supabase/functions/cg-assistant-chat/index.ts', 'utf8')
  assert.doesNotMatch(source, /ReturnType<typeof createClient>|@ts-ignore|@ts-nocheck/)
  const previous = source
    .replace('createClient, type SupabaseClient', 'createClient')
    .replaceAll('sb: SupabaseClient', 'sb: ReturnType<typeof createClient>')
    .replace('  currentClientName?: string | null\n', '')
    .replaceAll('(intent.action_type as string)', 'intent.action_type')
    .replaceAll('(parsed.action_type as string)', 'parsed.action_type')
    .replaceAll(': string | null | undefined', ': string | null')
  const emit = text => ts.transpileModule(text, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true,
  } }).outputText
  assert.equal(emit(source), emit(previous), 'typing changes must not alter runtime JavaScript')
})

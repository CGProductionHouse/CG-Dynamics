import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// tsc -b does not type-check Supabase Edge Functions (they are Deno), and ESLint's
// no-undef is off for TypeScript. So a reference to a variable that no longer
// exists passes both lint and build, then throws ReferenceError at runtime.
// (#326 removed providerName / providerRouteId from meeting-debrief while still
// reading them.) This runs the TypeScript checker over every Edge Function and
// fails on "Cannot find name", ignoring the runtime's own globals.

const RUNTIME_GLOBALS = new Set(['Deno', 'EdgeRuntime'])
const functionsDir = new URL('../supabase/functions/', import.meta.url)
const entries = readdirSync(functionsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
  .map(entry => fileURLToPath(new URL(`${entry.name}/index.ts`, functionsDir)))
  .filter(existsSync)

test('every Edge Function entry point is checked', () => {
  assert.ok(entries.length >= 30, `expected the Edge Function entry points, found ${entries.length}`)
})

test('no Edge Function references an undeclared name', () => {
  const program = ts.createProgram(entries, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
  })
  const undeclared = ts.getPreEmitDiagnostics(program)
    .filter(diagnostic => diagnostic.code === 2304 && diagnostic.file)
    .map(diagnostic => {
      const name = /'([^']+)'/.exec(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))?.[1] ?? '?'
      const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
      // TypeScript normalises file names to forward slashes on every platform.
      const fileName = diagnostic.file.fileName
      const at = fileName.search(/supabase.functions./)
      const file = at >= 0 ? fileName.slice(at + 'supabase/functions/'.length) : fileName
      return { name, where: `${file}:${line + 1}` }
    })
    .filter(item => !RUNTIME_GLOBALS.has(item.name))
    .map(item => `${item.where} ${item.name}`)
  assert.deepEqual(undeclared, [], 'Edge Function code references names that are never declared')
})

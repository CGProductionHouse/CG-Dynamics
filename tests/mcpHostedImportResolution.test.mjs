import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

test('shared Microsoft preview runtime imports resolve without Deno sloppy-imports', () => {
  const file = 'src/lib/microsoftImportPreview.ts'
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const runtimeImports = ast.statements.filter(node => ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly)
  assert.equal(runtimeImports.length, 2)
  for (const node of runtimeImports) {
    const specifier = node.moduleSpecifier.text
    assert.match(specifier, /^\.\/[^/]+\.ts$/)
    assert.doesNotThrow(() => readFileSync(new URL(`../src/lib/${specifier.slice(2)}`, import.meta.url)))
  }
})

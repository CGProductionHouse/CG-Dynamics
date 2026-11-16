import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const read = p => readFileSync(p, 'utf8')
test('chat screens and all composer mounts are removed; old link uses authenticated existing workspace', () => {
  for (const file of ['src/pages/admin/AssistantPage.tsx', 'src/components/assistant/GlobalAssistantComposer.tsx', 'src/components/assistant/DailyAssistantCapture.tsx']) assert.equal(existsSync(file), false)
  assert.doesNotMatch(read('src/pages/admin/AdminLayout.tsx'), /GlobalAssistantComposer|assistantFullscreen|assistantVisible/)
  assert.match(read('src/App.tsx'), /path="\/admin\/assistant" element=\{<Navigate to="\/admin\/my-assistant" replace \/>\}/)
  assert.match(read('src/pages/admin/MyAssistantPage.tsx'), /built-in CG Assistant is no longer available in this workspace/)
})
test('marketing deep link retains artifact history and human decisions without generation controls', () => {
  const page = read('src/pages/admin/MarketingAiDepartmentPage.tsx')
  for (const name of ['listMarketingArtifacts','listArtifactVersions','listArtifactHistory','listArtifactApprovals','recordMarketingDecision']) assert.ok(page.includes(name))
  assert.doesNotMatch(page, /runMarketingSpecialist|routeMarketingRequest|Start workflow|Regenerate current step/)
})

test('connector dependency graph never imports either retired HTTP entry point', () => {
  const seen = new Set()
  function visit(path) {
    if (seen.has(path)) return
    seen.add(path)
    assert.ok(!/\/(cg-assistant-chat|marketing-workflow)\/index\.ts$/.test(path), path)
    const source = read(path)
    assert.doesNotMatch(source, /functions\.invoke\(['"](?:cg-assistant-chat|marketing-workflow)['"]/, path)
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    for (const node of tree.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue
      const spec = node.moduleSpecifier.text
      if (!spec.startsWith('.')) continue
      const target = new URL(spec, new URL(path, `file://${process.cwd()}/`)).pathname
      if (existsSync(target)) visit(target)
    }
  }
  visit('supabase/functions/cg-dynamics-mcp/index.ts')
  assert.ok(seen.size > 20, 'walk the actual shared closure, not just one wrapper')
})

test('all four existing plugin skills remain installed and point at governed MCP context', () => {
  const manifest = JSON.parse(read('chatgpt-plugin/cg-dynamics/.codex-plugin/plugin.json'))
  assert.equal(manifest.skills, './skills/')
  for (const name of ['staff-assistant-daily-ops','client-context-and-content','content-run-closeout','lead-follow-up-and-email-draft']) {
    const skill = read(`chatgpt-plugin/cg-dynamics/skills/${name}/SKILL.md`)
    assert.match(skill, /MCP/)
    assert.match(skill, /context/)
  }
})

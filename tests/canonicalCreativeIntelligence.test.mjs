import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, Editor, AuthProvider, Adapter
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Editor = (await server.ssrLoadModule('/src/pages/admin/ContentGuidelineDocumentEditor.tsx')).default
  Adapter = (await server.ssrLoadModule('/src/pages/admin/CanonicalCreativeIntelligence.tsx')).default
  ;({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx'))
})
after(async () => { await server?.close() })
const clientId = '11111111-1111-4111-8111-111111111111'
const guideline = { id: 'guide', client_id: clientId, title: 'Exact document', month: '2026-10-01', coverage_start: null, coverage_end: null, client_published_at: null }
const run = { id: 'run', client_id: clientId, name: 'Exact run', run_date: null }
const render = videos => renderToStaticMarkup(createElement(AuthProvider, null,
  createElement(MemoryRouter, null, createElement(Editor, { guideline, run, videos, onChanged() {} }))))

test('live canonical editor exposes read-only intelligence before adding a video', () => {
  const html = render([])
  assert.equal((html.match(/aria-label="Creative Intelligence"/g) ?? []).length, 1)
  assert.match(html, /Select an exact client, month and linked deliverable/)
  assert.match(html, /Current staff draft — not a recommendation/)
  assert.match(html, /Nothing is applied to the guideline automatically/)
})
test('existing canonical video editor exposes the same panel, not a legacy unused form', () => {
  const html = render([{ id: 'video', title: 'Staff title', script: 'Staff script', month: null,
    objective: 'Staff objective', hook: 'Staff hook', cta: 'Staff CTA', shot_breakdown: 'Staff shots', requirements: 'Staff props', visual_notes: '', production_status: 'draft', deliverable_id: null }])
  assert.equal((html.match(/aria-label="Creative Intelligence"/g) ?? []).length, 2)
  assert.match(html, /Staff hook/)
  assert.match(html, /Staff CTA/)
  assert.match(html, /Not established by approved evidence/)
})
test('exact linked identity displays loading rather than invented or previous evidence', () => {
  const html = renderToStaticMarkup(createElement(Adapter, { clientId, month: '2026-10', deliverableId: 'video-slot',
    draft: { objective: '', hook: '', cta: '', shot_breakdown: '', requirements: '' } }))
  assert.match(html, /Loading approved knowledge and monthly strategy/)
  assert.doesNotMatch(html, /Linked deliverable ID:|Approved source rationale/)
})
test('live adapter uses only canonical reads and fences changed identity and late responses', () => {
  const source = readFileSync('src/pages/admin/CanonicalCreativeIntelligence.tsx', 'utf8')
  assert.match(source, /getMonthlyStrategy\(clientId, month\)/)
  assert.match(source, /listMonthlyDeliverablesByMonth\(month, \{ clientId \}\)/)
  assert.match(source, /listActiveSharedSkillCards\(\)/)
  assert.match(source, /evidence\?\.identity === identity/)
  assert.match(source, /if \(!active\) return/)
  assert.match(source, /return \(\) => \{ active = false \}/)
  assert.doesNotMatch(source, /updateGuideline|addGuideline|setGuidelinePublication|\.rpc\(|\.invoke\(/)
  const workflow = readFileSync('src/pages/admin/ContentWorkflowPage.tsx', 'utf8')
  assert.match(workflow, /<ContentGuidelineDocumentEditor/)
  const editor = readFileSync('src/pages/admin/ContentGuidelineDocumentEditor.tsx', 'utf8')
  assert.match(editor, /month=\{draft.targetMonth\} deliverableId=\{draft.deliverableId\}/)
  assert.match(editor, /month=\{newTargetMonth\} deliverableId=\{newDeliverableId\}/)
})

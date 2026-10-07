import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, Saved, workflow, receipt
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true } })
  Saved = (await server.ssrLoadModule('/src/pages/admin/SavedDirectorContext.tsx')).default
  workflow = await server.ssrLoadModule('/src/lib/contentWorkflow.ts')
  receipt = (await server.ssrLoadModule('/src/lib/contentDirectorEvidence.ts')).directorKnowledgeReceipt
})
after(async () => { await server?.close() })

test('actual saved-context component shows manual persisted receipt after a serialization/reload boundary', () => {
  const reference = { card_id: 'approved-fixture', title: 'Reviewed proof guidance', source_id: 'source-fixture', source_reference: 'Section 3', confidence_level: 'medium', evidence_label: 'source_backed', safe_claim: 'Use only actual service proof', prohibited_overclaim: 'No guaranteed results', updated_at: '2026-10-07T08:00:00Z' }
  const idea = { title: 'Human name', objective: 'Explain the real service', hook: 'Human opening', angle: 'Human chosen angle', audience: 'Proposed audience', targetMonth: '2026-10', deliverableId: null, needsConfirmation: 'Confirm service details', evidence: [{ kind: 'cg_knowledge', note: 'Guidance', knowledgeReference: reference }] }
  const before = JSON.stringify(idea)
  const saved = JSON.parse(JSON.stringify(workflow.ideaToVideoInput(idea, 3, 'staff-fixture')))
  const html = renderToStaticMarkup(React.createElement(Saved, saved))
  assert.match(html, /Saved creative context|Human opening|Human chosen angle|Confirm service details/)
  assert.match(html, /approved-fixture|source-fixture|Section 3|No guaranteed results|2026-10-07/)
  assert.match(html, /not a new recommendation|current approval/)
  assert.equal(saved.position, 3)
  assert.equal(JSON.stringify(idea), before)
  assert.ok(saved.notes.includes(receipt(reference)))
})

test('missing saved evidence stays absent, not zero, invented recommendation or auto-certified approval', () => {
  assert.equal(renderToStaticMarkup(React.createElement(Saved, { objective: null, hook: '', notes: '  ' })), '')
  const html = renderToStaticMarkup(React.createElement(Saved, { objective: null, hook: 'Explicit staff hook', notes: null }))
  assert.match(html, /Explicit staff hook/)
  assert.doesNotMatch(html, /Saved objective|Saved angle|Verified research|Approved evidence/)
})

test('stored source/notes render as escaped plain text, never arbitrary hyperlinks or executable HTML', () => {
  const html = renderToStaticMarkup(React.createElement(Saved, { objective: null, hook: null, notes: '<script>alert(1)</script> https://untrusted.example/?token=synthetic' }))
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script|href=|dangerouslySetInnerHTML/)
})

test('editor readback is staff-only and explicit script saves leave evidence/objective/hook untouched', () => {
  const editor = readFileSync('src/pages/admin/ContentGuidelineDocumentEditor.tsx', 'utf8')
  assert.match(editor, /<SavedDirectorContext objective=\{video.objective\} hook=\{video.hook\} notes=\{video.notes\}/)
  const save = editor.slice(editor.indexOf('async function saveVideo'), editor.indexOf('async function moveVideo'))
  assert.doesNotMatch(save, /^\s*(?:notes|objective|hook):/m)
  const client = readFileSync('src/pages/client/ClientContentCalendarPage.tsx', 'utf8')
  assert.doesNotMatch(client, /SavedDirectorContext|directorKnowledgeReceipt/)
  for (const page of ['ContentWorkflowPage', 'FullContentGuidePage']) {
    assert.match(readFileSync(`src/pages/admin/${page}.tsx`, 'utf8'), /<ContentGuidelineDocumentEditor\s+key=\{(?:runGuideline|selectedDocument.guideline)\.id\}/)
  }
})

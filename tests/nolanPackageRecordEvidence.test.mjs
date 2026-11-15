import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
let server, Evidence
before(async () => { server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' }); ({ NolanPackageRecordEvidence: Evidence } = await server.ssrLoadModule('/src/pages/admin/NolanPackageRecordEvidence.tsx')) })
after(async () => { await server?.close() })
const field = { state: 'proposed', proposedValue: 0, evidenceClass: 'direct_current_package_template', confidence: 'high', sourceReferences: ['package_template:fixture'], note: 'Current template only' }
const fixture = { clientId: 'client-fixture', clientName: 'Fixture', confirmed: false, fields: { design_posters_per_month: field }, directSources: ['package:fixture'], supportingSources: ['historical:fixture'], conflicts: [], unknownFields: [], cadence: [] }
const render = overrides => renderToStaticMarkup(React.createElement(Evidence, { client: { ...fixture, ...overrides } }))
test('field provenance preserves exact client source note and evidence classification', () => {
 const html = render()
 for (const text of ['client-fixture', 'package_template:fixture', 'Current template only', 'direct current package template', 'Confidence: high', 'package:fixture', 'historical:fixture']) assert.ok(html.includes(text), text)
 assert.ok(html.includes('not payment, historical entitlement, published usage'))
 assert.ok(html.includes('Supporting context is not a confirmed allowance'))
})
test('zero false and unknown values remain distinct without invented references', () => {
 const html = render({ fields: { zero: field, flag: { ...field, proposedValue: false }, missing: { ...field, proposedValue: null, sourceReferences: [], note: '' } } })
 assert.ok(html.includes(': 0 (proposed)'))
 assert.ok(html.includes(': false (proposed)'))
 assert.ok(html.includes('Unknown (proposed)'))
 assert.ok(html.includes('No source references recorded.'))
 assert.ok(html.includes('No evidence note recorded.'))
})
test('conflicts and unknown identities are visible not silently reduced to totals', () => {
 const html = render({ conflicts: ['Multiple current packages: p1, p2'], unknownFields: ['design_posters_per_month'] })
 assert.ok(html.includes('Multiple current packages: p1, p2'))
 assert.ok(html.includes('Unknown fields</h4><ul><li>design posters per month'))
 assert.ok(html.includes('Unverified package'))
})
test('references stay escaped non-clickable audit text and repeated references deduplicate', () => {
 const html = render({ directSources: ['<script>x</script>', 'javascript:alert(1)', 'same', 'same', '  '] })
 assert.ok(html.includes('&lt;script&gt;'))
 assert.ok(!html.includes('<script>'))
 assert.ok(!html.includes('<a '))
 assert.equal((html.match(/<li>same<\/li>/g) || []).length, 1)
})
test('presentation remains read-only wired to existing authority with explicit empty coverage', () => {
 const source = readFileSync('src/pages/admin/NolanPackageRecordEvidence.tsx', 'utf8')
 const wrapper = readFileSync('src/pages/admin/NolanPackageEvidence.tsx', 'utf8')
 assert.doesNotMatch(source, /fetch\(|supabase|\.update\(|\.insert\(|localStorage|iframe/)
 assert.ok(wrapper.includes('NolanPackageRecordEvidence client={client}'))
 assert.ok(wrapper.includes('does not establish company-wide coverage'))
})

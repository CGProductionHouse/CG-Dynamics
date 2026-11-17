import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
let server, MasterScope
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ;({MasterScope} = await server.ssrLoadModule('/src/pages/admin/NolanMasterScope.tsx'))
})
after(async () => { await server?.close() })
test('master responsibility view renders real accessible headings and source anchors without fabricated status claims', async () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(MasterScope, {role: 'manager'})))
  assert.equal((html.match(/<article/g) ?? []).length,12)
  const navigationCards = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? []
  assert.equal(navigationCards.length, 12)
  for (const card of navigationCards) assert.equal((card.match(/<h3>/g) ?? []).length, 1)
  assert.ok(html.includes('<h3>Visible task snapshot</h3>'))
  assert.equal((html.match(/<a /g) ?? []).length,12)
  for (const text of ['Websites &amp; discovery','Special requests and CG campaigns','Canva, OneDrive','Open source']) assert.ok(html.includes(text))
  assert.doesNotMatch(html,/All healthy|All complete/)
})

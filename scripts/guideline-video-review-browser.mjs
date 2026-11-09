import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
if (!process.env.CG_PLAYWRIGHT_MODULE) throw Error('Set CG_PLAYWRIGHT_MODULE to the existing approved Playwright package')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const token = 'a'.repeat(64), slug = 'example-client-content-guideline'
const version = '2026-11-09T10:24:27.044422+00:00'
const sample = { client: { name: 'Example Client' }, guide: { row_key: 'shared', title: 'Example Client · November 2026', month: '2026-11-01', filming_date: '2026-11-10', run_name: 'PRIVATE INTERNAL RUN', published_at: version,
  videos: [1, 2].map(position => ({ position, title: position === 1 ? 'The counter countdown' : 'The workshop voice note', script: `SCENE 01\nVerbatim sample script ${position}.\n\nSCENE 02\nEvery line stays exactly as authored.`, objective: 'A clear, memorable story about your business.', hook: 'Start with a familiar moment.', shot_breakdown: 'Wide shot, detail, reaction.', cta: 'Start a conversation with your team.', visual_notes: 'Natural light and a confident, conversational delivery.', platform: 'Facebook · Instagram', format: 'Short-form video',
    inspiration_url: position === 1 ? 'https://www.tiktok.com/@example/video/123456' : null, inspiration_note: position === 1 ? 'Take the playful countdown and quick reactions, then make it our own with your team and real products.' : null })) } }
const plugin = { name: 'public-review-fixture',
  resolveId(id) { if (id === 'virtual:public-review') return '\0virtual:public-review' },
  load(id) { if (id === '\0virtual:public-review') return `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Page from '/src/pages/PublicContentGuidelinePage.tsx';import {GuidelineClientResponses} from '/src/components/content/GuidelineClientResponses.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(location.search.includes('staff')?React.createElement('main',{className:'mx-auto max-w-4xl p-5'},React.createElement(GuidelineClientResponses,{runId:'30000000-0000-4000-8000-000000000001'})):React.createElement(MemoryRouter,{initialEntries:['/guidelines/${slug}/${token}']},React.createElement(Routes,null,React.createElement(Route,{path:'/guidelines/:slug/:token',element:React.createElement(Page)}))));` },
  configureServer(server) { server.middlewares.use((req, res, next) => { if (!req.url?.startsWith('/__public-review')) return next(); res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#030706"><div id="root"></div><script type="module" src="/@id/virtual:public-review"></script></body></html>') }) },
}
const server = await createServer({ configFile: false, plugins: [plugin, react()], cacheDir: join(tmpdir(), 'cg-guideline-review-cache'),
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture') },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react-router-dom'] }, server: { host: '127.0.0.1', port: 0, hmr: false } })
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const width of [1440, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = [], attempts = [], saved = new Map()
    let activeVersion = version, revoked = false, loseNext = false
    const reviews = () => ({ published_at: activeVersion, videos: [1, 2].map(position => {
      const responses = [...saved.values()].filter(e => e.position === position && e.version === activeVersion).reverse()
      return { position, revision: responses[0]?.id ?? null, decision: responses.find(e => e.action !== 'comment')?.action ?? 'pending', responses: responses.map(({ id, action, reviewer_name, message, created_at }) => ({ id, action, reviewer_name, message, created_at })) }
    }) })
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== 'http://127.0.0.1:1') { assert.equal(url.origin, origin, 'Only local assets/RPC fixture'); return route.continue() }
      assert.equal(request.method(), 'POST'); assert.equal(request.headers().authorization, 'Bearer local-public-fixture', 'Isolated anonymous API never uses a staff session')
      const body = request.postDataJSON()
      if (url.pathname.endsWith('/get_guideline_client_reviews')) return route.fulfill({ json: { content_run_id: body.p_run_id, responses: [...saved.values()].map(e => ({ ...e, title: sample.guide.videos[e.position - 1].title, published_at: e.version, current_publication: false, matches_current_video: false })) } })
      assert.equal(body.p_slug, slug); assert.equal(body.p_token, token)
      if (url.pathname.endsWith('/read_public_content_guideline_share')) return route.fulfill({ json: revoked ? null : { ...sample, guide: { ...sample.guide, published_at: activeVersion } } })
      if (url.pathname.endsWith('/read_public_guideline_video_reviews')) return route.fulfill({ json: revoked ? null : reviews() })
      assert.ok(url.pathname.endsWith('/respond_public_guideline_video')); attempts.push(body)
      if (revoked || body.p_published_at !== activeVersion) return route.fulfill({ status: 400, json: { message: 'This guideline has been updated. Refresh before responding.' } })
      if (!saved.has(body.p_request_id)) saved.set(body.p_request_id, { id: body.p_request_id, position: body.p_position, version: activeVersion, action: body.p_action, reviewer_name: body.p_reviewer_name, message: body.p_message, created_at: new Date().toISOString() })
      if (loseNext) { loseNext = false; return route.fulfill({ status: 500, json: { message: 'Fixture lost response' } }) }
      return route.fulfill({ json: { ...reviews(), saved_response_id: body.p_request_id } })
    })
    await page.goto(`${origin}/__public-review`)
    await page.getByText('0 of 2 ideas reviewed', { exact: true }).waitFor()
    assert.equal(await page.getByText(sample.guide.videos[0].script, { exact: true }).textContent(), sample.guide.videos[0].script)
    assert.doesNotMatch(await page.locator('main').innerText(), /PRIVATE INTERNAL|assignee|backend|admin/i)
    const account = page.getByRole('link', { name: 'Sign in to your CG Dynamics account' })
    assert.equal(await account.getAttribute('href'), '/login'); assert.equal(await account.getAttribute('target'), '_blank'); assert.match(await account.getAttribute('rel'), /noreferrer/)
    assert.equal(await page.locator('a[href*="/admin"]').count(), 0)
    const inspiration = page.getByRole('region', { name: 'Video inspiration', exact: true })
    assert.equal(await inspiration.count(), 1, 'Original script has no empty reference section')
    const example = inspiration.getByRole('link', { name: 'Watch example on TikTok' })
    assert.equal(await example.getAttribute('href'), sample.guide.videos[0].inspiration_url)
    assert.equal(await example.getAttribute('target'), '_blank'); assert.match(await example.getAttribute('rel'), /noreferrer/)
    assert.equal(await example.getAttribute('referrerpolicy'), 'no-referrer')
    assert.equal(await page.locator('iframe,video,audio').count(), 0, 'No social embeds, autoplay or third-party media requests')
    await inspiration.screenshot({ path: join(tmpdir(), `cg-guideline-inspiration-${width}.png`) })
    const first = page.getByRole('region', { name: 'Review video 1', exact: true }), second = page.getByRole('region', { name: 'Review video 2', exact: true })
    await first.getByRole('button', { name: 'Approve idea', exact: true }).click()
    await first.getByRole('textbox', { name: 'Your name', exact: true }).fill('Client reviewer')
    loseNext = true
    await first.getByRole('button', { name: 'Confirm approval' }).click()
    await first.getByRole('alert').waitFor(); assert.equal(saved.size, 1)
    await first.getByRole('button', { name: 'Confirm approval' }).click()
    await first.getByText('Response saved. Thank you.', { exact: true }).waitFor()
    assert.equal(attempts[0].p_request_id, attempts[1].p_request_id, 'A lost response retry keeps the exact idempotency key')
    assert.equal(saved.size, 1); await page.getByText('1 of 2 ideas reviewed', { exact: true }).waitFor()
    assert.ok(await second.getByText('Awaiting review', { exact: true }).isVisible())
    await second.getByRole('button', { name: 'Request changes', exact: true }).click()
    await second.getByRole('button', { name: 'Send response' }).click()
    assert.equal(attempts.length, 2, 'Required comment prevents empty change request')
    await second.getByRole('textbox', { name: 'Your comment', exact: true }).fill('Please change the opening. <script>alert(1)</script>')
    await second.getByRole('button', { name: 'Send response' }).click()
    await second.getByText('Response saved. Thank you.', { exact: true }).waitFor()
    await second.getByText('Responses (1)', { exact: true }).click()
    assert.ok(await second.getByText('Please change the opening. <script>alert(1)</script>', { exact: true }).isVisible())
    await second.getByRole('button', { name: 'Comment', exact: true }).click()
    await second.getByRole('textbox', { name: 'Your comment', exact: true }).fill('Keep the closing line.')
    await second.getByRole('button', { name: 'Send response' }).click()
    await second.getByText('Response saved. Thank you.', { exact: true }).waitFor()
    assert.ok(await second.getByText('Changes requested', { exact: true }).isVisible(), 'A comment preserves prior decision')
    await second.getByRole('button', { name: 'Decline idea', exact: true }).click()
    await second.getByRole('textbox', { name: 'Your comment', exact: true }).fill('We prefer a different concept.')
    await second.getByRole('button', { name: 'Send response' }).click()
    await second.getByText('Response saved. Thank you.', { exact: true }).waitFor()
    assert.ok(await second.getByText('Idea declined', { exact: true }).isVisible())
    await page.reload(); await page.getByText('2 of 2 ideas reviewed', { exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px no overflow`)
    await first.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(tmpdir(), `cg-guideline-review-${width}.png`) })
    await first.getByRole('button', { name: 'Request changes', exact: true }).click()
    await first.getByRole('textbox', { name: 'Your name', exact: true }).fill('Client reviewer')
    await first.getByRole('textbox', { name: 'Your comment', exact: true }).fill('Another requested change.')
    activeVersion = '2026-11-09T11:24:27.044422+00:00'
    await first.getByRole('button', { name: 'Send response' }).click()
    await first.getByText('This guideline has been updated. Refresh before responding.', { exact: true }).waitFor()
    await page.reload(); await page.getByText('0 of 2 ideas reviewed', { exact: true }).waitFor()
    revoked = true; await page.reload(); await page.getByRole('heading', { name: 'This link is unavailable' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Approve idea', exact: true }).count(), 0)
    await page.goto(`${origin}/__public-review?staff`)
    await page.getByText('View responses (4)', { exact: true }).click()
    assert.ok(await page.getByText('We prefer a different concept.', { exact: true }).isVisible())
    assert.equal(await page.getByText('Earlier published version — review again after republishing.', { exact: true }).count(), 4)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px staff response history no overflow`)
    assert.deepEqual(errors, [])
    await context.close(); console.log(`PASS ${width}px: actual anonymous page, separate video decisions/comments, lost-response retry, text safety, revision/revocation, standalone account link and no overflow`)
  }
} finally { await browser?.close(); await server.close() }

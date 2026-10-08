import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Render the actual Team Work message-card implementations with harmless local
// task fixtures. No authenticated session, clipboard, provider or DB write.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const source = readFileSync(new URL('../src/pages/admin/CommandCentrePage.tsx', import.meta.url), 'utf8')
const start = source.indexOf('function MorningMessageCard(')
const end = source.indexOf('function TaskDetailDrawer(', start)
assert.ok(start > 0 && end > start, 'message-card source boundary')
const cards = source.slice(start, end)
const plugin = {
  name: 'team-work-message-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:team-work-messages.tsx') return '\0virtual:team-work-messages.tsx' },
  async load(id) {
    if (id !== '\0virtual:team-work-messages.tsx') return
    const fixtureSource = `
      import React, { useMemo, useState } from 'react'
      import { createRoot } from 'react-dom/client'
      import '/src/index.css'
      type CommandCentreTask = { id: string }
      type Ownership = string
      type OwnershipGrouping<T> = { verified: T[] }
      const PremiumCard = ({children}: {children: React.ReactNode, padding?: string}) => <article>{children}</article>
      const ActionButton = ({children, variant, size, ...props}: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: string,size?: string}) => <button {...props}>{children}</button>
      const ownershipCounts = () => ({verified:72,needsReview:4167,conflicts:0,unassigned:187})
      const buildMorningMessage = () => 'MORNING ' + 'long task list '.repeat(2000)
      const buildEndOfDay = () => 'END OF DAY ' + 'long task list '.repeat(2000)
      ${cards}
      function Fixture() {
        const [copied, setCopied] = useState('')
        const onCopy = (section: string, text: string) => { window.__copied = {section,text}; setCopied(section) }
        return <main><MorningMessageCard ownershipGrouping={{verified:[{id:'task'}]}} copiedSection={copied} onCopy={onCopy} />
          <EndOfDayCard allRelevant={[{id:'task'}]} ownershipOf={() => 'verified'} copiedSection={copied} onCopy={onCopy} /></main>
      }
      createRoot(document.getElementById('root')!).render(<Fixture />)
    `
    return (await transformWithEsbuild(fixtureSource, 'team-work-messages.tsx', {loader:'tsx',jsx:'automatic'})).code
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__team-work-messages') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/virtual:team-work-messages.tsx"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile:false, plugins:[plugin,react()], cacheDir:join(tmpdir(),'cg-team-work-message-cache'), optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime']}, server:{host:'127.0.0.1',port:53996,strictPort:true,hmr:false} })
let browser
try {
  await server.listen()
  browser = await chromium.launch({headless:true})
  for (const width of [1440, 375]) {
    const page = await browser.newPage({viewport:{width,height:850}})
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:53996/__team-work-messages')
    await page.getByRole('button',{name:'Preview message'}).waitFor()
    assert.equal(await page.locator('pre').count(), 0, 'large drafts are not rendered by default')
    assert.match(await page.getByTestId('ownership-totals').innerText(), /4167 need assignment review/, 'truthful warning remains visible')
    await page.getByRole('button',{name:'Copy'}).first().click()
    assert.deepEqual(await page.evaluate(() => ({section:window.__copied?.section, start:window.__copied?.text.slice(0,8)})), {section:'morning',start:'MORNING '}, 'copy remains functional without preview')
    await page.getByRole('button',{name:'Preview message'}).click()
    assert.equal(await page.locator('#morning-message-preview').count(), 1)
    assert.equal(await page.getByRole('button',{name:'Hide preview'}).getAttribute('aria-expanded'), 'true')
    await page.getByRole('button',{name:'Hide preview'}).click()
    assert.equal(await page.locator('pre').count(), 0)
    await page.getByRole('button',{name:'Preview update'}).click()
    assert.equal(await page.locator('#end-of-day-preview').count(), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: deferred long drafts, truthful totals, copy, disclosure, no overflow/errors/writes`)
  }
} finally { if (browser) await browser.close(); await server.close() }

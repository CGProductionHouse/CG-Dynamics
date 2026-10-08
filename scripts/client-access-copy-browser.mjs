import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Actual admin component with synthetic access rows and clipboard. No real
// account, password, provider request or production mutation is used.
if (!process.env.CG_PLAYWRIGHT_MODULE) throw new Error('Set CG_PLAYWRIGHT_MODULE to the approved local Playwright module')
const { chromium } = await import(pathToFileURL(process.env.CG_PLAYWRIGHT_MODULE).href)
const username = 'fixtureclient'
const fixture = {
  name: 'client-access-copy-fixture', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:client-access' || id === 'virtual:client-access-api') return `\0${id}` },
  transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/pages/admin/ClientAccessAdmin.tsx')) {
      return code.replace("'../../lib/clientPortalAccess'", "'virtual:client-access-api'")
    }
  },
  load(id) {
    if (id === '\0virtual:client-access-api') return `
      export async function listClientPortalAccess() { return { data: [{ client_id: 'fixture-id', client_name: 'Fixture Client', proposed_username: '${username}', username: '${username}', provisioned: true, enabled: true, existing_client_users: 1 }], error: null } }
      export async function resetClientPortalAccess() { window.fixtureResets += 1; return { data: { username: '${username}' }, error: null } }
      export async function provisionClientPortalAccess() { throw Error('Unexpected provision') }
      export async function setClientPortalAccessEnabled() { throw Error('Unexpected enable/disable') }
    `
    if (id === '\0virtual:client-access') return `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import ClientAccessAdmin from '/src/pages/admin/ClientAccessAdmin.tsx'; import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(ClientAccessAdmin));
    `
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__client-access-copy') return next()
      res.setHeader('Content-Type', 'text/html')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060d0c"><div id="root"></div><script type="module" src="/@id/virtual:client-access"></script></body></html>')
    })
  },
}
const server = await createServer({ configFile: false, plugins: [fixture, react()],
  cacheDir: join(tmpdir(), 'cg-client-access-copy-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] },
  server: { host: '127.0.0.1', port: 53992, strictPort: true, hmr: false } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      window.fixtureResets = 0
      window.fixtureClipboard = []
      window.fixtureClipboardFail = false
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async value => {
          if (window.fixtureClipboardFail) throw Error('Synthetic clipboard denial')
          window.fixtureClipboard.push(value)
        },
      } })
    })
    await page.goto('http://127.0.0.1:53992/__client-access-copy')
    await page.getByText('Fixture Client', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.getByText('Client access ready', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.fixtureResets), 1)
    assert.equal(await page.getByText('Fixture Client', { exact: true }).count(), 2)
    await page.getByRole('button', { name: 'Copy username' }).click()
    await page.getByRole('status').getByText('Username copied. Paste it into the Username or email field.').waitFor()
    await page.getByRole('button', { name: 'Copy password' }).click()
    await page.getByRole('status').getByText('Password copied. Paste it into the Password field.').waitFor()
    assert.deepEqual(await page.evaluate(() => window.fixtureClipboard), [username, `${username}_cg$`])
    assert.equal((await page.locator('body').innerText()).includes(`${username}_cg$`), false)
    await page.evaluate(() => { window.fixtureClipboardFail = true })
    await page.getByRole('button', { name: 'Copy password' }).click()
    await page.getByRole('alert').getByText('Clipboard access failed. Check your browser clipboard permission and try again.').waitFor()
    assert.equal(await page.getByRole('status').count(), 0)
    assert.equal((await page.evaluate(() => window.fixtureClipboard)).length, 2)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px body overflow`)
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px: separate clipboard values, failure feedback, no secret rendering or overflow`)
  }
} finally { if (browser) await browser.close(); await server.close() }

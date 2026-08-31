import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, devices } from '@playwright/test'

const target = process.env.CG_BROWSER_TARGET_URL
if (!target) throw new Error('CG_BROWSER_TARGET_URL is required.')

const parsed = new URL(target)
const trusted = parsed.protocol === 'https:'
  && !parsed.username
  && !parsed.password
  && !parsed.port
  && parsed.pathname === '/'
  && (parsed.hostname === 'cg-dynamics.vercel.app'
    || /^cg-dynamics-[a-z0-9-]+-cg-dynamics-projects\.vercel\.app$/.test(parsed.hostname))
if (!trusted) throw new Error('Browser checks are locked to root CG Dynamics Vercel deployments.')

const output = 'artifacts/browser'
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const results = []

for (const profile of [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'iphone', ...devices['iPhone 15'] },
]) {
  const context = await browser.newContext(profile)
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)) })
  page.on('pageerror', error => pageErrors.push(error.message.slice(0, 500)))

  const loginResponse = await page.goto(new URL('/login', parsed).toString(), { waitUntil: 'networkidle', timeout: 30_000 })
  if (!loginResponse || loginResponse.status() >= 400) throw new Error(`${profile.name}: login route returned ${loginResponse?.status() ?? 'no response'}.`)
  await page.getByRole('heading', { name: 'Sign in' }).waitFor()

  await page.goto(new URL('/admin/cg-hub', parsed).toString(), { waitUntil: 'networkidle', timeout: 30_000 })
  if (!new URL(page.url()).pathname.startsWith('/login')) throw new Error(`${profile.name}: protected route did not redirect an unauthenticated browser.`)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  await page.screenshot({ path: `${output}/${profile.name}.png`, fullPage: true })
  results.push({ profile: profile.name, authenticated: false, finalUrl: page.url(), overflow, consoleErrors, pageErrors })
  if (overflow || consoleErrors.length || pageErrors.length) throw new Error(`${profile.name}: browser verification found runtime errors or horizontal overflow.`)
  await context.close()
}

await browser.close()
await writeFile(`${output}/result.json`, JSON.stringify({ target: parsed.origin, checkedAt: new Date().toISOString(), results }, null, 2))
console.log(JSON.stringify({ target: parsed.origin, results }))

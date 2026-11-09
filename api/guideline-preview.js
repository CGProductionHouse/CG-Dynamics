import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { clientLogoCandidates } from '../src/lib/clientLogo.js'
import { createGuidelinePreviewHandler } from '../server/guidelinePreview.js'

async function fetchSnapshot({ slug, token }) {
  const base = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (base !== 'https://ehtjfntukiwbgptqgbzy.supabase.co' || !key) throw new Error('Public configuration unavailable')
  const response = await fetch(`${base}/rest/v1/rpc/read_public_content_guideline_share`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug, p_token: token }), signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('Public metadata read unavailable')
  return response.json()
}

// Resolve only existing public logo assets; never fetch a private/custom URL.
export async function GET(request) {
  const paths = new Set((await readdir(join(process.cwd(), 'public/client-logos'))).map(file => `/client-logos/${file}`))
  return createGuidelinePreviewHandler({
    loadTemplate: () => readFile(join(process.cwd(), 'dist/index.html'), 'utf8'),
    fetchSnapshot,
    logoForClient: name => clientLogoCandidates({ name }).find(path => paths.has(path)),
  })(request)
}

export const HEAD = GET

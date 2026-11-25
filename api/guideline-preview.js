import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { clientLogoCandidates } from '../src/lib/clientLogo.js'
import { createGuidelinePreviewHandler } from '../server/guidelinePreview.js'
import { verifiedClientPreview } from '../server/clientLogoPreview.js'

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
  const manifest = await readFile(join(process.cwd(), 'public/client-preview-logos/manifest.json'), 'utf8').then(JSON.parse).catch(() => null)
  return createGuidelinePreviewHandler({
    loadTemplate: () => readFile(join(process.cwd(), 'dist/index.html'), 'utf8'),
    fetchSnapshot,
    logoForClient: async name => {
      const source = clientLogoCandidates({ name }).find(path => paths.has(path))
      return verifiedClientPreview(source, manifest, path => readFile(join(process.cwd(), 'public', path.slice(1))))
    },
  })(request)
}

export const HEAD = GET

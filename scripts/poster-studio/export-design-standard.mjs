import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
const server = await createServer({ logLevel:'error', optimizeDeps:{noDiscovery:true,entries:[]}, server:{middlewareMode:true}, appType:'custom' })
try {
  const s = await server.ssrLoadModule('/supabase/functions/_shared/picassoDesignSystem.ts')
  await writeFile('docs/ai-workforce/graphic-designer/picasso-standard.v1.json',JSON.stringify({system:'PICASSO',version:s.PICASSO_VERSION,formats:s.DESIGN_FORMATS,checks:s.PICASSO_CHECKS},null,2)+'\n')
} finally { await server.close() }

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const testImport = 'virtual:publication-approved-jpeg'
function codecEntry() {
  const manifestPath = process.env.CG_PUBLICATION_JPEG_PACKAGE
    ? join(process.env.CG_PUBLICATION_JPEG_PACKAGE, 'package.json') : require.resolve('jpeg-js/package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.name, 'jpeg-js'); assert.equal(manifest.version, '0.4.4')
  return join(dirname(manifestPath), 'index.js')
}

// Node/Vite does not implement Deno's npm: scheme. Resolve ONLY the approved
// codec specifier to the SAME pinned installed or qualified TEMP package;
// Node loads its actual CommonJS decoder, with no decoder/proof mock.
// Native Deno acceptance separately executes the original npm: import unchanged.
export const publicationCodecVite = {
  name: 'publication-codec-node-resolution', enforce: 'pre',
  resolveId(id) { if (id === testImport) return testImport },
  load(id) {
    if (id === testImport) return `import { createRequire } from 'node:module'; export default createRequire(${JSON.stringify(import.meta.url)})(${JSON.stringify(codecEntry())});`
    if (!id.replaceAll('\\', '/').endsWith('/supabase/functions/_shared/publicationJpegCodec.ts')) return
    const source = readFileSync('supabase/functions/_shared/publicationJpegCodec.ts', 'utf8')
    assert.equal(source.split("'npm:jpeg-js@0.4.4'").length, 2)
    return source.replace("'npm:jpeg-js@0.4.4'", `'${testImport}'`)
  },
}

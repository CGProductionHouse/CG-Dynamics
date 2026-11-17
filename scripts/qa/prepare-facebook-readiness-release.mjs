// OFFLINE preparation only. Never deploys, connects, sets secrets or calls an API.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs'
import { resolve, dirname, sep, posix, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const [snapshotFile, outputDirectory] = process.argv.slice(2)
if (!snapshotFile || !outputDirectory) throw Error('Supply the verified hosted source JSON and private output directory')
const root = realpathSync(process.cwd()), output = resolve(outputDirectory)
if (output.toLowerCase().startsWith(root.toLowerCase() + sep) || output.toLowerCase() === root.toLowerCase()) throw Error('Keep hosted source/payload outside the repository')
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'))
if (snapshot.slug !== 'cg-dynamics-mcp' || snapshot.version !== 84 || snapshot.files?.length !== 41 || snapshot.verify_jwt !== false || snapshot.import_map !== false) throw Error('Exact reviewed hosted v84 baseline required')
const baseline = 'ac55f313e3f040c4d230a648847a610f81b6d76f'
const changes = ['supabase/functions/cg-dynamics-mcp/index.ts', 'supabase/functions/cg-dynamics-mcp/projectContext.ts', 'supabase/functions/cg-dynamics-mcp/toolCatalog.ts']
const normalize = value => value.replace(/\r\n/g, '\n')
const hash = value => createHash('sha256').update(value).digest('hex')
const valid = name => typeof name === 'string' && /^(supabase|src)\/[A-Za-z0-9_./-]+\.ts$/.test(name) && !name.split('/').includes('..') && posix.normalize(name) === name
const files = new Map(), seen = new Set()
for (const file of snapshot.files) {
  if (!valid(file.name) || seen.has(file.name.toLowerCase()) || typeof file.content !== 'string') throw Error('Invalid/duplicate hosted file')
  seen.add(file.name.toLowerCase()); files.set(file.name, file.content)
}
function local(name) {
  if (!valid(name)) throw Error('Unsafe source path')
  const path = realpathSync(resolve(root, name))
  if (!path.toLowerCase().startsWith(root.toLowerCase() + sep)) throw Error('Source escaped the managed checkout')
  return normalize(readFileSync(path, 'utf8'))
}
for (const name of changes) {
  const base = execFileSync('git', ['show', `${baseline}:${name}`], { encoding: 'utf8', maxBuffer: 1_000_000 })
  if (normalize(files.get(name) ?? '') !== normalize(base)) throw Error(`Hosted baseline drift: ${name}`)
  files.set(name, local(name))
}
function collect(name, destination = files, includeTypes = false, visited = new Set()) {
  if (visited.has(name)) return
  visited.add(name)
  if (!destination.has(name)) destination.set(name, local(name))
  const source = ts.createSourceFile(name, destination.get(name), ts.ScriptTarget.Latest, true)
  function dependency(specifier) {
    if (typeof specifier !== 'string' || !specifier.startsWith('.')) return
    const path = posix.normalize(posix.join(posix.dirname(name), specifier))
    const child = posix.extname(path) ? path : `${path}.ts`
    if (!valid(child)) throw Error(`Unreviewed local dependency from ${name}`)
    collect(child, destination, includeTypes, visited)
  }
  for (const statement of source.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : null
    const typeOnly = clause?.isTypeOnly || ts.isExportDeclaration(statement) && statement.isTypeOnly
      || clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every(e => e.isTypeOnly)
    if (includeTypes || !typeOnly) dependency(statement.moduleSpecifier.text)
  }
}
collect('supabase/functions/cg-dynamics-mcp/index.ts')
const modified = [], preserved = [], added = []
for (const [name, content] of files) {
  const hosted = snapshot.files.find(f => f.name === name)
  if (hosted && hosted.content !== content) modified.push({ name, before: hash(hosted.content), after: hash(content) })
  else if (hosted) preserved.push({ name, sha256: hash(content) })
  else added.push({ name, sha256: hash(content) })
}
if (modified.length !== 3 || modified.some(f => !changes.includes(f.name)) || preserved.length !== 38) throw Error('Release exceeded the exact three-file change boundary')
const payload = { project_id: 'ehtjfntukiwbgptqgbzy', name: 'cg-dynamics-mcp', entrypoint_path: 'supabase/functions/cg-dynamics-mcp/index.ts', verify_jwt: false,
  files: [...files].map(([name, content]) => ({ name, content })) }
const text = JSON.stringify(payload)
// Existing hosted code has omitted frontend type-only imports. Supply those
// for LOCAL checking, matching the established hosted-payload Deno workflow;
// never add browser initialization/type shims to the upload or import map.
const analysisFiles = new Map(files)
collect('supabase/functions/cg-dynamics-mcp/index.ts', analysisFiles, true)
const manifest = { status: 'PREPARED_NOT_AUTHORIZED_NOT_DEPLOYED', project_id: payload.project_id, function: payload.name, baseline_version: 84,
  verify_jwt: false, import_map: false, hosted_source_sha256: hash(JSON.stringify(snapshot)), payload_sha256: hash(text),
  modified, preserved, added, file_count: files.size,
  local_check_only_files: [...analysisFiles.keys()].filter(name => !files.has(name)),
  config_change_requires_separate_approval: { SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED: 'true' },
  confirmation: 'SOCIAL_FACEBOOK_PHOTO_CONFIRMATION_ENABLED remains unset/false; no worker flag/release tuple changed',
  scope: 'One read-only company-admin MCP getter; zero SQL, queue, OAuth, account, permission, Microsoft, Vercel or other-function change',
  rollback: 'Restore the exact private v84 source snapshot/settings and disable the new inspection flag if specifically approved; preserve all audit/content/receipts',
  fresh_readback_required: 'Recheck deployed version/source hashes immediately before release; any drift requires rebuilding/review' }
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'payload.json'), text)
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
for (const [name, content] of analysisFiles) {
  const destination = resolve(output, 'source', name)
  if (!destination.startsWith(resolve(output, 'source') + sep)) throw Error('Payload path escaped private output')
  mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, content)
}
mkdirSync(join(output, 'checker'), { recursive: true })
writeFileSync(join(output, 'checker/vite-env.d.ts'), 'interface ImportMeta { readonly env: Readonly<Record<string, string | undefined>> }\n')
writeFileSync(join(output, 'checker/deno.json'), JSON.stringify({ compilerOptions: { types: ['./vite-env.d.ts'] }, imports: { '@supabase/supabase-js': 'https://esm.sh/@supabase/supabase-js@2' } }))
console.log(JSON.stringify({ prepared: true, baselineVersion: 84, modified: modified.length, preserved: preserved.length, added: added.length, files: files.size, payloadSha256: manifest.payload_sha256, output }))

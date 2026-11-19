// OFFLINE ONLY. Freeze a reviewed MCP v89 source delta, never deploy or set flags.
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs'
import { resolve, dirname, basename, sep, posix, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const [snapshotFile, directory, ...extra] = process.argv.slice(2)
if (!snapshotFile || !directory || extra.length) throw Error('Supply only the captured v89 source and private output directory')
const root = realpathSync(process.cwd()), normalize = text => text.replace(/\r\n/g, '\n')
const hash = text => createHash('sha256').update(text).digest('hex')
const valid = name => typeof name === 'string' && /^(supabase|src)\/[A-Za-z0-9_./-]+\.ts$/.test(name)
  && !name.split('/').includes('..') && posix.normalize(name) === name
let parent = resolve(directory)
const tail = []
while (!existsSync(parent)) { tail.unshift(basename(parent)); parent = dirname(parent) }
const output = resolve(realpathSync(parent), ...tail)
if (output.toLowerCase() === root.toLowerCase() || output.toLowerCase().startsWith(root.toLowerCase() + sep)) throw Error('Keep packets outside the checkout')
if (existsSync(join(output, 'payload.json')) || existsSync(join(output, 'manifest.json'))) throw Error('Never overwrite a prepared packet')
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'))
if (snapshot.slug !== 'cg-dynamics-mcp' || snapshot.version !== 89 || snapshot.files?.length !== 68
  || snapshot.verify_jwt !== false || snapshot.import_map !== false) throw Error('Exact reviewed v89 baseline required')
const files = new Map(), seen = new Set()
for (const file of snapshot.files) {
  if (!valid(file.name) || seen.has(file.name.toLowerCase()) || typeof file.content !== 'string') throw Error('Invalid or duplicate hosted path')
  seen.add(file.name.toLowerCase()); files.set(file.name, file.content)
}
const closureHash = hash(JSON.stringify([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))
if (closureHash !== 'f16b2c0f9d21aa1954e081b2b340b6f9018172118dc8287349bd4774359efbae') throw Error('Hosted v89 source drift; refresh and review before preparation')
const changes = ['index.ts', 'projectContext.ts', 'toolCatalog.ts', 'capabilityManifest.ts'].map(name => `supabase/functions/cg-dynamics-mcp/${name}`)
const additions = ['supabase/functions/cg-dynamics-mcp/facebookPermissionSetup.ts', 'supabase/functions/_shared/metaOAuthRequest.ts']
function local(name) {
  if (!valid(name)) throw Error('Unsafe source dependency')
  const path = realpathSync(resolve(root, name))
  if (!path.toLowerCase().startsWith(root.toLowerCase() + sep)) throw Error('Source escaped checkout')
  return normalize(readFileSync(path, 'utf8'))
}
for (const name of changes) {
  const baseline = execFileSync('git', ['show', `3b99cf3d:${name}`], { encoding: 'utf8', maxBuffer: 1_000_000 })
  if (normalize(files.get(name) ?? '') !== normalize(baseline)) throw Error('Reviewed baseline mismatch')
  files.set(name, local(name))
}
function collect(name, destination, includeTypes = false, visited = new Set()) {
  if (visited.has(name)) return
  visited.add(name)
  if (!destination.has(name)) destination.set(name, local(name))
  const ast = ts.createSourceFile(name, destination.get(name), ts.ScriptTarget.Latest, true)
  for (const statement of ast.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : null
    const typeOnly = clause?.isTypeOnly || ts.isExportDeclaration(statement) && statement.isTypeOnly
      || clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every(e => e.isTypeOnly)
    if (!includeTypes && typeOnly) continue
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('.')) continue
    const path = posix.normalize(posix.join(posix.dirname(name), specifier)), child = posix.extname(path) ? path : `${path}.ts`
    if (!valid(child)) throw Error('Unsafe source dependency')
    collect(child, destination, includeTypes, visited)
  }
}
collect('supabase/functions/cg-dynamics-mcp/index.ts', files)
const modified = [], preserved = [], added = []
for (const [name, content] of files) {
  const before = snapshot.files.find(file => file.name === name)
  if (!before) added.push({ name, sha256: hash(content) })
  else if (content !== before.content) modified.push({ name, before: hash(before.content), after: hash(content) })
  else preserved.push({ name, sha256: hash(content) })
}
if (modified.length !== 4 || modified.some(file => !changes.includes(file.name)) || preserved.length !== 64
  || added.length !== 2 || added.some(file => !additions.includes(file.name))) throw Error('Unreviewed source closure')
const payload = { project_id: 'ehtjfntukiwbgptqgbzy', name: 'cg-dynamics-mcp',
  entrypoint_path: 'supabase/functions/cg-dynamics-mcp/index.ts', verify_jwt: false,
  files: [...files].map(([name, content]) => ({ name, content })) }
const text = JSON.stringify(payload), analysis = new Map(files)
collect(payload.entrypoint_path, analysis, true)
const manifest = { status: 'PREPARED_NOT_AUTHORIZED_NOT_DEPLOYED', project_id: payload.project_id, function: payload.name,
  baseline_version: 89, baseline_closure_sha256: closureHash, verify_jwt: false, import_map: false,
  payload_sha256: hash(text), modified, preserved, added, file_count: files.size,
  local_check_only_files: [...analysis.keys()].filter(name => !files.has(name)), config_changes: {},
  scope: 'Company-admin explicit permission-setup action only; shared existing hashed OAuth state/callback. No grant, mapping, content, jobs, worker activation, Microsoft, Vercel, other function or configuration change.',
  authentication: 'Existing MCP OAuth/context checks and fresh active manager checks remain. No token/session copying. Only hashed expiring login state is persisted when explicitly invoked.',
  activation: 'Existing SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED flag only. Publishing/submission/confirmation/worker flags and exact-account release remain separately disabled.',
  rollback: 'Only if specifically approved, restore exact captured v89 source/settings. Preserve all configuration, unused expiring states, mappings, content, jobs and receipts.',
  fresh_readback_required: 'Verify entire hosted source closure/version immediately before any approved release; drift invalidates this packet.' }
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'payload.json'), text)
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
for (const [name, content] of analysis) {
  const path = resolve(output, 'source', name)
  if (!path.startsWith(resolve(output, 'source') + sep)) throw Error('Unsafe output path')
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content)
}
mkdirSync(join(output, 'checker'), { recursive: true })
writeFileSync(join(output, 'checker/vite-env.d.ts'), 'interface ImportMeta { readonly env: Readonly<Record<string, string | undefined>> }\n')
writeFileSync(join(output, 'checker/deno.json'), JSON.stringify({ nodeModulesDir: 'none', compilerOptions: { types: ['./vite-env.d.ts'] },
  imports: { '@supabase/supabase-js': 'https://esm.sh/@supabase/supabase-js@2' } }))
console.log(JSON.stringify({ prepared: true, modified: modified.length, preserved: preserved.length, added: added.length,
  files: files.size, payloadSha256: manifest.payload_sha256, output }))

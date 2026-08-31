import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { OwnerIdentity } from './auth.js'
import { requireWriteScope, writeScopeChallenge } from './auth.js'
import { audit } from './audit.js'
import {
  applyChanges, compareRefs, createBranch, createPullRequest, dispatchCheck, getWorkflowRun,
  listFiles, readFile, recentCommits, repoStatus, searchCode,
} from './github.js'
import { assertVerifiedPreviewUrl, deploymentEvents, listDeployments, runFixedDatabaseDiagnostic } from './integrations.js'

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true }

function result(data: unknown) {
  return { structuredContent: data as Record<string, unknown>, content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function register<T extends z.ZodObject>(server: McpServer, identity: OwnerIdentity, options: {
  name: string
  title: string
  description: string
  schema: T
  risk: 'low' | 'normal_write' | 'high_impact'
  target?: (args: z.infer<T>) => string
  handler: (args: z.infer<T>) => Promise<unknown>
}) {
  const toolConfig = {
    title: options.title,
    description: options.description,
    inputSchema: options.schema,
    annotations: options.risk === 'low' ? READ_ONLY : WRITE,
    _meta: {
      securitySchemes: [{ type: 'oauth2', scopes: options.risk === 'low' ? ['dev:read'] : ['dev:read', 'dev:write'] }],
      'openai/securitySchemes': [{ type: 'oauth2', scopes: options.risk === 'low' ? ['dev:read'] : ['dev:read', 'dev:write'] }],
    },
  }
  const toolHandler = async (args: z.output<T>) => {
    const started = Date.now()
    const requestId = randomUUID()
    try {
      if (options.risk !== 'low') requireWriteScope(identity)
      if (options.risk === 'high_impact') throw new Error('High-impact operations are not executable through this bridge.')
      const value = await options.handler(args)
      audit({ requestId, actor: identity.subject, tool: options.name, risk: options.risk, target: options.target?.(args), outcome: 'success', durationMs: Date.now() - started })
      return result({ requestId, ...value as Record<string, unknown> })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool failed.'
      audit({ requestId, actor: identity.subject, tool: options.name, risk: options.risk, target: options.target?.(args), outcome: message.includes('scope') || message.includes('protected') ? 'denied' : 'failed', durationMs: Date.now() - started, error: message })
      return {
        content: [{ type: 'text' as const, text: message }],
        isError: true,
        ...(message.includes('OAuth scope') ? { _meta: { 'mcp/www_authenticate': [writeScopeChallenge()] } } : {}),
      }
    }
  }
  // The SDK's overloaded generic cannot infer a schema passed through this registration helper.
  server.registerTool(options.name, toolConfig as never, toolHandler as never)
}

export function createOwnerDevServer(identity: OwnerIdentity): McpServer {
  const server = new McpServer({ name: 'cg-dynamics-owner-dev-bridge', version: '0.1.0' }, {
    instructions: 'CG Dynamics only. Inspect before writing. Work on scoped development branches. Run checks and inspect diffs before opening a draft PR. Production, default-branch, auth, secret, migration and destructive operations are hard-gated.',
  })

  register(server, identity, { name: 'dev_repo_status', title: 'Repository Status', description: 'Inspect the CG Dynamics revision, selected branch and open pull requests.', schema: z.object({ branch: z.string().max(100).optional() }), risk: 'low', handler: ({ branch }) => repoStatus(branch) })
  register(server, identity, { name: 'dev_list_files', title: 'List Repository Files', description: 'List bounded repository files under a directory at a Git ref.', schema: z.object({ ref: z.string().max(100).default('main'), directory: z.string().max(300).default(''), limit: z.number().int().min(1).max(500).default(200) }), risk: 'low', handler: ({ ref, directory, limit }) => listFiles(ref, directory, limit) })
  register(server, identity, { name: 'dev_search_code', title: 'Search Source Code', description: 'Search CG Dynamics source text and filenames through GitHub code search.', schema: z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(50).default(30) }), risk: 'low', handler: ({ query, limit }) => searchCode(query, limit) })
  register(server, identity, { name: 'dev_read_file', title: 'Read Repository File', description: 'Read a complete small file or a bounded line range. Secret paths and values are blocked/redacted.', schema: z.object({ ref: z.string().max(100).default('main'), path: z.string().min(1).max(300), start_line: z.number().int().min(1).default(1), end_line: z.number().int().min(1).max(100000).default(400) }), risk: 'low', target: args => args.path, handler: args => readFile(args.ref, args.path, args.start_line, args.end_line) })
  register(server, identity, { name: 'dev_get_diff', title: 'Compare Git Refs', description: 'Inspect commits and changed files between two CG Dynamics refs.', schema: z.object({ base: z.string().max(100).default('main'), head: z.string().min(1).max(100) }), risk: 'low', handler: ({ base, head }) => compareRefs(base, head) })
  register(server, identity, { name: 'dev_recent_commits', title: 'Recent Commits', description: 'Inspect bounded recent commits on a branch or ref.', schema: z.object({ ref: z.string().max(100).default('main'), limit: z.number().int().min(1).max(30).default(10) }), risk: 'low', handler: ({ ref, limit }) => recentCommits(ref, limit) })
  register(server, identity, { name: 'dev_create_branch', title: 'Create Development Branch', description: 'Create a scoped development branch from an inspected ref. Default/production branches are forbidden.', schema: z.object({ branch: z.string().min(3).max(90), from_ref: z.string().max(100).default('main') }), risk: 'normal_write', target: args => args.branch, handler: ({ branch, from_ref }) => createBranch(branch, from_ref) })
  register(server, identity, { name: 'dev_apply_changes', title: 'Apply and Commit Changes', description: 'Atomically create/update/delete up to 20 files on a development branch and create one commit. Requires the exact inspected branch head and blocks protected paths.', schema: z.object({ branch: z.string().min(3).max(90), expected_head_sha: z.string().regex(/^[a-f0-9]{40}$/), message: z.string().min(1).max(120), changes: z.array(z.object({ path: z.string().min(1).max(300), content: z.string().max(250000).optional(), delete: z.boolean().optional() })).min(1).max(20) }), risk: 'normal_write', target: args => args.branch, handler: args => applyChanges(args.branch, args.message, args.changes, args.expected_head_sha) })
  register(server, identity, { name: 'dev_run_check', title: 'Run Development Check', description: 'Dispatch an allowlisted isolated GitHub Actions check: typecheck, lint, test, build, full, or browser. No arbitrary command input.', schema: z.object({ branch: z.string().min(3).max(90), action: z.enum(['typecheck', 'lint', 'test', 'build', 'full', 'browser']), target_url: z.string().url().optional() }), risk: 'normal_write', target: args => `${args.branch}:${args.action}`, handler: args => dispatchCheck(args.branch, args.action, args.action === 'browser' && args.target_url ? assertVerifiedPreviewUrl(args.target_url) : undefined) })
  register(server, identity, { name: 'dev_get_check_result', title: 'Get Check Result', description: 'Inspect a dispatched GitHub Actions run by its numeric run ID or opaque dispatch ID.', schema: z.object({ run_id: z.number().int().positive().optional(), dispatch_id: z.string().uuid().optional() }), risk: 'low', handler: ({ run_id, dispatch_id }) => getWorkflowRun(run_id, dispatch_id) })
  register(server, identity, { name: 'dev_get_deployments', title: 'Get Vercel Deployments', description: 'Inspect bounded CG Dynamics preview or production deployment status.', schema: z.object({ branch: z.string().max(100).optional(), limit: z.number().int().min(1).max(20).default(10) }), risk: 'low', handler: ({ branch, limit }) => listDeployments(limit, branch) })
  register(server, identity, { name: 'dev_get_build_logs', title: 'Get Vercel Build Logs', description: 'Inspect bounded, redacted build events for one CG Dynamics Vercel deployment.', schema: z.object({ deployment_id: z.string().regex(/^dpl_[A-Za-z0-9]+$/), limit: z.number().int().min(1).max(200).default(100) }), risk: 'low', handler: ({ deployment_id, limit }) => deploymentEvents(deployment_id, limit) })
  register(server, identity, { name: 'dev_db_schema', title: 'Inspect Backend Schema', description: 'Run one fixed read-only live schema diagnostic. Arbitrary SQL and row mutation are not available.', schema: z.object({ diagnostic: z.enum(['schema_summary', 'rls_summary', 'policy_summary', 'function_summary', 'migration_summary']) }), risk: 'low', handler: ({ diagnostic }) => runFixedDatabaseDiagnostic(diagnostic) })
  register(server, identity, { name: 'dev_create_pr', title: 'Create Draft Pull Request', description: 'Create a draft pull request from a scoped development branch to main. This cannot merge or deploy production.', schema: z.object({ branch: z.string().min(3).max(90), title: z.string().min(1).max(120), body: z.string().max(20000), draft: z.literal(true).default(true) }), risk: 'normal_write', target: args => args.branch, handler: args => createPullRequest(args.branch, args.title, args.body, true) })

  return server
}

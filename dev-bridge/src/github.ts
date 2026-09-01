import { randomUUID } from 'node:crypto'
import { SignJWT, importPKCS8 } from 'jose'
import { DEFAULT_BRANCH, optional, REPOSITORY_NAME, REPOSITORY_OWNER } from './config.js'
import { assertDevelopmentBranch, assertNoSecretMaterial, assertWritablePath, boundedInt, normalizeRepoPath, redactText, redactValue } from './safety.js'

const API = 'https://api.github.com'
let installationToken: { value: string; expiresAt: number } | undefined

async function appJwt(): Promise<string> {
  const appId = optional('OWNER_BRIDGE_GITHUB_APP_ID')
  const rawKey = optional('OWNER_BRIDGE_GITHUB_PRIVATE_KEY')?.replaceAll('\\n', '\n')
  if (!appId || !rawKey) throw new Error('GitHub App is not configured.')
  const key = await importPKCS8(rawKey, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(appId)
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 540)
    .sign(key)
}

async function getInstallationToken(): Promise<string> {
  if (installationToken && installationToken.expiresAt > Date.now() + 60_000) return installationToken.value
  const installationId = optional('OWNER_BRIDGE_GITHUB_INSTALLATION_ID')
  if (!installationId) throw new Error('GitHub App installation is not configured.')
  const response = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await appJwt()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`GitHub App authentication failed (${response.status}).`)
  const body = await response.json() as { token: string; expires_at: string }
  installationToken = { value: body.token, expiresAt: Date.parse(body.expires_at) }
  return body.token
}

export async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getInstallationToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    const detail = redactText(await response.text(), 1_000)
    throw new Error(`GitHub request failed (${response.status}): ${detail}`)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

const repoPath = (suffix: string) => `/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}${suffix}`

export async function repoStatus(branch?: string) {
  const repository = await github<{ default_branch: string; pushed_at: string; html_url: string }>(repoPath(''))
  const selected = branch?.trim() || repository.default_branch
  const branchInfo = await github<{ name: string; commit: { sha: string; commit: { message: string; author: { date: string } } }; protected: boolean }>(repoPath(`/branches/${encodeURIComponent(selected)}`))
  const pulls = await github<Array<{ number: number; title: string; state: string; draft: boolean; html_url: string; head: { ref: string }; base: { ref: string } }>>(repoPath('/pulls?state=open&per_page=30'))
  return { repository, branch: branchInfo, openPullRequests: pulls }
}

export async function listFiles(ref: string, directory = '', limit = 200) {
  const safeDirectory = directory ? normalizeRepoPath(directory) : ''
  const tree = await github<{ tree: Array<{ path: string; type: string; sha: string; size?: number }>; truncated: boolean }>(repoPath(`/git/trees/${encodeURIComponent(ref)}?recursive=1`))
  const prefix = safeDirectory ? `${safeDirectory}/` : ''
  const entries = tree.tree
    .filter(item => !prefix || item.path === safeDirectory || item.path.startsWith(prefix))
    .slice(0, boundedInt(limit, 1, 500))
  return { ref, directory: safeDirectory, entries, truncated: tree.truncated || entries.length >= limit }
}

export async function readFile(ref: string, filePath: string, startLine = 1, endLine = 400) {
  const safePath = normalizeRepoPath(filePath)
  const encodedPath = safePath.split('/').map(encodeURIComponent).join('/')
  const result = await github<{ content: string; encoding: string; sha: string; html_url: string; size: number }>(repoPath(`/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`))
  if (result.encoding !== 'base64') throw new Error('Unsupported GitHub content encoding.')
  const text = Buffer.from(result.content.replace(/\n/g, ''), 'base64').toString('utf8')
  const from = boundedInt(startLine, 1, 100_000)
  const to = boundedInt(endLine, from, from + 999)
  const lines = text.split(/\r?\n/).slice(from - 1, to)
  return { path: safePath, ref, sha: result.sha, size: result.size, startLine: from, endLine: from + lines.length - 1, content: redactText(lines.join('\n')), url: result.html_url }
}

export async function searchCode(query: string, limit = 30) {
  const clean = query.trim().slice(0, 200)
  if (!clean) throw new Error('Search query is required.')
  const result = await github<{ total_count: number; incomplete_results: boolean; items: Array<{ name: string; path: string; sha: string; html_url: string }> }>(`/search/code?q=${encodeURIComponent(`${clean} repo:${REPOSITORY_OWNER}/${REPOSITORY_NAME}`)}&per_page=${boundedInt(limit, 1, 50)}`)
  return result
}

export async function compareRefs(base: string, head: string) {
  const result = await github<{ status: string; ahead_by: number; behind_by: number; total_commits: number; html_url: string; commits: Array<{ sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } } }>; files?: Array<{ sha: string; filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }> }>(repoPath(`/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`))
  return redactValue({
    status: result.status, aheadBy: result.ahead_by, behindBy: result.behind_by, totalCommits: result.total_commits, url: result.html_url,
    commits: result.commits.slice(0, 100).map(item => ({ sha: item.sha, message: item.commit.message, author: item.commit.author, url: item.html_url })),
    files: (result.files ?? []).slice(0, 300).map(file => ({ ...file, patch: file.patch ? redactText(file.patch, 8_000) : undefined })),
  })
}

export async function recentCommits(ref: string, limit = 10) {
  const commits = await github<Array<{ sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } } }>>(repoPath(`/commits?sha=${encodeURIComponent(ref)}&per_page=${boundedInt(limit, 1, 30)}`))
  return commits.map(item => ({ sha: item.sha, message: redactText(item.commit.message, 500), author: item.commit.author, url: item.html_url }))
}

export async function createBranch(branch: string, fromRef = DEFAULT_BRANCH) {
  const safeBranch = assertDevelopmentBranch(branch)
  const source = await github<{ object: { sha: string } }>(repoPath(`/git/ref/heads/${encodeURIComponent(fromRef)}`))
  await github(repoPath('/git/refs'), { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${safeBranch}`, sha: source.object.sha }) })
  return { branch: safeBranch, fromRef, sha: source.object.sha }
}

export type FileChange = { path: string; content?: string; delete?: boolean }

export async function applyChanges(branch: string, message: string, changes: FileChange[], expectedHeadSha: string) {
  const safeBranch = assertDevelopmentBranch(branch)
  if (!message.trim() || message.length > 120) throw new Error('Commit message must be 1-120 characters.')
  if (changes.length < 1 || changes.length > 20) throw new Error('Provide 1-20 file changes per commit.')
  const head = await github<{ object: { sha: string } }>(repoPath(`/git/ref/heads/${encodeURIComponent(safeBranch)}`))
  if (head.object.sha !== expectedHeadSha) throw new Error('Branch changed since inspection. Read status/diff again before writing.')
  const commit = await github<{ tree: { sha: string } }>(repoPath(`/git/commits/${head.object.sha}`))
  const tree = changes.map(change => {
    const safePath = assertWritablePath(change.path)
    if (change.delete) return { path: safePath, mode: '100644', type: 'blob', sha: null }
    if (typeof change.content !== 'string') throw new Error(`Content is required for ${safePath}.`)
    if (Buffer.byteLength(change.content) > 250_000) throw new Error(`File exceeds the 250KB bridge limit: ${safePath}`)
    assertNoSecretMaterial(change.content)
    return { path: safePath, mode: '100644', type: 'blob', content: change.content }
  })
  const newTree = await github<{ sha: string }>(repoPath('/git/trees'), { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) })
  const newCommit = await github<{ sha: string; html_url: string }>(repoPath('/git/commits'), { method: 'POST', body: JSON.stringify({ message: message.trim(), tree: newTree.sha, parents: [head.object.sha] }) })
  await github(repoPath(`/git/refs/heads/${encodeURIComponent(safeBranch)}`), { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha, force: false }) })
  return { branch: safeBranch, previousHead: head.object.sha, commit: newCommit.sha, url: newCommit.html_url, changedPaths: tree.map(item => item.path) }
}

export async function createPullRequest(branch: string, title: string, body: string, draft = true) {
  const safeBranch = assertDevelopmentBranch(branch)
  return github<unknown>(repoPath('/pulls'), { method: 'POST', body: JSON.stringify({ head: safeBranch, base: DEFAULT_BRANCH, title: title.slice(0, 120), body: redactText(body, 20_000), draft }) })
}

export async function dispatchCheck(branch: string, action: string, targetUrl?: string) {
  const safeBranch = assertDevelopmentBranch(branch)
  const allowed = new Set(['typecheck', 'lint', 'test', 'build', 'full', 'browser'])
  if (!allowed.has(action)) throw new Error('Unsupported check action.')
  if (action === 'browser' && !targetUrl) throw new Error('Browser checks require a verified preview URL.')
  const dispatchId = randomUUID()
  await github<void>(repoPath('/actions/workflows/owner-dev-bridge.yml/dispatches'), {
    method: 'POST',
    body: JSON.stringify({ ref: safeBranch, inputs: { action, target_url: targetUrl ?? '', request_id: dispatchId } }),
  })

  // GitHub returns 204 for workflow dispatch. The workflow run becomes visible
  // asynchronously, so correlate it through the opaque ID embedded in run-name.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
    const run = await findWorkflowRun(dispatchId)
    if (run) return { dispatch_id: dispatchId, run_id: run.id, url: run.html_url, status: run.status }
  }
  return { dispatch_id: dispatchId, run_id: null, url: null, status: 'queued_not_visible' }
}

type WorkflowRunSummary = {
  id: number
  html_url: string
  display_title: string
  status: string
}

async function findWorkflowRun(dispatchId: string): Promise<WorkflowRunSummary | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dispatchId)) {
    throw new Error('Invalid check dispatch ID.')
  }
  const result = await github<{ workflow_runs: WorkflowRunSummary[] }>(repoPath('/actions/workflows/owner-dev-bridge.yml/runs?event=workflow_dispatch&per_page=50'))
  return result.workflow_runs.find(run => run.display_title.includes(dispatchId))
}

export async function getWorkflowRun(runId?: number, dispatchId?: string) {
  const resolvedRunId = runId ?? (dispatchId ? (await findWorkflowRun(dispatchId))?.id : undefined)
  if (!resolvedRunId) throw new Error('Check run is not visible yet. Retry with the dispatch ID.')
  const run = await github<unknown>(repoPath(`/actions/runs/${resolvedRunId}`))
  const jobs = await github<unknown>(repoPath(`/actions/runs/${resolvedRunId}/jobs?per_page=50`))
  return { run, jobs }
}

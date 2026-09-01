import { optional } from './config.js'
import { boundedInt, redactText } from './safety.js'

async function vercel<T>(path: string): Promise<T> {
  const token = optional('OWNER_BRIDGE_VERCEL_TOKEN')
  if (!token) throw new Error('Vercel diagnostics are not configured.')
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Vercel request failed (${response.status}).`)
  return await response.json() as T
}

function vercelScope(): string {
  const projectId = optional('OWNER_BRIDGE_VERCEL_PROJECT_ID')
  const teamId = optional('OWNER_BRIDGE_VERCEL_TEAM_ID')
  if (!projectId) throw new Error('Vercel project ID is not configured.')
  return `projectId=${encodeURIComponent(projectId)}${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ''}`
}

export async function listDeployments(limit = 10, branch?: string) {
  const query = `${vercelScope()}&limit=${boundedInt(limit, 1, 20)}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`
  const result = await vercel<{ deployments: Array<Record<string, unknown>> }>(`/v7/deployments?${query}`)
  return {
    deployments: result.deployments.map(item => ({
      uid: item.uid,
      name: item.name,
      url: item.url ? `https://${item.url}` : null,
      state: item.state,
      target: item.target,
      created: item.created,
      meta: item.meta && typeof item.meta === 'object' ? {
        githubCommitSha: (item.meta as Record<string, unknown>).githubCommitSha,
        githubCommitRef: (item.meta as Record<string, unknown>).githubCommitRef,
        githubCommitMessage: (item.meta as Record<string, unknown>).githubCommitMessage,
      } : undefined,
    })),
  }
}

export async function deploymentEvents(deploymentId: string, limit = 100) {
  if (!/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) throw new Error('Invalid Vercel deployment ID.')
  const teamId = optional('OWNER_BRIDGE_VERCEL_TEAM_ID')
  const suffix = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const deployment = await vercel<{ projectId?: string; ownerId?: string }>(`/v13/deployments/${deploymentId}${suffix}`)
  if (deployment.projectId !== optional('OWNER_BRIDGE_VERCEL_PROJECT_ID')) throw new Error('Deployment does not belong to the CG Dynamics Vercel project.')
  if (teamId && deployment.ownerId !== teamId) throw new Error('Deployment does not belong to the configured Vercel team.')
  const result = await vercel<Array<{ id?: string; type?: string; text?: string; payload?: { text?: string }; created?: number; statusCode?: number }>>(`/v3/deployments/${deploymentId}/events${suffix}`)
  return result.slice(-boundedInt(limit, 1, 200)).map(event => ({
    id: event.id,
    type: event.type,
    created: event.created,
    statusCode: event.statusCode,
    text: redactText(event.text ?? event.payload?.text ?? '', 2_000),
  }))
}

const FIXED_DIAGNOSTICS: Record<string, string> = {
  schema_summary: `
    select table_schema, table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
    limit 1000`,
  rls_summary: `
    select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname
    limit 500`,
  policy_summary: `
    select schemaname, tablename, policyname, permissive, roles, cmd
    from pg_catalog.pg_policies
    where schemaname = 'public'
    order by tablename, policyname
    limit 1000`,
  function_summary: `
    select n.nspname as schema_name, p.proname as function_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
           pg_catalog.pg_get_function_result(p.oid) as result_type,
           p.prosecdef as security_definer
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by p.proname
    limit 1000`,
  migration_summary: `
    select version, name
    from supabase_migrations.schema_migrations
    order by version desc
    limit 200`,
}

export async function runFixedDatabaseDiagnostic(name: string) {
  const query = FIXED_DIAGNOSTICS[name]
  if (!query) throw new Error('Unsupported database diagnostic. Arbitrary SQL is not available.')
  const token = optional('OWNER_BRIDGE_SUPABASE_ACCESS_TOKEN')
  const projectRef = optional('OWNER_BRIDGE_SUPABASE_PROJECT_REF')
  if (!token || !projectRef) throw new Error('Supabase read-only diagnostics are not configured.')
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query/read-only`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Supabase diagnostic failed (${response.status}).`)
  const result = await response.json()
  return { diagnostic: name, rows: result }
}

export function assertVerifiedPreviewUrl(url: string): string {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/') {
    throw new Error('Preview URL must be a root HTTPS CG Dynamics deployment URL.')
  }
  const host = parsed.hostname.toLowerCase()
  const trusted = host === 'cg-dynamics.vercel.app'
    || /^cg-dynamics-[a-z0-9-]+-cg-dynamics-projects\.vercel\.app$/.test(host)
  if (!trusted) throw new Error('Browser checks are locked to CG Dynamics Vercel deployments.')
  return `https://${host}/`
}

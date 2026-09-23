import { supabase } from '../supabase'
import {
  EMPTY_PACKAGE_SETTINGS,
  buildPackageFieldStates,
  readPackageAuthority,
  readPackageSettings,
  type PackageSettings,
  type PackageVerificationReceipt,
} from '../packageAuthority'
import { withRequestTimeout } from './requestTimeout'

export { EMPTY_PACKAGE_SETTINGS, readPackageAuthority, readPackageSettings }
export type { PackageSettings, PackageVerificationReceipt }

export interface Client {
  id: string
  name: string
  tier: 'standard' | 'premium'
  logo_url: string | null
  active: boolean
  created_at: string
  // Added by phase-3j migration. Optional so the app keeps working before it
  // is applied (the column simply won't be present in the row).
  package_settings?: PackageSettings | null
}

function columnMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42703 = undefined_column. PostgREST may also report a schema-cache miss.
  if (error.code === '42703') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('package_settings') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))
}

export async function listClients(filter: 'active' | 'archived' | 'all' = 'all') {
  const base = supabase.from('clients').select('*').order('name')
  const query =
    filter === 'active' ? base.eq('active', true) :
    filter === 'archived' ? base.eq('active', false) :
    base
  const { data, error } = await withRequestTimeout(
    query,
    'Loading clients took too long. Please try again.'
  )
  return { data: (data ?? []) as Client[], error }
}

export async function getClient(id: string) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single(),
    'Loading the client took too long. Please try again.'
  )
  return { data: data as Client | null, error }
}

export async function createClient(input: {
  name: string
  tier: 'standard' | 'premium'
  active?: boolean
  logo_url?: string | null
}) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .insert(input)
      .select()
      .single(),
    'Saving the client took too long. Please try again.'
  )
  return { data: data as Client | null, error }
}

export async function updateClient(
  id: string,
  input: Partial<Pick<Client, 'name' | 'tier' | 'logo_url' | 'active'>>
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .update(input)
      .eq('id', id)
      .select()
      .single(),
    'Saving the client took too long. Please try again.'
  )
  return { data: data as Client | null, error }
}

// Explicit confirmation is separate from ordinary client CRUD. The guarded
// RPC owns the verification receipt and audit row; blanks are never defaulted.
export async function confirmClientPackage(input: {
  clientId: string
  settings: PackageSettings
  evidenceNote: string
  inferenceNote?: string
  sourceReferences?: string[]
}) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc('confirm_client_package_settings', {
      p_client_id: input.clientId,
      p_package_settings: {
        ...input.settings,
        field_states: buildPackageFieldStates(input.settings),
      },
      p_evidence_note: input.evidenceNote,
      p_inference_note: input.inferenceNote ?? '',
      p_source_references: input.sourceReferences ?? [],
    }),
    'Confirming the package took too long. Please try again.'
  )
  if (error && columnMissing(error)) {
    return { data: null, error: null, migrationNeeded: true }
  }
  return {
    data: data as {
      client_id: string
      package_settings: PackageSettings & { verification: PackageVerificationReceipt }
      verification: PackageVerificationReceipt
    } | null,
    error,
    migrationNeeded: false,
  }
}

export async function archiveClient(id: string) {
  return updateClient(id, { active: false })
}

export async function restoreClient(id: string) {
  return updateClient(id, { active: true })
}

export async function deleteClient(id: string) {
  const { error } = await withRequestTimeout(
    supabase.from('clients').delete().eq('id', id),
    'Deleting the client took too long. Please try again.'
  )
  return { error }
}

export async function clientHasData(id: string): Promise<boolean> {
  const [reportsRes, metricsRes, postsRes] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('manual_platform_metrics').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('imported_meta_posts').select('id', { count: 'exact', head: true }).eq('client_id', id),
  ])
  return ((reportsRes.count ?? 0) + (metricsRes.count ?? 0) + (postsRes.count ?? 0)) > 0
}

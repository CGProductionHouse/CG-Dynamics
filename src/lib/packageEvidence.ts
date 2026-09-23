import { readPackageAuthority, type PackageSettings } from './packageAuthority'
import type { Client } from './db/clients'
import { fetchAllPages } from './paginatedQuery'
import { supabase } from './supabase'

export type PackageEvidenceClass =
  | 'confirmed_receipt'
  | 'direct_current_package_template'
  | 'direct_current_package_record'
  | 'conflict'
  | 'unknown'

export interface PackageFieldEvidence {
  state: 'proposed' | 'confirmed' | 'conflict' | 'unknown'
  proposedValue: number | boolean | string | null
  evidenceClass: PackageEvidenceClass
  confidence: 'high' | 'conflicted' | 'none'
  sourceReferences: string[]
  note: string
}

export interface PackageCadenceMonth {
  month: string
  counts: Partial<Record<'professional_videos_per_month' | 'reels_per_month' | 'photo_posts_per_month' | 'design_posters_per_month' | 'website_updates_per_month', number>>
  microsoftMirrored: number
  sourceReferences: string[]
}

export interface ActiveClientPackageEvidence {
  clientId: string
  clientName: string
  confirmed: boolean
  fields: Record<keyof PackageSettings, PackageFieldEvidence>
  directSources: string[]
  supportingSources: string[]
  conflicts: string[]
  unknownFields: Array<keyof PackageSettings>
  cadence: PackageCadenceMonth[]
}

export interface PackageRow {
  id: string
  client_id: string
  package_name: string
  status: string
  start_date: string
  end_date: string | null
  notes: string | null
  updated_at: string | null
  archived_at: string | null
}

export interface PackageTemplateRow {
  id: string
  package_id: string
  code: string
  deliverable_type: string
  title_template: string
  count_per_month: number
  active: boolean
}

export interface PackageDeliverableEvidenceRow {
  id: string
  client_id: string
  package_id: string | null
  template_id: string | null
  month: string
  deliverable_type: string
  microsoft_source_type: string | null
  microsoft_task_id: string | null
  microsoft_last_synced_at: string | null
}

export interface ClientGuideEvidenceRow {
  id: string
  client_id: string
  version: number | null
  runtime_readiness: string | null
  updated_at: string | null
}

export interface ClientContextEvidenceRow {
  id: string
  client_id: string
  title: string
  review_state: string
  created_at: string
}

export interface PackageEvidenceInput {
  clients: Client[]
  packages: PackageRow[]
  templates: PackageTemplateRow[]
  deliverables: PackageDeliverableEvidenceRow[]
  guides: ClientGuideEvidenceRow[]
  contextUpdates: ClientContextEvidenceRow[]
  today: string
}

const FIELD_LABELS: Record<keyof PackageSettings, string> = {
  professional_videos_per_month: 'professional videos',
  reels_per_month: 'reels',
  photo_posts_per_month: 'photo posts',
  design_posters_per_month: 'design posters',
  animated_posters_per_month: 'animated posters',
  campaign_management_included: 'campaign management',
  monthly_campaign_budget: 'monthly campaign budget',
  shoot_days_per_month: 'shoot days',
  website_updates_per_month: 'website updates',
  other_agreed_deliverables: 'other agreed deliverables',
  package_notes: 'package notes',
  package_exclusions: 'package exclusions',
}

const TEMPLATE_FIELDS: Partial<Record<string, keyof PackageSettings>> = {
  video: 'professional_videos_per_month',
  reel: 'reels_per_month',
  photo: 'photo_posts_per_month',
  dp: 'design_posters_per_month',
  website_update: 'website_updates_per_month',
}

const NUMBER_FIELDS = new Set<keyof PackageSettings>([
  'professional_videos_per_month', 'reels_per_month', 'photo_posts_per_month',
  'design_posters_per_month', 'animated_posters_per_month', 'monthly_campaign_budget',
  'shoot_days_per_month', 'website_updates_per_month',
])

function unknownField(field: keyof PackageSettings): PackageFieldEvidence {
  return {
    state: 'unknown',
    proposedValue: null,
    evidenceClass: 'unknown',
    confidence: 'none',
    sourceReferences: [],
    note: `No exact current evidence proves ${FIELD_LABELS[field]}.`,
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return typeof left === typeof right && left === right
}

function monthStartOffset(today: string, monthsBack: number): string {
  const [year, month] = today.slice(0, 7).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 - monthsBack, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function buildActiveClientPackageEvidenceMatrix(input: PackageEvidenceInput): ActiveClientPackageEvidence[] {
  const activeClients = input.clients.filter(client => client.active).sort((a, b) => a.name.localeCompare(b.name))
  const templatesByPackage = new Map<string, PackageTemplateRow[]>()
  for (const template of input.templates.filter(row => row.active)) {
    const rows = templatesByPackage.get(template.package_id) ?? []
    rows.push(template)
    templatesByPackage.set(template.package_id, rows)
  }

  return activeClients.map(client => {
    const authority = readPackageAuthority(client.package_settings)
    const fields = Object.fromEntries(
      (Object.keys(FIELD_LABELS) as Array<keyof PackageSettings>).map(field => [field, unknownField(field)]),
    ) as Record<keyof PackageSettings, PackageFieldEvidence>
    const directSources: string[] = []
    const supportingSources: string[] = []
    const conflicts: string[] = []

    if (authority.settings && authority.verification) {
      for (const field of Object.keys(FIELD_LABELS) as Array<keyof PackageSettings>) {
        fields[field] = {
          state: 'confirmed',
          proposedValue: authority.settings[field],
          evidenceClass: 'confirmed_receipt',
          confidence: 'high',
          sourceReferences: authority.verification.source_references,
          note: `Confirmed by ${authority.verification.confirmed_by_profile_id} on ${authority.verification.confirmed_at}.`,
        }
      }
      directSources.push(...authority.verification.source_references)
    } else {
      const clientPackages = input.packages.filter(row => row.client_id === client.id && !row.archived_at)
      const currentPackages = clientPackages.filter(row =>
        row.status === 'active'
        && row.start_date <= input.today
        && (!row.end_date || row.end_date >= input.today),
      )
      for (const row of clientPackages) {
        supportingSources.push(`client_package:${row.id} (${row.package_name}; ${row.start_date} to ${row.end_date ?? 'open'})`)
        if (!currentPackages.some(current => current.id === row.id)) {
          for (const template of templatesByPackage.get(row.id) ?? []) {
            supportingSources.push(`package_template:${template.id} (${template.code}; ${template.count_per_month}/month; historical package ${row.id})`)
          }
        }
      }

      if (currentPackages.length > 1) {
        conflicts.push(`Multiple current package rows: ${currentPackages.map(row => row.id).join(', ')}.`)
        for (const field of Object.keys(fields) as Array<keyof PackageSettings>) {
          fields[field] = {
            state: 'conflict', proposedValue: null, evidenceClass: 'conflict',
            confidence: 'conflicted',
            sourceReferences: currentPackages.map(row => `client_package:${row.id}`),
            note: 'Resolve the competing current package rows before confirming scope.',
          }
        }
      } else if (currentPackages.length === 1) {
        const currentPackage = currentPackages[0]
        const packageReference = `client_package:${currentPackage.id}`
        directSources.push(`${packageReference} (${currentPackage.package_name}; current from ${currentPackage.start_date})`)
        const templates = templatesByPackage.get(currentPackage.id) ?? []
        const byField = new Map<keyof PackageSettings, PackageTemplateRow[]>()
        const otherTemplates: PackageTemplateRow[] = []
        for (const template of templates) {
          const field = TEMPLATE_FIELDS[template.deliverable_type]
          if (field) {
            const rows = byField.get(field) ?? []
            rows.push(template)
            byField.set(field, rows)
          } else {
            otherTemplates.push(template)
          }
        }
        for (const [field, rows] of byField) {
          const value = rows.reduce((sum, row) => sum + row.count_per_month, 0)
          const refs = [packageReference, ...rows.map(row => `package_template:${row.id} (${row.code}; ${row.count_per_month}/month)`)]
          fields[field] = {
            state: 'proposed', proposedValue: value, evidenceClass: 'direct_current_package_template',
            confidence: 'high',
            sourceReferences: refs,
            note: `Direct sum of ${rows.length} active template row${rows.length === 1 ? '' : 's'} in the current exact-client package.`,
          }
          directSources.push(...refs.slice(1))
        }
        if (otherTemplates.length > 0) {
          const value = otherTemplates.map(row => `${row.title_template} (${row.count_per_month}/month)`).join('; ')
          const refs = [packageReference, ...otherTemplates.map(row => `package_template:${row.id} (${row.code})`)]
          fields.other_agreed_deliverables = {
            state: 'proposed', proposedValue: value, evidenceClass: 'direct_current_package_template',
            confidence: 'high',
            sourceReferences: refs,
            note: 'Non-core deliverables copied from active rows in the current package.',
          }
          directSources.push(...refs.slice(1))
        }
        if (currentPackage.notes?.trim()) {
          fields.package_notes = {
            state: 'proposed', proposedValue: currentPackage.notes.trim(), evidenceClass: 'direct_current_package_record',
            confidence: 'high',
            sourceReferences: [packageReference], note: 'Copied verbatim from the current package row.',
          }
        }

        for (const field of Object.keys(fields) as Array<keyof PackageSettings>) {
          const existing = authority.explicitValues[field]
          const candidate = fields[field]
          if (existing === undefined || candidate.state !== 'proposed') continue
          if (!sameValue(existing, candidate.proposedValue)) {
            fields[field] = {
              state: 'conflict', proposedValue: null, evidenceClass: 'conflict',
              confidence: 'conflicted',
              sourceReferences: [...candidate.sourceReferences, `clients.package_settings:${client.id}`],
              note: `Current package evidence conflicts with the existing unverified ${FIELD_LABELS[field]} value.`,
            }
            conflicts.push(`${FIELD_LABELS[field]} differs between the current package and unverified package settings.`)
          }
        }
      }
    }

    const clientDeliverables = input.deliverables.filter(row => row.client_id === client.id)
    const cadenceByMonth = new Map<string, PackageCadenceMonth>()
    for (const row of clientDeliverables) {
      const month = row.month.slice(0, 7)
      const cadence = cadenceByMonth.get(month) ?? { month, counts: {}, microsoftMirrored: 0, sourceReferences: [] }
      const field = TEMPLATE_FIELDS[row.deliverable_type]
      if (field && NUMBER_FIELDS.has(field)) cadence.counts[field as keyof PackageCadenceMonth['counts']] = (cadence.counts[field as keyof PackageCadenceMonth['counts']] ?? 0) + 1
      if (row.microsoft_task_id || row.microsoft_source_type) cadence.microsoftMirrored += 1
      cadence.sourceReferences.push(`monthly_deliverable:${row.id}${row.microsoft_task_id ? `; microsoft_task:${row.microsoft_task_id}` : ''}${row.microsoft_last_synced_at ? `; synced:${row.microsoft_last_synced_at}` : ''}`)
      cadenceByMonth.set(month, cadence)
    }
    const cadence = [...cadenceByMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
    for (const month of cadence) supportingSources.push(...month.sourceReferences)

    for (const guide of input.guides.filter(row => row.client_id === client.id && row.runtime_readiness === 'ready')) {
      supportingSources.push(`client_guide:${guide.id} (version ${guide.version ?? 'unknown'}; ready)`)
    }
    for (const update of input.contextUpdates.filter(row => row.client_id === client.id && row.review_state === 'incorporated')) {
      supportingSources.push(`client_context_update:${update.id} (${update.title})`)
    }

    const unknownFields = (Object.keys(fields) as Array<keyof PackageSettings>).filter(field => fields[field].state === 'unknown')
    return {
      clientId: client.id,
      clientName: client.name,
      confirmed: authority.status === 'confirmed',
      fields,
      directSources: [...new Set(directSources)],
      supportingSources: [...new Set(supportingSources)],
      conflicts,
      unknownFields,
      cadence,
    }
  })
}

export async function loadActiveClientPackageEvidenceMatrix(clients: Client[], today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())) {
  const activeClients = clients.filter(client => client.active)
  const clientIds = activeClients.map(client => client.id)
  if (clientIds.length === 0) return { data: [], error: null }
  const recentMonth = monthStartOffset(today, 5)

  const [packages, deliverables, guides, contextUpdates] = await Promise.all([
    fetchAllPages<PackageRow>((from, to) => supabase.from('client_packages')
      .select('id,client_id,package_name,status,start_date,end_date,notes,updated_at,archived_at')
      .in('client_id', clientIds).order('start_date', { ascending: false }).range(from, to)),
    fetchAllPages<PackageDeliverableEvidenceRow>((from, to) => supabase.from('monthly_deliverables')
      .select('id,client_id,package_id,template_id,month,deliverable_type,microsoft_source_type,microsoft_task_id,microsoft_last_synced_at')
      .in('client_id', clientIds).is('archived_at', null).gte('month', recentMonth)
      .order('month', { ascending: false }).order('id').range(from, to)),
    fetchAllPages<ClientGuideEvidenceRow>((from, to) => supabase.from('client_guides')
      .select('id,client_id,version,runtime_readiness,updated_at').in('client_id', clientIds)
      .order('client_id').order('version', { ascending: false }).range(from, to)),
    fetchAllPages<ClientContextEvidenceRow>((from, to) => supabase.from('client_context_updates')
      .select('id,client_id,title,review_state,created_at').in('client_id', clientIds)
      .eq('review_state', 'incorporated').order('created_at', { ascending: false }).range(from, to)),
  ])
  const firstError = packages.error ?? deliverables.error ?? guides.error ?? contextUpdates.error
  if (firstError) return { data: [], error: firstError }

  const packageIds = packages.data.map(row => row.id)
  const templates = packageIds.length === 0
    ? { data: [] as PackageTemplateRow[], error: null }
    : await fetchAllPages<PackageTemplateRow>((from, to) => supabase.from('package_deliverable_templates')
      .select('id,package_id,code,deliverable_type,title_template,count_per_month,active')
      .in('package_id', packageIds).order('package_id').order('sort_order').range(from, to))
  if (templates.error) return { data: [], error: templates.error }

  return {
    data: buildActiveClientPackageEvidenceMatrix({
      clients: activeClients,
      packages: packages.data,
      templates: templates.data,
      deliverables: deliverables.data,
      guides: guides.data,
      contextUpdates: contextUpdates.data,
      today,
    }),
    error: null,
  }
}

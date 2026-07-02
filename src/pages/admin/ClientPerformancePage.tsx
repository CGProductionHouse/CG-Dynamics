import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { Pill, StatusBadge } from '../../components/ui/Badges'
import { listClients, type Client } from '../../lib/db/clients'
import { listReports, type Report } from '../../lib/db/reports'
import {
  getReportMonthFromPeriod,
  isFullCalendarMonth,
  isMonthComplete,
  monthDisplayLabel,
} from '../../lib/reportPeriod'
import { readStrategyData, strategyRequiredComplete } from '../../lib/strategyEngine'
import { supabase } from '../../lib/supabase'

type ReportState = 'published' | 'ready-to-publish' | 'needs-strategy' | 'internal-draft' | 'needs-repair'

interface AttentionItem {
  report: Report
  clientName: string
  state: 'ready-to-publish' | 'needs-strategy' | 'needs-repair'
  label: string
  message: string
  priority: number
}

const LINKS = [
  {
    title: 'Clients',
    description: 'Profiles, tiers and packages.',
    to: '/admin/clients',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: 'Client Dashboard',
    description: 'Review, edit, preview and publish client dashboards.',
    to: '/admin/client-dashboard',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 5.25A2.25 2.25 0 016 3h12a2.25 2.25 0 012.25 2.25v9A2.25 2.25 0 0118 16.5H6a2.25 2.25 0 01-2.25-2.25v-9z" />
        <path d="M7.5 20.25h9M12 16.5v3.75M7.5 8.25h9M7.5 11.25h5.25" />
      </svg>
    ),
  },
  {
    title: 'Meta / Integrations',
    description: 'Meta Business sync and platforms.',
    to: '/admin/integrations',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 019.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
  },
  {
    title: 'Content Calendar',
    description: 'Client-ready calendar presentation.',
    to: '/admin/client-calendar',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M5.25 5.25h13.5A1.5 1.5 0 0120.25 6.75v12A1.5 1.5 0 0118.75 20.25H5.25A1.5 1.5 0 013.75 18.75v-12A1.5 1.5 0 015.25 5.25z" />
        <path d="M7.5 12h.008v.008H7.5V12zm4.5 0h.008v.008H12V12zm4.5 0h.008v.008H16.5V12zm-9 4.5h.008v.008H7.5V16.5zm4.5 0h.008v.008H12V16.5z" />
      </svg>
    ),
  },
  {
    title: 'Import & Data',
    description: 'Fallback CSV imports and manual metrics support.',
    to: '/admin/import',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    ),
  },
]

const WORKFLOW_STEPS = [
  {
    title: 'Sync Meta',
    description: 'Refresh Facebook and Instagram data for the month.',
    to: '/admin/integrations/meta',
  },
  {
    title: 'Review dashboard',
    description: 'Open the Client Dashboard Editor and check the monthly workspace.',
    to: '/admin/client-dashboard',
  },
  {
    title: 'Add dashboard action plan',
    description: 'Turn the numbers into the next practical client move.',
    to: '/admin/client-dashboard',
  },
  {
    title: 'Client view and publish',
    description: 'Check the client view, then make the report live.',
    to: '/admin/client-dashboard',
  },
]

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function deriveReportState(report: Report): ReportState {
  const isPartial = !isFullCalendarMonth(report.period_start, report.period_end)
  if (isPartial) return 'needs-repair'
  if (report.status === 'published') return 'published'

  const month = getReportMonthFromPeriod(report)
  const monthComplete = isMonthComplete(month)
  const ready = monthComplete && strategyRequiredComplete(readStrategyData(report.strategy_data))

  if (ready) return 'ready-to-publish'
  if (monthComplete) return 'needs-strategy'
  return 'internal-draft'
}

function reportMonthLabel(report: Report) {
  return monthDisplayLabel(getReportMonthFromPeriod(report))
}

function reportTime(report: Report) {
  return report.updated_at ?? report.created_at
}

function dashboardPath(report: Report) {
  return `/admin/client-dashboard?reportId=${report.id}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not updated yet'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function ClientPerformancePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [linkedMetaClients, setLinkedMetaClients] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError(null)

      try {
        const [clientsRes, reportsRes, metaAssetsRes] = await Promise.all([
          listClients(),
          listReports(),
          supabase
            .from('meta_client_assets')
            .select('client_id')
            .eq('is_active', true),
        ])

        if (!active) return

        const loadError = clientsRes.error ?? reportsRes.error
        if (loadError) {
          setError(loadError.message)
          return
        }

        setClients(clientsRes.data)
        setReports(reportsRes.data)

        if (metaAssetsRes.error || !metaAssetsRes.data) {
          setLinkedMetaClients(null)
        } else {
          const metaRows = metaAssetsRes.data as { client_id: string | null }[]
          setLinkedMetaClients(new Set(metaRows.map(row => row.client_id).filter(Boolean)).size)
        }
      } catch (error) {
        if (active) setError(errorMessage(error, 'Could not load the performance dashboard.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const snapshot = useMemo(() => {
    const clientNameById = new Map(clients.map(client => [client.id, client.name]))
    const activeClients = clients.filter(client => client.active).length
    const publishedReports = reports.filter(report => report.status === 'published').length
    const draftReports = reports.filter(report => report.status === 'draft').length

    const stateCounts: Record<ReportState, number> = {
      published: 0,
      'ready-to-publish': 0,
      'needs-strategy': 0,
      'internal-draft': 0,
      'needs-repair': 0,
    }

    const attention: AttentionItem[] = []

    for (const report of reports) {
      const state = deriveReportState(report)
      stateCounts[state] += 1

      if (state === 'needs-repair' || state === 'ready-to-publish' || state === 'needs-strategy') {
        const clientName = clientNameById.get(report.client_id) ?? 'Unknown client'
        attention.push({
          report,
          clientName,
          state,
          label:
            state === 'needs-repair'
              ? 'Needs repair'
              : state === 'ready-to-publish'
                ? 'Ready to publish'
                : 'Needs strategy',
          message:
            state === 'needs-repair'
              ? 'Fix the report period before the client view is trusted.'
              : state === 'ready-to-publish'
                ? 'Review the dashboard, check Client View, then publish.'
                : 'Add the dashboard action plan before publishing.',
          priority:
            state === 'needs-repair'
              ? 0
              : state === 'ready-to-publish'
                ? 1
                : 2,
        })
      }
    }

    attention.sort((a, b) => {
      const priorityDiff = a.priority - b.priority
      if (priorityDiff !== 0) return priorityDiff
      return reportTime(b.report).localeCompare(reportTime(a.report))
    })

    return {
      activeClients,
      publishedReports,
      draftReports,
      stateCounts,
      attention: attention.slice(0, 5),
    }
  }, [clients, reports])

  const metaLabel =
    linkedMetaClients === null
      ? 'Check integrations'
      : `${linkedMetaClients}/${snapshot.activeClients} active clients`

  const metaHelper =
    linkedMetaClients === null
      ? 'Meta readiness could not be checked from the current data.'
      : snapshot.activeClients === 0
        ? 'Add active clients before linking Meta assets.'
        : linkedMetaClients >= snapshot.activeClients
          ? 'All active clients have an active Meta asset link.'
          : 'Some active clients still need Meta asset links.'

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-surface via-brand-bg to-black p-6 shadow-2xl sm:p-8">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-brand-teal/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-brand-accent/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="teal">Client Intelligence</Pill>
              <Pill tone="neutral">Performance snapshot</Pill>
            </div>
            <h1 className="mt-4 font-display text-4xl font-black uppercase tracking-wide text-white sm:text-5xl">
              Performance
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-primary/80 sm:text-base">
              A quick read on active clients, dashboard publishing status and what needs attention before month-end reporting.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <HeaderAction to="/admin/integrations/meta">Sync Meta</HeaderAction>
            <HeaderAction to="/admin/client-dashboard" primary>Client Dashboard</HeaderAction>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-muted border-t-brand-accent" />
          <p className="text-sm text-brand-primary">Loading performance snapshot...</p>
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotCard
              label="Active clients"
              value={snapshot.activeClients}
              helper={`${clients.length} total clients in the system`}
              tone="teal"
            />
            <SnapshotCard
              label="Published dashboards"
              value={snapshot.publishedReports}
              helper="Live in Client View"
              tone="accent"
            />
            <SnapshotCard
              label="Draft dashboards"
              value={snapshot.draftReports}
              helper={`${snapshot.stateCounts['ready-to-publish']} ready to publish`}
              tone="neutral"
            />
            <SnapshotCard
              label="Meta readiness"
              value={metaLabel}
              helper={metaHelper}
              tone={linkedMetaClients !== null && linkedMetaClients >= snapshot.activeClients && snapshot.activeClients > 0 ? 'teal' : 'neutral'}
            />
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <PremiumCard padding="lg" className="bg-white/[0.035]">
              <PremiumCardHeader
                eyebrow="Month-end workflow"
                title="Reporting flow"
                subtitle="Meta Sync -> Client Dashboard Editor -> Client View -> Publish."
              />

              <div className="grid gap-3 md:grid-cols-2">
                {WORKFLOW_STEPS.map((step, index) => (
                  <Link
                    key={step.title}
                    to={step.to}
                    className="group rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-brand-accent/35 hover:bg-brand-accent/[0.06]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-accent/25 bg-brand-accent/10 text-xs font-black text-[#f2b66f]">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-white group-hover:text-[#f2b66f]">{step.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-brand-primary/75">{step.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard padding="lg" className="bg-white/[0.035]">
              <PremiumCardHeader
                eyebrow="Needs attention"
                title="Dashboard queue"
                subtitle="Based on existing report status and readiness only."
              />

              {snapshot.attention.length === 0 ? (
                <div className="rounded-2xl border border-brand-teal/20 bg-brand-teal/[0.06] p-4">
                  <StatusBadge label="Clean" variant="published" />
                  <p className="mt-3 text-sm text-brand-primary/80">
                    No dashboards currently need repair, publishing or strategy action.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshot.attention.map(item => (
                    <Link
                      key={item.report.id}
                      to={dashboardPath(item.report)}
                      className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all hover:border-brand-teal/30 hover:bg-brand-teal/[0.05]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{item.clientName}</p>
                          <p className="mt-0.5 text-xs text-brand-primary/65">
                            {reportMonthLabel(item.report)} · Updated {formatDate(reportTime(item.report))}
                          </p>
                        </div>
                        <StatusBadge label={item.label} variant={item.state} />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-brand-primary/75">{item.message}</p>
                    </Link>
                  ))}
                </div>
              )}
            </PremiumCard>
          </section>

          <section className="mt-6">
            <PremiumCard padding="lg" className="bg-white/[0.025]">
              <PremiumCardHeader
                eyebrow="Quick links"
                title="Performance workspaces"
                subtitle="Secondary navigation for client setup, dashboard review, integrations, calendar and internal data support."
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="group flex min-h-40 flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-teal/25 hover:bg-brand-teal/[0.05]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal transition-colors group-hover:bg-brand-teal/20">
                      {link.icon}
                    </div>
                    <h2 className="mt-4 text-base font-bold text-white transition-colors group-hover:text-brand-teal">
                      {link.title}
                    </h2>
                    <p className="mt-1 text-sm text-brand-primary/65">
                      {link.description}
                    </p>
                  </Link>
                ))}
              </div>
            </PremiumCard>
          </section>
        </>
      )}
    </div>
  )
}

function HeaderAction({ to, children, primary = false }: { to: string; children: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-bold transition ${
        primary
          ? 'bg-brand-accent text-black shadow-[0_8px_24px_rgba(200,121,42,0.18)] hover:brightness-110'
          : 'border border-white/10 bg-white/[0.06] text-white hover:border-brand-accent/45 hover:bg-white/[0.09]'
      }`}
    >
      {children}
    </Link>
  )
}

function SnapshotCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: number | string
  helper: string
  tone: 'teal' | 'accent' | 'neutral'
}) {
  const toneClass = {
    teal: 'from-brand-teal/20 to-brand-teal/[0.03] text-[#66d0c3] border-brand-teal/20',
    accent: 'from-brand-accent/20 to-brand-accent/[0.03] text-[#f2b66f] border-brand-accent/20',
    neutral: 'from-white/[0.08] to-white/[0.02] text-white border-white/10',
  }[tone]

  return (
    <PremiumCard padding="md" className={`bg-gradient-to-br ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-primary/70">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-brand-primary/70">{helper}</p>
    </PremiumCard>
  )
}

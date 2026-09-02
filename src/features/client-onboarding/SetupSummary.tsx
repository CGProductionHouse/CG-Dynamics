import { useState } from 'react'
import { downloadOnboardingFile } from './api'
import type { ClientOnboardingState } from './types'
import { PLATFORM_GUIDES } from './platformGuides'
import { logoRequirementSatisfied, servicesRequirementSatisfied } from './validation'

export function SetupSummary({ state }: { state: ClientOnboardingState }) {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-report-accent">Performance</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Setup</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-report-muted">Your Welcome to CG information stays here, so you can check what was shared and what CG has verified.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title="Logo & brand files" ready={logoRequirementSatisfied(state)}>
          {state.uploads.filter(upload => upload.category === 'logo').map(upload => <p key={upload.id} className="flex items-center justify-between gap-2"><span>{upload.originalFilename}</span>{upload.uploadStatus === 'received' && <DownloadButton uploadId={upload.id} />}</p>)}
        </SummaryCard>
        <SummaryCard title="Services" ready={servicesRequirementSatisfied(state)}>
          {state.typedDescription && <p>{state.typedDescription}</p>}
          {state.serviceItems.length > 0 && <p>{state.serviceItems.join(', ')}</p>}
          {state.uploads.filter(upload => upload.category === 'services').map(upload => <p key={upload.id} className="flex items-center justify-between gap-2"><span>{upload.originalFilename}</span>{upload.uploadStatus === 'received' && <DownloadButton uploadId={upload.id} />}</p>)}
        </SummaryCard>
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Account access</h2>
        {state.platformAccess.length === 0 ? <p className="mt-3 text-sm text-report-muted">No account access tasks are assigned.</p> : (
          <div className="mt-4 divide-y divide-white/10">
            {state.platformAccess.map(access => (
              <div key={access.platform} className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm">
                <span className="font-semibold text-white">{PLATFORM_GUIDES[access.platform].label}</span>
                <span className="text-right text-report-muted">{access.connectionState === 'verified' && access.verifiedAt ? 'Verified by CG' : choiceLabel(access)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {state.additionalNotes && <SummaryCard title="Tell us more" ready><p>{state.additionalNotes}</p></SummaryCard>}
    </div>
  )
}

function SummaryCard({ title, ready, children }: { title: string; ready: boolean; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-white">{title}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? 'bg-report-accent/15 text-report-accent' : 'bg-white/[0.06] text-report-faint'}`}>{ready ? 'Received' : 'Still needed'}</span></div><div className="mt-4 space-y-2 text-sm leading-relaxed text-report-muted">{children || <p>Nothing shared yet.</p>}</div></section>
}

function DownloadButton({ uploadId }: { uploadId: string }) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    const { data, error } = await downloadOnboardingFile(uploadId)
    if (data) {
      const blob = data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (data as Blob & { name?: string }).name ?? 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
    void error
    setDownloading(false)
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={downloading}
      className="min-h-9 shrink-0 rounded-lg border border-white/15 px-3 text-xs font-semibold text-report-accent hover:bg-white/[0.05]"
    >
      {downloading ? '...' : 'Download'}
    </button>
  )
}

function choiceLabel(access: ClientOnboardingState['platformAccess'][number]) {
  if (access.connectionState === 'awaiting_verification') return 'Waiting for CG verification'
  if (access.clientChoice === 'connect_now') return 'Instructions opened'
  if (access.clientChoice === 'do_later') return 'Do it later'
  if (access.clientChoice === 'not_needed') return 'Not needed'
  return 'No choice yet'
}

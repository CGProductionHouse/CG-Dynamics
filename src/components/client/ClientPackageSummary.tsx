import { readPackageAuthority } from '../../lib/packageAuthority'
import { hasCgWebsiteMaintenance } from '../../lib/cgWebsiteFleet'

/** A known subtotal is not a complete combined allowance. */
function posterAllowance(photo: number | null, design: number | null) {
  if (photo === null && design === null) return 'To confirm'
  if (photo === null || design === null) return `${photo ?? design} confirmed · total to confirm`
  return `${photo + design} per month`
}

/** Render canonical confirmed quantities only, never private receipt metadata. */
export function ClientPackageSummary({ packageSettings, clientId }: { packageSettings: unknown; clientId?: string | null }) {
  const authority = readPackageAuthority(packageSettings)
  const settings = authority.settings
  const managedWebsite = hasCgWebsiteMaintenance(clientId)
  const cards = settings ? [
    { label: 'Video', value: settings.professional_videos_per_month === null ? 'To confirm' : `${settings.professional_videos_per_month} per month`, detail: 'Your professional video allowance.' },
    { label: 'Posters', value: posterAllowance(settings.photo_posts_per_month, settings.design_posters_per_month), detail: 'Photo posts and designed posters, together.' },
    { label: 'Content planning', value: 'Your monthly plan', detail: 'Explore the strategy and calendar for your planned content.' },
  ] : []
  if (managedWebsite) cards.push({ label: 'Website maintenance', value: 'Included', detail: settings?.website_updates_per_month == null ? 'CG-built website care. Update quantities are agreed with your CG team.' : `${settings.website_updates_per_month} updates per month.` })
  return (
    <section aria-labelledby="client-package-heading" className="mt-7 rounded-[2rem] border border-white/10 bg-[#071311] p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-300">Your CG package</p>
      <h2 id="client-package-heading" className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">What we create together</h2>
      {authority.settings ? (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Your confirmed monthly capacity. Your calendar shows the actual planned work; quantities are not a promise that every item is already scheduled.</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ label, value, detail }) => <div key={label} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <dt className="text-xs font-bold text-slate-400">{label}</dt>
              <dd className="mt-3 break-words text-lg font-black text-white">{value}</dd>
              <dd className="mt-2 text-xs leading-5 text-slate-400">{detail}</dd>
            </div>)}
          </dl>
          <p className="mt-5 text-xs leading-6 text-slate-500">“To confirm” means this capacity is not fixed yet—not zero. Any flexible or additional work is agreed with your CG team.</p>
        </>
      ) : <>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Your CG team is checking the current agreement. No quantities are assumed while the exact package is unconfirmed.</p>
        {managedWebsite && <p className="mt-4 text-sm text-slate-300">Website maintenance · Included for your CG-built website. Update quantities are agreed with your CG team.</p>}
      </>}
    </section>
  )
}

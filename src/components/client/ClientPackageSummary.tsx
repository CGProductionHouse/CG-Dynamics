import { readPackageAuthority } from '../../lib/packageAuthority'
type PackageCard = { label: string; value: string }

/** A partial poster receipt proves its own component, never an invented combined total. */
function confirmedPosters(photo: number | null, design: number | null): PackageCard | null {
  const photoCount = photo !== null && photo > 0 ? photo : 0
  const designCount = design !== null && design > 0 ? design : 0
  if (!photoCount && !designCount) return null
  if (photoCount && designCount) return { label: 'Posters', value: `${photoCount + designCount} per month` }
  return photoCount
    ? { label: 'Photo posts', value: `${photoCount} per month` }
    : { label: 'Design posters', value: `${designCount} per month` }
}

/** Render canonical confirmed quantities only, never private receipt metadata. */
export function ClientPackageSummary({ packageSettings }: { packageSettings: unknown; clientId?: string | null }) {
  const settings = readPackageAuthority(packageSettings).settings
  const cards: PackageCard[] = []
  if (settings?.professional_videos_per_month && settings.professional_videos_per_month > 0) {
    cards.push({ label: 'Professional videos', value: `${settings.professional_videos_per_month} per month` })
  }
  if (settings) {
    const posters = confirmedPosters(settings.photo_posts_per_month, settings.design_posters_per_month)
    if (posters) cards.push(posters)
    if (settings.website_updates_per_month !== null && settings.website_updates_per_month > 0) {
      cards.push({ label: 'Website updates', value: `${settings.website_updates_per_month} per month` })
    }
  }
  return (
    <section aria-labelledby="client-package-heading" className="mt-7 rounded-[2rem] border border-white/10 bg-[#071311] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-300">Your CG package</p>
          <h2 id="client-package-heading" className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">What we create together</h2>
        </div>
        <details className="shrink-0">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-teal-300/40 px-4 py-2 text-sm font-bold text-teal-200 hover:bg-teal-300/10">Amend package <span aria-hidden className="ml-2">⌄</span></summary>
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Contact Amonique to amend your package">
            <a href="https://wa.me/27791152339" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-teal-300/40 px-4 py-2 text-sm font-bold text-teal-200 hover:bg-teal-300/10">WhatsApp Amonique</a>
            <a href="tel:+27791152339" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Call Amonique</a>
          </div>
        </details>
      </div>
      {cards.length > 0 && <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value }) => <div key={label} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <dt className="text-xs font-bold text-slate-400">{label}</dt>
          <dd className="mt-3 break-words text-lg font-black text-white">{value}</dd>
        </div>)}
      </dl>}
    </section>
  )
}

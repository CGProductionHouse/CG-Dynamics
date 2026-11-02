import { readPackageAuthority } from '../../lib/packageAuthority'
import video from '../../assets/lucide/video.svg'
import image from '../../assets/lucide/image.svg'
import web from '../../assets/lucide/external-link.svg'
import people from '../../assets/lucide/users.svg'
import megaphone from '../../assets/lucide/megaphone.svg'
import guide from '../../assets/lucide/file-text.svg'
import chart from '../../assets/lucide/chart-no-axes-combined.svg'
import chevron from '../../assets/lucide/chevron-down.svg'
type PackageCard = { label: string; value: string; icon: string }

// Whole, explicitly agreed service lines only. Private notes, incidental mentions,
// negations and unrecognised free text must never become client service promises.
const AGREED_SERVICES = [
  { line: 'social media management', label: 'Social media management', icon: megaphone },
  { line: 'content guide', label: 'Content guide', icon: guide },
  { line: 'google ads', label: 'Google Ads', icon: chart },
] as const

/** A partial poster receipt proves its own component, never an invented combined total. */
function confirmedPosters(photo: number | null, design: number | null): PackageCard | null {
  const photoCount = photo !== null && photo > 0 ? photo : 0
  const designCount = design !== null && design > 0 ? design : 0
  if (!photoCount && !designCount) return null
  if (photoCount && designCount) return { label: 'Posters', value: `${photoCount + designCount} per month`, icon: image }
  return photoCount
    ? { label: 'Photo posts', value: `${photoCount} per month`, icon: image }
    : { label: 'Posters', value: `${designCount} confirmed per month`, icon: image }
}

/** Render canonical confirmed quantities only, never private receipt metadata. */
export function ClientPackageSummary({ packageSettings }: { packageSettings: unknown; clientId?: string | null }) {
  const settings = readPackageAuthority(packageSettings).settings
  const cards: PackageCard[] = []
  if (settings?.professional_videos_per_month && settings.professional_videos_per_month > 0) {
    cards.push({ label: 'Professional videos', value: `${settings.professional_videos_per_month} per month`, icon: video })
  }
  if (settings) {
    if (settings.other_agreed_deliverables?.trim().toLowerCase() === 'once-off') {
      cards.push({ label: 'Engagement', value: 'Once-off', icon: people })
    }
    const posters = confirmedPosters(settings.photo_posts_per_month, settings.design_posters_per_month)
    if (posters) cards.push(posters)
    if (settings.website_updates_per_month !== null && settings.website_updates_per_month > 0) {
      cards.push({ label: 'Website updates', value: `${settings.website_updates_per_month} per month`, icon: web })
    }
    const agreedLines = new Set((settings.other_agreed_deliverables ?? '').split(/\r?\n/).map(line => line.trim().toLowerCase()))
    for (const service of AGREED_SERVICES) {
      if (agreedLines.has(service.line) && (service.line !== 'google ads' || settings.campaign_management_included !== false)) {
        cards.push({ label: service.label, value: 'Included', icon: service.icon })
      }
    }
  }
  return (
    <section aria-labelledby="client-package-heading" className="mt-7 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_60%),linear-gradient(145deg,#0b1917,#07110f)] p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {cards.length > 0 && <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-300">Your CG package</p>}
          <h2 id="client-package-heading" className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">{cards.length > 0 ? 'What we create together' : 'Your package'}</h2>
          {cards.length === 0 && <p className="mt-2 text-sm text-slate-400">Package details aren’t available here yet.</p>}
        </div>
        <details className="shrink-0">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-teal-300/40 px-4 py-2 text-sm font-bold text-teal-200 hover:bg-teal-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">{cards.length > 0 ? 'Amend package' : 'Discuss package'} <img src={chevron} alt="" aria-hidden="true" className="h-4 w-4 brightness-0 invert" /></summary>
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Contact Amonique about your package">
            <a href="https://wa.me/27791152339" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-teal-300/40 px-4 py-2 text-sm font-bold text-teal-200 hover:bg-teal-300/10">WhatsApp Amonique</a>
            <a href="tel:+27791152339" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Call Amonique</a>
          </div>
        </details>
      </div>
      {cards.length > 0 && <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(({ label, value, icon }) => <div key={label} className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 last:odd:col-span-2 sm:p-5 lg:last:odd:col-span-1">
          <img src={icon} alt="" aria-hidden="true" className="mb-4 h-5 w-5 brightness-0 invert opacity-75 sm:h-6 sm:w-6" />
          <dt className="text-xs font-semibold leading-5 text-slate-300 sm:text-sm">{label}</dt>
          <dd className={`mt-2 break-words font-black tracking-[-0.035em] ${value === 'Included' ? 'text-lg text-teal-200 sm:text-xl' : 'text-xl text-white sm:text-3xl'}`}>{value}</dd>
        </div>)}
      </dl>}
    </section>
  )
}

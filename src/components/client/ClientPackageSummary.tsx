import { readPackageAuthority } from '../../lib/packageAuthority'

const QUANTITIES = [
  ['professional_videos_per_month', 'Professional videos'],
  ['photo_posts_per_month', 'Photo posts'],
  ['design_posters_per_month', 'Design posters'],
  ['reels_per_month', 'Reels'],
  ['animated_posters_per_month', 'Animated posters'],
  ['shoot_days_per_month', 'Shoot days'],
  ['website_updates_per_month', 'Website updates'],
] as const

/** Render canonical confirmed quantities only, never private receipt metadata. */
export function ClientPackageSummary({ packageSettings }: { packageSettings: unknown }) {
  const authority = readPackageAuthority(packageSettings)
  return (
    <section aria-labelledby="client-package-heading" className="mt-7 rounded-[2rem] border border-white/10 bg-[#071311] p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-300">Your CG package</p>
      <h2 id="client-package-heading" className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">What we create together</h2>
      {authority.settings ? (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Your confirmed monthly capacity. Your calendar shows the actual planned work; quantities are not a promise that every item is already scheduled.</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUANTITIES.map(([field, label]) => <div key={field} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <dt className="text-xs font-bold text-slate-400">{label}</dt>
              <dd className="mt-3 text-lg font-black text-white">{authority.settings![field] === null ? 'To confirm' : `${authority.settings![field]} per month`}</dd>
            </div>)}
            <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <dt className="text-xs font-bold text-slate-400">Campaign management</dt>
              <dd className="mt-3 text-lg font-black text-white">{authority.settings.campaign_management_included === null ? 'To confirm' : authority.settings.campaign_management_included ? 'Included' : 'Not included'}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-6 text-slate-500">“To confirm” means this capacity is not fixed yet—not zero. Any flexible or additional work is agreed with your CG team.</p>
        </>
      ) : <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Your CG team is checking the current agreement. No quantities are assumed while the exact package is unconfirmed.</p>}
    </section>
  )
}

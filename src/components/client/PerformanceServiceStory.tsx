import { SERVICE_COPY, type ServiceKey } from '../../lib/clientServicePresentation'
import { serviceConversationUrl } from '../../lib/performanceServiceCatalog'

type StoryKey = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'google' | 'web' | 'email'
const SERVICE_MAP: Partial<Record<StoryKey, ServiceKey>> = {
  instagram: 'instagram', tiktok: 'tiktok', linkedin: 'linkedin',
  google: 'google_business_profile', web: 'website_digital_experience',
}

export function PerformanceServiceStory({ service, clientName }: { service: StoryKey; clientName?: string }) {
  const mapped = SERVICE_MAP[service]
  const copy = mapped ? SERVICE_COPY[mapped] : service === 'facebook'
    ? { name: 'Facebook', benefit: 'Show your work, answer customer questions and build a recognisable presence with useful content for your community.' }
    : { name: 'Email marketing', benefit: 'Keep in touch with people who have chosen to hear from you. Share useful updates and timely offers with a considered email plan.' }
  const standardSocial = service === 'facebook' || service === 'instagram'
  const title = service === 'web' ? 'A premium CG-built website' : copy.name
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071311] p-6 sm:p-9">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-300">{standardSocial ? 'Your social presence' : 'More possibilities for your business'}</p>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">{title}</h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{copy.benefit}</p>
      {standardSocial ? (
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
          Facebook and Instagram are standard in CG social packages. Reporting for this month is not yet available here; this does not mean you need to buy the platform again. CG can help check the account relationship and reporting access.
        </p>
      ) : (
        <>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">Explore adding this service to your monthly package with Amonique. We will check your existing scope and agree the right plan and pricing before any change.</p>
          <a href={serviceConversationUrl(title, clientName)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-teal-300 px-5 py-3 text-sm font-bold text-[#06110f] hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300">Discuss my package on WhatsApp ↗</a>
        </>
      )}
    </section>
  )
}

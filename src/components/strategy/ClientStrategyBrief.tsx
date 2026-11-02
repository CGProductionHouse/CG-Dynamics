import { useId, useRef, useState } from 'react'
import image from '../../assets/lucide/image.svg'
import video from '../../assets/lucide/video.svg'
import chart from '../../assets/lucide/chart-no-axes-combined.svg'
import people from '../../assets/lucide/users.svg'
import guide from '../../assets/lucide/file-text.svg'
import megaphone from '../../assets/lucide/megaphone.svg'
import chevron from '../../assets/lucide/chevron-down.svg'
import { moveClientTabFocus } from '../../lib/clientTabKeyboard'
import { GOLD_STANDARD_FIELDS, type ActionPlanKey, type ActionPlanSection, type StrategyData } from '../../lib/strategyEngine'

const FORMATS: Record<ActionPlanKey, { label: string; icon: string }> = {
  professional_video: { label: 'Videos', icon: video },
  reels: { label: 'Reels', icon: video },
  photo_content: { label: 'Photo posts', icon: image },
  design_poster: { label: 'Posters', icon: guide },
  animated_poster: { label: 'Animated posters', icon: image },
  campaign_recommendation: { label: 'Campaigns', icon: chart },
}

const FIELD_LABELS = {
  objective: 'The goal', audienceAndIntent: 'Who we’re reaching', coreMessage: 'The message',
  formatsAndRationale: 'Content mix', testAndChange: 'What we’re testing',
  pillarsAndHooks: 'Creative angles', mustAvoid: 'Keep in mind', channelIntegration: 'How it connects',
  successSignals: 'What success looks like', nextMonthGamePlan: 'Next steps',
}

function Icon({ src }: { src: string }) {
  return <img src={src} alt="" className="h-5 w-5 shrink-0 brightness-0 invert opacity-80" />
}

/** Disclosure clips presentation only; the exact published copy remains intact. */
export function BriefText({ label, text, icon = guide, emphasis = false }: { label: string; text: string; icon?: string; emphasis?: boolean }) {
  return <details className={`group/brief min-w-0 rounded-2xl border border-white/10 p-5 ${emphasis ? 'bg-white/[0.055]' : 'bg-white/[0.025]'}`}>
    <summary className="list-none cursor-pointer rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-report-accent [&::-webkit-details-marker]:hidden">
      <span className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-report-accent"><Icon src={icon} />{label}</span>
        <img src={chevron} alt="" className="h-4 w-4 shrink-0 brightness-0 invert opacity-60 transition-transform group-open/brief:rotate-180 motion-reduce:transition-none" />
      </span>
      <span className={`whitespace-pre-line line-clamp-3 group-open/brief:line-clamp-none ${emphasis ? 'text-xl font-semibold leading-8 tracking-tight sm:text-2xl' : 'text-sm leading-6'} text-report-text`}>{text}</span>
      <span className="mt-3 block text-xs font-semibold text-report-muted"><span className="group-open/brief:hidden">Read more</span><span className="hidden group-open/brief:inline">Show less</span></span>
    </summary>
  </details>
}

export function ClientStrategyBrief({ data }: { data: StrategyData }) {
  const goal = data.goldStandard.objective.trim() || data.strategyGoingForward.trim()
  const message = data.goldStandard.coreMessage.trim()
  const fields = GOLD_STANDARD_FIELDS.filter(field => !['objective', 'coreMessage'].includes(field.key) && data.goldStandard[field.key].trim())
  const direction = data.strategyGoingForward.trim()
  const separateDirection = direction && direction !== goal && direction !== message
  if (!goal && !message && !fields.length && !separateDirection) return null
  return <section aria-label="Monthly strategy" className="min-w-0 lg:col-span-2">
    <h3 className="mb-5 text-2xl font-bold tracking-tight text-report-text sm:text-3xl">Monthly strategy</h3>
    <div className={`grid gap-4 ${goal && message ? 'md:grid-cols-2' : ''}`}>
      {goal && <BriefText label="The goal" text={goal} icon={chart} emphasis />}
      {message && <BriefText label="The message" text={message} icon={megaphone} emphasis />}
    </div>
    {(fields.length > 0 || separateDirection) && <details className="group mt-4 rounded-2xl border border-white/10 bg-white/[0.02]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-semibold text-report-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-report-accent [&::-webkit-details-marker]:hidden">Strategy details<img src={chevron} alt="" className="h-4 w-4 brightness-0 invert transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
        {separateDirection && <BriefText label="Our direction" text={direction} />}
        {fields.map(field => <BriefText key={field.key} label={FIELD_LABELS[field.key]} text={data.goldStandard[field.key]} icon={field.key === 'audienceAndIntent' ? people : guide} />)}
      </div>
    </details>}
  </section>
}

export function ClientActionPlan({ plans }: { plans: { key: ActionPlanKey; section: ActionPlanSection }[] }) {
  const [selected, setSelected] = useState<ActionPlanKey | null>(null)
  const id = useId()
  const buttons = useRef<Partial<Record<ActionPlanKey, HTMLButtonElement | null>>>({})
  const keys = plans.map(plan => plan.key)
  const active = plans.find(plan => plan.key === selected) ?? plans[0]
  if (!active) return null
  return <section aria-label="Action plan" className="min-w-0 rounded-3xl border border-white/10 bg-[#071311]/95 p-5 sm:p-7 lg:col-span-2">
    <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-report-accent/20 bg-report-accent/10"><Icon src={megaphone} /></span><h3 className="text-2xl font-bold tracking-tight text-report-text sm:text-3xl">Action plan</h3></div>
    <div role="tablist" aria-label="Content formats" className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {plans.map(({ key, section }, index) => <button key={key} type="button" role="tab" id={`${id}-${key}`} aria-controls={`${id}-${key}-panel`} aria-selected={active.key === key} tabIndex={active.key === key ? 0 : -1}
        ref={element => { buttons.current[key] = element }} onClick={() => setSelected(key)} onKeyDown={event => moveClientTabFocus(event, index, active.key, keys, buttons.current)}
        className={`flex min-h-14 min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-report-accent sm:px-4 ${active.key === key ? 'border-white bg-white text-[#06110f]' : 'border-white/10 bg-white/[0.025] text-report-muted hover:bg-white/[0.07] hover:text-white'}`}>
        <img src={FORMATS[key].icon} alt="" className={`h-5 w-5 shrink-0 ${active.key === key ? 'brightness-0' : 'brightness-0 invert opacity-70'}`} />
        <span className="min-w-0 text-sm font-bold">{FORMATS[key].label}<span className={`mt-0.5 block text-xs font-normal ${active.key === key ? 'text-black/60' : 'text-report-muted'}`}>{section.items.length ? `${section.items.length} ${key === 'campaign_recommendation' ? (section.items.length === 1 ? 'focus' : 'focus areas') : (section.items.length === 1 ? 'idea' : 'ideas')}` : 'Brief'}</span></span>
      </button>)}
    </div>
    {plans.map(({ key, section }) => <div key={key} id={`${id}-${key}-panel`} role="tabpanel" aria-labelledby={`${id}-${key}`} hidden={key !== active.key} tabIndex={key === active.key ? 0 : -1} className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-report-accent">
      <>
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {section.items.map((item, index) => <details key={`${key}-${index}`} className="group/idea min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <summary className="list-none cursor-pointer rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-report-accent [&::-webkit-details-marker]:hidden">
              <span className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-bold tabular-nums text-report-accent">{String(index + 1).padStart(2, '0')}</span><Icon src={FORMATS[key].icon} /></span>
              <span className="whitespace-pre-line text-base font-semibold leading-6 text-report-text line-clamp-2 group-open/idea:line-clamp-none">{item}</span>
              <span className="mt-4 flex min-h-6 items-center justify-between gap-2 text-xs font-semibold text-report-muted"><span className="group-open/idea:hidden">View brief</span><span className="hidden group-open/idea:inline">Close brief</span><img src={chevron} alt="" className="h-4 w-4 brightness-0 invert transition-transform group-open/idea:rotate-180 motion-reduce:transition-none" /></span>
            </summary>
          </details>)}
        </div>
        {section.notes.trim() && <div className="mt-3"><BriefText label="Brief notes" text={section.notes} /></div>}
      </>
    </div>)}
  </section>
}

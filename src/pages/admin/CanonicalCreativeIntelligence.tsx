import { useEffect, useState } from 'react'
import { buildCreativeBriefIntelligence, type CreativeBriefInput } from '../../lib/creativeBriefIntelligence'
import { getMonthlyStrategy } from '../../lib/monthlyStrategy'
import { listActiveSharedSkillCards } from '../../lib/marketing-library/skillCardsData'
import { listMonthlyDeliverablesByMonth } from '../../lib/planner'
import { CreativeIntelligencePanel } from './contentGuideline'

type Evidence = Pick<CreativeBriefInput, 'strategy' | 'cards' | 'deliverable'>

/** Read-only adapter for the live canonical document/video editor. No write callback. */
export default function CanonicalCreativeIntelligence({ clientId, month, deliverableId, draft }: Pick<CreativeBriefInput, 'clientId' | 'month' | 'deliverableId' | 'draft'>) {
  const identity = JSON.stringify([clientId, month, deliverableId])
  const [evidence, setEvidence] = useState<{ identity: string; data: Evidence; error: string | null } | null>(null)
  const validIdentity = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Boolean(deliverableId)

  useEffect(() => {
    if (!validIdentity) return
    let active = true
    void Promise.all([
      getMonthlyStrategy(clientId, month), listActiveSharedSkillCards(),
      listMonthlyDeliverablesByMonth(month, { clientId }),
    ]).then(([strategy, library, schedule]) => {
      if (!active) return
      setEvidence({ identity, data: {
        strategy: strategy.error ? null : strategy.data,
        cards: library.error || library.migrationNeeded ? [] : library.data,
        deliverable: schedule.error ? null : schedule.data?.find(row => row.id === deliverableId) ?? null,
      }, error: strategy.error || library.error || library.migrationNeeded || schedule.error
        ? 'Some Creative Intelligence sources could not be loaded.' : null })
    }).catch(() => {
      if (active) setEvidence({ identity, data: { strategy: null, cards: [], deliverable: null }, error: 'Creative Intelligence sources could not be loaded.' })
    })
    return () => { active = false }
  }, [clientId, month, deliverableId, identity, validIdentity])

  // Never render evidence belonging to a previous client/month/linked video, even for one frame.
  const current = validIdentity && evidence?.identity === identity ? evidence : null
  const intelligence = buildCreativeBriefIntelligence({ clientId, month, deliverableId, draft,
    strategy: current?.data.strategy ?? null, cards: current?.data.cards ?? [], deliverable: current?.data.deliverable ?? null,
    today: new Date().toISOString().slice(0, 10) })
  return <CreativeIntelligencePanel intelligence={intelligence} intelligenceLoading={validIdentity && !current} intelligenceError={current?.error ?? null} />
}

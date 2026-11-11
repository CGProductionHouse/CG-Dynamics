import { useEffect, useEffectEvent, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'
import {
  BRAND_RULE_CATEGORIES,
  brandBriefText,
  canvaBrandKitUrl,
  categoryLabel,
  formatColourList,
  parseCanvaBrandKitId,
  parseColourList,
  rulesForClient,
  validateRuleText,
  type BrandRuleCategory,
  type BrandRulePriority,
  type ClientBrandRule,
} from '../../lib/brandRules'
import {
  addBrandRule,
  getBrandProfile,
  listActiveBrandRules,
  retireBrandRule,
  saveBrandProfile,
  type ClientBrandProfile,
} from '../../lib/db/clientBrand'
import { ActionButton } from '../ui/Buttons'
import { Pill } from '../ui/Badges'

// Staff-only brand panel shown beside a video in the Video Pipeline.
// Editors read the client's Canva kit, colours, fonts, voice and the must/should
// rules (client + house) before editing, and record a client rule when feedback
// becomes a standing instruction. Managers maintain the profile and retire rules.

const INPUT = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
const LABEL = 'block text-[11px] font-black uppercase tracking-[0.12em] text-white/40'

type Status = 'loading' | 'ready' | 'missing' | 'error'

export function ClientBrandPanel({ clientId, clientName }: { clientId: string | null; clientName: string }) {
  const { profile: me } = useAuth()
  const isManager = isManagerRole(me?.role)
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [brand, setBrand] = useState<ClientBrandProfile | null>(null)
  const [rules, setRules] = useState<ClientBrandRule[]>([])
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingRule, setAddingRule] = useState(false)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  async function load() {
    if (!clientId) return
    setStatus('loading'); setLoadError(null)
    const [profileResult, ruleResult] = await Promise.all([getBrandProfile(clientId), listActiveBrandRules(clientId)])
    if (profileResult.tableMissing || ruleResult.tableMissing) { setStatus('missing'); return }
    const error = profileResult.error ?? ruleResult.error
    if (error) { setLoadError(error); setStatus('error'); return }
    setBrand(profileResult.data)
    setRules(rulesForClient(ruleResult.data, clientId))
    setStatus('ready')
  }
  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [clientId])

  if (!clientId) return null

  async function copyBrief() {
    const text = brandBriefText({
      clientName,
      colours: brand?.colours ?? [],
      fonts: brand?.fonts ?? [],
      toneVoice: brand?.tone_voice ?? null,
      canvaKitId: brand?.canva_brand_kit_id ?? null,
      rules,
    })
    try { await navigator.clipboard.writeText(text); setCopied('done') } catch { setCopied('failed') }
  }

  const kitUrl = canvaBrandKitUrl(brand?.canva_brand_kit_id)

  return (
    <section aria-labelledby="brand-panel-title" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal/80">Staff only</p>
          <h3 id="brand-panel-title" className="mt-1 text-base font-black text-white">Brand rules · {clientName}</h3>
        </div>
        {status === 'ready' && (
          <div className="flex flex-wrap gap-2">
            {kitUrl && <a href={kitUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white hover:border-brand-accent/45">Open Canva brand kit</a>}
            <ActionButton size="sm" variant="secondary" onClick={() => void copyBrief()}>{copied === 'done' ? 'Copied' : 'Copy brand brief'}</ActionButton>
          </div>
        )}
      </div>
      {copied === 'failed' && <p className="mt-2 text-xs text-amber-200">Copy didn't work in this browser. Select the rules below and copy them by hand.</p>}

      {status === 'loading' && <p className="mt-4 text-sm text-white/45">Loading brand rules…</p>}
      {status === 'missing' && (
        <p className="mt-4 text-sm leading-relaxed text-white/60">Brand rules aren't switched on yet. The database migration <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-amber-100">20261111090000_client_brand_profiles_and_rules.sql</code> needs approval and applying first.</p>
      )}
      {status === 'error' && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-amber-200">{loadError}</p>
          <ActionButton size="sm" variant="secondary" onClick={() => void load()}>Try again</ActionButton>
        </div>
      )}

      {status === 'ready' && (
        <div className="mt-4 space-y-5">
          {editingProfile ? (
            <ProfileForm
              clientId={clientId}
              brand={brand}
              onCancel={() => setEditingProfile(false)}
              onSaved={saved => { setBrand(saved); setEditingProfile(false) }}
            />
          ) : (
            <ProfileView brand={brand} isManager={isManager} onEdit={() => setEditingProfile(true)} />
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={LABEL}>Rules ({rules.length})</p>
              {!addingRule && <ActionButton size="sm" variant="ghost" onClick={() => setAddingRule(true)}>Add a rule</ActionButton>}
            </div>
            {addingRule && (
              <RuleForm clientId={clientId} isManager={isManager} onCancel={() => setAddingRule(false)} onAdded={() => { setAddingRule(false); void load() }} />
            )}
            {rules.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">No rules yet. When feedback becomes a standing instruction for this client, add it here so the next edit starts with it.</p>
            ) : (
              <ul className="mt-2 divide-y divide-white/[0.06]">
                {rules.map(rule => (
                  <RuleRow key={rule.id} rule={rule} isManager={isManager} onRetired={() => void load()} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ProfileView({ brand, isManager, onEdit }: { brand: ClientBrandProfile | null; isManager: boolean; onEdit: () => void }) {
  if (!brand) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-white/15 p-3">
        <p className="text-sm text-white/55">No brand profile yet{isManager ? '.' : '. Ask a manager to add the Canva kit, colours and fonts.'}</p>
        {isManager && <ActionButton size="sm" variant="outline" onClick={onEdit}>Add brand profile</ActionButton>}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {brand.colours.length > 0 && (
        <div>
          <p className={LABEL}>Colours</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {brand.colours.map(colour => (
              <span key={colour.hex} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/25 px-2 py-1 font-mono text-xs text-white/80">
                <span aria-hidden="true" className="h-4 w-4 rounded border border-white/20" style={{ background: colour.hex }} />
                {colour.hex}{colour.role ? ` ${colour.role}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[110px_minmax(0,1fr)]">
        {brand.fonts.length > 0 && (<><dt className="text-white/45">Fonts</dt><dd className="min-w-0 text-white/85">{brand.fonts.join(', ')}</dd></>)}
        {brand.tone_voice && (<><dt className="text-white/45">Voice</dt><dd className="min-w-0 whitespace-pre-line text-white/85">{brand.tone_voice}</dd></>)}
        {brand.visual_direction && (<><dt className="text-white/45">Look</dt><dd className="min-w-0 whitespace-pre-line text-white/85">{brand.visual_direction}</dd></>)}
        {brand.logo_notes && (<><dt className="text-white/45">Logos</dt><dd className="min-w-0 break-words text-white/85">{brand.logo_notes}</dd></>)}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/35">
          {brand.source === 'canva' && brand.source_synced_at
            ? `Copied from Canva on ${new Date(brand.source_synced_at).toLocaleDateString('en-ZA')}. Check Canva if anything looks out of date.`
            : `Updated ${new Date(brand.updated_at).toLocaleDateString('en-ZA')}`}
        </p>
        {isManager && <ActionButton size="sm" variant="ghost" onClick={onEdit}>Edit profile</ActionButton>}
      </div>
    </div>
  )
}

function ProfileForm({ clientId, brand, onCancel, onSaved }: {
  clientId: string
  brand: ClientBrandProfile | null
  onCancel: () => void
  onSaved: (brand: ClientBrandProfile) => void
}) {
  const [kit, setKit] = useState(brand?.canva_brand_kit_id ?? '')
  const [colours, setColours] = useState(formatColourList(brand?.colours ?? []))
  const [fonts, setFonts] = useState((brand?.fonts ?? []).join(', '))
  const [voice, setVoice] = useState(brand?.tone_voice ?? '')
  const [look, setLook] = useState(brand?.visual_direction ?? '')
  const [logos, setLogos] = useState(brand?.logo_notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    const kitId = kit.trim() ? parseCanvaBrandKitId(kit) : null
    if (kit.trim() && !kitId) { setError('Paste the Canva brand kit link, for example canva.com/brand/kAF…'); return }
    const parsed = parseColourList(colours)
    if (parsed.rejected.length) { setError(`These aren't hex colours: ${parsed.rejected.join(', ')}. Use the form #9b4f1b.`); return }
    setSaving(true); setError(null)
    const result = await saveBrandProfile(clientId, {
      canva_brand_kit_id: kitId,
      colours: parsed.colours,
      fonts: fonts.split(',').map(font => font.trim()).filter(Boolean),
      tone_voice: voice.trim() || null,
      visual_direction: look.trim() || null,
      logo_notes: logos.trim() || null,
    })
    setSaving(false)
    if (result.error || !result.data) { setError(result.error ?? 'Could not save the brand profile'); return }
    onSaved(result.data)
  }

  return (
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save() }}>
      <label className="block space-y-1"><span className={LABEL}>Canva brand kit link</span><input id="brand-kit" className={INPUT} value={kit} onChange={event => setKit(event.target.value)} placeholder="https://www.canva.com/brand/…" /></label>
      <label className="block space-y-1"><span className={LABEL}>Colours</span><input id="brand-colours" className={INPUT} value={colours} onChange={event => setColours(event.target.value)} placeholder="#9b4f1b orange, #0a2f37 teal" /></label>
      <label className="block space-y-1"><span className={LABEL}>Fonts</span><input id="brand-fonts" className={INPUT} value={fonts} onChange={event => setFonts(event.target.value)} placeholder="Montserrat, Barlow" /></label>
      <label className="block space-y-1"><span className={LABEL}>Voice</span><textarea id="brand-voice" className={`${INPUT} min-h-[70px]`} value={voice} onChange={event => setVoice(event.target.value)} /></label>
      <label className="block space-y-1"><span className={LABEL}>Look</span><textarea id="brand-look" className={`${INPUT} min-h-[70px]`} value={look} onChange={event => setLook(event.target.value)} placeholder="Backgrounds, textures, device mockups, motion style" /></label>
      <label className="block space-y-1"><span className={LABEL}>Logos</span><input id="brand-logos" className={INPUT} value={logos} onChange={event => setLogos(event.target.value)} placeholder="Which logo files to use, and where they are" /></label>
      {error && <p className="text-sm text-amber-200">{error}</p>}
      <div className="flex gap-2">
        <ActionButton type="submit" size="sm" loading={saving}>Save profile</ActionButton>
        <ActionButton type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

function RuleForm({ clientId, isManager, onCancel, onAdded }: { clientId: string; isManager: boolean; onCancel: () => void; onAdded: () => void }) {
  const [rule, setRule] = useState('')
  const [priority, setPriority] = useState<BrandRulePriority>('must')
  const [category, setCategory] = useState<BrandRuleCategory>('copy')
  const [scope, setScope] = useState<'client' | 'house'>('client')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function add() {
    const problem = validateRuleText(rule)
    if (problem) { setError(problem); return }
    setSaving(true); setError(null)
    const result = await addBrandRule({ clientId: scope === 'house' ? null : clientId, priority, category, rule, source: source || null })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    onAdded()
  }

  return (
    <form className="mt-2 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3" onSubmit={event => { event.preventDefault(); void add() }}>
      <label className="block space-y-1"><span className={LABEL}>Rule</span><textarea id="brand-rule-text" className={`${INPUT} min-h-[60px]`} value={rule} onChange={event => setRule(event.target.value)} placeholder="e.g. No full stops at the end of on-screen lines" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1"><span className={LABEL}>Strength</span>
          <select id="brand-rule-priority" className={INPUT} value={priority} onChange={event => setPriority(event.target.value as BrandRulePriority)}>
            <option value="must">Must</option><option value="should">Should</option>
          </select>
        </label>
        <label className="block space-y-1"><span className={LABEL}>Area</span>
          <select id="brand-rule-category" className={INPUT} value={category} onChange={event => setCategory(event.target.value as BrandRuleCategory)}>
            {BRAND_RULE_CATEGORIES.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1"><span className={LABEL}>Applies to</span>
          <select id="brand-rule-scope" className={INPUT} value={scope} onChange={event => setScope(event.target.value as 'client' | 'house')}>
            <option value="client">This client</option>
            {isManager && <option value="house">Every client (house rule)</option>}
          </select>
        </label>
      </div>
      <label className="block space-y-1"><span className={LABEL}>Where it came from</span><input id="brand-rule-source" className={INPUT} value={source} onChange={event => setSource(event.target.value)} placeholder="e.g. Client feedback on Video 03, round 2" /></label>
      {error && <p className="text-sm text-amber-200">{error}</p>}
      <div className="flex gap-2">
        <ActionButton type="submit" size="sm" loading={saving}>Add rule</ActionButton>
        <ActionButton type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

function RuleRow({ rule, isManager, onRetired }: { rule: ClientBrandRule; isManager: boolean; onRetired: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function retire() {
    setBusy(true); setError(null)
    const result = await retireBrandRule(rule.id)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    onRetired()
  }

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-start gap-2">
        <Pill tone={rule.priority === 'must' ? 'accent' : 'teal'} className="!px-2 !py-0.5 !text-[10px] uppercase">{rule.priority}</Pill>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/90">{rule.rule}</p>
          <p className="mt-0.5 text-xs text-white/40">{rule.client_id ? 'Client rule' : 'House rule'} · {categoryLabel(rule.category)}{rule.source ? ` · ${rule.source}` : ''}</p>
        </div>
        {isManager && !confirming && <ActionButton size="sm" variant="ghost" onClick={() => setConfirming(true)}>Retire</ActionButton>}
      </div>
      {confirming && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
          Retire this rule? Editors will stop seeing it; it stays in the history.
          <ActionButton size="sm" variant="danger" loading={busy} onClick={() => void retire()}>Retire rule</ActionButton>
          <ActionButton size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep</ActionButton>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-amber-200">{error}</p>}
    </li>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { completePublicOnboarding, loadPublicOnboarding, savePublicOnboarding, uploadOnboardingFile } from './api'
import { OnboardingShell } from './OnboardingShell'
import { PlatformAccessCard } from './PlatformAccessCard'
import type { ClientAccessChoice, ClientOnboardingState, OnboardingPlatform } from './types'
import { coreOnboardingComplete, logoRequirementSatisfied, servicesRequirementSatisfied, validateLogoCandidate } from './validation'

const fieldClass = 'min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none placeholder:text-report-faint focus:border-report-accent/60'

export default function WelcomeToCgPage() {
  const [token] = useState(() => {
    const fragmentToken = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const historyToken = typeof window.history.state?.onboardingToken === 'string' ? window.history.state.onboardingToken : ''
    return fragmentToken || historyToken
  })
  const [state, setState] = useState<ClientOnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceItem, setServiceItem] = useState('')
  const loadedRef = useRef(false)
  const saveRequestRef = useRef(0)
  const autosaveTimerRef = useRef<number | null>(null)
  const typedDescription = state?.typedDescription
  const serviceItems = state?.serviceItems
  const additionalNotes = state?.additionalNotes
  const onboardingStatus = state?.status

  useEffect(() => {
    document.title = 'Welcome to CG'
    const meta = document.querySelector('meta[name="referrer"]') ?? document.createElement('meta')
    meta.setAttribute('name', 'referrer')
    meta.setAttribute('content', 'no-referrer')
    if (!meta.parentNode) document.head.appendChild(meta)
    if (token) window.history.replaceState({ ...window.history.state, onboardingToken: token }, '', '/welcome')
  }, [token])

  useEffect(() => {
    let active = true
    async function load() {
      if (!token) {
        setError('This welcome link is no longer available. Ask CG for a new link.')
        setLoading(false)
        return
      }
      const result = await loadPublicOnboarding(token)
      if (!active) return
      setState(result.data)
      setError(result.error)
      setLoading(false)
      loadedRef.current = true
    }
    void load()
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (!loadedRef.current || onboardingStatus === 'completed') return
    autosaveTimerRef.current = window.setTimeout(async () => {
      autosaveTimerRef.current = null
      const requestId = ++saveRequestRef.current
      const result = await savePublicOnboarding(token, {
        typedDescription,
        serviceItems,
        additionalNotes,
      })
      if (requestId !== saveRequestRef.current) return
      if (result.data) setState(result.data)
      if (result.error) setError(result.error)
    }, 700)
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [typedDescription, serviceItems, additionalNotes, onboardingStatus, token])

  async function save(patch: Parameters<typeof savePublicOnboarding>[1]) {
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = null
    const requestId = ++saveRequestRef.current
    setSaving(true)
    setError(null)
    const result = await savePublicOnboarding(token, patch)
    if (requestId === saveRequestRef.current) {
      if (result.data) setState(result.data)
      if (result.error) setError(result.error)
    }
    setSaving(false)
  }

  function updateLocal(patch: Partial<ClientOnboardingState>) {
    setState(current => current ? { ...current, ...patch } : current)
  }

  async function chooseAccess(platform: OnboardingPlatform, clientChoice: ClientAccessChoice, clientConfirmed = false) {
    await save({
      platformAccess: [{
        platform,
        clientChoice,
        clientConfirmed,
      }],
    })
  }

  async function goToStep(currentStep: number) {
    await save({ currentStep, typedDescription, serviceItems, additionalNotes })
  }

  async function finish() {
    setSaving(true)
    const result = await completePublicOnboarding(token)
    if (result.data) setState(result.data)
    if (result.error) setError(result.error)
    setSaving(false)
  }

  if (loading) return <OnboardingShell><p className="text-sm text-report-muted">Opening your welcome link...</p></OnboardingShell>
  if (!state) return <OnboardingShell><Message title="This link is unavailable" body={error ?? 'Ask CG for a fresh welcome link.'} /></OnboardingShell>

  const step = state.currentStep
  return (
    <OnboardingShell step={step}>
      {error && <p role="alert" className="mb-5 rounded-xl border border-[#d8a07a]/25 bg-[#d8a07a]/10 p-4 text-sm text-[#e5b18d]">{error}</p>}

      {step === 0 && (
        <div className="py-6 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-report-accent">About 5-10 minutes</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Welcome to CG, {state.clientName}</h1>
          <div className="mt-6 max-w-2xl space-y-4 text-base leading-relaxed text-report-muted sm:text-lg">
            <p>We're excited to get started.</p>
            <p>We just need a few things from you first. Don't worry about getting everything perfect. Send us what you have and we'll take it from there.</p>
          </div>
          <ActionButton size="lg" className="mt-8 min-h-14" onClick={() => void save({ currentStep: 1 })} loading={saving}>Let's get started</ActionButton>
        </div>
      )}

      {step === 1 && (
        <Step title="First, send us your logo" intro="A vector PDF is ideal because it gives us the best quality for design and print. Don't have one? No stress. Send us whatever version you have and we'll take it from there.">
          <label className="mt-6 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-report-accent/40 bg-report-accent/[0.05] p-6 text-center">
            <span className="text-base font-bold text-white">Choose logo files</span>
            <span className="mt-2 text-sm text-report-muted">PDF, PNG, JPG, SVG, AI, EPS, WEBP, TIFF, PSD or ZIP</span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps,.webp,.tif,.tiff,.psd,.zip"
              className="sr-only"
              onChange={event => {
                const file = event.target.files?.[0]
                if (!file) return
                const validationError = validateLogoCandidate(file)
                if (validationError) setError(validationError)
                else void uploadOnboardingFile(token, 'logo', file).then(result => setError(result.error))
                event.target.value = ''
              }}
            />
          </label>
          <label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-4 text-sm text-report-text">
            <input type="checkbox" checked={state.vectorUnavailable} onChange={event => void save({ vectorUnavailable: event.target.checked })} className="h-5 w-5 accent-[#c17a49]" />
            I don't have a vector version
          </label>
          {state.vectorUnavailable && <p className="mt-3 text-sm text-report-muted">That's completely fine. Upload whatever version you have.</p>}
          <StickyActions onBack={() => void goToStep(0)} onContinue={() => void goToStep(2)} continueDisabled={!logoRequirementSatisfied(state)} saving={saving} />
        </Step>
      )}

      {step === 2 && (
        <Step title="What do you offer?" intro="Help us understand exactly what your business sells or does. Use whichever option is easiest. You don't need to complete all of them.">
          <label className="mt-6 block text-sm font-semibold text-white">Type it</label>
          <textarea className={`${fieldClass} mt-2 min-h-32 resize-y`} value={state.typedDescription} onChange={event => updateLocal({ typedDescription: event.target.value })} placeholder="PVC ceilings, cornices, wall panels, installations..." />
          <div className="mt-6">
            <p className="text-sm font-semibold text-white">Or make a quick list</p>
            <div className="mt-2 flex gap-2">
              <input className={fieldClass} value={serviceItem} onChange={event => setServiceItem(event.target.value)} placeholder="Add a service" />
              <button type="button" className="min-h-12 shrink-0 rounded-xl border border-white/15 px-4 text-sm font-bold text-white" onClick={() => {
                const item = serviceItem.trim()
                if (!item) return
                updateLocal({ serviceItems: [...state.serviceItems, item] })
                setServiceItem('')
              }}>Add</button>
            </div>
            {state.serviceItems.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{state.serviceItems.map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => updateLocal({ serviceItems: state.serviceItems.filter((_, itemIndex) => itemIndex !== index) })} className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm text-report-text">{item} <span className="ml-2 text-report-faint">Remove</span></button>)}</div>}
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-5">
            <p className="font-semibold text-white">Or upload something you already have</p>
            <p className="mt-1 text-sm text-report-muted">A company profile, brochure, menu, catalogue, pricelist, presentation, screenshots or photos all work.</p>
            <p className="mt-3 text-xs text-[#e5b18d]">Secure OneDrive file transfer is not connected in this foundation build. No file selected here will be treated as received.</p>
          </div>
          <StickyActions onBack={() => void goToStep(1)} onContinue={() => void goToStep(3)} continueDisabled={!servicesRequirementSatisfied(state)} saving={saving} />
        </Step>
      )}

      {step === 3 && (
        <Step title="Let's connect the accounts we'll be working with" intro="Connect what you can now. Anything you don't have time for can be done later.">
          <div className="mt-6 space-y-4">
            {state.platformAccess.map(access => <PlatformAccessCard key={access.platform} access={access} onChoose={(platform, choice, clientConfirmed) => void chooseAccess(platform, choice, clientConfirmed)} />)}
            {state.platformAccess.length === 0 && <p className="rounded-xl border border-white/10 p-4 text-sm text-report-muted">CG has not assigned any account setup to you. You can continue.</p>}
          </div>
          <StickyActions onBack={() => void goToStep(2)} onContinue={() => void finish()} continueDisabled={!coreOnboardingComplete(state)} saving={saving} label="Finish setup" />
        </Step>
      )}

      {step === 4 && (
        <div className="py-8 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-report-accent">Welcome aboard</p>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-6xl">You're all set.</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-report-muted sm:text-lg">Thanks. We've got what we need to start setting things up on our side. If anything else is needed, we'll get in touch.</p>
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <h2 className="text-xl font-bold text-white">Want to tell us more?</h2>
            <p className="mt-1 text-sm text-report-muted">Completely optional.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <ActionButton onClick={() => void save({ currentStep: 5 })}>Tell us more</ActionButton>
              <ActionButton variant="secondary" onClick={() => window.close()}>I'm done</ActionButton>
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <Step title="Anything else we should know?" intro="Completely optional. Share anything you'd love us to focus on, or anything you definitely don't want us to do.">
          <textarea className={`${fieldClass} mt-6 min-h-44 resize-y`} value={state.additionalNotes} onChange={event => updateLocal({ additionalNotes: event.target.value })} placeholder="Anything else we should know?" />
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-report-muted">Extra uploads and voice notes will be added after the secure OneDrive handoff is approved. Your onboarding is already complete.</div>
          <StickyActions onBack={() => void goToStep(4)} onContinue={() => void goToStep(4)} saving={saving} label="Save and finish" />
        </Step>
      )}
    </OnboardingShell>
  )
}

function Step({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <section><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-base leading-relaxed text-report-muted">{intro}</p>{children}</section>
}

function StickyActions({ onBack, onContinue, continueDisabled, saving, label = 'Continue' }: { onBack: () => void; onContinue: () => void; continueDisabled?: boolean; saving: boolean; label?: string }) {
  return <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#030706]/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl gap-3"><ActionButton variant="secondary" className="min-h-12" onClick={onBack}>Back</ActionButton><ActionButton fullWidth className="min-h-12" onClick={onContinue} disabled={continueDisabled} loading={saving}>{label}</ActionButton></div></div>
}

function Message({ title, body }: { title: string; body: string }) {
  return <div className="py-12"><h1 className="text-3xl font-black text-white">{title}</h1><p className="mt-4 text-report-muted">{body}</p></div>
}

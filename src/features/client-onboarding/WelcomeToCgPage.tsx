import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { completePublicOnboarding, loadPublicOnboarding, savePublicOnboarding, uploadOnboardingFile } from './api'
import { OnboardingShell } from './OnboardingShell'
import { PlatformAccessCard } from './PlatformAccessCard'
import { VideoWalkthrough } from './VideoWalkthrough'
import type { ClientAccessChoice, ClientOnboardingState, OnboardingPlatform, UploadCategory } from './types'
import { coreOnboardingComplete, logoRequirementSatisfied, servicesRequirementSatisfied, validateLogoCandidate, validateOptionalCandidate, validateServicesCandidate } from './validation'

const WALKTHROUGH_VIDEO_URL = import.meta.env.VITE_ONBOARDING_WALKTHROUGH_URL as string | undefined

const fieldClass = 'min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none placeholder:text-report-faint focus:border-report-accent/60'

type UploadQueueItem = {
  id: string
  name: string
  progress: number
  status: 'waiting' | 'uploading' | 'received' | 'failed'
  error?: string
}

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
  const [servicesMethod, setServicesMethod] = useState<'type' | 'upload'>('type')
  const [uploadingCategory, setUploadingCategory] = useState<UploadCategory | null>(null)
  const [uploadQueue, setUploadQueue] = useState<Record<UploadCategory, UploadQueueItem[]>>({ logo: [], services: [], optional: [] })
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

  async function handleFiles(
    category: UploadCategory,
    files: File[],
    validate: (file: File) => string | null,
  ) {
    if (files.length === 0 || uploadingCategory) return
    const batch = files.map((file, index) => ({
      id: `${category}-${file.name}-${file.lastModified}-${index}`,
      file,
      error: validate(file),
    }))
    setUploadQueue(current => ({
      ...current,
      [category]: batch.map(item => ({
        id: item.id,
        name: item.file.name,
        progress: 0,
        status: item.error ? 'failed' : 'waiting',
        error: item.error ?? undefined,
      })),
    }))
    setUploadingCategory(category)
    setError(null)

    let firstError = batch.find(item => item.error)?.error ?? null
    for (const item of batch) {
      if (item.error) continue
      setUploadQueue(current => ({
        ...current,
        [category]: current[category].map(row => row.id === item.id ? { ...row, status: 'uploading' } : row),
      }))
      const result = await uploadOnboardingFile(token, category, item.file, progress => {
        setUploadQueue(current => ({
          ...current,
          [category]: current[category].map(row => row.id === item.id ? { ...row, progress } : row),
        }))
      })
      if (result.data) setState(result.data)
      if (result.error) firstError ??= result.error
      setUploadQueue(current => ({
        ...current,
        [category]: current[category].map(row => row.id === item.id
          ? { ...row, progress: result.data ? 100 : row.progress, status: result.data ? 'received' : 'failed', error: result.error ?? undefined }
          : row),
      }))
    }

    if (firstError) setError(firstError)
    setUploadingCategory(null)
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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-report-accent">About 5 minutes</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Welcome to CG, {state.clientName}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-report-muted sm:text-lg">Send what you have. We'll take it from there.</p>
          <VideoWalkthrough videoUrl={WALKTHROUGH_VIDEO_URL} />
          <ActionButton size="lg" className="mt-8 min-h-14 w-full sm:w-auto" onClick={() => void save({ currentStep: 1 })} loading={saving}>Start</ActionButton>
        </div>
      )}

      {step === 1 && (
        <Step title="Add your logo" intro="PDF is best. Any clear version works.">
          <UploadPicker
            label="Choose logo files"
            hint="PDF, image, design file or ZIP, 50 MB each"
            accept=".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps,.webp,.tif,.tiff,.psd,.zip"
            busy={uploadingCategory !== null}
            onFiles={files => void handleFiles('logo', files, validateLogoCandidate)}
          />
          <UploadQueue items={uploadQueue.logo} />
          <ReceivedFiles state={state} category="logo" />
          <label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-4 text-sm text-report-text">
            <input type="checkbox" checked={state.vectorUnavailable} onChange={event => void save({ vectorUnavailable: event.target.checked })} className="h-5 w-5 accent-[#c17a49]" />
            I don't have a vector version
          </label>
          <StickyActions onBack={() => void goToStep(0)} onContinue={() => void goToStep(2)} continueDisabled={!logoRequirementSatisfied(state) || uploadingCategory !== null} saving={saving} />
        </Step>
      )}

      {step === 2 && (
        <Step title="What do you offer?" intro="Type it or upload a company profile.">
          <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1" aria-label="Choose how to add services">
            {(['type', 'upload'] as const).map(method => <button key={method} type="button" aria-pressed={servicesMethod === method} onClick={() => setServicesMethod(method)} className={`min-h-12 rounded-lg px-3 text-sm font-bold ${servicesMethod === method ? 'bg-report-accent text-black' : 'text-report-muted'}`}>{method === 'type' ? 'Type it' : 'Upload files'}</button>)}
          </div>
          {servicesMethod === 'type' ? (
            <div className="mt-5">
              <textarea className={`${fieldClass} min-h-32 resize-y`} value={state.typedDescription} onChange={event => updateLocal({ typedDescription: event.target.value })} placeholder="Tell us what you sell or do" />
              {state.serviceItems.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{state.serviceItems.map((item, index) => <span key={`${item}-${index}`} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-report-text">{item}</span>)}</div>}
            </div>
          ) : (
            <>
              <UploadPicker label="Choose company files" hint="Profile, brochure, menu or photos, 50 MB each" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.zip" busy={uploadingCategory !== null} onFiles={files => void handleFiles('services', files, validateServicesCandidate)} />
              <UploadQueue items={uploadQueue.services} />
              <ReceivedFiles state={state} category="services" />
            </>
          )}
          <StickyActions onBack={() => void goToStep(1)} onContinue={() => void goToStep(3)} continueDisabled={!servicesRequirementSatisfied(state) || uploadingCategory !== null} saving={saving} />
        </Step>
      )}

      {step === 3 && (
        <Step title="Connect accounts" intro="Choose now, later, or not needed.">
          <div className="mt-6 space-y-4">
            {state.platformAccess.map(access => <PlatformAccessCard key={access.platform} access={access} onChoose={(platform, choice, clientConfirmed) => void chooseAccess(platform, choice, clientConfirmed)} />)}
            {state.platformAccess.length === 0 && <p className="rounded-xl border border-white/10 p-4 text-sm text-report-muted">CG has not assigned any account setup to you. You can continue.</p>}
          </div>
          <StickyActions onBack={() => void goToStep(2)} onContinue={() => void finish()} continueDisabled={!coreOnboardingComplete(state) || uploadingCategory !== null} saving={saving} label="Finish" />
        </Step>
      )}

      {step === 4 && (
        <div className="py-8 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-report-accent">Welcome aboard</p>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-6xl">You're all set.</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-report-muted sm:text-lg">Thanks. We'll take it from here.</p>
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
        <Step title="Anything else?" intro="Optional. Add a note or extra files.">
          <textarea className={`${fieldClass} mt-6 min-h-44 resize-y`} value={state.additionalNotes} onChange={event => updateLocal({ additionalNotes: event.target.value })} placeholder="Anything else we should know?" />
          <UploadPicker label="Choose extra files" hint="PDF, image, ZIP, text or CSV, 50 MB each" accept=".pdf,.png,.jpg,.jpeg,.zip,.txt,.csv" busy={uploadingCategory !== null} onFiles={files => void handleFiles('optional', files, validateOptionalCandidate)} />
          <UploadQueue items={uploadQueue.optional} />
          <ReceivedFiles state={state} category="optional" />
          <StickyActions onBack={() => void goToStep(4)} onContinue={() => void goToStep(4)} continueDisabled={uploadingCategory !== null} saving={saving} label="Save" />
        </Step>
      )}
    </OnboardingShell>
  )
}

function Step({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <section><h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1><p className="mt-3 max-w-xl text-base leading-relaxed text-report-muted">{intro}</p>{children}</section>
}

function StickyActions({ onBack, onContinue, continueDisabled, saving, label = 'Continue' }: { onBack: () => void; onContinue: () => void; continueDisabled?: boolean; saving: boolean; label?: string }) {
  return <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#030706]/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl"><div className="mx-auto flex max-w-3xl gap-3"><ActionButton variant="secondary" className="min-h-12" onClick={onBack}>Back</ActionButton><ActionButton fullWidth className="min-h-12" onClick={onContinue} disabled={continueDisabled} loading={saving}>{label}</ActionButton></div></div>
}

function UploadPicker({ label, hint, accept, busy, onFiles }: { label: string; hint: string; accept: string; busy: boolean; onFiles: (files: File[]) => void }) {
  return (
    <label className={`mt-5 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center ${busy ? 'cursor-not-allowed border-white/10 opacity-60' : 'cursor-pointer border-report-accent/40 bg-report-accent/[0.05]'}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-report-accent/15 text-2xl text-report-accent">+</span>
      <span className="mt-3 text-base font-bold text-white">{label}</span>
      <span className="mt-1 text-xs leading-relaxed text-report-muted">{hint}</span>
      <input type="file" multiple accept={accept} disabled={busy} className="sr-only" onChange={event => {
        onFiles(Array.from(event.target.files ?? []))
        event.target.value = ''
      }} />
    </label>
  )
}

function UploadQueue({ items }: { items: UploadQueueItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-4 space-y-2" aria-live="polite">
      {items.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-report-text">{item.name}</span><span className={item.status === 'failed' ? 'text-[#e5b18d]' : item.status === 'received' ? 'text-brand-teal' : 'text-report-accent'}>{item.status === 'waiting' ? 'Waiting' : item.status === 'uploading' ? `${item.progress}%` : item.status === 'received' ? 'Done' : 'Try again'}</span></div>{item.status === 'uploading' && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-report-accent transition-all" style={{ width: `${item.progress}%` }} /></div>}{item.error && <p className="mt-1 text-xs text-[#e5b18d]">{item.error}</p>}</div>)}
    </div>
  )
}

function ReceivedFiles({ state, category }: { state: ClientOnboardingState; category: UploadCategory }) {
  const uploads = state.uploads.filter(upload => upload.category === category && upload.uploadStatus === 'received')
  if (uploads.length === 0) return null
  return <div className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal/[0.07] p-3"><p className="text-xs font-bold uppercase tracking-wider text-brand-teal">Received</p>{uploads.map(upload => <p key={upload.id} className="mt-1 truncate text-sm text-white">{upload.originalFilename}</p>)}</div>
}

function Message({ title, body }: { title: string; body: string }) {
  return <div className="py-12"><h1 className="text-3xl font-black text-white">{title}</h1><p className="mt-4 text-report-muted">{body}</p></div>
}

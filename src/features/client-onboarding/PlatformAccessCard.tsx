import { useState } from 'react'
import type { ClientAccessChoice, OnboardingPlatform, PlatformAccessState } from './types'
import { PLATFORM_GUIDES } from './platformGuides'

const CHOICES: Array<{ value: ClientAccessChoice; label: string }> = [
  { value: 'connect_now', label: 'Connect now' },
  { value: 'do_later', label: 'Do it later' },
  { value: 'not_needed', label: 'Not needed' },
]

export function PlatformAccessCard({
  access,
  onChoose,
}: {
  access: PlatformAccessState
  onChoose: (platform: OnboardingPlatform, choice: ClientAccessChoice, clientConfirmed?: boolean) => void
}) {
  const [guideOpen, setGuideOpen] = useState(access.clientChoice === 'connect_now')
  const guide = PLATFORM_GUIDES[access.platform]

  function choose(choice: ClientAccessChoice) {
    setGuideOpen(choice === 'connect_now')
    onChoose(access.platform, choice)
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <h3 className="text-base font-bold text-white">{guide.label}</h3>
      <p className="mt-1 text-sm leading-relaxed text-report-muted">{guide.summary}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {CHOICES.map(choice => (
          <button
            key={choice.value}
            type="button"
            onClick={() => choose(choice.value)}
            aria-pressed={access.clientChoice === choice.value}
            className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              access.clientChoice === choice.value
                ? 'border-report-accent bg-report-accent/15 text-white'
                : 'border-white/10 bg-black/10 text-report-muted hover:border-white/25 hover:text-white'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {guideOpen && (
        <div className="mt-5 rounded-xl border border-report-accent/20 bg-report-accent/[0.06] p-4">
          <ol className="space-y-3">
            {guide.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-report-text">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-report-accent/15 text-xs font-bold text-report-accent">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
          {guide.secureCredentialBoundary && (
            <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-report-muted">
              {guide.secureCredentialBoundary}
            </p>
          )}
          {guide.completionLabel ? (
            <button
              type="button"
              onClick={() => onChoose(access.platform, 'connect_now', true)}
              className="mt-4 min-h-12 w-full rounded-xl bg-report-accent px-4 text-sm font-bold text-black"
            >
              {guide.completionLabel}
            </button>
          ) : (
            <p className="mt-4 text-sm font-semibold text-report-accent">CG will arrange the separate secure handoff with you.</p>
          )}
        </div>
      )}
    </article>
  )
}

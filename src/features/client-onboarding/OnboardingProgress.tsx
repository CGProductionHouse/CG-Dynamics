import type { ClientOnboardingState } from './types'
import { logoRequirementSatisfied, servicesRequirementSatisfied } from './validation'

interface Step {
  id: number
  label: string
  description: string
  completed: boolean
  current: boolean
}

export function OnboardingProgress({ state }: { state: ClientOnboardingState }) {
  const steps = deriveSteps(state)
  const completedCount = steps.filter(s => s.completed).length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Onboarding progress</h2>
        <span className="text-sm font-semibold text-report-accent">{progressPercent}%</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-accent transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-5 space-y-3">
        {steps.map(step => (
          <div key={step.id} className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              step.completed
                ? 'bg-brand-teal/20 text-brand-teal'
                : step.current
                  ? 'bg-brand-accent/20 text-brand-accent'
                  : 'bg-white/[0.06] text-report-faint'
            }`}>
              {step.completed ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.id
              )}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${step.completed ? 'text-white' : step.current ? 'text-white' : 'text-report-muted'}`}>
                {step.label}
              </p>
              <p className="text-xs text-report-faint">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {state.status === 'completed' && (
        <div className="mt-5 rounded-xl border border-brand-teal/20 bg-brand-teal/[0.08] p-4">
          <p className="text-sm font-semibold text-brand-teal">Onboarding complete</p>
          <p className="mt-1 text-xs text-report-muted">Your CG team has received everything they need.</p>
        </div>
      )}
    </section>
  )
}

function deriveSteps(state: ClientOnboardingState): Step[] {
  const logoDone = logoRequirementSatisfied(state)
  const servicesDone = servicesRequirementSatisfied(state)
  const accessDone = state.platformAccess.every(
    a => a.clientChoice === 'not_needed' || a.clientChoice === 'do_later' || a.connectionState === 'verified' || a.connectionState === 'submitted',
  )
  const currentStep = state.currentStep ?? 0

  return [
    { id: 1, label: 'Welcome', description: 'Welcome to CG Dynamics', completed: currentStep > 0, current: currentStep === 0 },
    { id: 2, label: 'Logo & brand files', description: logoDone ? 'Brand files received' : 'Upload your logo and brand assets', completed: logoDone, current: !logoDone && currentStep <= 1 },
    { id: 3, label: 'Services', description: servicesDone ? 'Services information received' : 'Tell us about your services', completed: servicesDone, current: !servicesDone && !logoDone && currentStep <= 2 },
    { id: 4, label: 'Account access', description: accessDone ? 'Account access complete' : 'Connect your platforms', completed: accessDone, current: !accessDone && logoDone && servicesDone },
    { id: 5, label: 'All set', description: state.status === 'completed' ? 'Onboarding complete' : 'Review and submit', completed: state.status === 'completed', current: state.status === 'in_progress' && logoDone && servicesDone },
  ]
}

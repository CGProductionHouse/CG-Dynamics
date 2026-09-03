import { useState } from 'react'

const WALKTHROUGH_STEPS = [
  { number: 1, title: 'Upload your logo', description: 'A vector PDF is ideal. Any format works — we\'ll sort it out.' },
  { number: 2, title: 'Tell us about your services', description: 'Type a description, make a list, or upload something you already have.' },
  { number: 3, title: 'Connect your accounts', description: 'Link the platforms CG will manage. You can skip any you\'re not ready for.' },
  { number: 4, title: 'All set', description: 'Your CG team will take it from here.' },
]

export function VideoWalkthrough({ videoUrl }: { videoUrl?: string }) {
  const [expanded, setExpanded] = useState(false)

  if (expanded) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">How it works</h2>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-semibold text-report-accent hover:underline"
          >
            Show less
          </button>
        </div>

        {videoUrl ? (
          <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-white/10">
            <iframe
              src={videoUrl}
              title="Welcome to CG — walkthrough"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {WALKTHROUGH_STEPS.map(step => (
              <div key={step.number} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent/20 text-sm font-bold text-brand-accent">
                  {step.number}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-0.5 text-xs text-report-muted">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">How it works</h2>
          <p className="mt-1 text-sm text-report-muted">Quick overview of what to expect.</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 shrink-0 rounded-xl border border-white/15 px-4 text-xs font-bold text-report-accent hover:bg-white/[0.05]"
        >
          {videoUrl ? 'Watch video' : 'Show steps'}
        </button>
      </div>
    </section>
  )
}

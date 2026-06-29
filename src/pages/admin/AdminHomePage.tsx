import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'

const SECTIONS = [
  {
    id: 'client-performance',
    title: 'Client Performance Dashboard',
    description: 'Performance reports, clients, Meta data, and monthly insights.',
    to: '/admin/client-performance',
    accent: 'from-teal-500 to-sky-400',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: 'cg-hub',
    title: 'CG Hub',
    description: 'Internal tools, CG Assistant, tasks, and staff workflows.',
    to: '/admin/cg-hub',
    accent: 'from-brand-accent to-teal-300',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
]

export default function AdminHomePage() {
  const { profile } = useAuth()

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark subtitle="" compact />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Welcome to CG Dynamics
          </h1>
          <p className="mt-3 text-base leading-relaxed text-brand-primary">
            Choose where you want to work.
          </p>
          {profile && (
            <p className="mt-2 text-sm text-brand-primary/70">
              Signed in as <span className="font-medium text-white">{profile.full_name ?? 'Staff'}</span>
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <Link
              key={section.id}
              to={section.to}
              className="group relative flex flex-col rounded-2xl border border-brand-muted bg-brand-surface p-6 transition-all duration-200 hover:border-brand-accent/30 hover:bg-white/[0.03] hover:-translate-y-0.5"
            >
              <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${section.accent}`} />
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
                {section.icon}
              </div>
              <h2 className="mt-5 text-lg font-bold text-white group-hover:text-brand-accent transition-colors">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-primary">
                {section.description}
              </p>
              <div className="mt-auto pt-5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent/10 px-4 py-2 text-sm font-semibold text-brand-accent transition-all group-hover:bg-brand-accent/20">
                  Enter
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/admin/assistant"
            className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-accent transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            Go to CG Assistant
          </Link>
        </div>
      </div>
    </div>
  )
}

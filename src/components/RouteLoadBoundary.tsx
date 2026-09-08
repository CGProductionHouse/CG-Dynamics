import { Component, type ErrorInfo, type ReactNode } from 'react'

type RouteLoadBoundaryState = { failed: boolean }

export class RouteLoadBoundary extends Component<{ children: ReactNode }, RouteLoadBoundaryState> {
  state: RouteLoadBoundaryState = { failed: false }

  static getDerivedStateFromError(): RouteLoadBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CG Dynamics could not open this page.', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-bg p-6 text-center">
        <div role="alert" className="w-full max-w-md rounded-xl border border-white/10 bg-brand-surface p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">Page did not open</p>
          <h1 className="mt-2 text-xl font-semibold text-white">Refresh CG Dynamics to continue.</h1>
          <p className="mt-2 text-sm text-brand-primary">Your sign-in and saved work will stay in place.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-11 rounded-md bg-brand-teal px-5 text-sm font-black text-black"
          >
            Refresh page
          </button>
        </div>
      </main>
    )
  }
}

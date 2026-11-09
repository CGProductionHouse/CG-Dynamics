import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicGuidelineReview } from '../components/client/PublicGuidelineReview'
import { readSharedGuideline, type SharedContentGuideline } from '../lib/publicContentGuidelines'

export default function PublicContentGuidelinePage() {
  const { slug = '', token = '' } = useParams()
  const [data, setData] = useState<SharedContentGuideline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [resolvedKey, setResolvedKey] = useState('')
  const requestKey = `${slug}/${token}`
  const visibleData = resolvedKey === requestKey ? data : null
  useEffect(() => {
    let active = true
    void readSharedGuideline(slug, token).then(result => {
      if (!active) return
      setData(result.data); setError(result.error); setResolvedKey(`${slug}/${token}`); setLoading(false)
    })
    return () => { active = false }
  }, [slug, token, revision])
  useEffect(() => {
    const previous = document.title
    document.title = visibleData ? `${visibleData.client.name} · Content Guideline | CG` : 'Content Guideline | CG'
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow, noarchive'
    document.head.appendChild(robots)
    return () => { document.title = previous; robots.remove() }
  }, [visibleData])
  return <main className="min-h-screen bg-[#030706] px-3 py-6 text-white sm:px-6 sm:py-10">
    <div className="mx-auto max-w-6xl">
      {loading || resolvedKey !== requestKey ? <div role="status" className="rounded-3xl border border-white/10 p-8 text-slate-300">Opening your content guideline…</div>
        : visibleData ? <><h1 className="sr-only">{visibleData.client.name} content guideline</h1><p className="mb-4 px-2 text-xs font-medium text-slate-400">Prepared for {visibleData.client.name} · Ready for your review</p>
          <PublicGuidelineReview key={`${requestKey}/${visibleData.guide.published_at}`} data={visibleData} slug={slug} token={token} />
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-slate-400"><span>Prepared by CG Production House</span><a href="/login" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Sign in to your CG Dynamics account</a></footer>
        </> : <section className="mx-auto mt-12 max-w-lg rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2dd4bf]">CG Production House</p>
          <h1 className="mt-5 text-3xl font-bold">{error ? 'Let’s try that again' : 'This link is unavailable'}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">{error ?? 'Please ask your CG contact for the latest content guideline link.'}</p>
          {error && <button onClick={() => { setLoading(true); setRevision(v => v + 1) }} className="mt-6 min-h-11 rounded-full bg-white px-6 font-semibold text-[#06110f]">Try again</button>}
        </section>}
    </div>
  </main>
}

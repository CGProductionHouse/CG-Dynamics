import { Link } from 'react-router-dom'

// Responsibilities are navigation/coverage, never synthetic completed tasks.
export function MasterScope() {
  const sections = [
    ['Websites & discovery', '/admin/work?tab=board&id=7f413d31-17cd-4761-b2e9-a031c1343444', 'Four reviewed reporting mappings; full Builder registry pending.'],
    ['Apps: CG Hours, CG Pay, Dynamics, Web Editor', '/admin/work?tab=board', 'Exact linked Dynamics work; full external milestone inventory pending.'],
    ['Client packages, posters and posting', '/admin/client-schedule', 'Canonical schedule; paid entitlements and posted proof require reconciliation.'],
    ['Videos, amendments and approvals', '/admin/content?tab=pipeline', 'Canonical pipeline; delivery and approval remain separate.'],
    ['Operational email and WhatsApp follow-through', '/admin/work?tab=board', 'Accepted requests must be recorded as existing tasks; no inbox monitoring claimed by this page.'],
    ['Microsoft / Teams transition', '/admin/microsoft-import', 'Existing hold and retry budgets remain authoritative.'],
    ['GitHub, Vercel and Supabase', '/admin/work?tab=board', 'Existing linked work, not a new system-health certification.'],
    ['Canva, OneDrive and approved-final portals', '/admin/work?tab=board', 'Source handoffs and approval evidence remain required.'],
    ['Staff automation, greetings and morning checks', '/admin/work?tab=board', 'Daily receipts remain in the existing coordination record.'],
    ['Storage, drives and migration', '/admin/work?tab=board', 'Measured device evidence required; no automatic deletion.'],
    ['Special requests and CG campaigns', '/admin/work?tab=board', 'Existing tasks; public posting and paid advertising retain approval gates.'],
    ['Research and all-platform performance', '/admin/work?tab=board', 'Actual source evidence required; unsupported reach is not inferred.'],
  ]
  return <div className="grid list">{sections.map(([title, href, note]) => <article className="card" key={title}><h3>{title}</h3><span className="badge">Open source</span><p className="next">{note}</p><Link className="native-owner" to={href}>View ↗</Link></article>)}</div>
}

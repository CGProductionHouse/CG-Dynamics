import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const INTELLIGENCE_DIR = join(ROOT, 'docs/ai-workforce/client-intelligence')
const OUTPUT_DIR = join(ROOT, 'artifacts/client-strategy-dossiers/issue-513')
const RUNTIME_GUIDE_DIR = join(OUTPUT_DIR, 'runtime-guides')
const REPORT_SNAPSHOT = join(ROOT, 'artifacts/report-truth/issue-501-recovery-pass-1-snapshot.json')
const PACKAGE_AUTHORITY = 'https://github.com/CGProductionHouse/CG-Dynamics/issues/504#issuecomment-5796095876'

// Exact production projection captured after all 56 #504 V2 receipts were confirmed.
// ? means unknown/null, never zero. Columns: name|id|guide|video,photo,design,reel,animated|other|notes
const AUTHORITY_ROWS = `
Agri-Secure|893992a5-23cd-4ee6-b5d9-ccf7b17fe071|AGRI-SECURE-FARM-ARMED-RESPONSE-CLIENT-MARKETING-INTELLIGENCE-2026-08.md|?,?,?,?,?||
All Around PVC|fd16ebae-a50b-4920-afe0-94c2631f8f06|ALL-AROUND-PVC-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|1,3,3,?,?||
AV Event Life|3b85973f-bcad-49eb-b8f1-c27f7c7f1aba|AV-EVENT-LIFE-CG-DYNAMICS-CLIENT-GUIDE.md|?,4,4,?,?|Social media management and caption generation included.|Prepared from Teams Planner Excel dry-run
Bat Hill Royale|32bd9db3-5339-4404-825b-5a615cadec6a|BAT-HILL-ROYALE-CG-DYNAMICS-CLIENT-GUIDE.md|?,?,?,?,?||
Bloem Action Sports|b28af30a-3d44-490a-8290-1e56dac7b127|BLOEM-ACTION-SPORTS-CG-DYNAMICS-CLIENT-GUIDE.md|1,4,4,?,?||Prepared from Teams Planner Excel dry-run
Bloem Marble & Granite|89e0ad6d-e08c-4a75-8b8e-abea71af581c|BLOEM-MARBLE-GRANITE-CG-DYNAMICS-CLIENT-GUIDE.md|2,?,4,?,?||Prepared from Teams Planner Excel dry-run
Bloem Vascular|2d16262d-8450-458d-ae7e-084ef9ff662d|BLOEM-VASCULAR-CG-DYNAMICS-CLIENT-GUIDE.md|?,?,?,?,?||
Bohemia Quick Stop|5dfdf4bd-9d94-4cc6-9dee-0e480a2234cb|BOHEMIA-QUICK-STOP-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|?,?,2,?,?||Prepared from Teams Planner Excel dry-run
Bouwer & Coetzee Attorneys|8e448cf9-1534-4ba1-89a4-93e4c8b83d2f|BOUWER-COETZEE-ATTORNEYS-CG-DYNAMICS-CLIENT-GUIDE.md|1,?,7,?,?||Prepared from Teams Planner Excel dry-run
Braize|6b67a2df-e2ab-418b-bcee-03aef5963d37|BRAIZE-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|?,4,4,?,?||
C&L Innovations|afb62c53-d6d3-4ef8-9393-def88ed899d8|C-L-INNOVATIONS-CG-DYNAMICS-CLIENT-GUIDE.md|?,2,2,?,?||Prepared from Teams Planner Excel dry-run
Cape Lumber|42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa|CAPE-LUMBER-CG-DYNAMICS-CLIENT-GUIDE.md|?,3,4,?,?||Prepared from Teams Planner Excel dry-run
Case Bloemfontein|079df21e-783a-4648-b3fa-0acae6e68867|CASE-BLOEMFONTEIN-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|2,?,12,?,?||
Central Canvas|6b313cac-283e-48c4-9df6-ba43af2f7353|CENTRAL-CANVAS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|1,4,3,?,?||Prepared from Teams Planner Excel dry-run
CG Production House|c27d2185-08e4-4c49-be48-2572564ceecf|CG-PRODUCTION-HOUSE-CANONICAL-CLIENT-INTELLIGENCE-2026-09.md|4,8,4,?,?|Four photo deliverables are collaborations with CG Studios.|
Daisy & Co|3404f726-a693-4b2d-8c13-c9d3dfd17bbc|DAISY-CO-CG-DYNAMICS-CLIENT-GUIDE.md|1,3,3,?,?||Prepared from Teams Planner Excel dry-run
Delta Gas|06b20bb1-ed4a-4aa1-9f48-8c6cb0531aba|DELTA-GAS-CG-DYNAMICS-CLIENT-GUIDE.md|1,3,3,?,?||Prepared from Teams Planner Excel dry-run
Dulux Paint & Paper Bloemfontein|2aed8a31-bd53-4ad1-a3dc-432865adfb3d|DULUX-PAINT-PAPER-BLOEMFONTEIN-CG-DYNAMICS-CLIENT-GUIDE.md|2,4,4,?,?||Prepared from Teams Planner Excel dry-run
Econofoods|61acf81b-1011-404e-9fae-2e209be65fca|ECONOFOODS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|5,?,?,?,?||Video supply only; CG does not manage Econofoods social channels.
Ehrlich Park Butchery|ec643c75-51f5-4839-829f-3f5b7f48829a|EHRLICH-PARK-BUTCHERY-CG-DYNAMICS-CLIENT-GUIDE.md|1,3,4,?,?||Prepared from Teams Planner Excel dry-run
Emmanuel Funerals|d53d8e62-9e6a-4bb9-be3f-554f40942d45|EMMANUEL-FUNERALS-CG-DYNAMICS-CLIENT-GUIDE.md|1,3,4,?,?||Prepared from Teams Planner Excel dry-run
Emoya Estate Driving Range|217a547c-7b22-45cc-bf88-9d45a8e93dfe|EMOYA-ESTATE-DRIVING-RANGE-CG-DYNAMICS-CLIENT-GUIDE.md|1,4,4,?,?||
First Technology Central|c8d34a97-8400-4f52-8b0d-843491fe3d3b|FIRST-TECHNOLOGY-CENTRAL-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md|?,?,?,?,?||Recurring social-media scope removed; verify any non-social service separately.
Forklift Trucks|4424ed69-7270-4d30-a1ea-0b77d76912df|FORKLIFT-TRUCKS-CG-DYNAMICS-CLIENT-GUIDE.md|1,3,3,?,?||
Germoparts|b6052710-417d-4b3b-8348-0f126bfea671|GERMOPARTS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|2,?,12,?,?||Prepared from Teams Planner Excel dry-run
Hino Trucks|1007e58b-3fea-4515-88b7-ddaa85763de6|HINO-TRUCKS-CG-DYNAMICS-CLIENT-GUIDE.md|2,?,?,?,?||Prepared from Teams Planner Excel dry-run
HMHI|572555e0-d4d0-404a-8d67-beeeeed6a1f2|HILL-MCHARDY-HERBST-INC-CG-DYNAMICS-CLIENT-GUIDE.md|?,?,3,?,?||
Human Auto|816c7f59-d56c-46a3-ba15-f76971d83769|HUMAN-AUTO-CG-DYNAMICS-CLIENT-GUIDE.md|3,?,?,?,?||
Ipopeng Office Supplies|2e643855-e2ad-481f-a6c6-3d934b9f4a50|IPOPENG-OFFICE-SUPPLIES-CLIENT-INTELLIGENCE-2026-09.md|?,?,?,?,?||
Jenkor|a5eab798-3e00-44cc-947e-463386fdac39|JENKOR-CG-DYNAMICS-CLIENT-GUIDE.md|1,?,3,?,?||Prepared from Teams Planner Excel dry-run
Kundedienste|5e4e3335-a89c-4629-9efc-b6a194bec80c||?,?,?,?,?||Once-off engagement only; no recurring package scope is confirmed.
Local Deli|2a5ea019-64f5-4f8e-8a61-61a28940aa6e|LOCAL-DELI-CG-DYNAMICS-CLIENT-GUIDE.md|?,?,?,?,?||Stale social client; no ongoing recurring package is confirmed.
Loraclox|21300630-6755-4591-9a49-e22abbaf7e3d|LORACLOX-CG-DYNAMICS-CLIENT-GUIDE.md|?,3,3,?,?||Prepared from Teams Planner Excel dry-run
Madison Wear|7b47afb0-fa55-4916-85f6-09c57e5905b9|MADISON-WEAR-CG-DYNAMICS-CLIENT-GUIDE.md|2,8,8,?,?||Prepared from Teams Planner Excel dry-run
Mimosa Mall|e276f019-a580-44c5-a7ab-e43840c33a64|MIMOSA-MALL-CLIENT-MARKETING-INTELLIGENCE-2026-09.md|?,?,?,?,?||
NCNA|94fe2568-3cf1-47dc-801e-d8d5396a0965|NCNA-CG-DYNAMICS-CLIENT-GUIDE.md|?,?,?,?,?||
Novus Steel|4236a60a-990f-484f-8d19-13d2f92fbe3b|NOVUS-STEEL-CG-DYNAMICS-CLIENT-GUIDE.md|1,4,4,?,?||Prepared from Teams Planner Excel dry-run
Peyper Bonds|a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b|PEYPER-BONDS-CG-DYNAMICS-CLIENT-GUIDE.md|1,3,3,?,?||Prepared from Teams Planner Excel dry-run
Piek Group|ed7aa1ae-de21-4151-a8f9-54796b234c1f|PIEK-GROUP-CG-DYNAMICS-CLIENT-GUIDE.md|4,?,12,?,?||Prepared from Teams Planner Excel dry-run
PSG Bloemfontein|29a28efd-c998-45e2-a57c-4a751e779e66|PSG-BLOEMFONTEIN-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|1,?,3,?,?||Prepared from Teams Planner Excel dry-run
RC-Polypipe|4f6106de-c437-404e-8cef-fbe848de0665|RC-POLYPIPE-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|1,3,4,?,?||Prepared from Teams Planner Excel dry-run
Red Oak|cdb11a82-339e-4b46-9b09-bde1a23efeaf|RED-OAK-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|8,2,?,?,?|Posters as requested; daily special on Instagram Story and as a Facebook post.|No fixed poster quantity.
Rusoord Farmstay|ac4c5e0c-c5d3-4512-8472-fe59192abeca||?,?,?,?,?|Website service only; monthly website-update quantity is unspecified.|Social scope removed.
SecuriForce|917d6f7c-1c2a-4c20-82f0-daa41b9062f5|SECURIFORCE-CG-DYNAMICS-CLIENT-GUIDE.md|4,4,4,?,?||Prepared from Teams Planner Excel dry-run
Supa Quick BFN|a60b4d07-0a30-4f1c-8d48-7bd9ea649c97|SUPA-QUICK-BFN-CG-DYNAMICS-CLIENT-GUIDE.md|1,?,3,?,?||Prepared from Teams Planner Excel dry-run
Supa Quick Centurion|e2870110-930c-4e63-b2fe-c858030f7258|SUPA-QUICK-CENTURION-CG-DYNAMICS-CLIENT-GUIDE.md|1,?,3,?,?||Prepared from Teams Planner Excel dry-run
TBS Brokers|a36ba938-e9dc-4ecf-bb67-4853608b1c01|TBS-BROKERS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|?,4,4,?,?|Four review/template posts and four design slots; a design slot may swap to video.|Flexible scope; no fixed extra video/animation quantity.
The Staffordshire|dfa47255-875d-43cf-8a22-cfe1a6247fb7|THE-STAFFORDSHIRE-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md|4,4,4,?,?|Additional posters on request; daily specials on Instagram Story and Facebook.|No fixed extra poster quantity.
Tobich Optics|204f4f22-14c7-42ed-a956-da57af102706|TOBICH-OPTICS-CG-DYNAMICS-CLIENT-GUIDE.md|?,4,4,?,?||Prepared from Teams Planner Excel dry-run
Toyota Bloemfontein|e2ad6d57-5b06-46e1-b75b-b67f017d57f1|TOYOTA-BLOEMFONTEIN-CG-DYNAMICS-CLIENT-GUIDE.md|4,?,?,?,?||Prepared from Teams Planner Excel dry-run
Vrystaat Kunstefees|1f0406bb-d643-4b83-bc3e-b1ebe87eeb89|VRYSTAAT-KUNSTEFEES-CG-DYNAMICS-CLIENT-GUIDE.md|?,?,?,?,?||
Watch Addict|e1cb958e-3f68-4a77-b5ea-b471ea62bdef|WATCH-ADDICT-CG-DYNAMICS-CLIENT-GUIDE.md|1,1,2,?,?||Prepared from Teams Planner Excel dry-run
We Ar Fuels|2b953772-e791-4dff-a278-d4dd3521f02e|WE-AR-FUELS-CG-DYNAMICS-CLIENT-GUIDE.md|1,4,3,?,?||Prepared from Teams Planner Excel dry-run
Wiseman Group|899c9988-8207-4e45-a8fc-a7446dfcf96b|WISEMAN-GROUP-CG-DYNAMICS-CLIENT-GUIDE.md|1,4,4,?,?||Prepared from Teams Planner Excel dry-run
WiseRide|504113ee-fba9-4993-807e-a86066615212|WISERIDE-CLIENT-INTELLIGENCE-2026-09.md|?,2,2,?,?|Video capacity shared with Wiseman Group and may feature Midas/WiseRide.|No fixed WiseRide video quantity.
Zooz Lifestyle WFF|0c01d90f-ba5e-4251-a597-bf3c83f990fa||?,?,?,?,?||
`.trim()

const SPECIAL_RESEARCH = {
  'Rusoord Farmstay': {
    source: 'https://www.rusoordfarmstay.co.za/',
    observed: '2026-09-23',
    facts: ['Working-farm venue and farmstay outside Middelburg in the Eastern Cape Upper Karoo.', 'Current first-party site presents cottages, a rondavel, weddings/venue use, farm activities, walking/cycling, picnics and stargazing.'],
    constraints: ['CG package authority is website-only; do not plan recurring social deliverables.', 'Current package does not establish a monthly website-update quantity.'],
    recommendations: ['Keep October work website-scoped: make accommodation types, venue use, activities and direct booking path easy to distinguish; do not invent a social calendar.'],
  },
  'Zooz Lifestyle WFF': {
    source: 'https://zoozlifestyle.co.za/',
    observed: '2026-09-23',
    facts: ['First-party site positions ZooZ around eating/training plans, fitness products and apparel.', 'Verified July/August report evidence also shows WFF South Africa athlete, event, registration and recognition content.'],
    constraints: ['Every package quantity remains unknown; strategy may define direction but not promise output volume.', 'Health/product claims require current substantiation and must not be repeated merely because an old page contains them.'],
    recommendations: ['Separate the WFF event/athlete narrative from ZooZ product/programme content, and use the confirmed audience action for each item (registration, ticketing, recognition or product enquiry).'],
  },
  Kundedienste: {
    source: PACKAGE_AUTHORITY,
    observed: '2026-09-23',
    facts: ['CA confirmed Kundedienste was once-off work, not a recurring social-management client.'],
    constraints: ['Exact business identity and current service objective are not verified.', 'No recurring content quantity or channel entitlement may be inferred.'],
    recommendations: [],
  },
}

function slug(value) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function parseRows() {
  return AUTHORITY_ROWS.split('\n').map(line => {
    const [name, id, guide, mix, other, notes] = line.split('|')
    const [video, photo, design, reel, animated] = mix.split(',')
    return { name, id, guide, package: { video, photo, design, reel, animated, other: other || null, notes: notes || null } }
  })
}

function clean(text) {
  return text.replace(/\[([^\]]+)]\([^\)]+\)/g, '$1').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim()
}

function findLocalResearch(row) {
  const runtime = join(RUNTIME_GUIDE_DIR, `${slug(row.name)}.md`)
  if (existsSync(runtime)) return runtime
  if (row.guide) {
    const exact = join(INTELLIGENCE_DIR, row.guide)
    if (existsSync(exact)) return exact
  }
  const aliases = {
    HMHI: ['HMH-ATTORNEYS-LYDENBURG-CLIENT-MARKETING-INTELLIGENCE-2026-08.md'],
    'Hino Trucks': ['HINO-ORANJE-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md'],
    Econofoods: ['ECONOFOODS-SOUTH-AFRICA-VIDEO-COMMERCIAL-PLAYBOOK-2026-08.md'],
    'Emoya Estate Driving Range': ['EMOYA-DRIVING-RANGE-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md'],
    'Emmanuel Funerals': ['EMMANUEL-FUNERAL-SERVICES-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md'],
    Germoparts: ['GERMOPARTS-BLOEMFONTEIN-MAJOR-CLIENT-MARKETING-INTELLIGENCE-2026-08.md'],
    'Bohemia Quick Stop': ['BOHEMIA-QUICK-SHOP-LIGHT-MARKETING-GUIDE-2026-08.md'],
  }
  const alias = aliases[row.name]?.find(file => existsSync(join(INTELLIGENCE_DIR, file)))
  if (alias) return join(INTELLIGENCE_DIR, alias)
  const tokens = row.name.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2 && !['and', 'the'].includes(token))
  const candidates = readdirSync(INTELLIGENCE_DIR).filter(file => file.endsWith('.md')).filter(file => {
    const normalized = file.toLowerCase()
    return tokens.length > 0 && tokens.every(token => normalized.includes(token))
  })
  return candidates.length === 1 ? join(INTELLIGENCE_DIR, candidates[0]) : null
}

function extractEvidence(markdown, runtimeGuide = false) {
  const sections = { facts: [], constraints: [], observations: [], recommendations: [] }
  let bucket = runtimeGuide ? null : 'facts'
  for (const raw of markdown.split(/\r?\n/)) {
    const heading = raw.match(/^#{1,4}\s+(.+)/)?.[1]?.toLowerCase()
    if (heading) {
      if (/avoid|constraint|guardrail|must not|risk|compliance|freshness|unknown|confirm/.test(heading)) bucket = 'constraints'
      else if (/recommend|strategy|opportunit|content pillar|campaign|next step|plan/.test(heading)) bucket = 'recommendations'
      else if (/performance|observation|competitor|pattern|signal|what happened/.test(heading)) bucket = 'observations'
      else if (!runtimeGuide || /business|brand|audience|product|service|offer|voice|identity|history|evidence|website|social|client truth|current/.test(heading)) bucket = 'facts'
      else bucket = null
      continue
    }
    if (!bucket || !/^\s*(?:[-*]|\d+\.)\s+/.test(raw)) continue
    const value = clean(raw.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''))
    if (value.length < 28 || value.length > 320 || /^(file|commit|issue|branch|status|source|date|scope):/i.test(value)) continue
    if (runtimeGuide && (/\.(?:md|tsx?|mjs|json)\b|github\.com\/CGProductionHouse\/CG-Dynamics\/(?:issues|pull)\//i.test(value))) continue
    if (!sections[bucket].includes(value) && sections[bucket].length < 6) sections[bucket].push(value)
  }
  return sections
}

function packageLines(pkg) {
  const labels = [['video', 'professional videos'], ['photo', 'photo posts'], ['design', 'design posters'], ['reel', 'reels'], ['animated', 'animated posters']]
  const known = labels.filter(([key]) => pkg[key] !== '?').map(([key, label]) => `${pkg[key]} ${label}/month`)
  const unknown = labels.filter(([key]) => pkg[key] === '?').map(([, label]) => label)
  return {
    known: known.length ? known.join('; ') : 'No fixed content quantity is confirmed.',
    unknown: unknown.length ? unknown.join(', ') : 'None among the five tracked content formats.',
  }
}

const snapshot = JSON.parse(readFileSync(REPORT_SNAPSHOT, 'utf8'))
const rows = parseRows()
const snapshotClients = new Map(snapshot.rows.map(row => [row.client.id, row.client.name]))
if (rows.length !== 56 || snapshotClients.size !== 56) throw new Error(`Expected 56 exact active clients; authority=${rows.length}, snapshot=${snapshotClients.size}`)
for (const row of rows) if (snapshotClients.get(row.id) !== row.name) throw new Error(`Identity mismatch for ${row.name}`)

mkdirSync(OUTPUT_DIR, { recursive: true })
const index = []
for (const row of rows) {
  const history = snapshot.rows.filter(item => item.client.id === row.id)
  const safe = history.filter(item => item.state !== 'withheld')
  const posts = safe.flatMap(item => item.included_posts ?? [])
  const special = SPECIAL_RESEARCH[row.name]
  const guidePath = findLocalResearch(row)
  const guide = guidePath ? readFileSync(guidePath, 'utf8') : ''
  const runtimeGuide = guidePath?.startsWith(RUNTIME_GUIDE_DIR)
  const extracted = guide ? extractEvidence(guide, runtimeGuide) : { facts: [], constraints: [], observations: [], recommendations: [] }
  for (const key of ['facts', 'constraints', 'recommendations']) {
    for (const value of special?.[key] ?? []) if (!extracted[key].includes(value)) extracted[key].push(value)
  }
  const packageTruth = packageLines(row.package)
  const blockers = []
  if (!guide && row.guide) blockers.push('PRODUCTION_GUIDE_RETRIEVAL_REQUIRED')
  if (!guide && !row.guide && !special) blockers.push('NO_REVIEWED_EXACT_CLIENT_RESEARCH')
  if (extracted.facts.length === 0 && !row.guide) blockers.push('NO_VERIFIED_BUSINESS_FACTS')
  if (extracted.recommendations.length === 0 && !row.guide) blockers.push('NO_EVIDENCE_BACKED_RECOMMENDATION')
  const sources = [runtimeGuide ? `production-client-guide:${basename(guidePath)}` : guidePath ? `docs/ai-workforce/client-intelligence/${basename(guidePath)}` : null, !guidePath && row.guide ? `production-client-guide:${row.guide}` : null, special?.source, PACKAGE_AUTHORITY, `artifact:${basename(REPORT_SNAPSHOT)}#${row.id}`].filter(Boolean)
  const hash = createHash('sha256').update(JSON.stringify({ row, sources, extracted, report_ids: safe.map(item => item.report?.id), post_ids: posts.map(post => post.id) })).digest('hex')
  const bullet = values => values.length ? values.map(value => `- ${value}`).join('\n') : '- No exact evidence available; do not fill this gap with generic copy.'
  const dossier = `# ${row.name} — strategy grounding dossier

Client ID: \`${row.id}\`

Issue: #513

Evidence hash: \`${hash}\`
Status: **dossier complete${blockers.length ? '; strategy gate blocked' : '; ready for gold-strategy drafting'}**

## Verified facts

${bullet(extracted.facts)}

## Confirmed package

- Known capacity: ${packageTruth.known}
- Unknown capacity: ${packageTruth.unknown}
${row.package.other ? `- Other agreed scope: ${row.package.other}` : ''}
${row.package.notes ? `- Constraint/note: ${row.package.notes}` : ''}

## Actual CG history

- Published/frozen client-month reports available: ${safe.length} of 3 (July–September 2026).
- Exact frozen post identities available: ${posts.length}.
- Available months: ${safe.map(item => item.month + (item.month === '2026-09' ? ' MTD' : '')).join(', ') || 'none'}.
- Missing history is unavailable evidence, not zero performance.

## Client and CG constraints

${bullet(extracted.constraints)}

## Research observations

${bullet(extracted.observations)}

## Evidence-backed recommendations

${bullet(extracted.recommendations)}

## Strategy gate blockers

${blockers.length ? blockers.map(value => `- \`${value}\``).join('\n') : '- None at dossier level. Package-bounded strategy still requires field-by-field quality review.'}

## Sources

${sources.map(source => `- ${source}`).join('\n')}
`
  const file = `${slug(row.name)}.md`
  writeFileSync(join(OUTPUT_DIR, file), dossier)
  index.push({ name: row.name, id: row.id, file, dossier_status: 'complete', strategy_status: blockers.length ? 'blocked' : 'ready', blockers, evidence_hash: hash, reports: safe.length, posts: posts.length })
}

const indexPayload = { schema_version: 1, issue: 513, generated_from_snapshot_cutoff: snapshot.snapshot_cutoff, package_authority: PACKAGE_AUTHORITY, active_client_count: index.length, dossier_complete_count: index.filter(row => row.dossier_status === 'complete').length, strategy_ready_count: index.filter(row => row.strategy_status === 'ready').length, strategy_blocked_count: index.filter(row => row.strategy_status === 'blocked').length, clients: index }
writeFileSync(join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(indexPayload, null, 2)}\n`)
const markdown = `# Issue #513 exact-client strategy dossier index

Generated from the immutable #501 recovery snapshot and the confirmed #504 package authority. One isolated dossier exists for every active client. A blocked dossier is intentionally not padded with generic strategy filler.

- Active clients: ${index.length}
- Dossiers complete: ${indexPayload.dossier_complete_count}
- Ready for gold-strategy drafting from repository evidence: ${indexPayload.strategy_ready_count}
- Strategy-gate blocked pending production-guide retrieval or missing exact evidence: ${indexPayload.strategy_blocked_count}

| Client | Reports | Posts | Status | Blockers |
|---|---:|---:|---|---|
${index.map(row => `| [${row.name}](./${row.file}) | ${row.reports} | ${row.posts} | ${row.strategy_status} | ${row.blockers.join(', ') || '—'} |`).join('\n')}
`
writeFileSync(join(OUTPUT_DIR, 'README.md'), markdown)
process.stdout.write(`${JSON.stringify({ output: OUTPUT_DIR, ...indexPayload }, null, 2)}\n`)

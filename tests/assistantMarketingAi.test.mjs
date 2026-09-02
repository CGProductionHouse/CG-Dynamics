import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const chatFn = read('../supabase/functions/cg-assistant-chat/index.ts')
const wfLib = read('../src/lib/marketingWorkflow.ts')

let server, parse
const CTX = {
  today: '2026-08-03',
  clients: [
    { id: 'c-dulux', name: 'Dulux' },
    { id: 'c-braize', name: 'Braize' },
    { id: 'c-action', name: 'Action Sport' },
  ],
  staffNames: ['Franco Nel'],
  role: 'team',
  currentClientId: null,
  currentClientName: null,
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ parseAssistantAction: parse } = await server.ssrLoadModule('/src/lib/assistantActions.ts'))
})
after(async () => { await server.close() })

// ── The documented commands ─────────────────────────────────────────────────
test('"create a campaign strategy for [client]" starts marketing work on the exact client', () => {
  const r = parse('Create a campaign strategy for Dulux', CTX)
  assert.equal(r.type, 'marketing.start')
  assert.equal(r.clientId, 'c-dulux')
  assert.equal(r.fields.specialist, 'marketing_strategist')
})

test('"write social copy for [client]" routes to the Copywriting Agent', () => {
  const r = parse('Write social copy for Braize', CTX)
  assert.equal(r.type, 'marketing.start')
  assert.equal(r.clientId, 'c-braize')
  assert.equal(r.fields.specialist, 'copywriting_agent')
})

test('"review this copy against the client brand" routes to the Brand Guardian', () => {
  const r = parse('Review this copy against the client brand and approved knowledge for Dulux', CTX)
  assert.equal(r.type, 'marketing.start')
  assert.equal(r.fields.specialist, 'brand_guardian')
})

test('a request with no explicit specialist routes automatically', () => {
  const r = parse('Build a marketing campaign for Action Sport', CTX)
  assert.equal(r.type, 'marketing.start')
  assert.equal(r.fields.specialist, 'auto')
})

test('"continue the marketing workflow" continues the existing artifact', () => {
  const r = parse('Continue the marketing workflow for Dulux', CTX)
  assert.equal(r.type, 'marketing.continue')
  assert.equal(r.clientId, 'c-dulux')
})

test('"show me drafts awaiting approval" lists pending work', () => {
  const r = parse('Show me drafts awaiting approval', CTX)
  assert.equal(r.type, 'marketing.list')
})

test('approve / reject / request changes each map to the right decision', () => {
  assert.equal(parse('Approve the latest marketing draft', CTX).fields.decision, 'approved')
  assert.equal(parse('Reject this campaign draft', CTX).fields.decision, 'rejected')
  assert.equal(parse('Request changes to the latest version of the copy', CTX).fields.decision, 'changes_requested')
})

// ── Afrikaans / mixed ───────────────────────────────────────────────────────
test('Afrikaans and mixed phrasing is understood', () => {
  assert.equal(parse('Skep n kampanje strategie vir Dulux', CTX).type, 'marketing.start')
  assert.equal(parse('Skryf sosiale kopie vir Braize', CTX).type, 'marketing.start')
  assert.equal(parse('Gaan voort met die bemarking werkvloei vir Dulux', CTX).type, 'marketing.continue')
  assert.equal(parse('Keur die kampanje konsep goed', CTX).fields.decision, 'approved')
  assert.equal(parse('Afkeur hierdie kampanje konsep', CTX).fields.decision, 'rejected')
})

// ── Never guess the client ──────────────────────────────────────────────────
test('an unnamed client is asked for, never guessed', () => {
  const r = parse('Create a campaign strategy', CTX)
  assert.ok(r.clarify, 'must ask which client')
  assert.match(r.clarify, /which active client/i)
})

test('an ambiguous client is asked for, never guessed', () => {
  const ctx = { ...CTX, clients: [{ id: 'a', name: 'Action Sport' }, { id: 'b', name: 'Action Sport Retail' }] }
  const r = parse('Create a campaign strategy for Action Sport', ctx)
  assert.ok(r.clarify, 'must disambiguate')
  assert.match(r.clarify, /Action Sport/)
})

test('the current page client is used when the request does not name one', () => {
  const ctx = { ...CTX, currentClientId: 'c-dulux', currentClientName: 'Dulux' }
  const r = parse('Write social copy for the new range', ctx)
  assert.equal(r.type, 'marketing.start')
  assert.equal(r.clientId, 'c-dulux')
})

// ── No collision with existing intents ──────────────────────────────────────
test('marketing phrasing never hijacks the existing sync, task or calendar actions', () => {
  assert.equal(parse('sync all connected meta clients', CTX).fields.job, 'meta_sync')
  assert.equal(parse('run a microsoft sync', CTX).type, 'microsoft.sync')
  assert.equal(parse('Add a Dulux meeting next Tuesday at 10', CTX).type, 'calendar.create')
  assert.equal(parse('Mark videos one and two as shot', CTX).type, 'video.mark_shot')
  // Task assignment still asks for the exact task rather than becoming a
  // marketing action; it is unaffected by the marketing detectors. PR #203
  // changed the clarification from "Open the Planner task first" to a
  // canonical task-match clarification.
  const task = parse('Assign this task to Franco for Friday', CTX)
  assert.ok(task.clarify, 'task assignment must still ask for the exact task')
  assert.match(task.clarify, /matching active task/i)
  assert.doesNotMatch(task.clarify, /Planner/i)
})

test('ordinary chat still falls through to conversation', () => {
  assert.equal(parse('What should I focus on today?', CTX), null)
  assert.equal(parse('How is the campaign going?', CTX), null)
})

// ── Composer behaviour ──────────────────────────────────────────────────────
test('the Assistant continues an existing artifact instead of duplicating records', () => {
  assert.match(composer, /findOpenArtifact\(p\.clientId\)/)
  assert.match(composer, /Continue the existing open artifact rather than duplicating records/)
  assert.match(wfLib, /\.in\('status', \['draft', 'in_review', 'changes_requested'\]\)/)
})

test('approve and reject are refused for non-managers in the Assistant too', () => {
  const branch = composer.slice(composer.indexOf("p.type === 'marketing.decide'"), composer.indexOf("p.type === 'microsoft.sync'"))
  assert.match(branch, /decision === 'approved' \|\| decision === 'rejected'\) && !isManager/)
  assert.match(branch, /restricted to managers and admins/)
  assert.match(branch, /You can request changes instead/)
})

test('a decision always targets the current version of the open artifact', () => {
  const branch = composer.slice(composer.indexOf("p.type === 'marketing.decide'"), composer.indexOf("p.type === 'microsoft.sync'"))
  assert.match(branch, /getCurrentVersion\(openArtifact\)/)
  assert.match(branch, /recordMarketingDecision\(\{/)
})

test('insufficient evidence and provider exhaustion are reported honestly', () => {
  assert.match(composer, /if \(result\.insufficientEvidence\)/)
  assert.match(composer, /Honest insufficient-evidence \/ provider-exhaustion result/)
  assert.match(composer, /Not enough approved knowledge to produce a grounded draft/)
})

test('the Assistant reports citations and points at the full artifact', () => {
  assert.match(composer, /citing \$\{cited\} approved card/)
  assert.match(composer, /Open it in Marketing AI to read the full draft/)
})

test('approving via the Assistant states plainly that nothing was published', () => {
  assert.match(composer, /Nothing was published or changed on the client record/)
})

test('stage progress is surfaced while a specialist runs', () => {
  assert.match(composer, /setMarketingNote/)
  assert.match(composer, /Handing off to the next specialist/)
  assert.match(composer, /Marketing AI<\/p>/)
})

// ── Truthful capability answers ─────────────────────────────────────────────
test('the chat function reads REAL Marketing AI state, not a static claim', () => {
  assert.match(chatFn, /async function getMarketingAiState/)
  assert.match(chatFn, /\.from\('skill_cards'\)[\s\S]{0,120}\.eq\('status', 'active'\)/)
  assert.match(chatFn, /\.from\('ai_marketing_artifacts'\)/)
  assert.match(chatFn, /getMarketingAiState\(sb\),/)
})

test('a specialist only counts as available when it has approved knowledge routed to it', () => {
  assert.match(chatFn, /A specialist can only work when it has approved knowledge routed to it/)
  assert.match(chatFn, /filter\(\(\[, n\]\) => n > 0\)/)
  assert.match(chatFn, /normaliseAgentKey\(String\(raw\)\)/)
})

test('Marketing AI is a real registry entry and is grounded only for relevant chat', () => {
  const entry = chatFn.slice(chatFn.indexOf("key: 'marketing-ai'"), chatFn.indexOf("key: 'cg-hours'"))
  assert.match(entry, /status: 'available'/)
  assert.doesNotMatch(entry, /Future connection/)
  assert.match(chatFn, /const marketingFacts = \/\\b\(marketing\|content\|caption\|copy\|brand\)\\b\/i\.test\(userMessage\) && marketingAiState/)
  assert.match(chatFn, /Marketing AI: \$\{marketingAiState\.live \? 'live with '/)
})

test('the prompt states the safety posture the workflow actually enforces', () => {
  assert.match(chatFn, /Marketing AI produces internal drafts only\. Approval is manager\/admin only\./)
})

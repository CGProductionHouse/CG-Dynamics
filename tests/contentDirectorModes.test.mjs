// #224 AI Content Director: ideas first, then develop the saved, staff-edited videos.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let m

const allowed = () => ({
  deliverableIds: new Set(['d1', 'd2']),
  months: new Set(['2026-09', '2026-10']),
  researchUris: new Set(['https://example.co.za/trend']),
})

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  m = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorModes.ts')
})

after(async () => {
  await server?.close()
})

test('modes are suggest, ideas and develop', () => {
  assert.deepEqual([...m.DIRECTOR_MODES], ['suggest', 'ideas', 'develop'])
  assert.ok(m.isDirectorMode('ideas'))
  assert.ok(!m.isDirectorMode('anything-else'))
})

test('idea titles are descriptive names without a video number prefix', () => {
  assert.equal(m.cleanIdeaTitle('"Video 3 - Colour matching at the counter"'), 'Colour matching at the counter')
  assert.equal(m.cleanIdeaTitle('Video 10 Tips for painters'), 'Video 10 Tips for painters')
  assert.equal(m.cleanIdeaTitle(42), '')
})

test('the client guide is trimmed at a paragraph boundary and marked', () => {
  const guide = `${'a'.repeat(200)}\n\n${'b'.repeat(400)}`
  const excerpt = m.clientGuideExcerpt(guide, 300)
  assert.ok(excerpt.length < guide.length)
  assert.match(excerpt, /\[Client guide truncated for length\.\]$/)
  assert.equal(m.clientGuideExcerpt('short guide', 300), 'short guide')
  assert.equal(m.clientGuideExcerpt(null), '')
})

test('ideas keep only well-formed entries and never invent a schedule link', () => {
  const raw = JSON.stringify({
    ideas: [
      { title: 'Colour matching at the counter', objective: 'Show the in-store service', hook: 'Bring the chip in', deliverableId: 'd1', targetMonth: '2026-09', evidence: [], needsConfirmation: null },
      { title: 'Missing hook', objective: 'x' },
      { title: 'Colour Matching at the Counter', objective: 'duplicate title', hook: 'again', deliverableId: 'd2' },
      { title: 'Second idea', objective: 'o', hook: 'h', deliverableId: 'd1', targetMonth: '2026-12' },
      { title: 'Third idea', objective: 'o', hook: 'h', deliverableId: 'not-a-slot' },
    ],
  })
  const ideas = m.parseIdeas(raw, allowed())
  assert.deepEqual(ideas.map(idea => idea.title), ['Colour matching at the counter', 'Second idea', 'Third idea'])
  assert.equal(ideas[0].deliverableId, 'd1')
  assert.equal(ideas[1].deliverableId, null, 'a slot is used at most once')
  assert.equal(ideas[1].targetMonth, null, 'months outside the coverage window are dropped')
  assert.equal(ideas[2].deliverableId, null, 'unknown slot ids are dropped')
})

test('fresh research must cite a real grounding source, otherwise it is inference', () => {
  const raw = JSON.stringify({
    ideas: [{
      title: 'Trend led idea',
      objective: 'o',
      hook: 'h',
      evidence: [
        { kind: 'fresh_research', note: 'cited', sourceUri: 'https://example.co.za/trend' },
        { kind: 'fresh_research', note: 'uncited claim', sourceUri: 'https://made-up.example/x' },
        { kind: 'client_fact', note: 'from the guide' },
        { kind: 'nonsense', note: 'unknown kind' },
      ],
    }],
  })
  const [idea] = m.parseIdeas(raw, allowed())
  assert.deepEqual(idea.evidence.map(item => [item.kind, item.sourceUri]), [
    ['fresh_research', 'https://example.co.za/trend'],
    ['inference', null],
    ['client_fact', null],
    ['inference', null],
  ])
})

test('ideas parse out of a fenced response and are capped', () => {
  const many = { ideas: Array.from({ length: 20 }, (_, index) => ({ title: `Idea ${index}`, objective: 'o', hook: 'h' })) }
  const ideas = m.parseIdeas('```json\n' + JSON.stringify(many) + '\n```', allowed())
  assert.equal(ideas.length, m.MAX_IDEAS)
})

test('developments are limited to the saved videos and returned in saved order', () => {
  const targets = [
    { id: 'v1', position: 1, title: 'One', objective: null, hook: null, notes: null, targetMonth: null, deliverableLabel: null },
    { id: 'v2', position: 2, title: 'Two', objective: null, hook: null, notes: null, targetMonth: null, deliverableLabel: null },
  ]
  const raw = JSON.stringify({
    developments: [
      { videoId: 'v2', script: 'Second script', shotBreakdown: '1. wide', requirements: 'paint', visualNotes: 'bright', cta: 'Visit us' },
      { videoId: 'v1', script: 'First script', cta: 'Come in' },
      { videoId: 'v1', script: 'duplicate' },
      { videoId: 'not-mine', script: 'other guideline' },
      { videoId: 'v2', script: '' },
    ],
  })
  const developments = m.parseDevelopments(raw, targets)
  assert.deepEqual(developments.map(item => [item.videoId, item.script]), [['v1', 'First script'], ['v2', 'Second script']])
  assert.equal(developments[0].shotBreakdown, '')
})

test('research findings are short bullet lines', () => {
  const findings = m.parseResearchFindings('- Painters are posting colour reveals\n* Second finding line here\n\nshort\n1) Third finding line here')
  assert.deepEqual(findings, ['Painters are posting colour reveals', 'Second finding line here', 'Third finding line here'])
})

test('the ideas prompt demands client grounding, real slot ids and no scripts', () => {
  const { system, user } = m.buildIdeasPrompt({
    clientName: 'Dulux Paint & Paper Bloemfontein',
    guideExcerpt: 'Dulux sells paint and wallpaper in Bloemfontein.',
    coverageMonths: ['2026-09'],
    slots: [{ id: 'd1', code: 'Video 1', title: 'September video', month: '2026-09-01', deliverableType: 'video' }],
    existingTitles: ['Already planned'],
    historicalTitles: ['Old concept'],
    marketingKnowledge: ['[universal_principle] Hook fast'],
    calendar: ['[public_holiday] Heritage Day (24 Sep)'],
    research: null,
  })
  assert.match(system, /IDEAS for this Content Run — not scripts/)
  assert.match(system, /Do NOT prefix it with "Video" or a number/)
  assert.match(system, /Never invent client facts/)
  assert.match(user, /id=d1/)
  assert.match(user, /Dulux sells paint and wallpaper/)
  assert.match(user, /NOT PERFORMED for this session/)
  assert.doesNotMatch(user, /another client|other client/i)
})

test('research findings and their sources are labelled as input, not truth', () => {
  const { user } = m.buildIdeasPrompt({
    clientName: 'Dulux',
    guideExcerpt: 'guide',
    coverageMonths: ['2026-09'],
    slots: [],
    existingTitles: [],
    historicalTitles: [],
    marketingKnowledge: [],
    calendar: [],
    research: { findings: ['Colour reveals are working'], sources: [{ title: 'Trend report', uri: 'https://example.co.za/trend' }] },
  })
  assert.match(user, /INPUT, not truth/)
  assert.match(user, /https:\/\/example\.co\.za\/trend/)
  assert.match(user, /already stale/)
})

test('the develop prompt preserves staff titles, order and edits', () => {
  const { system, user } = m.buildDevelopPrompt({
    clientName: 'Dulux',
    guideExcerpt: 'guide',
    marketingKnowledge: [],
    targets: [{ id: 'v1', position: 1, title: 'Colour matching', objective: 'Show service', hook: 'Bring the chip', notes: 'Staff note', targetMonth: '2026-09', deliverableLabel: 'Video 1' }],
  })
  assert.match(system, /Keep each video's title, objective, hook and order exactly as given/)
  assert.match(system, /"videoId","script","shotBreakdown","requirements","visualNotes","cta","notes"/)
  assert.match(user, /videoId=v1 \(position 1\)/)
  assert.match(user, /staff notes: Staff note/)
  assert.match(user, /do not rename or reorder/)
})

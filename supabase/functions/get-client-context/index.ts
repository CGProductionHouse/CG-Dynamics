// get-client-context — Task-scoped client context retrieval for ChatGPT bridge
//
// POST /get-client-context
// { client_id: uuid, task_type: TaskType, topic?: string, platform?: string }
//
// Returns a compact context packet with only the relevant slice for the requested
// task type. No broad whole-app scan. No cross-client leakage.
//
// Task types:
//   caption         — voice/tone, caption rules, CTA, contacts, guardrails, hashtags
//   content_idea    — strategy, content pillars, opportunities, audience
//   poster_copy     — poster copy rules, CTA, visual direction
//   image_edit      — image/branding/person/product preservation rules
//   factual_lookup  — verified facts, contacts, services, prices, provenance
//   campaign        — positioning, audience, channels, measurement
//   seo_hashtags    — hashtag rules, forbidden tags, industry terms, max count
//
// Client-isolation: exact UUID match enforced. No fuzzy client search.
// Auth: staff-only (admin/manager). Client-role users are denied.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { requireAdminOrManager } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TASK_TYPES = ['caption', 'content_idea', 'poster_copy', 'image_edit', 'factual_lookup', 'campaign', 'seo_hashtags'] as const
type TaskType = typeof TASK_TYPES[number]

interface ContextRequest {
  client_id: string
  task_type: TaskType
  topic?: string
  platform?: string
}

interface TaskContext {
  client_id: string
  client_name: string
  task_type: TaskType
  topic?: string
  platform?: string
  generated_at: string
  context: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  // ── Auth ──────────────────────────────────────────────────────────────
  const auth = await requireAdminOrManager(req)
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status)
  const { supabase } = auth.value

  // ── Parse request ─────────────────────────────────────────────────────
  let body: ContextRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400)
  }

  const { client_id, task_type, topic, platform } = body

  if (!client_id || typeof client_id !== 'string') {
    return jsonResponse({ error: 'client_id is required.' }, 400)
  }
  if (!task_type || !TASK_TYPES.includes(task_type)) {
    return jsonResponse({ error: `task_type must be one of: ${TASK_TYPES.join(', ')}` }, 400)
  }

  // ── Verify client exists and is active ────────────────────────────────
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, active')
    .eq('id', client_id)
    .maybeSingle()

  if (clientError || !client) {
    return jsonResponse({ error: 'Client not found.' }, 404)
  }
  if (!client.active) {
    return jsonResponse({ error: 'Client is not active.' }, 400)
  }

  // ── Load task-relevant skill cards (exact client match) ────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: cards } = await supabase
    .from('skill_cards')
    .select('id, slug, title, category, subcategory, principle, summary, why_it_matters, how_to_apply, mistakes_to_avoid, agent_instructions, relevant_agents, knowledge_layer, client_specific, active_client_id, status, review_expires_at')
    .eq('active_client_id', client_id)
    .eq('status', 'active')
    .eq('client_specific', true)

  // Filter expired cards
  const activeCards = (cards ?? []).filter(c => {
    if (!c.review_expires_at) return true
    return c.review_expires_at.slice(0, 10) >= today
  })

  // ── Build task-specific context ───────────────────────────────────────
  const context = buildTaskContext(task_type, activeCards, topic, platform)

  // ── Record retrieval timestamp ────────────────────────────────────────
  await supabase
    .from('client_project_mappings')
    .update({ last_context_retrieved_at: new Date().toISOString() })
    .eq('client_id', client_id)

  const result: TaskContext = {
    client_id,
    client_name: client.name,
    task_type,
    topic,
    platform,
    generated_at: new Date().toISOString(),
    context,
  }

  return jsonResponse(result)
})

// ── Task-specific context builder ──────────────────────────────────────────
// Returns only the slice relevant to the requested task type.
// No broad whole-app scan. No cross-client data.

function buildTaskContext(
  taskType: TaskType,
  cards: Array<Record<string, unknown>>,
  topic?: string,
  platform?: string,
): Record<string, unknown> {
  // Extract common card data
  const voiceCards = cards.filter(c => matchesCategory(c, ['voice', 'tone']))
  const captionCards = cards.filter(c => matchesCategory(c, ['caption', 'copy']))
  const imageCards = cards.filter(c => matchesCategory(c, ['image', 'visual', 'photo', 'editing']))
  const hashtagCards = cards.filter(c => matchesCategory(c, ['hashtag', 'seo', 'social']))
  const strategyCards = cards.filter(c => matchesCategory(c, ['strategy', 'positioning', 'audience']))
  const factualCards = cards.filter(c => matchesCategory(c, ['product', 'service', 'contact', 'factual']))
  const guardrailCards = cards.filter(c => matchesCategory(c, ['guardrail', 'avoid', 'mistake', 'correction']))

  switch (taskType) {
    case 'caption':
      return {
        task: 'caption',
        voice_rules: extractPrinciples(voiceCards),
        caption_rules: extractPrinciples(captionCards),
        cta_behaviour: extractField(captionCards, 'how_to_apply'),
        guardrails: extractPrinciples(guardrailCards),
        hashtag_rules: extractPrinciples(hashtagCards),
        hashtag_max: 5,
        platform_specific: platform ? `Optimise for ${platform}.` : null,
        topic,
        fresh_facts_required: true,
        instruct: 'Generate caption using only the rules above. Do not invent mutable facts. Use natural searchable language. Choose 3-5 hashtags dynamically for current topic/platform.',
      }

    case 'content_idea':
      return {
        task: 'content_idea',
        strategy: extractPrinciples(strategyCards),
        voice_rules: extractPrinciples(voiceCards),
        guardrails: extractPrinciples(guardrailCards),
        topic,
        instruct: 'Suggest content ideas grounded in the strategy and voice rules above. Each idea must be specific to this client. Do not recycle generic ideas.',
      }

    case 'poster_copy':
      return {
        task: 'poster_copy',
        voice_rules: extractPrinciples(voiceCards),
        caption_rules: extractPrinciples(captionCards),
        guardrails: extractPrinciples(guardrailCards),
        instruct: 'Write poster copy using only the rules above. Keep it concise and visual. Do not repeat text that will appear on the artwork/video.',
      }

    case 'image_edit':
      return {
        task: 'image_edit',
        image_rules: extractPrinciples(imageCards),
        brand_preservation: 'Preserve real people, products, branding, proportions, and composition. Change only what was explicitly requested.',
        guardrails: extractPrinciples(guardrailCards),
        instruct: 'Apply image edits using only the rules above. Never alter real people\'s faces, body proportions, or product appearance beyond what was requested.',
      }

    case 'factual_lookup':
      return {
        task: 'factual_lookup',
        factual_rules: extractPrinciples(factualCards),
        guardrails: extractPrinciples(guardrailCards),
        instruct: 'Return only verified facts from the rules above. If a fact cannot be confirmed, say so. Never invent prices, contacts, hours, stock, or operational details.',
      }

    case 'campaign':
      return {
        task: 'campaign',
        strategy: extractPrinciples(strategyCards),
        voice_rules: extractPrinciples(voiceCards),
        caption_rules: extractPrinciples(captionCards),
        hashtag_rules: extractPrinciples(hashtagCards),
        guardrails: extractPrinciples(guardrailCards),
        topic,
        instruct: 'Design the campaign using only the strategy, voice, and rules above. Every element must be grounded in verified client intelligence.',
      }

    case 'seo_hashtags':
      return {
        task: 'seo_hashtags',
        hashtag_rules: extractPrinciples(hashtagCards),
        hashtag_max: 5,
        platform,
        topic,
        instruct: 'Choose 3-5 hashtags dynamically for the current topic and platform. Use SEO/search-intent driven selection: exact brand term, exact content term, relevant local/industry term, and a current/trending term only when evidence supports it. Do not use trending tags that are irrelevant or geographically wrong.',
      }

    default:
      return { task: taskType, instruct: 'No specific context rules defined for this task type.' }
  }
}

function matchesCategory(card: Record<string, unknown>, keywords: string[]): boolean {
  const category = `${card.category ?? ''} ${card.subcategory ?? ''} ${card.title ?? ''}`.toLowerCase()
  return keywords.some(kw => category.includes(kw))
}

function extractPrinciples(cards: Array<Record<string, unknown>>): string[] {
  return cards
    .map(c => c.principle)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
}

function extractField(cards: Array<Record<string, unknown>>, field: string): string[] {
  const values: string[] = []
  for (const card of cards) {
    const val = card[field]
    if (Array.isArray(val)) {
      values.push(...val.filter((v): v is string => typeof v === 'string'))
    } else if (typeof val === 'string') {
      values.push(val)
    }
  }
  return values
}

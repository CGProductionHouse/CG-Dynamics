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
  scope_key?: string
  content_mode?: string
  topic?: string
  platform?: string
}

interface TaskContext {
  client_id: string
  client_name: string
  task_type: TaskType
  scope_key?: string
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
  const { supabase, user } = auth.value
  const { data: callerProfile, error: callerProfileError } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle()
  if (callerProfileError) return jsonResponse({ error: 'Authorization check unavailable.' }, 503)
  if (callerProfile?.is_active !== true) return jsonResponse({ error: 'Active staff access required.' }, 403)

  // ── Parse request ─────────────────────────────────────────────────────
  let body: ContextRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400)
  }

  const { client_id, task_type, scope_key, content_mode = 'caption', topic, platform } = body

  if (!client_id || typeof client_id !== 'string') {
    return jsonResponse({ error: 'client_id is required.' }, 400)
  }
  if (!task_type || !TASK_TYPES.includes(task_type)) {
    return jsonResponse({ error: `task_type must be one of: ${TASK_TYPES.join(', ')}` }, 400)
  }
  if (scope_key !== undefined && (typeof scope_key !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(scope_key))) {
    return jsonResponse({ error: 'scope_key must be a lowercase exact entity key.' }, 400)
  }
  if (typeof content_mode !== 'string' || !content_mode.trim() || content_mode.length > 80) {
    return jsonResponse({ error: 'content_mode must be a short non-empty value.' }, 400)
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
  let cardQuery = supabase
    .from('skill_cards')
    .select('id, slug, title, category, subcategory, principle, summary, why_it_matters, how_to_apply, mistakes_to_avoid, agent_instructions, relevant_agents, knowledge_layer, client_specific, active_client_id, client_scope_key, status, review_expires_at')
    .eq('active_client_id', client_id)
    .eq('status', 'active')
    .eq('client_specific', true)
  cardQuery = scope_key ? cardQuery.eq('client_scope_key', scope_key) : cardQuery.is('client_scope_key', null)
  const { data: cards, error: cardsError } = await cardQuery
  if (cardsError) return jsonResponse({ error: 'Client knowledge is unavailable.' }, 503)

  // Filter expired cards
  const activeCards = (cards ?? []).filter(c => {
    if (!c.review_expires_at) return true
    return c.review_expires_at.slice(0, 10) >= today
  })

  // ── Build task-specific context ───────────────────────────────────────
  const contactContext = task_type === 'caption' || task_type === 'poster_copy' || task_type === 'factual_lookup'
    ? await loadContactContext(supabase, client_id, scope_key ?? null, content_mode, platform ?? null)
    : null
  if (contactContext?.error) return jsonResponse({ error: contactContext.error }, 503)

  const context = buildTaskContext(task_type, activeCards, topic, platform, contactContext?.data ?? null)

  // ── Record retrieval timestamp ────────────────────────────────────────
  await supabase
    .from('client_project_mappings')
    .update({ last_context_retrieved_at: new Date().toISOString() })
    .eq('client_id', client_id)

  const result: TaskContext = {
    client_id,
    client_name: client.name,
    task_type,
    scope_key,
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
  contactContext?: Record<string, unknown> | null,
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
        contact_footer: contactContext,
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
        contact_footer: contactContext,
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
        public_contacts: contactContext,
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

async function loadContactContext(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  scopeKey: string | null,
  contentMode: string,
  platform: string | null,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  let contactQuery = supabase
    .from('client_contacts')
    .select('id,client_id,scope_key,contact_type,display_label,person_name,person_role,value,approved_for_caption,blocks_caption,visibility,provenance_summary,last_verified_at,freshness_state,lifecycle_state,platforms,content_modes,footer_order')
    .eq('client_id', clientId)
  contactQuery = scopeKey ? contactQuery.eq('scope_key', scopeKey) : contactQuery.is('scope_key', null)

  let policyQuery = supabase
    .from('client_contact_footer_policies')
    .select('client_id,scope_key,content_mode,platform,requirement,format_template,review_state,provenance_summary,last_verified_at')
    .eq('client_id', clientId)
    .eq('content_mode', contentMode)
  policyQuery = scopeKey ? policyQuery.eq('scope_key', scopeKey) : policyQuery.is('scope_key', null)

  const [{ data: contacts, error: contactsError }, { data: policies, error: policiesError }] = await Promise.all([
    contactQuery,
    policyQuery,
  ])
  if (contactsError || policiesError) return { data: null, error: 'Client contact policy is unavailable.' }

  const unresolved = (contacts ?? [])
    .filter(contact => contact.lifecycle_state === 'active' && (
      contact.visibility === 'unverified_hold' ||
      contact.freshness_state === 'possible_change' ||
      contact.freshness_state === 'stale_unverified'
    ))
    .map(contact => ({
      contact_id: contact.id,
      display_label: contact.display_label,
      reason: contact.visibility === 'unverified_hold'
        ? 'Contact is on unverified hold.'
        : `Contact freshness is ${contact.freshness_state}.`,
    }))

  const approved = (contacts ?? [])
    .filter(contact =>
      contact.lifecycle_state === 'active' &&
      contact.visibility === 'public_marketing' &&
      contact.approved_for_caption === true &&
      contact.freshness_state === 'current_verified' &&
      (!platform || contact.platforms.length === 0 || contact.platforms.includes(platform)) &&
      (contact.content_modes.length === 0 || contact.content_modes.includes(contentMode)),
    )
    .sort((a, b) => a.footer_order - b.footer_order || a.display_label.localeCompare(b.display_label))

  const policy = (policies ?? [])
    .filter(candidate => candidate.review_state === 'current_verified' && (candidate.platform === platform || candidate.platform === null))
    .sort((a, b) => Number(b.platform === platform) - Number(a.platform === platform))[0] ?? null
  const blockingUnresolved = (contacts ?? []).some(contact =>
    contact.lifecycle_state === 'active' && contact.blocks_caption === true && (
      contact.visibility === 'unverified_hold' ||
      contact.freshness_state === 'possible_change' ||
      contact.freshness_state === 'stale_unverified'
    ))
  const mandatoryMissing = policy?.requirement === 'mandatory' && approved.length === 0
  const blocked = blockingUnresolved || mandatoryMissing

  return {
    data: {
      requirement: policy?.requirement ?? 'unresolved',
      format_template: blocked ? null : policy?.format_template ?? null,
      contacts: blocked ? [] : approved.map(contact => ({
        contact_type: contact.contact_type,
        display_label: contact.display_label,
        person_name: contact.person_name,
        person_role: contact.person_role,
        value: contact.value,
        footer_order: contact.footer_order,
        provenance: contact.provenance_summary,
        last_verified_at: contact.last_verified_at,
      })),
      unresolved,
      can_generate_footer: !blocked && policy?.requirement !== 'omitted',
      blocked_reason: blockingUnresolved
        ? 'Contact conflict or freshness hold must be resolved before use.'
        : mandatoryMissing
          ? 'A footer is mandatory but no current caption-approved contact is available for this exact scope.'
          : null,
      exact_scope_only: true,
    },
    error: null,
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

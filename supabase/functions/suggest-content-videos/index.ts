// Suggest Content Videos — AI-assisted Content Guideline planning
//
// Staff select a client and coverage window; the function returns research-backed
// video suggestions grouped by target month, campaign or evergreen bucket.
//
// POST /suggest-content-videos
// { clientId, coverageStart, coverageEnd, existingVideoCount }

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SuggestRequest {
  clientId: string
  coverageStart: string
  coverageEnd: string
  existingVideoCount: number
}

interface ContentSuggestion {
  id: string
  targetMonth: string
  title: string
  objective: string
  hook: string
  reasoning: string
  suggestedScriptPreview: string
}

interface SuggestResponse {
  suggestions: ContentSuggestion[]
  context: {
    clientName: string
    industry: string | null
    coverageMonths: string[]
    totalDeliverableSlots: number
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error.' }, 500)

    const authHeader = request.headers.get('Authorization')
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return jsonResponse({ error: 'Authentication required.' }, 401)
    }

    const body: SuggestRequest = await request.json()
    const { clientId, coverageStart, coverageEnd, existingVideoCount } = body
    if (!clientId || !coverageStart || !coverageEnd) {
      return jsonResponse({ error: 'clientId, coverageStart and coverageEnd are required.' }, 400)
    }

    // Load client context
    const { data: client } = await supabase.from('clients').select('name, industry').eq('id', clientId).single()
    if (!client) return jsonResponse({ error: 'Client not found.' }, 404)

    // Compute coverage months from start/end
    const startDate = new Date(`${coverageStart}T00:00:00Z`)
    const endDate = new Date(`${coverageEnd}T00:00:00Z`)
    const coverageMonths: string[] = []
    let cursor = new Date(startDate)
    while (cursor <= endDate) {
      coverageMonths.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
      cursor.setMonth(cursor.getMonth() + 1)
    }

    // Count available future deliverables for this client in the coverage window
    const { count: deliverableCount } = await supabase
      .from('monthly_deliverables')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('deliverable_type', ['video', 'reel'])
      .gte('month', coverageStart)
      .lte('month', coverageEnd)
      .is('production_status', null)

    // Load existing approved concepts to avoid duplication
    const { data: existingConcepts } = await supabase
      .from('content_guide_ideas')
      .select('title, month, client_id')
      .eq('client_id', clientId)
      .in('status', ['approved', 'in_production', 'completed'])

    const existingTitles = new Set((existingConcepts ?? []).map(concept => concept.title.trim().toLowerCase()))

    // Generate month-aware suggestions using built-in logic
    // (AI provider integration can replace the static generator later)
    const suggestions: ContentSuggestion[] = []

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']

    const knownCampaignMoments: Record<string, string[]> = {
      '08': ['Back to School', 'Womens Month', 'Summer campaign launch'],
      '09': ['Spring campaign', 'Heritage Month (SA)'],
      '10': ['Halloween', 'OKTOBERFEST', 'Summer prep'],
      '11': ['Black Friday', 'Summer holidays begin', 'School year-end'],
      '12': ['Christmas/December holidays', 'Year-end review', 'New Year planning'],
      '01': ['New Year campaign', 'January back-to-work', 'Summer peak'],
      '02': ['Valentines Day', 'Back to School (SA)'],
      '03': ['Human Rights Day (SA)', 'Autumn campaign', 'Financial year-end prep'],
      '04': ['Easter', 'Freedom Day (SA)', 'Winter campaign prep'],
      '05': ['Workers Day (SA)', 'Mothers Day', 'Winter campaign'],
      '06': ['Youth Day (SA)', 'Mid-year review', 'Winter peak'],
      '07': ['Mandela Day', 'Sports events', 'Spring preview'],
    }

    for (let index = 0; index < Math.min(coverageMonths.length, 8); index++) {
      const monthKey = coverageMonths[index].slice(5, 7)
      const monthLabel = monthNames[parseInt(monthKey, 10) - 1] ?? `Month ${monthKey}`
      const moments = knownCampaignMoments[monthKey] ?? []

      const seasonalIdeas = [
        { base: `Seasonal highlight for ${monthLabel}`, obj: `Showcase ${client.name} relevance in ${monthLabel.toLowerCase()}`, hook: `This ${monthLabel}, ${client.name} has what you need` },
        { base: `${client.name} ${monthLabel} promotion`, obj: `Drive awareness for ${monthLabel.toLowerCase()} offer`, hook: `Make ${monthLabel.toLowerCase()} count with ${client.name}` },
      ]

      if (moments.length > 0) {
        for (const moment of moments.slice(0, 2)) {
          const title = `${client.name} | ${moment}`
          if (existingTitles.has(title.trim().toLowerCase())) continue
          suggestions.push({
            id: `suggest-${index}-${moment.slice(0, 10).replace(/\s+/g, '-').toLowerCase()}`,
            targetMonth: coverageMonths[index],
            title,
            objective: `Connect ${client.name} with ${moment.toLowerCase()} and drive customer engagement.`,
            hook: `${moment} is coming — ${client.name} is ready.`,
            reasoning: `${moment} is a relevant marketing moment for ${monthLabel}${client.industry ? ` in the ${client.industry} industry` : ''}.`,
            suggestedScriptPreview: `[Open with ${moment} context]\n[Introduce ${client.name} product/service]\n[Showcase value proposition]\n[Call to action]`,
          })
        }
      } else {
        const idea = seasonalIdeas[index % seasonalIdeas.length]
        if (existingTitles.has(idea.base.trim().toLowerCase())) continue
        suggestions.push({
          id: `suggest-${index}-seasonal`,
          targetMonth: coverageMonths[index],
          title: idea.base,
          objective: idea.obj,
          hook: idea.hook,
          reasoning: `Seasonal relevance for ${monthLabel}${client.industry ? ` in the ${client.industry} sector` : ''}. Aligns with client priorities.`,
          suggestedScriptPreview: `[Open with seasonal context for ${monthLabel}]\n[Present ${client.name} solution]\n[Highlight key benefits]\n[Call to action]`,
        })
      }
    }

    return jsonResponse({
      suggestions,
      context: {
        clientName: client.name,
        industry: client.industry,
        coverageMonths,
        totalDeliverableSlots: deliverableCount ?? 0,
      },
    })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})

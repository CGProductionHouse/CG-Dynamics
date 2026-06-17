import { supabase } from '../supabase'

// Editable strategy option library.
//
// The guided strategy engine selects from these option lists. They are global
// and admin-editable via the `strategy_options` table (see phase-3k migration),
// but the app ships with built-in DEFAULTS and falls back to them whenever the
// table is empty or not yet created — so everything keeps working before the
// migration is run, and team/client roles still see a full set of options.
//
// When an option is chosen into a report, the app stores the selected *label*
// inside that report's strategy_data. Editing the library here therefore never
// rewrites already-saved reports.

export type StrategyCategory =
  | 'client_direction'
  | 'why_it_worked'
  | 'strategy_driver'
  | 'client_action_required'
  | 'campaign_recommendation'
  | 'professional_video_action'
  | 'reels_action'
  | 'photo_content_action'
  | 'design_poster_action'
  | 'animated_poster_action'

export interface StrategyOption {
  id: string
  category: StrategyCategory
  label: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string | null
}

export const STRATEGY_CATEGORY_LABELS: Record<StrategyCategory, string> = {
  client_direction: 'Client direction',
  why_it_worked: 'Why it worked',
  strategy_driver: 'Strategy driver',
  client_action_required: 'Client actions required',
  campaign_recommendation: 'Campaign recommendation',
  professional_video_action: 'Professional video plan',
  reels_action: 'Reels plan',
  photo_content_action: 'Photo content plan',
  design_poster_action: 'Design poster plan',
  animated_poster_action: 'Animated poster plan',
}

// ─── built-in defaults ───────────────────────────────────────────────────────

function defs(category: StrategyCategory, labels: string[]): StrategyOption[] {
  return labels.map((label, index) => ({
    id: `default:${category}:${index}`,
    category,
    label,
    description: null,
    sort_order: index + 1,
    is_active: true,
  }))
}

export const DEFAULT_OPTIONS: Record<StrategyCategory, StrategyOption[]> = {
  client_direction: defs('client_direction', [
    'Promote a special',
    'Seasonal content',
    'Product or service push',
    'Event or launch',
    'More bookings / enquiries',
    'Build trust in the brand',
    'Explain what the business offers',
    'Push a specific product range',
    'Client requested a specific post',
    'Public holiday / special date content',
    'Campaign support',
  ]),
  why_it_worked: defs('why_it_worked', [
    'Clear offer',
    'Easy to understand quickly',
    'Strong opening line',
    'Useful information',
    'Relevant to the customer',
    'Timely or seasonal',
    'Good product/service showcase',
    'Showed the real business experience',
    'Strong before-and-after',
    'Behind-the-scenes or process content',
    'Strong local relevance',
    'Trend or sound helped',
    'Better visual quality',
    'Gave people a reason to comment or share',
    'Paid campaign support',
  ]),
  strategy_driver: defs('strategy_driver', [
    'Build on the strongest performing content style',
    'Connect the next content cycle to the client’s current offer',
    'Turn the strongest topic into a campaign',
    'Use more short-form video',
    'Use more product/service explanation',
    'Create more real business/customer experience content',
    'Support organic content with paid campaign budget',
    'Improve lead/enquiry tracking',
    'Prepare content around public holidays or key dates',
  ]),
  client_action_required: defs('client_action_required', [
    'Confirm the next month’s specials or offers',
    'Approve content direction',
    'Share product/service updates or news',
    'Provide photos, footage or product access for a shoot',
    'Confirm campaign budget',
    'Respond to enquiries/DMs promptly',
    'Share key dates or events coming up',
  ]),
  campaign_recommendation: defs('campaign_recommendation', [
    'No paid campaign recommended this month',
    'Boost the top-performing post',
    'Run a lead/enquiry campaign',
    'Run an offer/special campaign',
    'Run a reach/awareness campaign',
    'Run a seasonal or holiday campaign',
  ]),
  professional_video_action: defs('professional_video_action', [
    'Shoot a brand/story video',
    'Film a product or service showcase',
    'Capture a customer experience / testimonial',
    'Film a behind-the-scenes / process piece',
  ]),
  reels_action: defs('reels_action', [
    'Short-form trend-led reel',
    'Quick product/service explainer reel',
    'Behind-the-scenes reel',
    'Before-and-after reel',
    'Customer experience reel',
  ]),
  photo_content_action: defs('photo_content_action', [
    'Product/service photo set',
    'Team or business environment photos',
    'Customer experience photos',
    'Lifestyle / in-use photos',
  ]),
  design_poster_action: defs('design_poster_action', [
    'Promote a special or offer',
    'Announce an event or key date',
    'Explain a product or service',
    'Public holiday / seasonal greeting',
  ]),
  animated_poster_action: defs('animated_poster_action', [
    'Animated special / offer poster',
    'Animated event or launch poster',
    'Animated seasonal greeting',
  ]),
}

export function defaultOptionsFor(category: StrategyCategory): StrategyOption[] {
  return DEFAULT_OPTIONS[category] ?? []
}

// ─── data access (graceful when table is absent) ─────────────────────────────

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42P01 = undefined_table (Postgres). PostgREST also surfaces schema-cache
  // misses for unknown relations.
  if (error.code === '42P01') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache')
}

/**
 * Active options grouped by category. Always returns a usable map: if the table
 * is missing/empty, the built-in defaults are returned. `usingDefaults` tells
 * the UI whether editing is backed by the database yet.
 */
export async function listStrategyOptions(): Promise<{
  byCategory: Record<StrategyCategory, StrategyOption[]>
  usingDefaults: boolean
  error: string | null
}> {
  const { data, error } = await supabase
    .from('strategy_options')
    .select('*')
    .order('category')
    .order('sort_order')

  if (error) {
    if (tableMissing(error)) {
      return { byCategory: { ...DEFAULT_OPTIONS }, usingDefaults: true, error: null }
    }
    return { byCategory: { ...DEFAULT_OPTIONS }, usingDefaults: true, error: error.message }
  }

  const rows = (data ?? []) as StrategyOption[]
  if (rows.length === 0) {
    return { byCategory: { ...DEFAULT_OPTIONS }, usingDefaults: true, error: null }
  }

  const byCategory = {} as Record<StrategyCategory, StrategyOption[]>
  ;(Object.keys(DEFAULT_OPTIONS) as StrategyCategory[]).forEach(category => {
    const forCategory = rows.filter(row => row.category === category && row.is_active)
    byCategory[category] = forCategory.length > 0 ? forCategory : DEFAULT_OPTIONS[category]
  })
  return { byCategory, usingDefaults: false, error: null }
}

export async function createStrategyOption(input: {
  category: StrategyCategory
  label: string
  description?: string | null
  sort_order?: number
}) {
  const { data, error } = await supabase
    .from('strategy_options')
    .insert({
      category: input.category,
      label: input.label,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 999,
    })
    .select('*')
    .single()
  return { data: data as StrategyOption | null, error }
}

export async function updateStrategyOption(
  id: string,
  input: Partial<Pick<StrategyOption, 'label' | 'description' | 'sort_order' | 'is_active'>>
) {
  const { data, error } = await supabase
    .from('strategy_options')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  return { data: data as StrategyOption | null, error }
}

export async function deleteStrategyOption(id: string) {
  const { error } = await supabase.from('strategy_options').delete().eq('id', id)
  return { error }
}

export function isPersistedOption(option: StrategyOption) {
  return !option.id.startsWith('default:')
}

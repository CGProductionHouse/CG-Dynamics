// South African content calendar.
//
// Pure and deterministic — NO network calls at runtime. Computes South African
// public holidays (with the Sunday -> Monday observance rule and Easter-derived
// Good Friday / Family Day), plus the commercial and seasonal marketing dates a
// social team plans around. Used to surface "calendar suggestions" in the
// report workspace that can feed the Strategy going forward and Action plan.

export type CalendarCategory =
  | 'public_holiday'
  | 'commercial'
  | 'seasonal'
  | 'awareness_month'

export type DeliverableType =
  | 'professional_video'
  | 'reel'
  | 'photo_post'
  | 'design_poster'
  | 'animated_poster'
  | 'campaign'

export const DELIVERABLE_LABELS: Record<DeliverableType, string> = {
  professional_video: 'Professional video',
  reel: 'Reel',
  photo_post: 'Photo post',
  design_poster: 'Design poster',
  animated_poster: 'Animated poster',
  campaign: 'Campaign',
}

export interface CalendarEvent {
  id: string
  title: string
  // Specific calendar date (YYYY-MM-DD) for dated events, or null for
  // month-long themes (awareness months, seasonal build-ups).
  date: string | null
  month: string // YYYY-MM the event belongs to
  category: CalendarCategory
  relevanceHint: string
  suggestedAngle: string
  deliverables: DeliverableType[]
  // For public holidays shifted to the Monday by the Sunday observance rule.
  observed?: string
}

// --- date helpers -------------------------------------------------------------

function iso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function monthOf(dateStr: string) {
  return dateStr.slice(0, 7)
}

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for Easter Sunday.
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000)
}

// nth (1-indexed) weekday of a month. weekday: 0 = Sunday ... 6 = Saturday.
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month0, 1))
  const shift = (weekday - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month0, 1 + shift + (n - 1) * 7))
}

// --- month-long themes -------------------------------------------------------

interface MonthTheme {
  title: string
  relevanceHint: string
  suggestedAngle: string
  deliverables: DeliverableType[]
}

const MONTH_THEMES: Record<number, MonthTheme[]> = {
  // January
  0: [
    {
      title: 'New year fresh start',
      relevanceHint: 'Audiences are planning, resetting and buying for the year ahead.',
      suggestedAngle: 'Position the brand around fresh starts, new-year offers and back-to-routine needs.',
      deliverables: ['reel', 'design_poster', 'photo_post'],
    },
    {
      title: 'Back to school',
      relevanceHint: 'Families shop for school needs in mid-to-late January.',
      suggestedAngle: 'Run a back-to-school offer or checklist if relevant to the client.',
      deliverables: ['design_poster', 'photo_post', 'campaign'],
    },
  ],
  // February
  1: [
    {
      title: "Valentine's season",
      relevanceHint: 'February is love season — high engagement for gifts, dining, couples experiences and self-care offers.',
      suggestedAngle: "Run a Valentine's special, gift guide, couples experience or a treat-yourself promotion.",
      deliverables: ['design_poster', 'reel', 'campaign'],
    },
  ],
  // April — Easter month (Good Friday and Family Day fall here most years)
  3: [
    {
      title: 'Easter period',
      relevanceHint: 'Easter weekend is a high-traffic, family-focused long weekend — trading patterns shift and audiences are very active online.',
      suggestedAngle: 'Share trading hours and Easter specials at least a week before Good Friday.',
      deliverables: ['design_poster', 'photo_post', 'reel'],
    },
  ],
  // June
  5: [
    {
      title: 'Youth Month',
      relevanceHint: 'June is Youth Month in South Africa, centred on 16 June.',
      suggestedAngle: 'Highlight younger audiences, youth-led stories or youth-focused offers.',
      deliverables: ['reel', 'professional_video', 'design_poster'],
    },
  ],
  // July
  6: [
    {
      title: 'Mandela Month',
      relevanceHint: 'July is Nelson Mandela Month — Mandela Day (18 July) calls for 67 minutes of community action.',
      suggestedAngle: "Show the brand's community side. Share a Mandela Day initiative, a local cause, or a team giving-back story.",
      deliverables: ['professional_video', 'reel', 'photo_post'],
    },
    {
      title: 'Winter content opportunity',
      relevanceHint: 'Midwinter in South Africa — audiences respond to warmth, comfort and seasonal offers.',
      suggestedAngle: 'Promote winter specials, cosy experiences, hot products or seasonal deals.',
      deliverables: ['reel', 'photo_post', 'design_poster'],
    },
  ],
  // August
  7: [
    {
      title: "Women's Month",
      relevanceHint: "August is National Women's Month, centred on 9 August.",
      suggestedAngle: 'Celebrate women in the business and community; consider a women-focused campaign.',
      deliverables: ['professional_video', 'reel', 'design_poster', 'campaign'],
    },
  ],
  // September
  8: [
    {
      title: 'Heritage Month',
      relevanceHint: 'September is Heritage Month, building to Heritage Day on 24 September.',
      suggestedAngle: 'Lean into local culture, food, community and "proudly local" storytelling.',
      deliverables: ['professional_video', 'reel', 'photo_post'],
    },
  ],
  // October
  9: [
    {
      title: 'October year-end build',
      relevanceHint: 'October opens the final quarter — audiences start planning for year-end spending and Black Friday.',
      suggestedAngle: 'Begin end-of-year promotions, countdown content and early Black Friday teasers.',
      deliverables: ['campaign', 'design_poster', 'animated_poster', 'reel'],
    },
  ],
  // November
  10: [
    {
      title: 'Festive & Black Friday build-up',
      relevanceHint: 'November kicks off peak retail spend ahead of Black Friday and December.',
      suggestedAngle: 'Tease specials early and prepare campaign assets for Black Friday.',
      deliverables: ['campaign', 'design_poster', 'animated_poster', 'reel'],
    },
  ],
  // December
  11: [
    {
      title: 'Festive season',
      relevanceHint: 'December is peak gifting, dining and holiday activity.',
      suggestedAngle: 'Run festive specials, gift ideas, trading hours and year-end thank-yous.',
      deliverables: ['design_poster', 'animated_poster', 'reel', 'campaign'],
    },
  ],
}

// --- dated events for a given year -------------------------------------------

interface DatedSeed {
  title: string
  date: Date
  category: CalendarCategory
  relevanceHint: string
  suggestedAngle: string
  deliverables: DeliverableType[]
  isPublicHoliday?: boolean
}

function buildYearEvents(year: number): CalendarEvent[] {
  const easter = easterSunday(year)
  const goodFriday = addDays(easter, -2)
  const familyDay = addDays(easter, 1) // Easter Monday

  const seeds: DatedSeed[] = [
    {
      title: "New Year's Day",
      date: new Date(Date.UTC(year, 0, 1)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday and a natural fresh-start moment.',
      suggestedAngle: 'Open the year with a warm brand message or new-year offer.',
      deliverables: ['design_poster', 'reel'],
      isPublicHoliday: true,
    },
    {
      title: "Valentine's Day",
      date: new Date(Date.UTC(year, 1, 14)),
      category: 'commercial',
      relevanceHint: 'Strong commercial date for gifting, dining and couples offers.',
      suggestedAngle: "Run a Valentine's special, gift guide or booking push if relevant.",
      deliverables: ['design_poster', 'reel', 'campaign'],
    },
    {
      title: 'Human Rights Day',
      date: new Date(Date.UTC(year, 2, 21)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday with a reflective, community tone.',
      suggestedAngle: 'Share a respectful brand acknowledgement; keep it non-promotional.',
      deliverables: ['design_poster'],
      isPublicHoliday: true,
    },
    {
      title: 'Good Friday',
      date: goodFriday,
      category: 'public_holiday',
      relevanceHint: 'Public holiday (Easter weekend); trading patterns shift.',
      suggestedAngle: 'Share trading hours and any Easter-weekend specials early.',
      deliverables: ['design_poster'],
      isPublicHoliday: true,
    },
    {
      title: 'Family Day',
      date: familyDay,
      category: 'public_holiday',
      relevanceHint: 'Easter Monday public holiday focused on family time.',
      suggestedAngle: 'Family-oriented message or Easter offer wrap-up.',
      deliverables: ['photo_post', 'design_poster'],
      isPublicHoliday: true,
    },
    {
      title: 'Freedom Day',
      date: new Date(Date.UTC(year, 3, 27)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday commemorating the 1994 elections.',
      suggestedAngle: 'Respectful acknowledgement; tie to local pride if natural.',
      deliverables: ['design_poster'],
      isPublicHoliday: true,
    },
    {
      title: "Workers' Day",
      date: new Date(Date.UTC(year, 4, 1)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday recognising workers.',
      suggestedAngle: 'Thank the team or highlight the people behind the business.',
      deliverables: ['photo_post', 'design_poster'],
      isPublicHoliday: true,
    },
    {
      title: "Mother's Day",
      date: nthWeekday(year, 4, 0, 2),
      category: 'commercial',
      relevanceHint: 'Second Sunday of May — major gifting and dining date.',
      suggestedAngle: "Mother's Day gift ideas, specials or bookings.",
      deliverables: ['design_poster', 'reel', 'campaign'],
    },
    {
      title: 'Youth Day',
      date: new Date(Date.UTC(year, 5, 16)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday central to Youth Month.',
      suggestedAngle: 'Spotlight youth stories, staff or youth-relevant offers.',
      deliverables: ['reel', 'professional_video', 'design_poster'],
      isPublicHoliday: true,
    },
    {
      title: "Father's Day",
      date: nthWeekday(year, 5, 0, 3),
      category: 'commercial',
      relevanceHint: 'Third Sunday of June — gifting and dining date.',
      suggestedAngle: "Father's Day gift ideas, specials or bookings.",
      deliverables: ['design_poster', 'reel', 'campaign'],
    },
    {
      title: 'Nelson Mandela Day',
      date: new Date(Date.UTC(year, 6, 18)),
      category: 'commercial',
      relevanceHint: 'Mandela Day — 67 minutes of community action. Strong for community, social-good and local-pride content.',
      suggestedAngle: "Share a community initiative, highlight a team giving-back story, or acknowledge Madiba's legacy.",
      deliverables: ['photo_post', 'reel', 'professional_video'],
    },
    {
      title: "National Women's Day",
      date: new Date(Date.UTC(year, 7, 9)),
      category: 'public_holiday',
      relevanceHint: "Public holiday central to Women's Month.",
      suggestedAngle: 'Celebrate women in the business and community.',
      deliverables: ['professional_video', 'reel', 'design_poster'],
      isPublicHoliday: true,
    },
    {
      title: 'Heritage Day',
      date: new Date(Date.UTC(year, 8, 24)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday ("Braai Day"), strong for local culture.',
      suggestedAngle: 'Proudly-local content, food, community and heritage stories.',
      deliverables: ['professional_video', 'reel', 'photo_post'],
      isPublicHoliday: true,
    },
    {
      title: 'Black Friday',
      date: addDays(nthWeekday(year, 10, 4, 4), 1),
      category: 'commercial',
      relevanceHint: 'Day after the 4th Thursday of November — peak sales event.',
      suggestedAngle: 'Headline specials with campaign support; prepare assets in advance.',
      deliverables: ['campaign', 'animated_poster', 'design_poster', 'reel'],
    },
    {
      title: 'Day of Reconciliation',
      date: new Date(Date.UTC(year, 11, 16)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday with a unity and reflection tone.',
      suggestedAngle: 'Respectful acknowledgement; festive build-up can begin.',
      deliverables: ['design_poster'],
      isPublicHoliday: true,
    },
    {
      title: 'Christmas Day',
      date: new Date(Date.UTC(year, 11, 25)),
      category: 'public_holiday',
      relevanceHint: 'Peak festive date; trading hours and goodwill messaging matter.',
      suggestedAngle: 'Festive greeting, trading hours and year-end thank-you.',
      deliverables: ['animated_poster', 'design_poster', 'reel'],
      isPublicHoliday: true,
    },
    {
      title: 'Day of Goodwill',
      date: new Date(Date.UTC(year, 11, 26)),
      category: 'public_holiday',
      relevanceHint: 'Public holiday; quieter, goodwill-focused tone.',
      suggestedAngle: 'Light festive content or a year-end reflection.',
      deliverables: ['design_poster'],
      isPublicHoliday: true,
    },
  ]

  return seeds.map(seed => {
    const dateStr = iso(seed.date)
    const event: CalendarEvent = {
      id: `${dateStr}-${seed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      title: seed.title,
      date: dateStr,
      month: monthOf(dateStr),
      category: seed.category,
      relevanceHint: seed.relevanceHint,
      suggestedAngle: seed.suggestedAngle,
      deliverables: seed.deliverables,
    }
    // Sunday observance rule: a public holiday on a Sunday is observed the
    // following Monday.
    if (seed.isPublicHoliday && seed.date.getUTCDay() === 0) {
      event.observed = iso(addDays(seed.date, 1))
    }
    return event
  })
}

// --- public API --------------------------------------------------------------

/**
 * All calendar events that fall within the given month (YYYY-MM), including
 * any month-long awareness/seasonal themes. Deterministic and offline.
 */
export function getMonthEvents(month: string): CalendarEvent[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return []
  const year = Number(match[1])
  const month0 = Number(match[2]) - 1

  const dated = buildYearEvents(year).filter(event => event.month === month)

  const themes: CalendarEvent[] = (MONTH_THEMES[month0] ?? []).map(theme => ({
    id: `${month}-theme-${theme.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    title: theme.title,
    date: null,
    month,
    category: 'awareness_month' as CalendarCategory,
    relevanceHint: theme.relevanceHint,
    suggestedAngle: theme.suggestedAngle,
    deliverables: theme.deliverables,
  }))

  return [...themes, ...dated].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date) return 1
    if (b.date) return -1
    return 0
  })
}

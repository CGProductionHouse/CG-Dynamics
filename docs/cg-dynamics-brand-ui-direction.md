# CG Dynamics — Brand UI Direction

> Translate CG Production House brand identity into a practical internal operations interface. The app should feel like a production house built its own OS — not a generic admin panel with teal buttons.

---

## 1. What the Current Internal App Gets Wrong

| Issue | Detail |
|---|---|
| **Teal body text** | `text-brand-primary` (`#0f766e`) is used for descriptions, labels, metadata — makes everything look flat and greenish instead of readable |
| **Too many PremiumCards** | Every section, stat, form, and task row wraps in `bg-brand-surface border border-brand-muted rounded-2xl` — creates a uniform card sea with no hierarchy |
| **Too wordy** | "Paste Amonique's WhatsApp to-do list and create tasks." — the user knows what the button does. Every section has explanatory text that slows scanning |
| **Same pattern everywhere** | Every page has `text-xs uppercase tracking-wider text-brand-accent/80` eyebrow + `text-white font-black` heading + gradient divider — formulaic, not functional |
| **No urgency palette** | Only teal and white. No copper/orange/amber to signal priority, deadlines, warnings |
| **PlannerPage is generic** | Uses the same header pattern as every other page. The board area should feel like Teams Planner — compact, dense, practical |
| **Dashboard has fluff** | Quick shortcuts (redundant with nav) and "More sections" cards (also redundant) pad the page without adding utility |
| **Low information density** | Lots of whitespace, lots of card padding. Staff need to see more tasks at once, not more empty space |
| **Mobile is crowded** | Forms and cards don't collapse well. Filter/search/task areas compete for screen |

## 2. CG Brand Examples — Key Observations

From reviewing brand design examples in `docs/cgbrand-examples/`:

- **Dark cinematic base** — true black or deep charcoal (`#0a0a0a`, `#111111`), not dark teal
- **Typography is bold and condensed** — headlines use tight tracking, high weight, minimal letter-spacing
- **Teal is a glow, not a coat** — teal/emerald used sparingly: small accent bars, highlights, hover states. Never large text areas
- **Copper/warmth** — amber, copper, warm gold used for emphasis, calls-to-action, priority signals
- **Minimal copy** — headlines are 1–3 words. No taglines, no explanations
- **Photography-led** — CG brand examples use high-contrast imagery with text overlay. In the app, translate this as high-contrast typography on dark fields

## 3. Colour Usage Rules

| Token | Usage | Why |
|---|---|---|
| **White (`#ffffff`)** | Primary body text, headings, active nav items | Maximum contrast on dark background |
| **Off-white (`#e8e8e8` / `text-white`)** | Task titles, form labels, primary UI text | Clean, readable, authoritative |
| **Muted grey (`#6b7280` / `text-brand-primary/50-70`)** | Secondary text, metadata, timestamps, hints | Puts focus on actionable content |
| **Teal (`#2dd4bf`)** | Accent only: active tab, selected state, icon highlight, small badge, hover underline | Keeps teal special, not everywhere |
| **Deep teal (`#134e4a`)** | Subtle borders, dividers, muted UI chrome | Defines space without drawing attention |
| **Amber/copper (`#f59e0b`, `#d97706`)** | Urgency, priority, warnings, deadlines, blocked status | Warmth signals "pay attention" without alarmist red |
| **Red (`#ef4444`)** | Errors only, destructive actions | Avoid overuse; red = broken, not busy |
| **Green/teal (`#2dd4bf`)** | Done, completed, positive counts | Success feels good in teal |
| **Near-black (`#0a1412`)** | Page background, large fields | Cinematic base, never pure black |

### Colour rules summary
- `text-brand-accent` = teal highlight, never body text
- `text-brand-primary` = should be muted grey (currently teal — needs fixing)
- White = readable text, titles, active states
- Amber = urgency, deadlines, blocked items
- Red = errors only

## 4. Typography Rules

- **Headings**: `font-black tracking-tight` — tight, bold, confident. Max 3 words where possible
- **Body text**: `font-normal text-sm` — never teal, always white or muted grey
- **Labels/form fields**: `text-xs` or `text-[11px]` — secondary, muted
- **Stat values**: `text-2xl font-semibold` — large numbers, white
- **Buttons**: `text-sm font-semibold` — clear, actionable
- **Status/priority pills**: `text-xs font-medium` — compact, colour-coded
- **Avoid**: long descriptions, multi-sentence explanations, marketing-style headers

## 5. Board/Task Card Rules

- **Dark shell** — page background is `bg-brand-bg`, board areas sit directly on it
- **Light task cards** — inside Planner-style boards, use `bg-white/[0.05]` or `bg-brand-surface/50` for cards that need to be distinguishable but not heavy. Use `bg-white` or `bg-white/90` if readability demands it
- **Compact padding** — task cards: `p-2` or `p-3`, not `p-4 sm:p-5`
- **No nested PremiumCards** — a task row inside a card should be a flat `<div>` with a left accent bar, not another card
- **Left accent bars** — colour-coded priority indicator (`w-0.5 rounded-full bg-{priority-color}`)
- **Buckets/columns** — in Planner, columns are `w-64 shrink-0` with `bg-transparent` and a dashed border, not full cards
- **Status dropdowns** — compact, inline, `text-xs`

## 6. Dashboard Rules

- **Stat cards**: compact `p-3`, no border radius larger than `rounded-xl`, small icon, large number, tiny label
- **No "More sections" cards** — nav handles section discovery
- **No "Quick shortcuts"** — duplicates nav
- **Primary actions**: 4 compact grid cards with icon + title + tiny description (1 line max)
- **Task preview list**: flat rows with accent bars, no card nesting
- **Forms**: collapsible or compact by default

## 7. Form Rules

- **Compact by default** — inline fields where possible, stacked fields only on mobile
- **Labels**: `text-[11px] text-brand-primary/60` — small, muted, above field
- **Fields**: `bg-brand-bg border border-brand-muted/60` — dark inputs that don't jump out
- **Focus ring**: `ring-1 ring-brand-accent` — teal only on interaction
- **Buttons**: `bg-brand-accent text-brand-bg` for primary, `border border-brand-muted` for secondary
- **Avoid**: explanatory text above forms. The heading is enough

## 8. Mobile Rules

- **Bottom nav** for primary sections (already done — keep this)
- **Cards collapse** to full width
- **Forms** stack vertically
- **Filter/search** stays sticky if needed
- **Reduce** stat cards from 6 to 3–4 on mobile
- **No horizontal scroll** unless it's a board

## 9. What Not to Do

- ❌ Do not use teal for body text or descriptions
- ❌ Do not wrap every element in a `PremiumCard`
- ❌ Do not add explanatory text under headings ("View today's team tasks, statuses and update progress.")
- ❌ Do not add "More sections" or "Quick shortcuts" blocks — nav handles this
- ❌ Do not use the same header pattern on every page (eyebrow + huge heading + gradient line)
- ❌ Do not add marketing-style cards to the internal app
- ❌ Do not decorate without purpose
- ❌ Do not use `text-brand-primary` as the only secondary text colour

## 10. Good CG Dynamics UI (Examples)

> Examples are principles, not pixel specs.

- **Planner board tabs**: Pill-shaped, compact, teal for active, muted for inactive. The board area is light/neutral inside, dark shell outside. Task cards are white/borderless with coloured left bars
- **Dashboard**: 4 compact action cards at top, stat row below, filtered task list below that. No Marketing fluff, no redundant links
- **Command Centre**: Tabs at top (All / My tasks / Staff X), compact task rows with inline status, morning import collapses into a button until opened
- **Stat cards**: Small card, big number, tiny label, subtle icon. No border. Just the number and what it means
- **Form**: Title + client + staff + due date in one row. Button at end. No "Create a new task for the team." text

## 11. Bad CG Dynamics UI (Current Examples)

- **AdminHomePage secondary section cards**: "Client Performance Dashboard" + "CG Hub" — these are already in the nav. They're decorative.
- **"Quick shortcuts" section**: Links to CG Hub, Reports, Clients, Integrations — all nav items. Redundant.
- **CommandCentrePage header text**: "Daily tasks, client requests, staff progress and WhatsApp-ready summaries." — redundant, the heading says enough.
- **Every page eyebrow + large heading + gradient line**: Same pattern, no page identity.
- **PremiumCard around every task row**: A task row should be a compact row, not a card.

## 12. Priority for Full Redesign

1. **Planner board area** — needs full board/column/card UI (future phase)
2. **Command Centre task rows** — compact, inline status changes (partially done)
3. **Admin Home dashboard** — remove fluff, increase density
4. **CG Hub** — reduce card count, improve information density
5. **Assistant page** — compact chat interface without card wrapping
6. **Mobile** — compact forms, shorter stat rows

---

*Last updated: 2026-06-29*

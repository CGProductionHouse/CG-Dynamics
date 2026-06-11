# CG Dynamics — Phase 3 Build Specification

> **For Claude Code.** This is the single source of truth for Phase 3.
> Build it phase by phase (3a → 3f). Do not skip ahead. After each phase,
> stop and tell CA what to verify before continuing.

---

## 1. Context

CG Dynamics is a client analytics + strategy platform built by CG Production House
(a social media agency in South Africa). Clients log in and see their social media
performance dashboards plus a monthly/quarterly **Strategy Page** written by the
agency with AI assistance.

**Already built and working (do not rebuild):**
- Vite + React 19 + TypeScript + Tailwind CSS v3 + React Router v6
- Supabase project connected (`.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`)
- Auth: `src/lib/supabase.ts`, `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`,
  `src/pages/Signup.tsx`, `src/pages/LandingPage.tsx`, routes in `src/App.tsx`
- Brand tokens in `tailwind.config.js`:
  - `brand.primary` #0f766e · `brand.accent` #2dd4bf · `brand.bg` #0a1412
  - `brand.surface` #0f1f1c · `brand.muted` #134e4a
- Dark theme. Logo assets in `public/`.

**Working dir:** `C:\Projects\CG-Dynamics` · **Repo:** github.com/CGProductionHouse/CG-Dynamics

---

## 2. Users & roles

| Role | Who | Can do |
|---|---|---|
| `admin` | CA (info@cgproductionhouse.com) | Everything: manage clients, users, reports, publish |
| `team` | CG staff (Ger-Marie, Sydney, …) | Create/edit reports, upload CSVs, tag posts, edit strategy, log client requests. CANNOT add/delete clients or manage users. |
| `client` | Client staff (e.g. Red Oak) | View ONLY their own client's **published** reports. Nothing else. |

Roles live in a `profiles` table keyed to `auth.users`. New signups default to role
`client` with `client_id = null` (they see an empty "ask your account manager" state
until an admin assigns them). Admin assigns roles + client links from the admin UI.

---

## 3. Core concepts

- **Client** — a business CG manages (first: Red Oak). Tier `premium` (monthly) or `standard` (quarterly).
- **Report** — one per client + platform + period. E.g. "Red Oak · Facebook · May 2026".
  Status `draft` (team only) → `published` (client can see).
- **Posts** — rows parsed from the Meta CSV export, each tagged with a **category**:
  `photo` | `video` | `poster` | `animated_poster`.
- **Strategy Page** — the heart of every report. Sections:
  1. **Best performing poster** of the period (auto-picked by reach, editable commentary)
  2. **Best performing video** of the period (same)
  3. **Previous period's goal/theme** (auto-pulled from previous report's `next_theme`)
  4. **Strategy for next period** (reflection on data; AI drafts, team edits)
  5. **Post direction** (what to shoot/design next period, applies to all posts)
  6. **Client requests** (anything the client asked for — logged anytime by the team)
  7. **Boost recommendation** (which post/type to put spend behind next period + why)
  8. **Next period theme** (e.g. "Rugby World Cup", "Winter warmers") — becomes item 3 of the NEXT report
- **Client request** — standalone log entry against a client ("Cape Lumber asked for X
  on 11 June"). Open requests automatically surface when the team builds that client's
  next report, and can be marked addressed.

---

## 4. Database schema (Phase 3a)

Generate a single SQL file `supabase/schema.sql` that CA pastes into the Supabase SQL
editor. Use `uuid` PKs with `gen_random_uuid()`, `timestamptz` defaults `now()`.

```sql
-- profiles: one row per auth user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'client' check (role in ('admin','team','client')),
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'standard' check (tier in ('standard','premium')),
  logo_url text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','tiktok')),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','published')),
  -- Strategy Page fields
  theme_previous text,          -- auto-copied from previous report's theme_next
  theme_next text,              -- e.g. 'Rugby World Cup'
  best_poster_post_id uuid,     -- FK to posts, set after upload
  best_poster_commentary text,
  best_video_post_id uuid,
  best_video_commentary text,
  strategy_reflection text,     -- 'Strategy for next month through reflecting'
  post_direction text,          -- direction for all posts next period
  boost_recommendation text,
  ai_draft jsonb,               -- raw AI suggestions before human edit
  published_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (client_id, platform, period_start)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  meta_post_id text,
  publish_time timestamptz,
  meta_post_type text,          -- 'Photos' | 'Videos' as Meta exports it
  category text check (category in ('photo','video','poster','animated_poster')),
  category_source text default 'ai' check (category_source in ('ai','manual')),
  caption text,                 -- merged: Title (Photos) / Description (Videos)
  permalink text,
  views int default 0,
  reach int default 0,
  reactions int default 0,
  comments int default 0,
  shares int default 0,
  total_clicks int default 0,
  views_organic int default 0,
  views_boosted int default 0,
  reach_organic int default 0,
  reach_boosted int default 0,
  avg_seconds_viewed numeric,
  demographics jsonb,           -- {age_gender: {...}, countries: {...}}
  raw jsonb not null,           -- full original CSV row, always keep
  created_at timestamptz default now()
);

create table client_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  request_text text not null,
  status text not null default 'open' check (status in ('open','addressed')),
  addressed_in_report uuid references reports(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

**Row-Level Security — enable on every table.** Policy logic:
- Helper: `is_staff()` = exists profile where id = auth.uid() and role in ('admin','team').
- `profiles`: user can read own row; admin can read/update all.
- `clients`: staff full read; **only admin** insert/update/delete; clients can read
  their own client row (id = their profile.client_id).
- `reports`: staff full read/write; clients can `select` only rows where
  `client_id = their client_id AND status = 'published'`.
- `posts`: staff full read/write; clients can select posts whose report is published
  and belongs to their client.
- `client_requests`: staff full read/write; clients no access (internal tool).

Also create a Postgres trigger: on insert into `auth.users`, create a `profiles` row
(role 'client'). Supabase standard pattern (`handle_new_user()` security definer).

**Seed data:** insert Red Oak (`tier = 'premium'`). Then instruct CA to run one manual
UPDATE setting her profile role to 'admin' (provide the SQL with her email lookup).

---

## 5. App structure (Phase 3b onward)

```
src/
  lib/supabase.ts            (exists)
  lib/csv/parseMetaCsv.ts    -- CSV → ParsedPost[]
  lib/ai/tagPosts.ts         -- AI categorisation
  lib/ai/draftStrategy.ts    -- AI strategy draft
  contexts/AuthContext.tsx   (exists; extend to load profile + role)
  components/...             -- shared UI (StatTile, CategoryBadge, Chart wrappers)
  pages/
    Login.tsx / Signup.tsx / LandingPage.tsx   (exist)
    admin/
      AdminLayout.tsx        -- sidebar nav, staff-only guard
      ClientsList.tsx        -- /admin
      ClientDetail.tsx       -- /admin/clients/:id  (reports list + requests log)
      ReportEditor.tsx       -- /admin/reports/:id  (tabs: Upload, Posts, Strategy, Publish)
      UsersAdmin.tsx         -- /admin/users (admin only: assign roles + client links)
    client/
      Dashboard.tsx          -- /dashboard (client home: latest published report)
      ReportView.tsx         -- /dashboard/reports/:id
```

Routing guards: `RequireStaff`, `RequireAdmin`, `RequireClient` wrapper components
reading role from AuthContext. After login: staff → `/admin`, client → `/dashboard`.

Charts: use **recharts** (`npm i recharts`). Keep charts simple: bar chart for
category comparison, line chart for period-over-period trends.

---

## 6. CSV upload + parsing (Phase 3c)

Source: Meta Business Suite → Insights → Content → Export, presets
Published + Performance + Audience, Lifetime, Post-level, Creation date.
Sample shape: 40 rows × 84 columns. Key columns (exact header names):

- `Post ID`, `Page name`, `Title` (caption for Photos), `Description` (caption for
  Videos), `Publish time`, `Post type` ('Photos'|'Videos'), `Permalink`
- `Views`, `Reach`, `Reactions`, `Comments`, `Shares`, `Total clicks`
- `Views from Organic posts`, `Views from Boosted posts`,
  `Reach from Organic posts`, `Reach from Boosted posts`
- `Average seconds viewed`, `3-second video views`, `1-minute views`
- Demographic columns: `Views from M 25-34`, `Views from F 25-34`, etc.
- Country columns: `Views from ZA`, `Views from US`, etc.

**Parsing rules:**
- Parse with PapaParse (`npm i papaparse @types/papaparse`), `header: true`,
  handle UTF-8 BOM.
- `caption` = `Title` if Post type is Photos else `Description`. Trim, may be empty.
- Numeric fields: empty string → 0.
- Demographic + country columns → fold into `demographics` jsonb.
- Entire raw row → `raw` jsonb.
- Upload UI: drag-and-drop zone in ReportEditor's Upload tab. Re-upload replaces
  the report's posts (delete + insert) after a confirm dialog.

---

## 7. AI tagging (Phase 3c)

After parsing, send posts in ONE batch request to Anthropic
(`claude-sonnet-4-20250514` via `https://api.anthropic.com/v1/messages`).
The API key must NOT live in client code: create a **Supabase Edge Function**
(`supabase/functions/ai-tag-posts`) that holds `ANTHROPIC_API_KEY` as a secret and
proxies the request. Frontend calls the edge function with the parsed posts.

Prompt design (system prompt for the tagging call):

```
You categorise social media posts for a South African agency. Categories:
- "poster": a designed promotional graphic. Signals: caption sells a specific
  item/special/price/day ("Tuesday special", "R99", menu items like schnitzel,
  steak roll, pizza, omelette), Post type Photos.
- "animated_poster": same promotional design but with motion. Signals: Post type
  Videos AND average seconds viewed low / duration short (≤ ~15s) AND caption is
  promotional like a poster.
- "photo": real photography — atmosphere, people, vibe. Signals: Post type Photos,
  caption is mood/story-led, no price/special/menu-item sell.
- "video": real video footage — performances, people, moments. Signals: Post type
  Videos with longer watch time, caption about a person/moment/event.
Event announcements with a named performer + date are "poster" if designed graphic
signals dominate, else "photo". Captions may be Afrikaans — handle both languages.
Return STRICT JSON: [{"meta_post_id": "...", "category": "...", "confidence": 0-1,
"reason": "short"}] and nothing else.
```

UI after tagging: **review table** — every post with thumbnail-less row (caption,
date, Meta type, reach), AI category as a colored badge, confidence, AI's reason,
and a dropdown to override. Overrides set `category_source = 'manual'`. "Confirm
tags" saves everything to `posts`.

Auto-compute after save: `best_poster_post_id` = highest-reach post with category
poster|animated_poster; `best_video_post_id` = highest-reach video. Team can
override both in the Strategy tab.

---

## 8. Strategy Page editor (Phase 3d)

ReportEditor → Strategy tab. Sections in order, matching the team workflow:

1. **Best performers** — two cards (poster + video) showing the auto-picked posts
   with their stats, a dropdown to pick a different post, and a commentary textarea each.
2. **Previous theme** — read-only, auto-filled from the previous report
   (same client+platform, latest `period_end` < this `period_start`). Editable if empty.
3. **Open client requests** — list of `client_requests` with status 'open' for this
   client. Checkbox "address in this report" → marks addressed + links report.
4. **AI draft button** — "Draft strategy with AI" calls a second edge function
   (`ai-draft-strategy`) sending: category aggregates (count/avg reach/avg
   engagement per category, organic vs boosted split), top 5 posts, previous theme,
   open client requests. AI returns JSON: `{strategy_reflection, post_direction,
   boost_recommendation, theme_next_suggestion}`. Store in `reports.ai_draft`, then
   populate the form fields with it FOR EDITING — never auto-publish AI text.
5. **Editable fields** — strategy_reflection, post_direction, boost_recommendation,
   theme_next. Autosave on blur.
6. **Publish tab** — preview of what the client will see + Publish button
   (sets status='published', published_at=now()). Confirm dialog. Unpublish allowed
   for admin only.

---

## 9. Client dashboard (Phase 3e)

`/dashboard`: header with client logo + name, then latest published report per
platform as cards → click into ReportView. Past reports listed below (history).

ReportView sections, top to bottom:
1. Period + theme banner
2. Headline tiles: Views, Reach, Reactions, Comments, Shares (totals)
3. **Organic vs Boosted** — side-by-side bars for views + reach (CA requirement:
   separated, both visible)
4. **Category performance** — bar chart: avg reach per category + post counts
5. **Best performing poster / video** — the two cards with commentary
6. **Strategy** — strategy_reflection, post_direction, boost_recommendation,
   next theme, rendered as a clean readable page (this is the money section —
   design it like a polished report, generous spacing, brand accent highlights)

Clients must never see: draft reports, ai_draft raw content, client_requests admin
log, other clients' anything. RLS enforces this; UI must also not attempt to fetch it.

---

## 10. Build phases — work in this order

- **3a** `supabase/schema.sql` (tables + RLS + trigger + seed) → STOP. CA pastes
  into Supabase SQL editor, runs admin-role UPDATE, verifies tables exist.
- **3b** AuthContext role loading, route guards, AdminLayout, ClientsList +
  add/edit client (admin-only), UsersAdmin. → STOP for CA verification.
- **3c** ReportEditor Upload tab: CSV drag-drop → parse → edge function AI tagging →
  review table → save posts. Includes both edge functions scaffolding. → STOP.
- **3d** Strategy tab + AI draft + publish flow. → STOP.
- **3e** Client dashboard + ReportView with charts. → STOP.
- **3f** Polish: loading/empty/error states, mobile pass, client_requests quick-add
  from ClientDetail, history view. → DONE.

## 11. Conventions

- TypeScript strict; no `any` unless unavoidable (CSV raw rows may use `Record<string,string>`).
- All data access through typed helper modules in `src/lib/db/` (one per table).
- Keep components under ~200 lines; extract.
- Dark brand theme throughout; tiles/cards on `brand.surface` with `brand.muted` borders;
  accent `brand.accent` for highlights and chart primary.
- Commit after each phase with message `phase 3x: <summary>`.
- Never commit `.env.local` or any API key. Anthropic key lives only in Supabase
  edge function secrets (`supabase secrets set ANTHROPIC_API_KEY=...`).

-- ============================================================
-- CG Dynamics — Database Schema
-- Paste this entire file into the Supabase SQL editor and run.
-- ============================================================


-- ── 1. TABLES ────────────────────────────────────────────────

-- clients must come first (profiles FKs to it)
create table clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tier       text not null default 'standard' check (tier in ('standard','premium')),
  logo_url   text,
  active     boolean not null default true,
  created_at timestamptz default now()
);

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'client' check (role in ('admin','team','client')),
  client_id  uuid references clients(id) on delete set null,
  created_at timestamptz default now()
);

-- best_poster_post_id / best_video_post_id FK to posts added after posts is created
create table reports (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references clients(id) on delete cascade,
  platform               text not null check (platform in ('facebook','instagram','tiktok')),
  period_start           date not null,
  period_end             date not null,
  status                 text not null default 'draft' check (status in ('draft','published')),
  theme_previous         text,
  theme_next             text,
  best_poster_post_id    uuid,
  best_poster_commentary text,
  best_video_post_id     uuid,
  best_video_commentary  text,
  strategy_reflection    text,
  post_direction         text,
  boost_recommendation   text,
  ai_draft               jsonb,
  published_at           timestamptz,
  created_by             uuid references profiles(id),
  created_at             timestamptz default now(),
  unique (client_id, platform, period_start)
);

create table posts (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid not null references reports(id) on delete cascade,
  meta_post_id       text,
  publish_time       timestamptz,
  meta_post_type     text,
  category           text check (category in ('photo','video','poster','animated_poster')),
  category_source    text default 'ai' check (category_source in ('ai','manual')),
  caption            text,
  permalink          text,
  views              int default 0,
  reach              int default 0,
  reactions          int default 0,
  comments           int default 0,
  shares             int default 0,
  total_clicks       int default 0,
  views_organic      int default 0,
  views_boosted      int default 0,
  reach_organic      int default 0,
  reach_boosted      int default 0,
  avg_seconds_viewed numeric,
  demographics       jsonb,
  raw                jsonb not null,
  created_at         timestamptz default now()
);

-- Wire the reports → posts FKs now that posts exists
alter table reports
  add constraint fk_reports_best_poster_post
    foreign key (best_poster_post_id) references posts(id) on delete set null;

alter table reports
  add constraint fk_reports_best_video_post
    foreign key (best_video_post_id) references posts(id) on delete set null;

create table client_requests (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  request_text        text not null,
  status              text not null default 'open' check (status in ('open','addressed')),
  addressed_in_report uuid references reports(id),
  created_by          uuid references profiles(id),
  created_at          timestamptz default now()
);


-- ── 2. AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 3. ROW-LEVEL SECURITY ─────────────────────────────────────

alter table clients          enable row level security;
alter table profiles         enable row level security;
alter table reports          enable row level security;
alter table posts            enable row level security;
alter table client_requests  enable row level security;

-- Security-definer helpers so RLS policies can query profiles
-- without hitting the profiles RLS themselves.
create or replace function public.is_staff()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'team')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.my_client_id()
returns uuid
language sql
security definer stable
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- profiles
create policy "profiles: read own row"
  on profiles for select
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on profiles for select
  using (is_admin());

create policy "profiles: admin updates all"
  on profiles for update
  using (is_admin());

-- clients
create policy "clients: staff reads all"
  on clients for select
  using (is_staff());

create policy "clients: client reads own"
  on clients for select
  using (id = my_client_id());

create policy "clients: admin insert"
  on clients for insert
  with check (is_admin());

create policy "clients: admin update"
  on clients for update
  using (is_admin());

create policy "clients: admin delete"
  on clients for delete
  using (is_admin());

-- reports
create policy "reports: staff full access"
  on reports for all
  using (is_staff())
  with check (is_staff());

create policy "reports: client reads own published"
  on reports for select
  using (
    status = 'published'
    and client_id = my_client_id()
  );

-- posts
create policy "posts: staff full access"
  on posts for all
  using (is_staff())
  with check (is_staff());

create policy "posts: client reads own published"
  on posts for select
  using (
    exists (
      select 1 from reports r
      where r.id = posts.report_id
        and r.status = 'published'
        and r.client_id = my_client_id()
    )
  );

-- client_requests: staff only, clients have no access
create policy "client_requests: staff full access"
  on client_requests for all
  using (is_staff())
  with check (is_staff());


-- ── 4. SEED DATA ─────────────────────────────────────────────

insert into clients (name, tier)
values ('Red Oak', 'premium');


-- ── 5. GRANT YOUR ACCOUNT ADMIN ROLE ─────────────────────────
-- Run this separately AFTER you have signed in at least once
-- (so your row exists in auth.users and profiles):
--
-- update profiles
-- set role = 'admin'
-- where id = (
--   select id from auth.users
--   where email = 'info@cgproductionhouse.com'
-- );

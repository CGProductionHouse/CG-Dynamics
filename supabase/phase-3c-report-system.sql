-- ============================================================
-- CG Dynamics - Phase 3c Meta CSV report system
-- Run this once in the Supabase SQL editor before testing Phase 3c.
-- ============================================================

create table if not exists imported_meta_posts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  source           text not null default 'meta_business_suite',
  platform         text not null default 'facebook' check (platform in ('facebook','instagram','tiktok')),
  import_batch_id  uuid not null default gen_random_uuid(),
  source_file_name text,
  row_number       int not null,
  meta_post_id     text,
  publish_time     timestamptz,
  caption          text,
  permalink        text,
  post_type        text,
  reach            int not null default 0,
  impressions      int not null default 0,
  engagements      int not null default 0,
  reactions        int not null default 0,
  comments         int not null default 0,
  shares           int not null default 0,
  clicks           int not null default 0,
  video_views      int not null default 0,
  raw              jsonb not null,
  created_at       timestamptz default now()
);

alter table reports add column if not exists report_title text;
alter table reports add column if not exists previous_month_strategy text;
alter table reports add column if not exists previous_month_reflection text;
alter table reports add column if not exists performance_comments text;
alter table reports add column if not exists strategy_next_month text;
alter table reports add column if not exists content_direction_next_month text;
alter table reports add column if not exists general_notes text;

alter table imported_meta_posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'imported_meta_posts'
      and policyname = 'imported_meta_posts: staff full access'
  ) then
    create policy "imported_meta_posts: staff full access"
      on imported_meta_posts for all
      using (is_staff())
      with check (is_staff());
  end if;
end
$$;

create index if not exists imported_meta_posts_client_date_idx
  on imported_meta_posts (client_id, publish_time);

create index if not exists imported_meta_posts_batch_idx
  on imported_meta_posts (import_batch_id);

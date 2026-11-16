-- Client brand profiles and brand rules for video editors (staff-only).
--
-- APPLIED to production 11 November 2026 with CA approval (ledger version 20261111064719).
-- Supersedes the never-applied supabase/phase-8a-client-brand-workflow.sql,
-- whose read policy would have exposed brand notes to client-role logins.
--
-- One profile per client holds the facts editors need (Canva brand kit link,
-- colours, fonts, voice, logos). Rules are individual "must"/"should" lines;
-- a rule with no client_id is a house rule for every client. Rules are retired,
-- never deleted, so the history of what editors were told survives.

create table public.client_brand_profiles (
  client_id          uuid primary key references public.clients(id),
  canva_brand_kit_id text check (canva_brand_kit_id ~ '^[A-Za-z0-9_-]{6,40}$'),
  colours            jsonb not null default '[]'::jsonb check (jsonb_typeof(colours) = 'array'),
  fonts              text[] not null default '{}',
  tone_voice         text check (char_length(tone_voice) <= 2000),
  visual_direction   text check (char_length(visual_direction) <= 2000),
  logo_notes         text check (char_length(logo_notes) <= 2000),
  source             text not null default 'manual' check (source in ('manual', 'canva')),
  source_synced_at   timestamptz,
  updated_by         uuid references public.profiles(id),
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create table public.client_brand_rules (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id),
  priority    text not null check (priority in ('must', 'should')),
  category    text not null check (category in ('copy', 'type', 'colour', 'logo', 'layout', 'motion', 'audio', 'devices', 'backgrounds', 'delivery')),
  rule        text not null check (char_length(btrim(rule)) between 3 and 500),
  source      text check (char_length(source) <= 300),
  created_by  uuid not null references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  retired_at  timestamptz,
  retired_by  uuid references public.profiles(id)
);

create index client_brand_rules_active_client_idx
  on public.client_brand_rules (client_id) where retired_at is null;

alter table public.client_brand_profiles enable row level security;
alter table public.client_brand_rules enable row level security;

revoke all on public.client_brand_profiles, public.client_brand_rules from anon, authenticated;
grant select, insert, update on public.client_brand_profiles to authenticated;
grant select, insert, update on public.client_brand_rules to authenticated;

-- Reads: active internal content staff only. Clients never see brand rules.
create policy "brand profile staff read" on public.client_brand_profiles
  for select to authenticated using (public.is_active_content_staff());
create policy "brand rule staff read" on public.client_brand_rules
  for select to authenticated using (public.is_active_content_staff());

-- Profiles: managers and admins maintain them.
create policy "brand profile manager insert" on public.client_brand_profiles
  for insert to authenticated with check (public.is_manager());
create policy "brand profile manager update" on public.client_brand_profiles
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

-- Rules: any active content staff member may record a client rule from
-- feedback, as themselves. House rules (no client) are manager-only.
create policy "brand rule staff insert" on public.client_brand_rules
  for insert to authenticated with check (
    public.is_active_content_staff()
    and created_by = auth.uid()
    and retired_at is null
    and (client_id is not null or public.is_manager())
  );

-- Only managers retire rules. Retiring is the only permitted change.
create policy "brand rule manager retire" on public.client_brand_rules
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

create function public.guard_client_brand_rule_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is distinct from old.client_id or new.priority is distinct from old.priority
     or new.category is distinct from old.category or new.rule is distinct from old.rule
     or new.source is distinct from old.source or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Brand rules cannot be edited. Retire the rule and add a new one';
  end if;
  if old.retired_at is not null then
    raise exception 'This brand rule is already retired';
  end if;
  if new.retired_at is null then
    raise exception 'Updating a brand rule only retires it';
  end if;
  new.retired_by := auth.uid();
  return new;
end $$;

create trigger client_brand_rules_retire_only
  before update on public.client_brand_rules
  for each row execute function public.guard_client_brand_rule_update();

create function public.touch_client_brand_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.client_id := old.client_id;
  end if;
  return new;
end $$;

create trigger client_brand_profiles_touch
  before insert or update on public.client_brand_profiles
  for each row execute function public.touch_client_brand_profile();

revoke all on function public.guard_client_brand_rule_update() from public, anon, authenticated;
revoke all on function public.touch_client_brand_profile() from public, anon, authenticated;

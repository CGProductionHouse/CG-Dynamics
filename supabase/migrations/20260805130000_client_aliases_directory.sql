-- Client aliases as DATA, not code (PR 4).
--
-- Client identity was hardcoded in three places:
--   commandCentre.ts       CLIENT_ALIASES        (12 entries, Morning List)
--   microsoftImportMap.ts  MASTER_CLIENT_ALIASES, CLIENT_SCHEDULE_ALIASES,
--                          OUTLOOK_CLIENT_ALIASES
--
-- Most of those are derivable from the directory and need no storage at all.
-- What is NOT derivable is an external system's misspelling — nothing can infer
-- "actio sports" -> Action Sport or "the staffordhire pub" -> The Staffy from
-- the client name. Those are facts about the source system, so they belong in
-- the database next to the client, where adding one needs no code change.

create table if not exists public.client_aliases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  alias text not null,
  alias_normalised text generated always as (
    lower(regexp_replace(coalesce(alias, ''), '[^a-zA-Z0-9]+', '', 'g'))
  ) stored,
  -- Where this spelling comes from, so an operator knows why it exists.
  source text not null default 'manual'
    check (source in ('manual', 'microsoft_planner', 'outlook', 'client_schedule', 'import')),
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (client_id, alias_normalised)
);

create index if not exists client_aliases_normalised_idx on public.client_aliases (alias_normalised);

comment on table public.client_aliases is
  'Alternate spellings for a client that CANNOT be derived from its name — typically an external system''s misspelling. Derivable forms (tokens, shortened names, punctuation variants) are computed by the matcher and must NOT be stored here.';

alter table public.client_aliases enable row level security;
alter table public.client_aliases force row level security;
drop policy if exists client_aliases_staff_read on public.client_aliases;
create policy client_aliases_staff_read on public.client_aliases for select using (public.is_staff());
drop policy if exists client_aliases_manager_write on public.client_aliases;
create policy client_aliases_manager_write on public.client_aliases for all
  using (public.is_manager()) with check (public.is_manager());

-- Seed the non-derivable spellings that were hardcoded. Each is matched to the
-- live directory by exact name, so a rename or a missing client simply inserts
-- nothing rather than creating a phantom alias.
insert into public.client_aliases (client_id, alias, source)
select c.id, v.alias, v.source
from (values
  ('Ehrlich Park Butchery', 'ehrlich park',          'microsoft_planner'),
  ('Braize',                'braize promotions',     'client_schedule'),
  ('HMH Attorneys',         'hmhi attorneys',        'client_schedule'),
  ('Human Auto',            'human auto ford',       'client_schedule'),
  ('RC-Polypipe',           'rc polypipe',           'client_schedule'),
  ('The Staffy',            'the staffordhire pub',  'client_schedule'),
  ('Action Sport',          'actio sports',          'outlook'),
  ('Action Sport',          'action sports',         'outlook'),
  ('Bloem Marble & Granite','bloem marble',          'outlook'),
  ('Bouwer & Coetzee Attorneys', 'bouwer coetzee attorneys', 'outlook'),
  ('Case Bloemfontein',     'case',                  'outlook')
) as v(client_name, alias, source)
join public.clients c on c.name = v.client_name
on conflict (client_id, alias_normalised) do nothing;

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// Immutable, already-reviewed migration artifacts. This is projection, not research.
const clients = [
  ['fd16ebae-a50b-4920-afe0-94c2631f8f06', 'All Around PVC', '383ae2cb1c4342593dab678b55cee90e54e5e5e2', 'ALL-AROUND-PVC-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['3b85973f-bcad-49eb-b8f1-c27f7c7f1aba', 'AV Event Life', '65c55627eb1eafa57a1a8161d7ee5a7620d7e4ff', 'AV-EVENT-LIFE-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['32bd9db3-5339-4404-825b-5a615cadec6a', 'Bat Hill Royale', 'c32fef89b9e86e9811a093fe6a5b0971bb633529', 'BAT-HILL-ROYALE-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['b28af30a-3d44-490a-8290-1e56dac7b127', 'Bloem Action Sports', 'a6ad66478976405290e130ec0a1fd8afd5409c3a', 'BLOEM-ACTION-SPORTS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['89e0ad6d-e08c-4a75-8b8e-abea71af581c', 'Bloem Marble & Granite', '744bdef91493e932f7e9e20e81549d12321aa6bb', 'BLOEM-MARBLE-GRANITE-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['2d16262d-8450-458d-ae7e-084ef9ff662d', 'Bloem Vascular', '52e4d0e9b765cb576992ce808f440a493fe9abe6', 'BLOEM-VASCULAR-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['5dfdf4bd-9d94-4cc6-9dee-0e480a2234cb', 'Bohemia Quick Stop', '01fcdad0741fba507f38b7bc35b4fb60c44f2863', 'BOHEMIA-QUICK-STOP-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['8e448cf9-1534-4ba1-89a4-93e4c8b83d2f', 'Bouwer & Coetzee Attorneys', '98da2261a84cbbb0687c8de6456a20b0bf4f2a7f', 'BOUWER-COETZEE-ATTORNEYS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['6b67a2df-e2ab-418b-bcee-03aef5963d37', 'Braize', '9c379e3785422732e57946f4ab769732dbeb2a1b', 'BRAIZE-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['afb62c53-d6d3-4ef8-9393-def88ed899d8', 'C&L Innovations', 'b132069e1c40a543d466b4af53f7d3cbf21f540c', 'C-L-INNOVATIONS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa', 'Cape Lumber', 'a6ad66478976405290e130ec0a1fd8afd5409c3a', 'CAPE-LUMBER-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['079df21e-783a-4648-b3fa-0acae6e68867', 'Case Bloemfontein', '2ab107bc61e0407c3fd729df1199112a2c685395', 'CASE-BLOEMFONTEIN-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['6b313cac-283e-48c4-9df6-ba43af2f7353', 'Central Canvas', '63b3683694c8662a6d9b4666ddf18bf3d1031a3a', 'CENTRAL-CANVAS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['c27d2185-08e4-4c49-be48-2572564ceecf', 'CG Production House', '22cefb3da4ffa4e00f25fbdd3700b7ccbbd4962e', 'CG-PRODUCTION-HOUSE-CANONICAL-CLIENT-INTELLIGENCE-2026-09.md'],
  ['3404f726-a693-4b2d-8c13-c9d3dfd17bbc', 'Daisy & Co', 'cca107e5959e42f76dfb41288d2e7fafbd670373', 'DAISY-CO-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['06b20bb1-ed4a-4aa1-9f48-8c6cb0531aba', 'Delta Gas', '6a7ce096e407eb31a5b238ba4c63a2ce2c7e5d17', 'DELTA-GAS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['2aed8a31-bd53-4ad1-a3dc-432865adfb3d', 'Dulux Paint & Paper Bloemfontein', '5db7702ec269fbeaf7fa4a464ec6ebc583fe5ed6', 'DULUX-PAINT-PAPER-BLOEMFONTEIN-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['61acf81b-1011-404e-9fae-2e209be65fca', 'Econofoods', '6164d78d39628b25a6166ad42a4be6c9426a53ed', 'ECONOFOODS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['ec643c75-51f5-4839-829f-3f5b7f48829a', 'Ehrlich Park Butchery', '5aa73d999ed06345162cdb89b8ebb5fbccdf949a', 'EHRLICH-PARK-BUTCHERY-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['d53d8e62-9e6a-4bb9-be3f-554f40942d45', 'Emmanuel Funerals', 'bf319f00380c8d597cc0681f1eda708409a41779', 'EMMANUEL-FUNERALS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['217a547c-7b22-45cc-bf88-9d45a8e93dfe', 'Emoya Estate Driving Range', '7db320ba78fa8d77e585f8c0dd6f24b037699655', 'EMOYA-ESTATE-DRIVING-RANGE-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['c8d34a97-8400-4f52-8b0d-843491fe3d3b', 'First Technology Central', 'd47954305eb6f0aa79ebd3775abfb7d75b0a2afa', 'FIRST-TECHNOLOGY-CENTRAL-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md'],
  ['4424ed69-7270-4d30-a1ea-0b77d76912df', 'Forklift Trucks', 'e9335fe2a4163e326b905aa644f6206ace819f5a', 'FORKLIFT-TRUCKS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['b6052710-417d-4b3b-8348-0f126bfea671', 'Germoparts', 'e808404571ba985201f8e639bd1c50434d5ba25e', 'GERMOPARTS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['1007e58b-3fea-4515-88b7-ddaa85763de6', 'Hino Trucks', '57411cca291031ce8dc40f23d7227016a915dc3b', 'HINO-TRUCKS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['572555e0-d4d0-404a-8d67-beeeeed6a1f2', 'HMHI', '7e44edb52906f319d8f2355eb25e3cbfd2423c13', 'HILL-MCHARDY-HERBST-INC-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['816c7f59-d56c-46a3-ba15-f76971d83769', 'Human Auto', '08e30839d533852a655b36e7b9c9fadb724e8ee8', 'HUMAN-AUTO-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['2e643855-e2ad-481f-a6c6-3d934b9f4a50', 'Ipopeng Office Supplies', '785a60a0e57cedafa6c4b4a71f0ac6235eefec3f', 'IPOPENG-OFFICE-SUPPLIES-CLIENT-INTELLIGENCE-2026-09.md'],
  ['a5eab798-3e00-44cc-947e-463386fdac39', 'Jenkor', '28105226a83716865f9af6a6adca7a3ce7186cb3', 'JENKOR-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['2a5ea019-64f5-4f8e-8a61-61a28940aa6e', 'Local Deli', 'ed343124e48925e2d66dd78958fd87989c14f611', 'LOCAL-DELI-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['21300630-6755-4591-9a49-e22abbaf7e3d', 'Loraclox', '63ca07a17017cab34ed92eaae069938f9185d308', 'LORACLOX-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['7b47afb0-fa55-4916-85f6-09c57e5905b9', 'Madison Wear', '52b90ef46a63786730abad7b00dc6b14e1080b36', 'MADISON-WEAR-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['e276f019-a580-44c5-a7ab-e43840c33a64', 'Mimosa Mall', 'df77b027ef59a3c218e6337b8fa728c0466b9052', 'MIMOSA-MALL-CLIENT-MARKETING-INTELLIGENCE-2026-09.md'],
  ['94fe2568-3cf1-47dc-801e-d8d5396a0965', 'NCNA', 'fb401c0c838ebdce5f153cc55bfd10529b2fec5b', 'NCNA-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['4236a60a-990f-484f-8d19-13d2f92fbe3b', 'Novus Steel', 'dba733f761c897653b5a281dae044d04e0361555', 'NOVUS-STEEL-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b', 'Peyper Bonds', 'bbf466cecbdef846a9370352caf59960d0116f60', 'PEYPER-BONDS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['ed7aa1ae-de21-4151-a8f9-54796b234c1f', 'Piek Group', '06986fa0de259a22001fbdcbfd86cf2e1bc0b9d5', 'PIEK-GROUP-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['29a28efd-c998-45e2-a57c-4a751e779e66', 'PSG Bloemfontein', '322b28b6f63ec222517d3cb4190e4abfda4ac843', 'PSG-BLOEMFONTEIN-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['4f6106de-c437-404e-8cef-fbe848de0665', 'RC-Polypipe', '16473b409df988723f8b134ae4c0703492517497', 'RC-POLYPIPE-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['cdb11a82-339e-4b46-9b09-bde1a23efeaf', 'Red Oak', 'aaca2bffb70bf41e92968cd5275b300dbad1ef10', 'RED-OAK-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['917d6f7c-1c2a-4c20-82f0-daa41b9062f5', 'SecuriForce', 'ccd3550c7d34a09973c627c5a740a826687f50a7', 'SECURIFORCE-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['a60b4d07-0a30-4f1c-8d48-7bd9ea649c97', 'Supa Quick BFN', '97ec81d5302289c1968605221a3a82f473a0d495', 'SUPA-QUICK-BFN-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['e2870110-930c-4e63-b2fe-c858030f7258', 'Supa Quick Centurion', '4bd35988f5f4eb4f8c80d40e791712d538c3c300', 'SUPA-QUICK-CENTURION-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['a36ba938-e9dc-4ecf-bb67-4853608b1c01', 'TBS Brokers', '21c872945c4607b856caefccd53580c09d86e694', 'TBS-BROKERS-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['dfa47255-875d-43cf-8a22-cfe1a6247fb7', 'The Staffordshire', '3b2032edc5d02f9607be97b79842f51461f43853', 'THE-STAFFORDSHIRE-CHATGPT-PROJECT-MIGRATION-AUDIT-2026-09-08.md'],
  ['204f4f22-14c7-42ed-a956-da57af102706', 'Tobich Optics', '134cdae1b5be661e0e1d05a1ed30e9a66a3ad1db', 'TOBICH-OPTICS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['e2ad6d57-5b06-46e1-b75b-b67f017d57f1', 'Toyota Bloemfontein', 'a2aa56af7cdc8c4a9c2ffb1a4dfeac18f6dca9ea', 'TOYOTA-BLOEMFONTEIN-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['1f0406bb-d643-4b83-bc3e-b1ebe87eeb89', 'Vrystaat Kunstefees', '7eda72b09e0c4995976670a36b3aac173b4cf427', 'VRYSTAAT-KUNSTEFEES-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['e1cb958e-3f68-4a77-b5ea-b471ea62bdef', 'Watch Addict', '04178cfa73aca2389ad1cfbb95d61990d646643e', 'WATCH-ADDICT-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['2b953772-e791-4dff-a278-d4dd3521f02e', 'We Ar Fuels', '11013c779753a76a6a2c4035b8216fa103cbdb69', 'WE-AR-FUELS-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['899c9988-8207-4e45-a8fc-a7446dfcf96b', 'Wiseman Group', '33f53f23447a3a4449f1bd5fed88930ab9b5d2bc', 'WISEMAN-GROUP-CG-DYNAMICS-CLIENT-GUIDE.md'],
  ['504113ee-fba9-4993-807e-a86066615212', 'WiseRide', '16204a8d3d16bf44a59085321d1483821e99fab9', 'WISERIDE-CLIENT-INTELLIGENCE-2026-09.md'],
]

const base = 'docs/ai-workforce/client-intelligence/'
const q = value => `'${value.replaceAll("'", "''")}'`
const instructions = name => `Work on the exact CG Dynamics client selected for this task (${name}).\nBefore client-dependent work, call get_client_context with its exact client_id and the exact task type.\nTreat CLIENT CONTEXT NOT READY as a hard stop for client creative output; surface the missing readiness instead of writing generic copy.\nUse the returned current exact-client guide and task packet. Never borrow from a similar, sibling, group or billing client.\nFor captions and poster copy, use only the returned current caption-approved exact-scope contact/footer packet. Never hardcode or guess contacts, people, addresses, links or mutable facts.\nCaptions must add to the supplied creative, follow the client-specific output contract, and avoid generic filler.\nUse no more than 5 dynamically relevant hashtags unless the exact-client guide requires fewer.\nFor image work, preserve real people, products, branding, proportions and composition unless the brief explicitly changes them.\nIf exact-client evidence conflicts or is stale, flag the bounded gap rather than guessing.`

const rows = clients.map(([id, name, commit, file]) => {
  const path = base + file
  const markdown = execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  const b64 = Buffer.from(markdown, 'utf8').toString('base64')
  return `    (${q(id)}::uuid, ${q(name)}, ${q(commit)}, ${q(path)}, ${q(b64)}, ${q(Buffer.from(instructions(name), 'utf8').toString('base64'))})`
})

const sql = `-- Generated by scripts/generate-client-runtime-projection.mjs.
-- Projects already-reviewed client migration evidence into the exact-client runtime (#241).
-- Additive, idempotent, and fail-closed: exact UUID+name+active assertions; no fuzzy matching.
begin;

alter table public.client_guides
  add column if not exists source_revision text,
  add column if not exists source_observed_at timestamptz,
  add column if not exists runtime_readiness text not null default 'not_ready'
    check (runtime_readiness in ('ready','not_ready')),
  add column if not exists readiness_reason text;

create temporary table client_runtime_projection (
  client_id uuid primary key,
  client_name text not null,
  source_revision text not null,
  source_pack_path text not null,
  guide_b64 text not null,
  instructions_b64 text not null
) on commit drop;

insert into client_runtime_projection values
${rows.join(',\n')};

do $$
declare
  v_expected integer;
  v_matched integer;
begin
  select count(*) into v_expected from client_runtime_projection;
  select count(*) into v_matched
  from client_runtime_projection projection
  join public.clients client
    on client.id = projection.client_id
   and client.name = projection.client_name
   and client.active = true;
  if v_matched <> v_expected then
    raise exception 'Client runtime projection identity check failed: expected %, matched % exact active UUID+name rows', v_expected, v_matched;
  end if;
end $$;

insert into public.client_guides
  (client_id, guide_markdown, project_instructions, generated_at, version,
   source_pack_path, source_revision, source_observed_at, runtime_readiness, readiness_reason)
select
  client_id,
  convert_from(decode(guide_b64, 'base64'), 'UTF8'),
  convert_from(decode(instructions_b64, 'base64'), 'UTF8'),
  '2026-09-10T00:00:00+02:00'::timestamptz,
  1,
  source_pack_path,
  source_revision,
  '2026-09-08T00:00:00+02:00'::timestamptz,
  'ready',
  'Projected from the completed, immutable client migration evidence recorded by source_revision.'
from client_runtime_projection
on conflict (client_id) do nothing;

-- A mapping row records runtime coverage without claiming a Project URL was confirmed.
-- Shared containers remain supported because chatgpt_project_url is not unique.
insert into public.client_project_mappings (client_id, project_name, sync_state, last_instructions_at, notes)
select
  client_id,
  case when client_id in (
    'a60b4d07-0a30-4f1c-8d48-7bd9ea649c97'::uuid,
    'e2870110-930c-4e63-b2fe-c858030f7258'::uuid,
    '504113ee-fba9-4993-807e-a86066615212'::uuid,
    '899c9988-8207-4e45-a8fc-a7446dfcf96b'::uuid
  ) then 'Wiseman Group' else client_name end,
  'needs_setup',
  '2026-09-10T00:00:00+02:00'::timestamptz,
  'Exact-client runtime projection is live. Project URL/application confirmation remains independent.'
from client_runtime_projection
on conflict (client_id) do nothing;

-- Red Oak public contacts are explicitly current first-party evidence in the immutable migration audit.
-- Routine captions may omit them; no contact is inferred for clients whose final guide withheld a value.
insert into public.client_contacts
  (client_id,scope_key,contact_type,display_label,person_name,person_role,value,
   approved_for_caption,blocks_caption,visibility,allowed_purposes,provenance_summary,
   source_reference,observed_at,last_verified_at,freshness_state,lifecycle_state,
   platforms,content_modes,footer_order)
values
  ('cdb11a82-339e-4b46-9b09-bde1a23efeaf',null,'phone','General enquiries',null,null,'051 011 0208',true,false,'public_marketing',array['caption_footer'],'Current first-party Red Oak website evidence reviewed 2026-09-08','git:aaca2bffb70bf41e92968cd5275b300dbad1ef10#current-verified-first-party-business-facts','2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],10),
  ('cdb11a82-339e-4b46-9b09-bde1a23efeaf',null,'booking','Bookings','Niki Ferns','Bookings/functions','079 240 1307',true,false,'public_marketing',array['caption_footer','bookings'],'Current first-party Red Oak website evidence reviewed 2026-09-08','git:aaca2bffb70bf41e92968cd5275b300dbad1ef10#current-verified-first-party-business-facts','2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],20),
  ('cdb11a82-339e-4b46-9b09-bde1a23efeaf',null,'email','Booking/function email','Niki Ferns','Bookings/functions','niki@redoakgroup.co.za',true,false,'public_marketing',array['caption_footer','bookings'],'Current first-party Red Oak website evidence reviewed 2026-09-08','git:aaca2bffb70bf41e92968cd5275b300dbad1ef10#current-verified-first-party-business-facts','2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],30),
  ('cdb11a82-339e-4b46-9b09-bde1a23efeaf',null,'other','Events email',null,'Events','events@redoakgroup.co.za',true,false,'public_marketing',array['caption_footer','events'],'Current first-party Red Oak website evidence reviewed 2026-09-08','git:aaca2bffb70bf41e92968cd5275b300dbad1ef10#current-verified-first-party-business-facts','2026-09-08','2026-09-08','current_verified','active','{}',array['caption'],40)
on conflict do nothing;

insert into public.client_contact_footer_policies
  (client_id,scope_key,content_mode,platform,requirement,format_template,review_state,provenance_summary,last_verified_at)
values
  ('cdb11a82-339e-4b46-9b09-bde1a23efeaf',null,'caption',null,'optional',null,'current_verified','Red Oak routine captions omit contacts unless the brief needs an enquiry, booking, function or event route.','2026-09-08')
on conflict do nothing;

commit;
`

writeFileSync('supabase/migrations/20260910100000_client_runtime_projection_backfill.sql', sql)
console.log(`Projected ${clients.length} exact clients.`)

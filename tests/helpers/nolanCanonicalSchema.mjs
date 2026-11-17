import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// Platform scaffolding only: NOT GoTrue authentication or hosted Supabase proof.
// Public tables, triggers, functions and policies come from unmodified repo SQL.
export function replayNolanCanonicalSchema(sql, reportPath, {bootstrap=true}={}) {
 if(bootstrap)sql(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema extensions;
 create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key, email text, invited_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 -- Explicit local emulation of Supabase's public-schema default API grants.
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`)
 // A bare phase (6 core) precedes lettered additions (6b/6e). GNU sort -V
 // puts 6e before 6-core, breaking the repository's older replay script.
 const phaseOrder=name=>{const m=name.match(/^phase-(\d+)([a-z]*)-/);return m?[Number(m[1]),m[2]]:[Infinity,name]}
 const phases=readdirSync('supabase').filter(n=>/^phase-.*\.sql$/.test(n)).sort((a,b)=>{
  const x=phaseOrder(a),y=phaseOrder(b);return x[0]-y[0]||x[1].localeCompare(y[1])||a.localeCompare(b)
 }).map(n=>'supabase/'+n)
 const files=['supabase/schema.sql',...phases,...readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort().map(n=>'supabase/migrations/'+n)]
 // These legacy files depend on newer-numbered/timestamped foundations.
 // Move entire unchanged files; do not replace their policies with test doubles.
 const after=(file,anchor)=>{files.splice(files.indexOf(file),1);files.splice(files.indexOf(anchor)+1,0,file)}
 after('supabase/phase-5b-tiktok-metric-registry.sql','supabase/phase-20d-meta-reporting-truth.sql')
 after('supabase/phase-5c-tiktok-client-mapping.sql','supabase/migrations/20260725172531_content_guideline_document_model.sql')
 after('supabase/phase-19g-content-guideline-multi-month.sql','supabase/phase-5c-tiktok-client-mapping.sql')
 after('supabase/phase-30a-content-run-voice-debrief.sql','supabase/phase-19g-content-guideline-multi-month.sql')
 const report=[]
 for(const file of files){
  const source=readFileSync(file,'utf8')
  const entry={file,sha256:createHash('sha256').update(source).digest('hex')}
  try{sql('set search_path=public,extensions;'+source);entry.result='applied'}
  catch(error){entry.result='failed (may have applied preceding statements)';entry.error=String(error.stderr||error.message).split('\n').filter(line=>/ERROR:|DETAIL:|CONTEXT:/.test(line)).join('\n')}
  report.push(entry)
 }
 const policies=JSON.parse(sql("select coalesce(json_agg(p order by tablename,policyname),'[]') from (select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename in ('profiles','command_centre_tasks')) p"))
 const extensions=JSON.parse(sql("select json_agg(e order by extname) from (select extname,extversion from pg_extension) e"))
 writeFileSync(reportPath,JSON.stringify({policies,extensions,platform:bootstrap?'PostgreSQL 17; synthetic auth.users/auth.uid/auth.role and API default grants; no GoTrue/storage/vault/cron/net':'PostgreSQL 17; real GoTrue-managed auth schema and auth.uid/auth.role; verified PostgREST JWT claims; local API default grants; no storage/vault/cron/net',report},null,2)+'\n')
 // Known gaps are explicit and bounded. New failures cannot silently pass as
 // "expected on an empty database", even when the narrow Nolan tests pass.
 const gaps={
  'supabase/phase-22a-content-guide-publication-gate.sql':/operator does not exist: date = text/,
  'supabase/phase-24b-ingestion-support.sql':/relation "storage.buckets" does not exist/,
  'supabase/phase-24f-client-candidate-cards.sql':/skill_cards_active_client_id_fkey/,
  'supabase/phase-28a-marketing-library-repo-source-registration.sql':/marketing_library_sources_title_year_edition_uidx/,
  'supabase/migrations/20260907150843_content_review_foundation.sql':/relation "storage.buckets" does not exist/,
  'supabase/migrations/20260909110000_client_contact_pilot_backfill.sql':/Expected exactly one Cape Lumber client/,
  'supabase/migrations/20260909120000_client_contact_piek_backfill.sql':/Expected exactly one Piek Group client/,
  'supabase/migrations/20260909130000_client_contact_wiseride_backfill.sql':/Expected exact WiseRide client/,
  'supabase/migrations/20260910100000_client_runtime_projection_backfill.sql':/Client runtime projection identity check failed/,
  'supabase/migrations/20260910120000_client_contact_securiforce_backfill.sql':/Expected exactly one SecuriForce client/,
  'supabase/migrations/20260921143900_peyper_bonds_alissa_contact.sql':/client_contacts_client_id_fkey/,
 }
 for(const entry of report.filter(r=>r.result!=='applied')){
  assert.ok(gaps[entry.file],`Unreviewed replay failure: ${entry.file}: ${entry.error}`)
  assert.match(entry.error,gaps[entry.file])
 }
 // Fail closed if the actual owning schema/policy files did not apply in full.
 for(const file of ['supabase/schema.sql','supabase/phase-3f-user-emails-invites.sql','supabase/phase-5-cg-command-centre.sql','supabase/phase-6-cg-planner-core.sql','supabase/phase-6e-teams-planner-import.sql','supabase/phase-7a-client-request-package-link.sql','supabase/phase-7b-helper-names.sql','supabase/phase-14a-workforce-roles.sql','supabase/phase-14b-staff-role-alias.sql','supabase/phase-16a-operational-task-permissions.sql','supabase/phase-security-admin-isolation.sql','supabase/migrations/20260728180000_planner_multi_assignment.sql']){
  const entry=report.find(r=>r.file===file)
  assert.equal(entry?.result,'applied',`${file}: ${entry?.error}`)
 }
 return report
}

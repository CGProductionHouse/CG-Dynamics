// OFFLINE ONLY. Reads the two pinned existing migrations; performs no writes,
// network, connection, credential lookup, migration application or deployment.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const sources = [
  { version: '20261115104948', name: 'social_publishing_queue', sha256: '00233282015fcfac969421f6429f0c13cdb2421df57dff7141b64e5562076b7b' },
  { version: '20261116085815', name: 'social_publication_preparation_evidence', sha256: 'd82380bc84e4ccedc702408e07353c334a4c16c3fa7650faaf21e13b284600e8' },
]
const hash = text => createHash('sha256').update(text).digest('hex')
const receiptSource = text => `convert_from(decode('${Buffer.from(text).toString('hex')}','hex'),'UTF8')`

export function prepareFacebookDatabaseRelease(root = process.cwd()) {
  const pinned = sources.map(spec => {
    const file = `supabase/migrations/${spec.version}_${spec.name}.sql`
    const source = readFileSync(resolve(root, file), 'utf8').replaceAll('\r\n', '\n')
    if (hash(source) !== spec.sha256) throw Error(`Reviewed migration source changed: ${file}`)
    if (!/\nbegin;\n/i.test(source) || !/\ncommit;\s*$/i.test(source)) throw Error('Reviewed transaction boundary missing')
    return { ...spec, file, source }
  })
  const migrations = pinned.map((spec, index) => {
    const prior = pinned[index - 1]
    const guard = `
set local lock_timeout = '3s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(991,220);
do $cg_facebook_release$
begin
 if exists(select 1 from supabase_migrations.schema_migrations where version='${spec.version}' or name='${spec.name}')
 then raise exception 'Migration already recorded; inspect instead of replaying'; end if;
 ${prior ? `if not exists(select 1 from supabase_migrations.schema_migrations where version='${prior.version}' and name='${prior.name}' and statements=array[${receiptSource(prior.source)}])
 then raise exception 'Exact prior Facebook migration receipt required'; end if;` : ''}
end;
$cg_facebook_release$;
`
    const receipt = `
insert into supabase_migrations.schema_migrations(version,name,statements)
values('${spec.version}','${spec.name}',array[${receiptSource(spec.source)}]);
`
    const query = spec.source.replace(/\nbegin;\n/i, match => match + guard).replace(/\ncommit;\s*$/i, receipt + '\ncommit;\n')
    return { version: spec.version, name: spec.name, file: spec.file, source_sha256: spec.sha256, query_sha256: hash(query), query }
  })
  return {
    status: 'PREPARED_NOT_AUTHORIZED_NOT_APPLIED', project_id: 'ehtjfntukiwbgptqgbzy', migrations,
    scope: 'Only pinned Facebook queue and captured-schedule RPC with atomic original-version receipts; no history repair, job or provider action',
    preflight: 'Fresh exact project/schema/history/source/ownership comparison required; any drift stops before application',
    failure: 'Each transaction rolls back its own DDL and receipt; preserve any previously committed migration and all operational/audit records',
  }
}

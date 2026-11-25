-- PREPARED ONLY. Separate exact CA approval required. No invocation or key value.
-- FIRST privately configure matching BACKGROUND_WORKER_INVOCATION_SECRET in Edge
-- and cg_background_worker_invocation_secret in Vault (new 256-bit random key).
-- THEN apply this exact transaction, THEN release the reviewed worker auth guard.
-- Supabase protects direct row locks on cron.job. Serializable isolation keeps
-- the read/alter compare safe through the supported cron.alter_job API without
-- granting UPDATE, assuming its extension owner or overwriting concurrent edits.
begin isolation level serializable;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $guard$
declare target cron.job; valid_keys integer; unrelated_before text; unrelated_after text;
begin
  perform pg_advisory_xact_lock(hashtext('cg-background-worker-auth-2026-11-24'));
  select * into strict target from cron.job where jobid=1 and jobname='cg-background-worker';
  if target.schedule is distinct from '* * * * *' or target.active is distinct from true
     or md5(target.command) is distinct from 'a432533625dcb8db3cd10c3c7e518e69' then
    raise exception 'Exact existing worker cron fingerprint required; do not replay';
  end if;
  select count(*) into valid_keys from vault.decrypted_secrets
    where name='cg_background_worker_invocation_secret' and decrypted_secret ~ '^[0-9a-f]{64}$';
  if valid_keys <> 1 or (select count(*) from vault.secrets where name='cg_background_worker_invocation_secret') <> 1 then
    raise exception 'One privately configured worker invocation key required';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(j) order by jobid)::text,'[]')) into unrelated_before from cron.job j where jobid<>1;
  perform cron.alter_job(1::bigint, command := $command$
with worker_key as materialized (
  select min(decrypted_secret) as secret from vault.decrypted_secrets
  where name='cg_background_worker_invocation_secret'
  having count(*)=1 and bool_and(decrypted_secret ~ '^[0-9a-f]{64}$')
), tick as materialized (
  select floor(extract(epoch from statement_timestamp()))::bigint::text as stamp
)
select net.http_post(
  url := 'https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/background-worker',
  headers := jsonb_build_object('Content-Type','application/json',
    'X-CG-Worker-Timestamp',tick.stamp,
    'X-CG-Worker-Signature',encode(extensions.hmac(
      E'cg-background-worker:v1\nPOST\n' || tick.stamp,worker_key.secret,'sha256'),'hex')),
  body := '{}'::jsonb,
  timeout_milliseconds := 30000
) from worker_key cross join tick;
$command$);
  if not exists(select 1 from cron.job where jobid=1 and jobname=target.jobname
      and schedule=target.schedule and active=target.active and database=target.database
      and username=target.username and command like '%X-CG-Worker-Signature%') then
    raise exception 'Worker cron identity/schedule changed unexpectedly';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(j) order by jobid)::text,'[]')) into unrelated_after from cron.job j where jobid<>1;
  if unrelated_after is distinct from unrelated_before then raise exception 'Other cron rows changed'; end if;
end
$guard$;
commit;

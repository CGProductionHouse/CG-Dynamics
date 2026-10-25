import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const sql = readFileSync('supabase/migrations/20260806090001_assistant_linked_completed_authority.sql', 'utf8')
const push = readFileSync('supabase/migrations/20260804070651_iphone_web_push_notifications.sql', 'utf8')
function functionSql(source, name) {
  const start = source.indexOf(`create or replace function public.${name}()`)
  assert.ok(start >= 0)
  const end = source.indexOf('$$;', start)
  assert.ok(end > start)
  // The ONLY substitution is clock injection. All actual predicates, joins,
  // dedupe keys and queue logic execute from the committed SQL, not a JS clone.
  return source.slice(start, end + 3).replace(/\bnow\(\)/g, 'public.fixture_now()')
}

test('reminder acceptance executes the latest generator definition, not an obsolete baseline', () => {
  const files = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()
  const definitions = files.filter(name => /create or replace function public\.generate_due_assistant_notifications\(\)/i.test(readFileSync(`supabase/migrations/${name}`, 'utf8')))
  assert.equal(definitions.at(-1), '20260806090001_assistant_linked_completed_authority.sql')
})

test('real reminder + push-queue SQL: isolation, dedupe, completed/history/quiet-hour gates; calendar is NOT invitation delivery', { skip: !process.env.CG_LOCAL_PGLITE_MODULE }, async t => {
  const { PGlite } = await import(pathToFileURL(process.env.CG_LOCAL_PGLITE_MODULE).href)
  const db = await PGlite.create()
  const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const alice = id(1), bob = id(2), inactive = id(3), client = id(4), item = id(10), task = id(20)
  const run = () => db.query('select public.generate_due_assistant_notifications() as inserted')
  const count = async table => Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n)
  const reset = async () => db.exec("truncate notifications, web_push_deliveries, background_jobs; update fixture_clock set value='2026-10-25T13:00:00Z';")
  try {
    await db.exec(readFileSync('tests/sql/staff_reminder_contract_fixture.sql', 'utf8'))
    await db.exec(functionSql(push, 'queue_notification_web_push'))
    await db.exec('create trigger fixture_queue after insert on notifications for each row execute function queue_notification_web_push()')
    await db.exec(functionSql(sql, 'generate_due_assistant_notifications'))
    for (const [user, name, role, active] of [[alice, 'Synthetic A', 'staff', true], [bob, 'Synthetic B', 'staff', true], [inactive, 'Inactive', 'staff', false], [client, 'Client', 'client', true]]) {
      await db.query('insert into profiles values($1,$2,$3,$4)', [user, name, role, active])
      await db.query('insert into web_push_subscriptions values($1,$2,true,null)', [id(100 + Number(user.slice(-2))), user])
    }
    await db.query('insert into web_push_subscriptions values($1,$2,true,null)', [id(200), alice])
    await db.query("insert into assistant_day_items values($1,$2,'open','follow_up','Synthetic follow-up',null,null,'2026-10-25T13:02:00Z')", [item, alice])
    await t.test('one exact recipient notification queues each owned device once; replay queues no duplicates', async () => {
      assert.equal((await run()).rows[0].inserted, 1)
      assert.equal(await count('notifications'), 1)
      assert.equal(await count('web_push_deliveries'), 2)
      assert.equal(await count('background_jobs'), 1)
      assert.deepEqual((await db.query('select distinct user_id from web_push_deliveries')).rows, [{ user_id: alice }])
      assert.equal((await run()).rows[0].inserted, 0)
      assert.equal(await count('web_push_deliveries'), 2)
      assert.equal(await count('background_jobs'), 1)
      assert.ok((await db.query('select status from web_push_deliveries')).rows.every(row => row.status === 'queued'), 'queued is NOT provider/device delivered')
    })
    await t.test('inactive/client/closed/distant reminders cannot receive staff notifications', async () => {
      await reset()
      for (const user of [inactive, client]) {
        await db.query('update assistant_day_items set user_id=$1 where id=$2', [user, item])
        assert.equal((await run()).rows[0].inserted, 0)
      }
      await db.query("update assistant_day_items set user_id=$1,state='completed' where id=$2", [alice, item])
      assert.equal((await run()).rows[0].inserted, 0)
      await db.query("update assistant_day_items set state='open', reminder_at='2026-10-25T14:00:00Z' where id=$1", [item])
      assert.equal((await run()).rows[0].inserted, 0)
    })
    await t.test('completed, archived, superseded and removed linked tasks never resurrect an open reminder', async () => {
      await reset()
      await db.query("insert into planner_tasks(id,title,status) values($1,'Synthetic linked task','done')", [task])
      await db.query("update assistant_day_items set planner_task_id=$1,reminder_at='2026-10-25T13:02:00Z' where id=$2", [task, item])
      for (const status of ['done', 'completed']) {
        await db.query('update planner_tasks set status=$1 where id=$2', [status, task])
        assert.equal((await run()).rows[0].inserted, 0)
      }
      await db.query("update planner_tasks set status='to_do' where id=$1", [task])
      for (const column of ['archived_at', 'microsoft_source_removed_at', 'superseded_by_task_id']) {
        await db.query(`update planner_tasks set ${column}=$1 where id=$2`, [column === 'superseded_by_task_id' ? id(99) : '2026-10-25T12:00:00Z', task])
        assert.equal((await run()).rows[0].inserted, 0)
        await db.query(`update planner_tasks set ${column}=null where id=$1`, [task])
      }
      assert.equal((await run()).rows[0].inserted, 1, 'verified reopen can reactivate an explicitly open reminder')
    })
    await t.test('exact reminder-window boundaries are inclusive and replay cannot requeue an unchanged reminder', async () => {
      for (const [at, expected] of [['2026-10-25T12:55:00Z',1],['2026-10-25T12:54:59.999Z',0],['2026-10-25T13:10:00Z',1],['2026-10-25T13:10:00.001Z',0]]) {
        await reset()
        await db.query('update assistant_day_items set planner_task_id=null,reminder_at=$1 where id=$2',[at,item])
        assert.equal((await run()).rows[0].inserted,expected,at)
        assert.equal((await run()).rows[0].inserted,0,'identical replay')
        assert.equal(await count('background_jobs'),expected)
      }
    })
    await t.test('07:00 SAST starts eligibility;19:00 SAST stops it without creating a second reminder scheduler', async () => {
      for(const [clock,expected]of [['2026-10-25T04:59:59Z',0],['2026-10-25T05:00:00Z',1],['2026-10-25T16:59:59Z',1],['2026-10-25T17:00:00Z',0]]){
        await reset()
        await db.query('update fixture_clock set value=$1',[clock])
        await db.query('update assistant_day_items set planner_task_id=null,reminder_at=$1 where id=$2',[clock,item])
        await run()
        assert.equal(Number((await db.query("select count(*) n from notifications where type='assistant_reminder'")).rows[0].n),expected,clock)
      }
    })
    await t.test('quiet hours produce nothing; an assigned calendar event is NOT an invitation/reminder source', async () => {
      await reset()
      await db.query("update fixture_clock set value='2026-10-25T19:00:00Z'")
      assert.equal((await run()).rows[0].inserted, 0)
      await reset()
      await db.exec('truncate assistant_day_items')
      await db.query("insert into company_calendar_events values($1,'Synthetic internal meeting','2026-10-25T13:05:00Z','confirmed','Synthetic A')", [id(30)])
      assert.equal((await run()).rows[0].inserted, 0)
      assert.equal(await count('notifications'), 0)
      assert.equal(await count('web_push_deliveries'), 0)
      assert.equal(await count('background_jobs'), 0)
    })
    await t.test('expired/disabled devices cannot qualify a reminder; exact expiry is excluded', async () => {
      await db.query("insert into assistant_day_items values($1,$2,'open','follow_up','Synthetic expiry follow-up',null,null,'2026-10-25T13:02:00Z')",[item,alice])
      for(const expiry of ['2026-10-25T12:59:59Z','2026-10-25T13:00:00Z']){
        await reset()
        await db.query("update assistant_day_items set planner_task_id=null,reminder_at='2026-10-25T13:02:00Z' where id=$1",[item])
        await db.query('update web_push_subscriptions set is_active=true,expires_at=$1 where user_id=$2',[expiry,alice])
        assert.equal((await run()).rows[0].inserted,0)
        assert.equal(await count('web_push_deliveries'),0)
      }
      await db.query('update web_push_subscriptions set expires_at=null,is_active=false where user_id=$1',[alice])
      assert.equal((await run()).rows[0].inserted,0)
      await db.query('update web_push_subscriptions set is_active=true,expires_at=$1 where id=$2',['2026-10-25T13:00:00.001Z',id(200)])
      assert.equal((await run()).rows[0].inserted,1)
      assert.deepEqual((await db.query('select subscription_id,user_id from web_push_deliveries')).rows,[{subscription_id:id(200),user_id:alice}])
      assert.equal((await run()).rows[0].inserted,0)
    })
  } finally { await db.close() }
})

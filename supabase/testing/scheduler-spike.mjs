import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const context = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''))
assert.equal(context.project, 'gymio-workout-push-local')
assert.equal(context.port, '55441')
assert.ok(path.isAbsolute(context.root) && path.basename(context.root).startsWith('gymio-workout-push-'))
assert.equal(fs.readFileSync(path.join(context.root, '.owner'), 'utf8').trim(), context.project)
const sql = (input) => execFileSync('docker', ['exec', '-i', `supabase_db_${context.project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] })
assert.equal(sql("select extversion from pg_extension where extname='pg_cron';").trim(), '1.6.4')
const name = 'gymio-workout-cadence-spike'
let job
try {
  sql(`create schema gymio_scheduler_spike authorization postgres;
    revoke all on schema gymio_scheduler_spike from public,anon,authenticated,service_role;
    create table gymio_scheduler_spike.runs(id bigint generated always as identity primary key,started_at timestamptz not null,ended_at timestamptz);
    alter table gymio_scheduler_spike.runs enable row level security;
    create function gymio_scheduler_spike.record_tick() returns void language plpgsql set search_path='' as $$
      declare v_id bigint;
      begin
        if not pg_catalog.pg_try_advisory_xact_lock(18347621) then raise exception 'unexpected overlap'; end if;
        insert into gymio_scheduler_spike.runs(started_at) values(clock_timestamp()) returning id into v_id;
        perform pg_catalog.pg_sleep(0.1);
        update gymio_scheduler_spike.runs set ended_at=clock_timestamp() where id=v_id;
      end $$;
    revoke all on function gymio_scheduler_spike.record_tick() from public,anon,authenticated,service_role;`)
  job = Number(sql(`select cron.schedule('${name}', '10 seconds', 'select gymio_scheduler_spike.record_tick();');`).trim())
  assert.ok(Number.isSafeInteger(job) && job > 0)
  let count = 0
  const deadline = Date.now() + 55000
  while (count < 3 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    count = Number(sql('select count(*) from gymio_scheduler_spike.runs where ended_at is not null;').trim())
  }
  assert.ok(count >= 3, 'three real cron executions')
  sql(`select cron.unschedule(${job});`)
  const runs = JSON.parse(sql('select jsonb_agg(to_jsonb(r) order by started_at) from gymio_scheduler_spike.runs r;'))
  const intervals = runs.slice(1).map((run, i) => (Date.parse(run.started_at)-Date.parse(runs[i].started_at))/1000)
  assert.ok(intervals.every((value) => value >= 8 && value <= 12), 'approximately ten seconds')
  for (let i=1; i<runs.length; i++) assert.ok(Date.parse(runs[i-1].ended_at) <= Date.parse(runs[i].started_at), 'no overlap')
  const statuses = JSON.parse(sql(`select jsonb_agg(status) from cron.job_run_details where jobid=${job};`))
  assert.ok(statuses.length >= 3 && statuses.every((value) => value === 'succeeded'), 'successful cron runs')
  const result = { passed:true, version:'1.6.4', schedule:'10 seconds', command:'select gymio_scheduler_spike.record_tick();', runs, intervals, externalRequests:0 }
  fs.writeFileSync(path.join(context.root,'scheduler-spike-result.json'), JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
} finally {
  if (job) sql(`select cron.unschedule(jobid) from cron.job where jobid=${job}; delete from cron.job_run_details where jobid=${job};`)
  sql('drop schema if exists gymio_scheduler_spike cascade;')
}

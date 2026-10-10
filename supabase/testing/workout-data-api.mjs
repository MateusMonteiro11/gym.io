import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {workoutContext} from './workout-context.mjs'
const {context,api,status,sql,users}=workoutContext(process.argv[2]),anon=status.ANON_KEY??status.anon_key
let rejections=0
for(const jwt of [null,users[0].jwt,users[1].jwt]){
 for(const [name,body]of [['workout_push_claim',{p_limit:10}],['workout_push_begin',{p_delivery_id:'11111111-1111-4111-8111-111111111111',p_claim_token:'11111111-1111-4111-8111-111111111111'}],['workout_push_complete',{p_delivery_id:'11111111-1111-4111-8111-111111111111',p_claim_token:'11111111-1111-4111-8111-111111111111',p_outcome:'accepted',p_snapshot:{}}]]){
  const response=await fetch(`${api}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anon,...(jwt?{Authorization:`Bearer ${jwt}`}:{ }),'Content-Type':'application/json'},body:JSON.stringify(body)})
  assert.ok([401,403].includes(response.status),`${name} forbidden to client`);await response.body?.cancel();rejections++
 }
 for(const method of ['GET','POST','PATCH','DELETE'])for(const table of ['outbox','deliveries']){
  const response=await fetch(`${api}/rest/v1/${table}`,{method,headers:{apikey:anon,...(jwt?{Authorization:`Bearer ${jwt}`}:{ }),'Accept-Profile':'gymio_workout_push_private','Content-Profile':'gymio_workout_push_private','Content-Type':'application/json'},...(method==='POST'||method==='PATCH'?{body:'{}'}:{})})
  assert.equal(response.status,406,'private schema is not exposed');await response.body?.cancel();rejections++
 }
}
const migration=fs.readFileSync('supabase/migrations/20261010183821_workout_notifications.sql','utf8'),assertions=migration.match(/do \$assertions\$[\s\S]*?\$assertions\$;/)[0]
sql(assertions)
const fixtures=[
 'grant usage on schema gymio_workout_push_private to authenticated;',
 'grant select on gymio_workout_push_private.outbox to anon;',
 'grant select(id) on gymio_workout_push_private.deliveries to gymio_push_executor;',
 'grant execute on function public.workout_push_claim(integer)to authenticated;',
 'alter function public.workout_push_begin(uuid,uuid)security invoker;',
 'alter table gymio_workout_push_private.deliveries disable row level security;',
 'alter table gymio_workout_push_private.deliveries drop constraint deliveries_subscription_id_fkey;',
 'drop index gymio_workout_push_private.workout_delivery_subscription_idx;',
 "select cron.alter_job((select jobid from cron.job where jobname='gymio-workout-push'),schedule:='20 seconds');",
]
for(const fixture of fixtures){assert.throws(()=>sql(`begin;${fixture}\n${assertions}\nrollback;`),'negative assertion must fail');sql(assertions)}
fs.writeFileSync(path.join(context.root,'workout-api-result.json'),JSON.stringify({passed:true,clientRejections:rejections,negativeFixtures:fixtures.length}))
console.log(`PASS B Data API: ${rejections} client RPC/direct-DML rejections; ${fixtures.length} rolled-back negative assertion fixtures`)

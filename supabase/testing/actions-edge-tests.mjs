import assert from 'node:assert/strict'
import {actionsContext} from './actions-context.mjs'
import {actionsFixture} from './actions-fixture.mjs'
const c=actionsContext(process.argv[2]),f=actionsFixture(c),sub=f.subscribe(),origin={Origin:'http://localhost:5173'}
try {
 f.start();const issued=f.issue(sub),capability=issued.projection.controls[0].capability
 const route='/functions/v1/workout-action'
 for(const [body,headers] of [[{},origin],[{capability,identity:f.b.id},origin],[{capability},{Origin:'http://localhost:5174'}],[{capability},{}]]){
  const result=await c.request(route,null,body,{headers,publicOnly:true});assert.ok(result.status>=400);assert.equal(result.data.result,'unavailable')
 }
 const options=await c.request(route,null,undefined,{method:'OPTIONS',publicOnly:true,headers:{...origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}})
 assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),'http://localhost:5173')
 const success=await c.request(route,null,{capability},{headers:origin,publicOnly:true})
 assert.equal(success.status,200);assert.equal(success.data.result,'ok');assert.equal(success.data.projection.version,3)
 assert.equal(success.headers.get('Access-Control-Allow-Origin'),'http://localhost:5173')
 const replay=await c.request(route,null,{capability},{headers:origin,publicOnly:true});assert.equal(replay.data.result,'already_used')
 // Real 10-second production timeout against a locked local Session V2 row.
 // A timeout is ambiguous: permit zero or one committed action, never assert
 // rollback merely because the browser did not receive the result.
 f.start();const timed=f.issue(sub).projection.controls[0].capability,before=Number(f.session.revisao)
 const lock=c.concurrentSql(`begin;set local application_name='gymio_c_timeout';select 1 from public.treino_sessoes where id_sessao=${c.literal(f.session.id_sessao)} for update;select pg_sleep(12);commit;`)
 for(let i=0;i<30;i++){
  if(c.sql("select exists(select 1 from pg_stat_activity where application_name='gymio_c_timeout' and wait_event='PgSleep');")==='t')break
  await new Promise((r)=>setTimeout(r,100));if(i===29)throw Error('timeout_lock_not_ready')
 }
 const started=Date.now(),timeout=await c.request(route,null,{capability:timed},{headers:origin,publicOnly:true})
 assert.equal(timeout.status,503);assert.equal(timeout.data.result,'unavailable');assert.ok(Date.now()-started>=9000&&Date.now()-started<18000)
 await lock
 assert.ok(Number(c.sql(`select revisao from public.treino_sessoes where id_sessao=${c.literal(f.session.id_sessao)};`))<=before+1)
 console.log('PASS C real Edge: production 10-second timeout, ambiguous outcome bounded to at most one mutation')
 f.rpc('remover_push_subscription',[c.literal(sub)])
 // Test-only fixed harness uses real Auth/DB and injected transport. Production
 // routes contain no fake transport, destination override or auth bypass.
 for(const group of ['boundary','timeout','sanitize','sender_bound','sender_removed','sender_after_claim','sender_logout','sender_user_cascade',
   'sender_404','sender_410','sender_refresh','sender_temporary','sender_partial','sender_no_retry']) {
  f.start(1)
  const response=await c.request('/functions/v1/actions-integration',f.a.jwt,{group},{headers:origin})
  assert.equal(response.status,200,group);assert.equal(response.data.passed,true,group);assert.equal(response.data.externalPushRequests,0)
  console.log(`PASS C real Edge: ${group}`)
 }
} finally {f.clean()}

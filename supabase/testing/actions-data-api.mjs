import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createECDH,randomBytes,randomUUID} from 'node:crypto'
import {actionsContext} from './actions-context.mjs'
import {actionsFixture} from './actions-fixture.mjs'
const c=actionsContext(process.argv[2]),f=actionsFixture(c),{request,sql,value,literal:q}=c,sub=f.subscribe(),other=f.subscribe(f.b)
const schema='gymio_workout_actions_private'
const snapshot=(sessionId)=>value(`select jsonb_build_object('session',(select to_jsonb(s)from public.treino_sessoes s where id_sessao=${q(sessionId)}),
 'generations',coalesce((select jsonb_agg(to_jsonb(g)order by id)from ${schema}.generations g where id_sessao=${q(sessionId)}),'[]'::jsonb),
 'capabilities',coalesce((select jsonb_agg(to_jsonb(c)order by id)from ${schema}.capabilities c where id_sessao=${q(sessionId)}),'[]'::jsonb));`)
const unchanged=(before,after,message)=>assert.ok(JSON.stringify(before)===JSON.stringify(after),message)
const subscriptionSnapshot=()=>value("select coalesce(jsonb_agg(to_jsonb(ps)order by id),'[]'::jsonb)from public.push_subscriptions ps;")
const directKey=createECDH('prime256v1');directKey.generateKeys()
const directP256dh=directKey.getPublicKey().toString('base64url'),directAuth=randomBytes(16).toString('base64url')
let rejected=0
try {
 f.start()
 for(const jwt of [null,f.a.jwt,f.b.jwt]) {
  for(const [name,args] of [['workout_notification_action',{p_capability:'A'.repeat(43)}],
    ['workout_push_begin_controls',{p_delivery_id:'11111111-1111-4111-8111-111111111111',p_claim_token:'11111111-1111-4111-8111-111111111111'}]]) {
    const result=await request(`/rest/v1/rpc/${name}`,jwt,args);assert.ok([401,403].includes(result.status));rejected++
  }
  for(const table of ['generations','capabilities'])for(const method of ['GET','POST','PATCH','DELETE']){
    const result=await request(`/rest/v1/${table}`,jwt,['POST','PATCH'].includes(method)?{}:undefined,{method,
      headers:{'Accept-Profile':'gymio_workout_actions_private','Content-Profile':'gymio_workout_actions_private'}})
    assert.equal(result.status,406);rejected++
  }
  for(const table of ['outbox','deliveries'])for(const method of ['GET','POST','PATCH','DELETE']){
    const result=await request(`/rest/v1/${table}`,jwt,['POST','PATCH'].includes(method)?{}:undefined,{method,
      headers:{'Accept-Profile':'gymio_workout_push_private','Content-Profile':'gymio_workout_push_private'}})
    assert.equal(result.status,406);rejected++
  }
  const beforeDirectDml=subscriptionSnapshot()
  for(const method of ['GET','POST','PATCH','DELETE']){
    // Match the historical A probe: valid concrete POST/PATCH and target an
    // existing fixture for PATCH/DELETE. Supabase's safe-update baseline rejects
    // unfiltered mutations before permissions, which cannot prove this ACL.
    const filter=['PATCH','DELETE'].includes(method)?`?id=eq.${sub}`:''
    const body=method==='POST'?{id_usuario:f.a.id,endpoint:'https://fcm.googleapis.com/fcm/send/c-direct-api-'+randomUUID(),p256dh:directP256dh,auth:directAuth}:
      method==='PATCH'?{auth:directAuth}:undefined
    const result=await request('/rest/v1/push_subscriptions'+filter,jwt,body,{method})
    assert.ok([401,403].includes(result.status),`targeted direct ${method} must be denied by ACL`);rejected++
    unchanged(beforeDirectDml,subscriptionSnapshot(),`direct ${method} rejection must preserve all existing subscription rows`)
  }
 }
 const args={p_session_id:f.session.id_sessao,p_subscription_id:sub,p_expected_revision:f.session.revisao}
 assert.ok([401,403].includes((await request('/rest/v1/rpc/emitir_controles_notificacao_treino',null,args)).status))
 assert.equal((await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.b.jwt,args)).data.result,'stale')
 assert.equal((await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,{...args,p_subscription_id:other})).data.result,'unavailable')
 for(const revision of [null,'-1',String(Number(f.session.revisao)-1)])
  assert.equal((await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,{...args,p_expected_revision:revision})).data.result,'stale')
 const ownedByB=actionsFixture(c,{owner:f.b})
 try{
  ownedByB.start();const before=snapshot(ownedByB.session.id_sessao)
  const denied=await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,{...args,p_session_id:ownedByB.session.id_sessao,p_expected_revision:ownedByB.session.revisao})
  assert.equal(denied.status,200);assert.equal(denied.data.result,'stale')
  unchanged(before,snapshot(ownedByB.session.id_sessao),'A JWT issuing for real B session must produce no generation, capability or session mutation')
 }finally{ownedByB.clean()}
 const first=await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,args)
 assert.equal(first.status,200);assert.equal(first.data.result,'ok');assert.equal(first.data.projection.version,3)
 const beforeRepeat=snapshot(f.session.id_sessao)
 const repeated=await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,args)
 assert.equal(repeated.data.result,'unchanged');assert.deepEqual(repeated.data.projection.controls,[])
 assert.equal(repeated.data.projection.generation_id,first.data.projection.generation_id)
 unchanged(beforeRepeat,snapshot(f.session.id_sessao),'Data API unchanged must preserve every C row, count, hash and invalidated_at')
 // Administrative C remains inaccessible even with malformed/non-string bearer
 // payloads; handler-level JSON shape/canonical negatives run in Edge tests.
 for(const capability of [null,42,{},[],true])for(const jwt of [null,f.a.jwt,f.b.jwt]){
  const response=await request('/rest/v1/rpc/workout_notification_action',jwt,{p_capability:capability})
  assert.ok([400,401,403,404].includes(response.status));assert.ok(response.data?.result!=='ok');rejected++
 }
 unchanged(beforeRepeat,snapshot(f.session.id_sessao),'denied administrative malformed payloads must have zero mutation')
 for(const role of ['anon','authenticated','service_role','gymio_push_executor','gymio_workout_executor'])
  assert.equal(sql(`select bool_or(has_table_privilege(${q(role)},c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(${q(role)},c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) from pg_class c where relnamespace='gymio_workout_actions_private'::regnamespace and relkind='r';`),'f')
 for(const name of ['20261007215944_push_foundation.sql','20261010183821_workout_notifications.sql']) {
  const text=fs.readFileSync(`supabase/migrations/${name}`,'utf8')
  const assertions=text.match(/do \$assertions\$[\s\S]*?\$assertions\$;/)?.[0];assert.ok(assertions);sql(assertions)
 }
 const source=fs.readFileSync('supabase/migrations/20261011021351_workout_notification_actions.sql','utf8')
 const capture=source.slice(source.indexOf('create temporary table gymio_c_historical'),source.indexOf('create schema gymio_workout_actions_private'))
 const assertions=source.match(/do \$assert\$[\s\S]*?\$assert\$;/)?.[0]
 assert.ok(capture.startsWith('create temporary table')&&assertions)
 sql(`begin;${capture}${assertions}rollback;`)
 // Reexecute the actual C assertion block under each negative grant. Every
 // unexpected privilege MUST throw, and disconnect rolls the transaction back.
 for(const grant of ['grant usage on schema gymio_workout_actions_private to authenticated;',
   'grant select on gymio_workout_actions_private.capabilities to anon;',
   'grant select(token_hash)on gymio_workout_actions_private.capabilities to authenticated;',
   'grant execute on function public.workout_notification_action(text)to authenticated;']) {
  assert.throws(()=>sql(`begin;${capture}${grant}${assertions}rollback;`),'C assertions must reject the specific unexpected privilege')
  sql(`begin;${capture}${assertions}rollback;`)
 }
 console.log(`PASS C Data API: ${rejected} administrative/schema/DML rejections; real A/B cross-session/subscription JWT ownership; unchanged full snapshots; actual A/B/C assertions and C fail-closed negative probes`)
} finally {f.clean()}

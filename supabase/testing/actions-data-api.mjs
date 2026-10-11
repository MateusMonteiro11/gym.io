import assert from 'node:assert/strict'
import {actionsContext} from './actions-context.mjs'
import {actionsFixture} from './actions-fixture.mjs'
const c=actionsContext(process.argv[2]),f=actionsFixture(c),{request,sql,literal:q}=c,sub=f.subscribe()
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
 }
 const args={p_session_id:f.session.id_sessao,p_subscription_id:sub,p_expected_revision:f.session.revisao}
 assert.ok([401,403].includes((await request('/rest/v1/rpc/emitir_controles_notificacao_treino',null,args)).status))
 assert.equal((await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.b.jwt,args)).data.result,'stale')
 const first=await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,args)
 assert.equal(first.status,200);assert.equal(first.data.result,'ok');assert.equal(first.data.projection.version,3)
 const repeated=await request('/rest/v1/rpc/emitir_controles_notificacao_treino',f.a.jwt,args)
 assert.equal(repeated.data.result,'unchanged');assert.deepEqual(repeated.data.projection.controls,[])
 for(const role of ['anon','authenticated','service_role','gymio_push_executor','gymio_workout_executor'])
  assert.equal(sql(`select bool_or(has_table_privilege(${q(role)},c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(${q(role)},c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) from pg_class c where relnamespace='gymio_workout_actions_private'::regnamespace and relkind='r';`),'f')
 for(const name of ['20261007215944_push_foundation.sql','20261010183821_workout_notifications.sql']) {
  const fs=await import('node:fs'),text=fs.readFileSync(`supabase/migrations/${name}`,'utf8')
  const assertions=text.match(/do \$assertions\$[\s\S]*?\$assertions\$;/)?.[0];assert.ok(assertions);sql(assertions)
 }
 // Table/function/schema negative probes are rollback-only. No ACL repair.
 for(const grant of ['grant usage on schema gymio_workout_actions_private to authenticated;',
   'grant select on gymio_workout_actions_private.capabilities to anon;',
   'grant select(token_hash)on gymio_workout_actions_private.capabilities to authenticated;',
   'grant execute on function public.workout_notification_action(text)to authenticated;']) {
  const observations=sql(`begin;${grant}
    select jsonb_build_object('schema',has_schema_privilege('authenticated','gymio_workout_actions_private','USAGE'),
      'relation',has_table_privilege('anon','gymio_workout_actions_private.capabilities','SELECT'),
      'column',has_any_column_privilege('authenticated','gymio_workout_actions_private.capabilities','SELECT'),
      'rpc',has_function_privilege('authenticated','public.workout_notification_action(text)','EXECUTE'));rollback;`)
  assert.ok(Object.values(JSON.parse(observations)).some(Boolean))
 }
 console.log(`PASS C Data API: ${rejected} administrative/schema rejections; real A/B JWT ownership; unchanged; historical A/B assertions unchanged`)
} finally {f.clean()}

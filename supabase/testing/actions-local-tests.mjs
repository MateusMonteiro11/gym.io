import assert from 'node:assert/strict'
import {actionsContext} from './actions-context.mjs'
import {actionsFixture} from './actions-fixture.mjs'
const c=actionsContext(process.argv[2]),f=actionsFixture(c),{sql,value,literal:q,concurrentSql}=c,schema='gymio_workout_actions_private'
const token=(issued,action)=>issued.projection.controls.find((control)=>control.action===action).capability
const run=async(name,fn)=>{await fn();console.log(`PASS C SQL: ${name}`)}
const sub=f.subscribe(),second=f.subscribe(),other=f.subscribe(f.b)
try {
 await run('ownership, unchanged, backend text hash, replay and siblings',()=>{
  f.start();const issued=f.issue(sub),g=issued.projection.generation_id,original=token(issued,'rest_add_15')
  assert.equal(f.issue(sub).result,'unchanged');assert.deepEqual(f.issue(sub).projection.controls,[])
  assert.equal(f.issue(sub,f.session.revisao,f.b).result,'stale');assert.equal(f.issue(other).result,'unavailable')
  assert.equal(f.issue(sub,Number(f.session.revisao)-1).result,'stale')
  const hash=sql(`select encode(token_hash,'hex')from ${schema}.capabilities where generation_id=${q(g)} and action='rest_add_15';`)
  const encoded=sql(`select translate(rtrim(encode(token_hash,'base64'),'='),'+/','-_')from ${schema}.capabilities where generation_id=${q(g)} and action='rest_add_15';`)
  assert.equal(f.consume(hash).result,'unavailable');assert.equal(f.consume(encoded).result,'unavailable')
  const result=f.consume(original);assert.equal(result.result,'ok');assert.equal(result.projection.revisao,String(Number(f.session.revisao)+1))
  assert.equal(f.consume(original).result,'already_used');assert.equal(f.consume(token(issued,'rest_skip')).result,'stale')
 })
 for(const [action,paused] of [['rest_pause',false],['rest_resume',true],['rest_skip',false],['rest_skip',true],['rest_continue',false]])await run(`fixed ${action}${paused?' paused':''}`,async()=>{
  f.start(action==='rest_continue'?1:120);if(paused)f.mutate('definir_pausa_treino_sessao','true')
  if(action==='rest_continue')await new Promise((r)=>setTimeout(r,1100))
  const before=f.session,issued=f.issue(sub),result=f.consume(token(issued,action))
  assert.equal(result.result,'ok');assert.equal(result.projection.revisao,String(Number(before.revisao)+(action==='rest_skip'&&paused?2:1)))
  assert.equal(result.projection.fase,['rest_skip','rest_continue'].includes(action)?'execucao':'descanso')
  if(action==='rest_pause')assert.equal(result.projection.pausada,true)
  if(action==='rest_resume')assert.equal(result.projection.pausada,false)
 })
 await run('two consumers serialize; exactly one action, old generation cannot replay',async()=>{
  f.start();const issued=f.issue(sub),t=token(issued,'rest_add_15'),statement=`select public.workout_notification_action(${q(t)});`
  const results=await Promise.all([concurrentSql(statement),concurrentSql(statement)])
  assert.deepEqual(results.map((r)=>JSON.parse(r).result).sort(),['already_used','ok'])
  assert.equal(sql(`select revisao from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`),String(Number(f.session.revisao)+1))
 })
 await run('reissuance serializes for the same session/subscription',async()=>{
  f.start();const s=f.session,statement=`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(f.a.id)},true);select public.emitir_controles_notificacao_treino(${q(s.id_sessao)},${q(sub)},${s.revisao});commit;`
  const results=await Promise.all([concurrentSql(statement),concurrentSql(statement)])
  assert.deepEqual(results.map((r)=>JSON.parse(r.split('\n').find((l)=>l.startsWith('{'))).result).sort(),['ok','unchanged'])
 })
 await run('pause beyond original deadline, resume shifts both clocks and preserves remaining rest',async()=>{
  f.start(3);const original=f.session;f.mutate('definir_pausa_treino_sessao','true');const paused=f.session,issued=f.issue(sub)
  await new Promise((r)=>setTimeout(r,Math.max(0,Date.parse(original.descanso_termina_em)-Date.now())+100))
  assert.equal(f.issue(sub).result,'unchanged')
  const resumed=f.consume(token(issued,'rest_resume'));assert.equal(resumed.result,'ok');assert.equal(resumed.projection.eligible_state,'rest_active')
  const shiftStart=Date.parse(resumed.projection.descanso_iniciado_em)-Date.parse(original.descanso_iniciado_em)
  const shiftEnd=Date.parse(resumed.projection.descanso_termina_em)-Date.parse(original.descanso_termina_em)
  assert.ok(shiftEnd>0);assert.ok(Math.abs(shiftEnd-shiftStart)<=1)
  assert.ok(Math.abs((Date.parse(resumed.projection.descanso_termina_em)-Date.parse(resumed.projection.agora_servidor))-
    (Date.parse(original.descanso_termina_em)-Date.parse(paused.pausada_em)))<100)
 })
 await run('deadline changes eligible state without revision: old controls stale, new continue generation',async()=>{
  f.start(3);const active=f.issue(sub)
  await new Promise((r)=>setTimeout(r,Math.max(0,Date.parse(f.session.descanso_termina_em)-Date.now())+70))
  assert.equal(f.consume(token(active,'rest_skip')).result,'stale')
  const due=f.issue(sub);assert.equal(due.result,'ok');assert.equal(due.projection.eligible_state,'rest_finished')
  assert.notEqual(due.projection.generation_id,active.projection.generation_id);assert.equal(due.projection.revisao,active.projection.revisao)
  assert.equal(f.consume(token(due,'rest_continue')).result,'ok')
 })
 await run('constraints reject hash length, duplicate hashes, action, TTL and crossed subscription binding',()=>{
  f.start();const issued=f.issue(sub),g=issued.projection.generation_id
  const clone=`select generation_id,id_usuario,subscription_id,id_sessao,revision,'rest_resume',token_hash from ${schema}.capabilities where generation_id=${q(g)} limit 1`
  assert.throws(()=>sql(`insert into ${schema}.capabilities(generation_id,id_usuario,subscription_id,id_sessao,revision,action,token_hash) ${clone};`))
  assert.throws(()=>sql(`update ${schema}.capabilities set token_hash=decode(repeat('00',31),'hex') where generation_id=${q(g)};`))
  assert.throws(()=>sql(`update ${schema}.capabilities set action='arbitrary' where generation_id=${q(g)};`))
  assert.throws(()=>sql(`update ${schema}.generations set expires_at=created_at+interval '16 minutes' where id=${q(g)};`))
  assert.throws(()=>sql(`update ${schema}.capabilities set subscription_id=${q(other)} where generation_id=${q(g)};`))
  assert.equal(f.issue(sub).result,'unchanged')
 })
 await run('bounded retention removes at most 100 old terminal generations and preserves live controls',()=>{
  f.start();const issued=f.issue(sub),g=issued.projection.generation_id
  sql(`insert into ${schema}.generations(id_usuario,subscription_id,id_sessao,revision,eligible_state,item_id,next_set,rest_started_at,deadline,paused_at,created_at,expires_at,invalidated_at)
    select g.id_usuario,g.subscription_id,g.id_sessao,g.revision,g.eligible_state,g.item_id,g.next_set,g.rest_started_at,g.deadline,g.paused_at,
      statement_timestamp()-interval '9 days',statement_timestamp()-interval '9 days'+interval '15 minutes',statement_timestamp()-interval '8 days'
    from ${schema}.generations g cross join generate_series(1,110) where g.id=${q(g)};`)
  assert.equal(f.issue(sub).result,'unchanged')
  assert.equal(sql(`select count(*)from ${schema}.generations where id_sessao=${q(f.session.id_sessao)};`),'11')
  assert.equal(sql(`select invalidated_at is null from ${schema}.generations where id=${q(g)};`),'t')
 })
 // Each script is one physical PostgreSQL connection reused across transactions.
 for(const prior of ['present','absent','claims'])for(const ending of ['commit','rollback'])await run(`transaction-local UID: ${prior}, ${ending}, same connection reused`,()=>{
  f.start();const issued=f.issue(sub),t=token(issued,'rest_pause')
  const set=prior==='present'?`select set_config('request.jwt.claim.sub',${q(f.b.id)},true);`:prior==='claims'?`select set_config('request.jwt.claims',${q(JSON.stringify({sub:f.b.id}))},true);`:''
  const rows=sql(`begin;${set}
    select public.workout_notification_action(${q(t)});
    select jsonb_build_object('restored',coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'));
    ${ending};begin;
    select jsonb_build_object('next',nullif(current_setting('request.jwt.claim.sub',true),''),'claims',nullif(current_setting('request.jwt.claims',true),''));rollback;`).split('\n').filter((l)=>l.startsWith('{')).map(JSON.parse)
  assert.equal(rows[0].result,'ok');assert.equal(rows[1].restored,prior==='absent'?null:f.b.id)
  assert.deepEqual(rows[2],{next:null,claims:null})
 })
 for(const prior of ['present','absent','claims'])for(const ending of ['commit','rollback'])await run(`paused skip rollback and UID exception isolation: ${prior}, ${ending}`,()=>{
  f.start();f.mutate('definir_pausa_treino_sessao','true');const issued=f.issue(sub),t=token(issued,'rest_skip'),s=f.session
  // A negative fixture inside a rollback-only transaction; never deployed.
  const set=prior==='present'?`select set_config('request.jwt.claim.sub',${q(f.b.id)},true);`:prior==='claims'?`select set_config('request.jwt.claims',${q(JSON.stringify({sub:f.b.id}))},true);`:''
  const rows=sql(`begin;${set}
    create function pg_temp.fail_c_skip()returns trigger language plpgsql as $f$begin if new.fase='execucao' then raise exception 'negative fixture';end if;return new;end$f$;
    create trigger c_test_fail_skip before update on public.treino_sessoes for each row when(old.id_sessao=${q(s.id_sessao)}::uuid)execute function pg_temp.fail_c_skip();
    select public.workout_notification_action(${q(t)});
    select jsonb_build_object('uid',coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'),'revision',(select revisao from public.treino_sessoes where id_sessao=${q(s.id_sessao)}),
      'paused',(select pausada_em is not null from public.treino_sessoes where id_sessao=${q(s.id_sessao)}),'consumed',(select count(*)from ${schema}.capabilities where generation_id=${q(issued.projection.generation_id)} and (consumed_at is not null or invalidated_at is not null)));
    drop trigger c_test_fail_skip on public.treino_sessoes;drop function pg_temp.fail_c_skip();
    ${ending};begin;select jsonb_build_object('next',nullif(current_setting('request.jwt.claim.sub',true),''),'claims',nullif(current_setting('request.jwt.claims',true),''));rollback;`).split('\n').filter((l)=>l.startsWith('{')).map(JSON.parse)
  assert.equal(rows[0].result,'unavailable');assert.equal(rows[1].uid,prior==='absent'?null:f.b.id);assert.equal(String(rows[1].revision),String(s.revisao));assert.equal(rows[1].paused,true);assert.equal(rows[1].consumed,0);assert.deepEqual(rows[2],{next:null,claims:null})
 })
 await run('expiration, invalid identity, stale revision, cancellation and cascade',()=>{
  f.start();const issued=f.issue(sub),t=token(issued,'rest_skip'),g=issued.projection.generation_id
  sql(`update ${schema}.generations set created_at=statement_timestamp()-interval '16 minutes',expires_at=statement_timestamp()-interval '1 minute' where id=${q(g)};`)
  assert.equal(f.consume(t).result,'expired');assert.equal(f.issue(sub).result,'ok')
  for(const identity of ['', 'invalid'])assert.throws(()=>sql(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(identity)},true);select public.emitir_controles_notificacao_treino(${q(f.session.id_sessao)},${q(sub)},${f.session.revisao});rollback;`))
  const previous=f.issue(second);f.mutate('ajustar_descanso_treino_sessao','15');assert.equal(f.consume(token(previous,'rest_skip')).result,'stale')
  f.mutate('cancelar_treino_sessao');assert.equal(sql(`select count(*)from ${schema}.generations where id_sessao=${q(issued.projection.id_sessao)};`),'0')
 })
 await run('sender binds two deliveries to their exact subscription, same user is insufficient',async()=>{
  f.start(1);await new Promise((r)=>setTimeout(r,1100));value('select gymio_workout_push_private.capture_events();')
  const claims=value('select public.workout_push_claim(10);');assert.equal(claims.length,2)
  for(const claim of claims){
    const attempt=value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`)
    assert.equal(attempt.payload.version,3)
    const g=attempt.payload.generation_id
    assert.equal(sql(`select bool_and(subscription_id=${q(attempt.snapshot.id)}::uuid)from ${schema}.capabilities where generation_id=${q(g)};`),'t')
    assert.equal(sql(`select subscription_id from ${schema}.generations where id=${q(g)};`),attempt.snapshot.id)
  }
 })
 await run('unexpected issuance failure atomically rolls back B attempted marker',async()=>{
  f.start(1);await new Promise((r)=>setTimeout(r,1100));value('select gymio_workout_push_private.capture_events();')
  const claim=value('select public.workout_push_claim(10);')[0]
  const rows=sql(`begin;
    create function pg_temp.fail_c_issue()returns trigger language plpgsql as $f$begin raise exception 'negative issue fixture';end$f$;
    create trigger c_test_fail_issue before insert on ${schema}.generations for each row execute function pg_temp.fail_c_issue();
    do $b$begin begin perform public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});raise exception 'missing expected failure';exception when raise_exception then if sqlerrm='missing expected failure' then raise;end if;end;end$b$;
    select jsonb_build_object('state',state,'attempted',attempted_at)from gymio_workout_push_private.deliveries where id=${q(claim.id)};rollback;`).split('\n').filter((l)=>l.startsWith('{')).map(JSON.parse)
  assert.deepEqual(rows[0],{state:'claimed',attempted:null})
 })
 for(const afterClaim of [false,true])await run(`remove subscription ${afterClaim?'after':'before'} claim: no begin, no capabilities`,async()=>{
  const temporary=f.subscribe();f.start(1);await new Promise((r)=>setTimeout(r,1100));value('select gymio_workout_push_private.capture_events();')
  const claim=afterClaim?value('select public.workout_push_claim(10);').find((row)=>sql(`select subscription_id from gymio_workout_push_private.deliveries where id=${q(row.id)};`)===temporary):null
  f.rpc('remover_push_subscription',[q(temporary)])
  assert.equal(sql(`select count(*)from gymio_workout_push_private.deliveries where subscription_id=${q(temporary)};`),'0')
  if(claim)assert.equal(value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`),null)
  assert.equal(sql(`select count(*)from ${schema}.generations where subscription_id=${q(temporary)};`),'0')
 })
 console.log('C SQL matrix complete: no external Push requests')
} finally {f.clean()}

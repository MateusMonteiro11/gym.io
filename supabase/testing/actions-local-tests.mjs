import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {performance} from 'node:perf_hooks'
import {actionsContext} from './actions-context.mjs'
import {actionsFixture} from './actions-fixture.mjs'
const c=actionsContext(process.argv[2]),f=actionsFixture(c),{sql,value,literal:q,concurrentSql}=c,schema='gymio_workout_actions_private'
const token=(issued,action)=>issued.projection.controls.find((control)=>control.action===action).capability
const timings=[],cases=[]
let matrixComplete=false
const run=async(name,fn)=>{let passed=false;const started=performance.now();try{await fn();passed=true;console.log(`PASS C SQL: ${name}`)}finally{cases.push({name,passed,elapsed_ms:Number((performance.now()-started).toFixed(3))})}}
const timed=(name,fn)=>{const started=performance.now();let passed=false;try{const result=fn();passed=true;return result}finally{timings.push({operation:name,passed,elapsed_ms:Number((performance.now()-started).toFixed(3))})}}
const timedAsync=async(name,fn)=>{const started=performance.now();let passed=false;try{const result=await fn();passed=true;return result}finally{timings.push({operation:name,passed,elapsed_ms:Number((performance.now()-started).toFixed(3))})}}
const snapshotSQL=(sessionId)=>`select jsonb_build_object(
  'session',(select to_jsonb(s)from public.treino_sessoes s where id_sessao=${q(sessionId)}),
  'generations',coalesce((select jsonb_agg(to_jsonb(g)order by g.id)from ${schema}.generations g where id_sessao=${q(sessionId)}),'[]'::jsonb),
  'capabilities',coalesce((select jsonb_agg(to_jsonb(c)order by c.id)from ${schema}.capabilities c where id_sessao=${q(sessionId)}),'[]'::jsonb));`
// Snapshot hashes stay inside this process and never appear in assertion output.
const unchanged=(before,after,message)=>assert.ok(JSON.stringify(before)===JSON.stringify(after),message)
const snapshot=(id=f.session.id_sessao)=>value(snapshotSQL(id))
const waitRestDue=async()=>{
 const remaining=Number(sql(`select greatest(extract(epoch from descanso_termina_em-clock_timestamp()),0)from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`))
 await new Promise((resolve)=>setTimeout(resolve,Math.ceil(remaining*1000)+80))
 assert.equal(sql(`select descanso_termina_em<=clock_timestamp()from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`),'t')
}
const sub=f.subscribe(),second=f.subscribe(),other=f.subscribe(f.b)
try {
 await run('ownership, unchanged, backend text hash, replay and siblings',()=>{
  f.start();const issued=timed('issuance',()=>f.issue(sub)),g=issued.projection.generation_id,original=token(issued,'rest_add_15')
  assert.deepEqual(issued.projection.controls.map((control)=>control.action),['rest_add_15','rest_skip','rest_pause'])
  const before=snapshot(),repeated=timed('unchanged',()=>f.issue(sub))
  assert.equal(repeated.result,'unchanged');assert.deepEqual(repeated.projection.controls,[]);assert.equal(repeated.projection.generation_id,g)
  unchanged(before,snapshot(),'unchanged must preserve all generation/capability rows, hashes, counts and invalidation snapshots')
  assert.equal(before.generations.length,1);assert.equal(before.capabilities.length,3)
  assert.equal(sql(`select count(*)from information_schema.columns where table_schema=${q(schema)} and column_name in ('token','capability','plaintext','token_text');`),'0')
  assert.equal(sql(`select count(*)=count(distinct token_hash) and bool_and(octet_length(token_hash)=32)from ${schema}.capabilities where generation_id=${q(g)};`),'t')
  assert.equal(sql(`select bool_and(id_usuario=${q(f.a.id)}::uuid and subscription_id=${q(sub)}::uuid and id_sessao=${q(f.session.id_sessao)}::uuid and revision=${f.session.revisao})from ${schema}.capabilities where generation_id=${q(g)};`),'t')
  assert.equal(f.issue(sub,f.session.revisao,f.b).result,'stale');assert.equal(f.issue(other).result,'unavailable')
  assert.equal(f.issue(sub,Number(f.session.revisao)-1).result,'stale')
  const hash=sql(`select encode(token_hash,'hex')from ${schema}.capabilities where generation_id=${q(g)} and action='rest_add_15';`)
  const encoded=sql(`select translate(rtrim(encode(token_hash,'base64'),'='),'+/','-_')from ${schema}.capabilities where generation_id=${q(g)} and action='rest_add_15';`)
  assert.equal(sql(`select token_hash=extensions.digest(convert_to(${q(original)},'UTF8'),'sha256')from ${schema}.capabilities where generation_id=${q(g)} and action='rest_add_15';`),'t')
  const lowercase=original.toLowerCase(),uppercase=original.toUpperCase()
  assert.ok(lowercase!==original&&uppercase!==original,'synthetic token must provide distinct case mutation fixtures')
  assert.equal(value('select public.workout_notification_action(null);').result,'unavailable')
  const invalid=['',hash,encoded,`${original}=`,original.slice(0,42),`${original}A`,`${original.slice(0,10)}*${original.slice(11)}`,
   `${original.slice(0,42)}B`,` ${original}`,`${original} `,`\n${original}`,lowercase,uppercase]
  for(const candidate of invalid)assert.equal(f.consume(candidate).result,'unavailable')
  unchanged(before,snapshot(),'canonical bearer negatives must have zero SQL mutation')
  const beforeDeadline=sql(`select descanso_termina_em from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`)
  const result=timed('consume_add_15',()=>f.consume(original));assert.equal(result.result,'ok');assert.equal(result.projection.revisao,String(Number(f.session.revisao)+1))
  assert.equal(sql(`select descanso_termina_em=${q(beforeDeadline)}::timestamptz+interval '15 seconds'from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`),'t')
  assert.equal(f.consume(original).result,'already_used');assert.equal(f.consume(token(issued,'rest_skip')).result,'stale')
 })
 await run('A cannot issue controls for the real B-owned session using an A subscription',()=>{
  const ownedByB=actionsFixture(c,{owner:f.b})
  try{
   ownedByB.start();const before=snapshot(ownedByB.session.id_sessao)
   assert.equal(f.issueFor(ownedByB.session.id_sessao,sub,ownedByB.session.revisao,f.a).result,'stale')
   unchanged(before,snapshot(ownedByB.session.id_sessao),'cross-session ownership must leave Session B and all C rows unchanged')
   assert.equal(before.generations.length,0);assert.equal(before.capabilities.length,0)
  }finally{ownedByB.clean()}
 })
 for(const [action,paused] of [['rest_pause',false],['rest_resume',true],['rest_skip',false],['rest_skip',true],['rest_continue',false]])await run(`fixed ${action}${paused?' paused':''}`,async()=>{
  f.start(action==='rest_continue'?1:120);if(paused)f.mutate('definir_pausa_treino_sessao','true')
  if(action==='rest_continue')await waitRestDue()
  const before=f.session,issued=f.issue(sub),result=timed(`consume_${action}${paused?'_paused':''}`,()=>f.consume(token(issued,action)))
  assert.equal(result.result,'ok');assert.equal(result.projection.revisao,String(Number(before.revisao)+(action==='rest_skip'&&paused?2:1)))
  assert.equal(result.projection.fase,['rest_skip','rest_continue'].includes(action)?'execucao':'descanso')
  if(action==='rest_pause')assert.equal(result.projection.pausada,true)
  if(action==='rest_resume')assert.equal(result.projection.pausada,false)
 })
 await run('two consumers serialize; exactly one action, old generation cannot replay',async()=>{
  f.start();const issued=f.issue(sub),t=token(issued,'rest_add_15'),statement=`select public.workout_notification_action(${q(t)});`
  const results=await timedAsync('concurrent_consumers',()=>Promise.all([concurrentSql(statement),concurrentSql(statement)]))
  assert.deepEqual(results.map((r)=>JSON.parse(r).result).sort(),['already_used','ok'])
  assert.equal(sql(`select revisao from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`),String(Number(f.session.revisao)+1))
 })
 await run('reissuance serializes for the same session/subscription',async()=>{
  f.start();const s=f.session,statement=`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(f.a.id)},true);select public.emitir_controles_notificacao_treino(${q(s.id_sessao)},${q(sub)},${s.revisao});commit;`
  const results=await timedAsync('concurrent_issuers',()=>Promise.all([concurrentSql(statement),concurrentSql(statement)]))
  assert.deepEqual(results.map((r)=>JSON.parse(r.split('\n').find((l)=>l.startsWith('{'))).result).sort(),['ok','unchanged'])
  assert.equal(sql(`select count(*)from ${schema}.generations where id_sessao=${q(s.id_sessao)} and subscription_id=${q(sub)} and invalidated_at is null;`),'1')
  assert.equal(sql(`select count(*)from ${schema}.capabilities where id_sessao=${q(s.id_sessao)} and subscription_id=${q(sub)};`),'3')
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
 await run('continue before deadline cannot mutate: normal V2 rejection and stale capability after legitimate extension',async()=>{
  f.start();let before=snapshot()
  assert.throws(()=>f.rpc('encerrar_descanso_treino_sessao',[q(f.session.id_sessao),f.session.revisao,'false']))
  unchanged(before,snapshot(),'non-forced V2 ending before the server deadline must not mutate')
  f.start(1);await waitRestDue();const due=f.issue(sub),oldContinue=token(due,'rest_continue')
  f.mutate('ajustar_descanso_treino_sessao','15');before=snapshot()
  assert.equal(sql(`select descanso_termina_em>clock_timestamp()from public.treino_sessoes where id_sessao=${q(f.session.id_sessao)};`),'t')
  assert.equal(f.consume(oldContinue).result,'stale')
  unchanged(before,snapshot(),'a continue token from before the legitimate revision/deadline extension must have zero mutation')
  const renewed=f.issue(sub);assert.equal(renewed.result,'ok');assert.equal(renewed.projection.eligible_state,'rest_active')
  assert.notEqual(renewed.projection.generation_id,due.projection.generation_id)
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
  assert.equal(timed('bounded_cleanup',()=>f.issue(sub)).result,'unchanged')
  assert.equal(sql(`select count(*)from ${schema}.generations where id_sessao=${q(f.session.id_sessao)};`),'11')
  assert.equal(sql(`select invalidated_at is null from ${schema}.generations where id=${q(g)};`),'t')
 })
 // Every sql(script) below starts exactly one psql backend and reuses it across
 // both transactions. Only the TEST baseline may use session-local GUCs.
 for(const failure of [false,true])for(const prior of ['present','absent','claims','transaction_claims'])for(const ending of ['commit','rollback'])await run(`${failure?'paused skip rollback':'successful action'} / UID ${prior}, ${ending}, same physical connection`,()=>{
  f.start();if(failure)f.mutate('definir_pausa_treino_sessao','true')
  const issued=f.issue(sub),t=token(issued,failure?'rest_skip':'rest_pause'),s=f.session,before=snapshot()
  const claims=JSON.stringify({sub:f.b.id}),priorUID=prior==='present'?f.b.id:'',priorClaims=prior==='claims'?claims:''
  const baseline=['present','claims'].includes(prior)?`do $baseline$begin perform set_config('request.jwt.claim.sub',${q(priorUID)},false);
    perform set_config('request.jwt.claims',${q(priorClaims)},false);end $baseline$;`:''
  const transactionClaims=prior==='transaction_claims'?`do $guc$begin perform set_config('request.jwt.claims',${q(claims)},true);end $guc$;`:''
  const observedClaims=['claims','transaction_claims'].includes(prior)?claims:''
  const rows=sql(`${baseline}
    create temporary sequence c_uid_observations;
    create function pg_temp.observe_c_uid()returns trigger language plpgsql security definer set search_path='' as $observe$
    begin
      if current_setting('request.jwt.claim.sub',true) is distinct from ${q(f.a.id)}
        or coalesce(current_setting('request.jwt.claims',true),'') is distinct from ${q(observedClaims)} then raise exception 'unexpected bridge identity';end if;
      perform nextval('pg_temp.c_uid_observations');
      if tg_argv[0]='fail_skip' and new.fase='execucao' then raise exception 'negative fixture after resume';end if;
      return new;
    end $observe$;
    begin;${transactionClaims}
    create trigger c_test_observe_uid before update on public.treino_sessoes for each row when(old.id_sessao=${q(s.id_sessao)}::uuid)
      execute function pg_temp.observe_c_uid(${q(failure?'fail_skip':'observe')});
    select public.workout_notification_action(${q(t)});
    select jsonb_build_object('pid',pg_backend_pid(),'restored',coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'),
      'claims',nullif(current_setting('request.jwt.claims',true),''),'bridge_updates',(select case when is_called then last_value else 0 end from pg_temp.c_uid_observations));
    ${snapshotSQL(s.id_sessao)}
    drop trigger c_test_observe_uid on public.treino_sessoes;
    ${ending};begin;
    select jsonb_build_object('pid',pg_backend_pid(),'next',nullif(current_setting('request.jwt.claim.sub',true),''),'claims',nullif(current_setting('request.jwt.claims',true),''));rollback;
    do $clean$begin perform set_config('request.jwt.claim.sub','',false);perform set_config('request.jwt.claims','',false);end $clean$;
    select jsonb_build_object('clean_uid',nullif(current_setting('request.jwt.claim.sub',true),''),'clean_claims',nullif(current_setting('request.jwt.claims',true),''));
    drop function pg_temp.observe_c_uid();drop sequence pg_temp.c_uid_observations;`).split('\n').filter((line)=>line.startsWith('{')).map(JSON.parse)
  assert.equal(rows[0].result,failure?'unavailable':'ok')
  assert.equal(rows[1].restored,prior==='absent'?null:f.b.id)
  assert.equal(rows[1].claims,observedClaims||null)
  // Sequence increments deliberately survive the exception subtransaction, so
  // this proves V2 observed UID A at resume AND forced skip before rollback.
  assert.equal(rows[1].bridge_updates,failure?2:1)
  if(failure){
   unchanged(before,rows[2],'failed paused skip must restore the exact session, paused timestamp, all C rows, counts, consumed_at, siblings and generation hashes')
   assert.equal(rows[2].session.pausada_em,before.session.pausada_em)
   assert.equal(rows[2].generations.length,before.generations.length);assert.equal(rows[2].capabilities.length,before.capabilities.length)
   assert.ok(rows[2].capabilities.every((capability)=>capability.consumed_at===null&&capability.invalidated_at===null))
  }
  assert.equal(rows[3].pid,rows[1].pid)
  assert.equal(rows[3].next,prior==='present'?f.b.id:null)
  assert.equal(rows[3].claims,prior==='claims'?claims:null)
  assert.deepEqual(rows[4],{clean_uid:null,clean_claims:null})
  if(failure||ending==='rollback')unchanged(before,snapshot(),'rollback must leave no C/V2 mutation on subsequent connections')
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
  f.start(1);await waitRestDue();value('select gymio_workout_push_private.capture_events();')
  const claims=value('select public.workout_push_claim(10);');assert.equal(claims.length,2)
  const boundTokens=new Map()
  for(const claim of claims){
    const expectedSub=sql(`select subscription_id from gymio_workout_push_private.deliveries where id=${q(claim.id)};`)
    // Obtain the preserved B envelope without changing its claim/attempt state.
    const baselineB=value(`begin;select public.workout_push_begin(${q(claim.id)},${q(claim.claim_token)});rollback;`)
    assert.equal(sql(`select state='claimed' and attempted_at is null from gymio_workout_push_private.deliveries where id=${q(claim.id)};`),'t')
    const attempt=timed('sender_begin_controls',()=>value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`))
    assert.equal(attempt.payload.version,3)
    assert.equal(attempt.payload.type,'workout_control')
    assert.equal(attempt.payload.title,baselineB.payload.title)
    assert.equal(attempt.payload.body,baselineB.payload.body)
    assert.equal(attempt.payload.title,'Gym.io · Descanso concluído')
    const projection=value(`select gymio_workout_actions_private.projection(s)from public.treino_sessoes s where id_sessao=${q(f.session.id_sessao)};`)
    for(const [key,expected]of Object.entries(projection))if(!['version','type','title','body','agora_servidor'].includes(key))
      unchanged(expected,attempt.payload[key],`sender must preserve C projection field ${key}`)
    assert.equal(attempt.payload.controls_status,'emitted');assert.equal(attempt.payload.eligible_state,'rest_finished')
    assert.deepEqual(attempt.payload.controls.map((control)=>control.action),['rest_continue'])
    for(const field of ['revisao','id_treino','id_treino_exercicio','proxima_serie'])
      assert.match(attempt.payload[field],/^(0|[1-9][0-9]*)$/)
    assert.equal(attempt.snapshot.id,expectedSub);assert.ok([sub,second].includes(expectedSub))
    const g=attempt.payload.generation_id
    assert.equal(sql(`select bool_and(subscription_id=${q(attempt.snapshot.id)}::uuid)from ${schema}.capabilities where generation_id=${q(g)};`),'t')
    assert.equal(sql(`select subscription_id from ${schema}.generations where id=${q(g)};`),attempt.snapshot.id)
    assert.equal(sql(`select expires_at=${q(attempt.payload.expires_at)}::timestamptz and eligible_state=${q(attempt.payload.eligible_state)} from ${schema}.generations where id=${q(g)};`),'t')
    for(const control of attempt.payload.controls){
      assert.ok(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(control.capability),'sender token must be canonical without logging it')
      assert.equal(sql(`select count(*)from ${schema}.capabilities where generation_id=${q(g)} and subscription_id=${q(expectedSub)}
        and action=${q(control.action)} and token_hash=extensions.digest(convert_to(${q(control.capability)},'UTF8'),'sha256');`),'1')
    }
    assert.equal(sql(`select state='attempted' and attempted_at is not null from gymio_workout_push_private.deliveries where id=${q(claim.id)};`),'t')
    assert.ok(!boundTokens.has(expectedSub));boundTokens.set(expectedSub,attempt.payload.controls.map((control)=>control.capability))
    assert.equal(sql(`select public.workout_push_complete(${q(claim.id)},${q(claim.claim_token)},'accepted',${q(JSON.stringify(attempt.snapshot))}::jsonb);`),'accepted')
    assert.equal(sql(`select state='accepted' and attempted_at is not null and accepted_at is not null from gymio_workout_push_private.deliveries where id=${q(claim.id)};`),'t')
    assert.equal(value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`),null)
  }
  assert.equal(boundTokens.size,2)
  assert.ok(boundTokens.get(sub).every((capability)=>!boundTokens.get(second).includes(capability)),'same-user devices must never share tokens')
 })
 for(const injection of ['generation','capability'])await run(`unexpected ${injection} issuance failure atomically rolls back B attempt and every C row`,async()=>{
  f.start(1);await waitRestDue();value('select gymio_workout_push_private.capture_events();')
  const claim=value('select public.workout_push_claim(10);')[0]
  const before=snapshot(),deliveryBefore=value(`select to_jsonb(d)from gymio_workout_push_private.deliveries d where id=${q(claim.id)};`)
  const rows=sql(`begin;
    create function pg_temp.fail_c_issue()returns trigger language plpgsql as $f$begin raise exception 'negative issue fixture';end$f$;
    create trigger c_test_fail_issue ${injection==='generation'?'before insert on '+schema+'.generations':'after insert on '+schema+'.capabilities'} for each row execute function pg_temp.fail_c_issue();
    do $b$begin begin perform public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});raise exception 'missing expected failure';exception when raise_exception then if sqlerrm='missing expected failure' then raise;end if;end;end$b$;
    select jsonb_build_object('state',state,'attempted',attempted_at)from gymio_workout_push_private.deliveries where id=${q(claim.id)};
    ${snapshotSQL(f.session.id_sessao)}
    select jsonb_build_object('delivery',(select to_jsonb(d)from gymio_workout_push_private.deliveries d where id=${q(claim.id)}),
      'orphans',(select count(*)from ${schema}.capabilities c left join ${schema}.generations g on g.id=c.generation_id where g.id is null));rollback;`).split('\n').filter((l)=>l.startsWith('{')).map(JSON.parse)
  assert.deepEqual(rows[0],{state:'claimed',attempted:null})
  unchanged(before,rows[1],'failed sender issuance must rollback the exact session and all C rows including partial generation/capability inserts')
  unchanged(deliveryBefore,rows[2].delivery,'failed sender issuance must restore the entire delivery, token and lease snapshots')
  assert.equal(rows[2].orphans,0)
  unchanged(before,snapshot(),'failed sender issuance must leave no partial C state on the next connection')
  unchanged(deliveryBefore,value(`select to_jsonb(d)from gymio_workout_push_private.deliveries d where id=${q(claim.id)};`),'claim must remain exactly recoverable after rollback')
  // The same still-valid B claim succeeds after the test trigger rolls back.
  const recovered=timed('sender_begin_after_issuance_rollback',()=>value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`))
  assert.equal(recovered.payload.version,3)
  assert.equal(sql(`select state='attempted' and attempted_at is not null from gymio_workout_push_private.deliveries where id=${q(claim.id)};`),'t')
  assert.equal(sql(`select public.workout_push_complete(${q(claim.id)},${q(claim.claim_token)},'failed',${q(JSON.stringify(recovered.snapshot))}::jsonb);`),'failed')
 })
 for(const afterClaim of [false,true])await run(`remove subscription ${afterClaim?'after':'before'} claim: no begin, no capabilities`,async()=>{
  const temporary=f.subscribe();f.start(1);await new Promise((r)=>setTimeout(r,1100));value('select gymio_workout_push_private.capture_events();')
  const claim=afterClaim?value('select public.workout_push_claim(10);').find((row)=>sql(`select subscription_id from gymio_workout_push_private.deliveries where id=${q(row.id)};`)===temporary):null
  f.rpc('remover_push_subscription',[q(temporary)])
  assert.equal(sql(`select count(*)from gymio_workout_push_private.deliveries where subscription_id=${q(temporary)};`),'0')
  if(claim)assert.equal(value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`),null)
  assert.equal(sql(`select count(*)from ${schema}.generations where subscription_id=${q(temporary)};`),'0')
 })
 await run('deleting the matrix user cascades C bindings and B deliveries, entirely rollback-only',async()=>{
  f.start(1);f.issue(sub);await waitRestDue();value('select gymio_workout_push_private.capture_events();')
  const before=snapshot(),counts=sql('select jsonb_build_object(\'auth\',(select count(*)from auth.users),\'profiles\',(select count(*)from public.usuarios));')
  const result=value(`begin;delete from auth.users where id=${q(f.a.id)};
    select jsonb_build_object('generations',(select count(*)from ${schema}.generations where id_usuario=${q(f.a.id)}),
    'capabilities',(select count(*)from ${schema}.capabilities where id_usuario=${q(f.a.id)}),
    'subscriptions',(select count(*)from public.push_subscriptions where id_usuario=${q(f.a.id)}),
    'deliveries',(select count(*)from gymio_workout_push_private.deliveries where subscription_id in (${q(sub)},${q(second)})));rollback;`)
  assert.deepEqual(result,{generations:0,capabilities:0,subscriptions:0,deliveries:0})
  assert.equal(sql('select jsonb_build_object(\'auth\',(select count(*)from auth.users),\'profiles\',(select count(*)from public.usuarios));'),counts)
  unchanged(before,snapshot(),'user-delete rollback must restore exact fixture rows and original A/B baseline')
 })
 assert.equal(sql(`select count(*)from cron.job where command like '%gymio_workout_actions_private%' or jobname like '%workout-actions%';`),'0')
 matrixComplete=true
 console.log('C SQL matrix complete: no external Push requests')
} finally {
 let cleaned=false
 try{f.clean();cleaned=true}finally{
  const result={matrixComplete,fixtureCleanupCompleted:cleaned,unit:'milliseconds',includesHarnessTransport:true,arbitraryThreshold:false,timings,cases}
  fs.writeFileSync(path.join(c.context.root,'actions-performance-result.json'),JSON.stringify(result,null,2))
  console.log(`C SQL performance (local PostgreSQL call including harness transport; no threshold): ${JSON.stringify(timings)}`)
 }
}

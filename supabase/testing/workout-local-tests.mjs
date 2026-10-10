import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createECDH,randomBytes,randomUUID} from 'node:crypto'
import {workoutContext} from './workout-context.mjs'
const {context,sql,concurrentSql,value,users,literal:q}=workoutContext(process.argv[2])
const schema='gymio_workout_push_private',a=users[0],b=users[1],results=[]
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms))
const rpc=(name,args,user=a)=>value(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(user.id)},true);select public.${name}(${args.join(',')});commit;`)
const counts=()=>value(`select jsonb_build_object('events',(select count(*) from ${schema}.outbox),'deliveries',(select count(*) from ${schema}.deliveries),'states',(select coalesce(jsonb_agg(state order by state),'[]') from ${schema}.deliveries));`)
const capture=()=>value(`select ${schema}.capture_events();`)
const claim=()=>value('select public.workout_push_claim(10);')
const begin=(c)=>value(`select public.workout_push_begin(${q(c.id)},${q(c.claim_token)});`)
const complete=(c,outcome,snapshot)=>sql(`select public.workout_push_complete(${q(c.id)},${q(c.claim_token)},${q(outcome)},${q(JSON.stringify(snapshot))}::jsonb);`)
const key=createECDH('prime256v1');key.generateKeys();const p256dh=key.getPublicKey().toString('base64url'),auth=randomBytes(16).toString('base64url')
const subscription=(user=a)=>sql(`insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth)values(${q(user.id)},${q('https://fcm.googleapis.com/fcm/send/'+randomUUID())},${q(p256dh)},${q(auth)})returning id;`)
const workout=sql(`insert into public.treinos(nome,id_usuario)values('B SQL fixture',${q(a.id)})returning id_treino;`)
const exercise=sql("insert into public.exercicios(nome)values('Supino SQL')returning id_exercicio;")
const section=sql(`insert into public.secoes_treino(id_treino,nome)values(${workout},'B')returning id_secao;`)
const item=sql(`insert into public.treinos_exercicios(id_treino,id_secao,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem)values(${workout},${section},${exercise},4,10,20,2,'1')returning id_treino_exercicio;`)
let current
const reset=()=>{sql(`delete from public.treino_sessao_series where id_sessao in(select id_sessao from public.treino_sessoes where id_treino=${workout});delete from public.treino_sessoes where id_treino=${workout};delete from ${schema}.outbox;delete from public.push_subscriptions where id_usuario in(${q(a.id)},${q(b.id)});`);current=null}
const start=(seconds=2)=>{sql(`update public.treinos_exercicios set descanso_segundos=${seconds} where id_treino_exercicio=${item};`);current=rpc('iniciar_treino_sessao',[workout,seconds]);current=rpc('concluir_treino_serie',[q(current.id_sessao),current.revisao,'20.25','10']);return current}
const mutate=(name,...args)=>current=rpc(name,[q(current.id_sessao),current.revisao,...args])
const expired=async()=>{await sleep(Math.max(0,Date.parse(current.descanso_termina_em)-Date.now())+70);capture()}
const run=async(name,fn)=>{reset();const t=performance.now();await fn();results.push({name,ms:Math.round(performance.now()-t)});console.log(`PASS SQL B: ${name}`)}
try {
 await run('real pause/resume: old deadline blocked; both timestamps shifted; new expiry exactly once',async()=>{
  subscription();start(3);const old=current;mutate('definir_pausa_treino_sessao','true');const paused=current
  await sleep(Math.max(0,Date.parse(old.descanso_termina_em)-Date.now())+100);capture();assert.equal(counts().events,0)
  mutate('definir_pausa_treino_sessao','false');const shiftedStart=Date.parse(current.descanso_iniciado_em)-Date.parse(old.descanso_iniciado_em),shiftedEnd=Date.parse(current.descanso_termina_em)-Date.parse(old.descanso_termina_em)
  assert.ok(shiftedStart>2500);assert.ok(Math.abs(shiftedEnd-shiftedStart)<=1);assert.ok(Math.abs(shiftedEnd-(Date.parse(current.atualizada_em)-Date.parse(paused.pausada_em)))<=2)
  capture();assert.equal(counts().events,0);await expired();capture();assert.deepEqual(counts(),{events:1,deliveries:1,states:['pending']})
 })
 await run('physical unique, frozen zero recipients, next rest gets later subscription',async()=>{
  start(1);await expired();assert.equal(counts().events,1);assert.equal(counts().deliveries,0);subscription();capture();assert.equal(counts().deliveries,0)
  mutate('encerrar_descanso_treino_sessao','false');mutate('concluir_treino_serie','20.25','10');await expired();assert.equal(counts().events,2);assert.equal(counts().deliveries,1)
  assert.throws(()=>sql(`insert into ${schema}.outbox(id_usuario,id_sessao,id_treino_exercicio,proxima_serie,tipo_evento,revision_snapshot,rest_started_snapshot,deadline_snapshot)
    select id_usuario,id_sessao,id_treino_exercicio,proxima_serie,tipo_evento,revision_snapshot,rest_started_snapshot,deadline_snapshot from ${schema}.outbox limit 1;`),(error)=>String(error.stderr).includes('workout_rest_identity'))
 })
 await run('multiple devices and ownership isolation; canonical server payload',async()=>{
  subscription();subscription();subscription(b);start(1);await expired();assert.equal(counts().deliveries,2)
  const claims=claim();assert.equal(claims.length,2);const attempt=begin(claims[0]);assert.equal(attempt.snapshot.id_usuario,a.id);assert.equal(attempt.payload.exercicio,'Supino SQL')
  assert.equal(typeof attempt.payload.revisao,'string');assert.equal(attempt.payload.proxima_serie,'2');assert.equal(attempt.payload.data.url,`/treinar/${workout}`)
  complete(claims[0],'accepted',attempt.snapshot);assert.equal(begin(claims[0]),null);assert.equal(claim().length,0)
 })
 await run('deadline +15 preserves event, releases unattempted claim, waits; attempted never repeats',async()=>{
  subscription();start(1);await expired();const c=claim()[0];mutate('ajustar_descanso_treino_sessao','15');assert.equal(begin(c),null);capture();assert.equal(claim().length,0);assert.equal(counts().events,1)
  await expired();const next=claim()[0];assert.notEqual(next.claim_token,c.claim_token);const attempt=begin(next);assert.ok(attempt);mutate('ajustar_descanso_treino_sessao','15');capture();assert.equal(claim().length,0);assert.equal(counts().events,1)
 })
 for(const [name,operation,args]of [['skip','encerrar_descanso_treino_sessao',['true']],['finalize','finalizar_treino_sessao',[]],['cancel','cancelar_treino_sessao',[]],['advance','avancar_exercicio_treino_sessao',[]]])await run(`${name} before or after capture makes unattempted work stale`,async()=>{
  subscription();start(1);await expired();const c=claim()[0];mutate(operation,...args);capture();assert.equal(begin(c),null);assert.equal(claim().length,0);assert.deepEqual(counts().states,['stale'])
 })
 await run('pause after capture defers existing claim, resume refreshes snapshots',async()=>{
  subscription();start(1);await expired();const c=claim()[0];mutate('definir_pausa_treino_sessao','true');assert.equal(begin(c),null);await sleep(200);mutate('definir_pausa_treino_sessao','false');capture();assert.equal(begin(c),null);assert.equal(claim().length,1)
 })
 await run('stale revision fails closed',async()=>{
  subscription();start(1);await expired();sql(`update ${schema}.outbox set revision_snapshot=revision_snapshot+100;`);capture();assert.deepEqual(counts().states,['stale']);assert.equal(claim().length,0)
 })
 for(const afterClaim of [false,true])await run(`subscription removed ${afterClaim?'after claim':'before claim'} cascades and prevents begin`,async()=>{
  const id=subscription();start(1);await expired();const c=afterClaim?claim()[0]:null;rpc('remover_push_subscription',[q(id)]);assert.equal(counts().deliveries,0);assert.equal(claim().length,0);if(c)assert.equal(begin(c),null);capture();assert.equal(counts().events,1);assert.equal(counts().deliveries,0)
 })
 await run('auth user removal cascades delivery and outbox atomically',async()=>{
  subscription();start(1);await expired();const uid=randomUUID();sql(`insert into auth.users(id)values(${q(uid)});update public.push_subscriptions set id_usuario=${q(uid)};update ${schema}.outbox set id_usuario=${q(uid)};delete from auth.users where id=${q(uid)};`);assert.deepEqual(counts(),{events:0,deliveries:0,states:[]})
 })
 await run('two schedulers and two senders cannot duplicate physical events or claims',async()=>{
  subscription();subscription();start(1);await sleep(1100)
  await Promise.all([concurrentSql(`select ${schema}.capture_events();`),concurrentSql(`select ${schema}.capture_events();`)])
  assert.equal(counts().events,1);assert.equal(counts().deliveries,2)
  const claimed=(await Promise.all([concurrentSql('select public.workout_push_claim(10);'),concurrentSql('select public.workout_push_claim(10);')])).flatMap(JSON.parse)
  assert.equal(claimed.length,2);assert.equal(new Set(claimed.map((c)=>c.id)).size,2)
 })
 await run('real 60-second lease: crash before attempt reclaimed; crash after attempt never reclaimed',async()=>{
  subscription();subscription();start(1);await expired();const [before,after]=claim();assert.ok(begin(after));assert.equal(claim().length,0)
  console.log('Waiting for the actual PostgreSQL 60-second lease; no timestamp rewriting.')
  await sleep(61000);const recovered=claim();assert.equal(recovered.length,1);assert.equal(recovered[0].id,before.id);assert.notEqual(recovered[0].claim_token,before.claim_token);assert.equal(begin(before),null);assert.equal(begin(after),null)
 })
 await run('404/410 snapshot-safe cleanup and concurrent key refresh',async()=>{
  const id=subscription();start(1);await expired();const c=claim()[0],attempt=begin(c);sql(`update public.push_subscriptions set auth=${q(randomBytes(16).toString('base64url'))},updated_at=clock_timestamp()where id=${q(id)};`)
  assert.equal(complete(c,'expired',attempt.snapshot),'expired');assert.equal(counts().deliveries,1);assert.equal(sql(`select count(*)from public.push_subscriptions where id=${q(id)};`),'1')
  reset();subscription();start(1);await expired();const d=claim()[0],next=begin(d);assert.equal(complete(d,'expired',next.snapshot),'expired');assert.equal(counts().deliveries,0)
 })
 await run('retention removes only old terminal inactive/absent events, preserves active dedup',async()=>{
  start(1);await expired();sql(`update ${schema}.outbox set terminal_at=clock_timestamp()-interval '8 days';`);capture();assert.equal(counts().events,1)
  mutate('cancelar_treino_sessao');capture();assert.equal(counts().events,0)
 })
 await run('idle tick and repeated capture produce zero Session/countdown writes',async()=>{
  subscription();start(30);const original=sql(`select row_to_json(s)from public.treino_sessoes s where id_sessao=${q(current.id_sessao)};`),times=[]
  for(let i=0;i<10;i++){const t=performance.now();const r=value(`select ${schema}.tick();`);assert.equal(r.dispatched,false);times.push(performance.now()-t)}
  assert.equal(counts().events,0);await expired();const after=sql(`select row_to_json(s)from public.treino_sessoes s where id_sessao=${q(current.id_sessao)};`);assert.equal(after,original)
  for(let i=0;i<10;i++)capture();assert.equal(counts().events,1);assert.equal(counts().deliveries,1);assert.equal(sql(`select row_to_json(s)from public.treino_sessoes s where id_sessao=${q(current.id_sessao)};`),original)
  results.push({name:'idle tick wall-time including docker/psql overhead',minMs:Math.round(Math.min(...times)),maxMs:Math.round(Math.max(...times)),meanMs:Math.round(times.reduce((x,y)=>x+y)/times.length),sessionWrites:0})
 })
 fs.writeFileSync(path.join(context.root,'workout-sql-result.json'),JSON.stringify({passed:true,results},null,2))
} finally {reset();sql(`delete from public.historico_treinos where id_treino=${workout};delete from public.treinos where id_treino=${workout};delete from public.exercicios where id_exercicio=${exercise};`)}

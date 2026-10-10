import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {workoutContext} from './workout-context.mjs'
import {createECDH,randomBytes}from 'node:crypto'
const {context,sql,value,literal:q}=workoutContext(process.argv[2]),schema='gymio_workout_push_private'
assert.equal(sql(`select count(*)from ${schema}.deliveries where attempted_at is null and state in('pending','claimed');`),'0','empty performance baseline')
const plan=()=>JSON.parse(sql(`explain(analyze,buffers,format json)select ${schema}.tick();`))[0]
const idle=Array.from({length:10},plan)
const writes=value(`begin;do $$begin for i in 1..10 loop perform ${schema}.tick();end loop;end$$;
 select jsonb_build_object('sessionWrites',coalesce(sum(n_tup_ins+n_tup_upd+n_tup_del)filter(where relname in('treino_sessoes','treino_sessao_series')),0),
 'notificationWrites',coalesce(sum(n_tup_ins+n_tup_upd+n_tup_del)filter(where schemaname='${schema}'),0))from pg_stat_xact_user_tables;rollback;`)
assert.equal(writes.sessionWrites,0);assert.equal(writes.notificationWrites,0)
const indexPlan=JSON.parse(sql(`explain(analyze,buffers,format json)select id_sessao from public.treino_sessoes where status='ativa'and fase='descanso'and pausada_em is null and descanso_termina_em<=clock_timestamp()order by id_sessao limit 100;`))[0]
const key=createECDH('prime256v1');key.generateKeys()
const large=sql(`begin;
 create temp table b_perf_users as select gen_random_uuid()id from generate_series(1,1000);
 insert into auth.users(id)select id from b_perf_users;
 insert into public.usuarios(id_usuario,nome,email,status)select id,'B performance',id::text||'@perf.local.invalid','ativo'from b_perf_users;
 create temp table b_perf_workout as with added as(insert into public.treinos(nome,tipo_treino)values('B performance','sistema')returning id_treino)select *from added;
 create temp table b_perf_exercise as with added as(insert into public.exercicios(nome)values('B performance')returning id_exercicio)select *from added;
 create temp table b_perf_item as with added as(insert into public.treinos_exercicios(id_treino,id_exercicio,series,descanso_segundos)select id_treino,id_exercicio,4,1 from b_perf_workout cross join b_perf_exercise returning id_treino_exercicio,id_treino)select *from added;
 insert into public.treino_sessoes(id_usuario,id_treino,id_treino_exercicio_atual,serie_atual,fase,revisao,iniciada_em,descanso_iniciado_em,descanso_termina_em)
 select u.id,i.id_treino,i.id_treino_exercicio,2,'descanso',1,clock_timestamp()-interval '3 seconds',clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '1 second'from b_perf_users u cross join b_perf_item i;
 insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth)select id,'https://fcm.googleapis.com/fcm/send/perf-'||id::text,${q(key.getPublicKey().toString('base64url'))},${q(randomBytes(16).toString('base64url'))}from b_perf_users;
 analyze public.treino_sessoes;
 create temp table b_perf_before as select schemaname,relname,n_tup_ins+n_tup_upd+n_tup_del writes from pg_stat_xact_user_tables;
 explain(analyze,buffers,format json)select ${schema}.capture_events();
 select jsonb_build_object('sessionWrites',sum((t.n_tup_ins+t.n_tup_upd+t.n_tup_del)-b.writes)filter(where t.relname in('treino_sessoes','treino_sessao_series')),
  'events',(select count(*)from ${schema}.outbox),'deliveries',(select count(*)from ${schema}.deliveries))from pg_stat_xact_user_tables t join b_perf_before b using(schemaname,relname);
 do $$begin for i in 1..9 loop perform ${schema}.capture_events();end loop;end$$;
 select jsonb_build_object('allEvents',(select count(*)from ${schema}.outbox),'allDeliveries',(select count(*)from ${schema}.deliveries));
 explain(analyze,buffers,format json)select id_sessao from public.treino_sessoes where status='ativa'and fase='descanso'and pausada_em is null and descanso_termina_em<=clock_timestamp()order by id_sessao limit 100;
 rollback;`)
const lines=large.split('\n'),first=lines.findIndex((line)=>line.startsWith('{')),last=lines.findIndex((line,i)=>i>first&&line.startsWith('{'))
const fullPlan=JSON.parse(lines.slice(0,first).join('\n'))[0],fullWrites=JSON.parse(lines[first]),progress=JSON.parse(lines[last]),populatedIndexPlan=JSON.parse(lines.slice(last+1).join('\n'))[0]
assert.equal(fullWrites.sessionWrites,0);assert.equal(fullWrites.events,100);assert.equal(fullWrites.deliveries,100);assert.equal(progress.allEvents,1000);assert.equal(progress.allDeliveries,1000)
const result={passed:true,idleServerMs:{min:Math.min(...idle.map((p)=>p['Execution Time'])),max:Math.max(...idle.map((p)=>p['Execution Time'])),mean:idle.reduce((n,p)=>n+p['Execution Time'],0)/idle.length},writes,indexPlan,fullServerMs:fullPlan['Execution Time'],fullWrites,progress,populatedIndexPlan,fixtureRolledBack:true}
fs.writeFileSync(path.join(context.root,'workout-performance.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result))

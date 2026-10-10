import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createECDH,randomBytes,randomUUID} from 'node:crypto'
import {workoutContext} from './workout-context.mjs'
const {context,sql,value,users,literal:q}=workoutContext(process.argv[2]),a=users[0],schema='gymio_workout_push_private'
const baseline=value('select coalesce(jsonb_agg(id),\'[]\')from net._http_response;'),key=createECDH('prime256v1');key.generateKeys()
const workout=sql(`insert into public.treinos(nome,id_usuario)values('B cron fixture',${q(a.id)})returning id_treino;`),exercise=sql("insert into public.exercicios(nome)values('Supino cron')returning id_exercicio;"),section=sql(`insert into public.secoes_treino(id_treino,nome)values(${workout},'B')returning id_secao;`)
sql(`insert into public.treinos_exercicios(id_treino,id_secao,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem)values(${workout},${section},${exercise},4,10,20,1,'1');`)
const rpc=(name,args)=>value(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(a.id)},true);select public.${name}(${args.join(',')});commit;`)
let subscription,session
try {
 assert.equal(sql(`select count(*)from ${schema}.deliveries;`),'0')
 // An active job with no eligible sessions must not enqueue even a local HTTP.
 const idle=value(`select ${schema}.tick();`);assert.equal(idle.dispatched,false)
 subscription=sql(`insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth)values(${q(a.id)},${q('https://fcm.googleapis.com/fcm/send/cron-'+randomUUID())},${q(key.getPublicKey().toString('base64url'))},${q(randomBytes(16).toString('base64url'))})returning id;`)
 session=rpc('iniciar_treino_sessao',[workout,'1']);session=rpc('concluir_treino_serie',[q(session.id_sessao),session.revisao,'20.25','10'])
 // Inspect the exact enqueue arguments before commit, then roll back. The
 // actual integration below is still performed by the real global cron job.
 await new Promise((resolve)=>setTimeout(resolve,1100))
 const argumentsProbe=value(`begin;select ${schema}.tick();
  select jsonb_build_object('body',convert_from(body,'UTF8')='{}','timeout',timeout_milliseconds=10000,
   'headers',headers->>'Content-Type'='application/json' and headers->>'X-Gymio-Workout-Worker-Token'=(select decrypted_secret from vault.decrypted_secrets where name='gymio_workout_push_worker_token'),
   'url',url=(select decrypted_secret from vault.decrypted_secrets where name='gymio_workout_push_url'),
   'noTokenInUrl',position((select decrypted_secret from vault.decrypted_secrets where name='gymio_workout_push_worker_token') in url)=0)
  from net.http_request_queue order by id desc limit 1;rollback;`)
 for(const field of ['body','timeout','headers','url','noTokenInUrl'])assert.equal(argumentsProbe?.[field],true,`real net.http_post ${field}`)
 sql("select cron.alter_job((select jobid from cron.job where jobname='gymio-workout-push'),active:=true);")
 const start=Date.now(),deadline=start+30000
 while(Date.now()<deadline&&sql(`select count(*)from ${schema}.deliveries where state='accepted';`)!=='1')await new Promise((r)=>setTimeout(r,700))
 assert.equal(sql(`select count(*)from ${schema}.deliveries where state='accepted';`),'1','real cron -> pg_net -> authenticated Edge -> encrypted fake transport')
 const responses=value(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status_code,'counts',content::jsonb)),'[]')from net._http_response;`).filter((r)=>!baseline.includes(r.id))
 assert.ok(responses.length>=1&&responses.every((r)=>r.status===200&&r.counts.attempted===1&&r.counts.accepted===1))
 const runs=value("select coalesce(jsonb_agg(jsonb_build_object('start',start_time,'end',end_time,'status',status)),'[]')from cron.job_run_details where jobid=(select jobid from cron.job where jobname='gymio-workout-push');")
 const pgNetVersion=sql("select extversion from pg_extension where extname='pg_net';")
 const result={passed:true,pgNetVersion,argumentsProbe,elapsedMs:Date.now()-start,runs,responses:responses.map((r)=>({status:r.status,counts:r.counts})),externalPushRequests:0,idleDispatched:false}
 fs.writeFileSync(path.join(context.root,'workout-dispatch-result.json'),JSON.stringify(result,null,2));console.log('PASS real global cron -> conditional pg_net -> header-authenticated Edge -> accepted fake provider; zero external Push requests')
 // Delete only response IDs created by this dedicated local job.
 for(const r of responses)sql(`delete from net._http_response where id=${Number(r.id)};`)
}finally{
 sql("select cron.alter_job((select jobid from cron.job where jobname='gymio-workout-push'),active:=false);delete from cron.job_run_details where jobid=(select jobid from cron.job where jobname='gymio-workout-push');")
 if(session)rpc('cancelar_treino_sessao',[q(session.id_sessao),session.revisao]);sql(`delete from ${schema}.outbox where id_sessao=${q(session?.id_sessao??randomUUID())};`)
 if(subscription)sql(`delete from public.push_subscriptions where id=${q(subscription)}and id_usuario=${q(a.id)};`)
 sql(`delete from public.treinos where id_treino=${workout};delete from public.exercicios where id_exercicio=${exercise};`)
}

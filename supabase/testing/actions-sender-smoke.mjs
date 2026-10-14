// Explicit no-network PostgreSQL sender smoke. Does not start the API, Edge,
// browser, Push provider or the complete matrix. Importing starts nothing.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes,createECDH} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {assertActionsHistory,historicalHashes} from './actions-context.mjs'
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const image='public.ecr.aws/supabase/postgres:17.6.1.113',owner='gymio-workout-actions-sender-smoke'
const q=(value)=>`'${String(value).replace(/'/g,"''")}'`
const read=(name)=>fs.readFileSync(path.join(workspace,'supabase/migrations',name),'utf8')
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms))
class SmokeFailure extends Error {constructor(stage,state=null){super(stage);this.stage=stage;this.sqlstate=state}}
export async function senderSmoke(){
 assert.equal(process.cwd(),workspace)
 assertActionsHistory()
 const suffix=randomUUID().replaceAll('-',''),name='gymio-c-sender-smoke-'+suffix,root=path.join(os.tmpdir(),'gymio-c-sender-smoke-'+suffix)
 const result={passed:false,scope:'no-network two-subscription PostgreSQL sender smoke; not the complete matrix',
  image,cHash:historicalHashes['20261011021351_workout_notification_actions.sql'],support:[],stages:[],externalRequests:0}
 let containerId=null,failure=null,activeStage='image availability',postgresPassword
 const docker=(args,{input,allowFailure=false,env=process.env}={})=>{
  const r=spawnSync('docker',args,{input,env,cwd:workspace,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024})
  if(!allowFailure&&(r.error||r.status!==0))throw new SmokeFailure('local Docker command failed: '+args[0])
  return r
 }
 const sql=(input)=>{
  const r=docker(['exec','-i','-e','PGPASSWORD',name,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{input,allowFailure:true,env:{...process.env,PGPASSWORD:postgresPassword}})
  if(r.error||r.status!==0)throw new SmokeFailure('isolated sender SQL failed',r.stderr?.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??'unknown')
  return r.stdout.trim()
 }
 const value=(input)=>JSON.parse(sql(input).split(/\r?\n/).filter((line)=>line.startsWith('{')||line.startsWith('[')||line==='null').at(-1)??'null')
 try{
  const pin=docker(['image','inspect',image],{allowFailure:true})
  if(pin.error||pin.status!==0)throw new SmokeFailure('C MATRIX BLOCKED: TARGET POSTGRES IMAGE UNAVAILABLE')
  const metadata=JSON.parse(pin.stdout)[0];result.imageId=metadata.Id;result.digests=metadata.RepoDigests
  activeStage='official image startup/TCP readiness'
  fs.mkdirSync(root);fs.writeFileSync(path.join(root,'.owner'),owner+'\n',{flag:'wx'})
  postgresPassword=randomBytes(32).toString('base64url')
  fs.writeFileSync(path.join(root,'postgres.env'),`POSTGRES_PASSWORD=${postgresPassword}\nPOSTGRES_DB=postgres\n`,{flag:'wx'})
  const launch=docker(['run','-d','--name',name,'--label','com.gymio.validation='+owner,'--label','com.gymio.validation.root='+root,
   '--network','none','--tmpfs','/var/lib/postgresql/data:rw','--env-file',path.join(root,'postgres.env'),image,
   'postgres','-c','config_file=/etc/postgresql/postgresql.conf','-c','shared_preload_libraries=pg_cron,pg_net,pg_stat_statements'])
  containerId=launch.stdout.trim();assert.match(containerId,/^[a-f0-9]{64}$/)
  let ready=false
  // Init uses a Unix-socket server. TCP requires the final configured server.
  for(let i=0;i<80;i++){
   const probe=docker(['exec',name,'pg_isready','-h','127.0.0.1','-p','5432','-U','postgres','-d','postgres'],{allowFailure:true})
   if(probe.status===0){await sleep(200);ready=true;break}
   const state=JSON.parse(docker(['inspect',containerId]).stdout)[0].State
   if(!state.Running)throw new SmokeFailure('official image exited before TCP readiness')
   await sleep(250)
  }
  assert.ok(ready,'final configured TCP PostgreSQL server unavailable')
  result.serverVersion=sql('show server_version;');assert.match(result.serverVersion,/^17\.6/)
  assert.equal(sql('show config_file;'),'/etc/postgresql/postgresql.conf')
  result.preload=sql('show shared_preload_libraries;')
  result.stages.push('exact PostgreSQL with official config and TCP readiness')
  activeStage='baseline support and unchanged migrations A/B'
  // Minimal support is added only if absent from the official image. It is
  // explicitly fixture support, never historical Auth or a security ACL repair.
  if(sql("select to_regclass('auth.users') is null;")==='t'){
   sql("create schema if not exists auth authorization postgres;create table auth.users(id uuid primary key,email text);")
   result.support.push('minimal synthetic auth.users fixture support')
  }
  if(sql("select to_regprocedure('auth.uid()') is null;")==='t'){
   sql("create function auth.uid()returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;grant usage on schema auth to authenticated;")
   result.support.push('minimal auth.uid JWT-GUC fixture support')
  }
  sql(fs.readFileSync(path.join(workspace,'supabase/testing/legacy-baseline.sql'),'utf8'))
  for(const name of ['20260821190134_workout_session_persistence_expand.sql','20260823003337_exercise_memory_read.sql'])sql('begin;\n'+read(name)+'\ncommit;')
  sql(read('20261007215944_push_foundation.sql'))
  for(const [extension,version] of [['pg_cron','1.6.4'],['pg_net','0.20.0'],['supabase_vault','0.3.1']]){
   if(sql(`select exists(select 1 from pg_extension where extname=${q(extension)});`)==='f')sql(`create extension ${extension} version ${q(version)};`)
   assert.equal(sql(`select extversion from pg_extension where extname=${q(extension)};`),version)
  }
  sql(read('20261010183821_workout_notifications.sql'))
  activeStage='corrected C migration application'
  sql(read('20261011021351_workout_notification_actions.sql'))
  result.stages.push('fixture -> EXPAND -> Memory -> Foundation A -> Notifications B -> corrected C')
  assert.equal(sql("select count(*) from cron.job where jobname='gymio-workout-push' and not active;"),'1')
  const uid=randomUUID(),email='sender-smoke-'+suffix+'@local.invalid',key=createECDH('prime256v1');key.generateKeys()
  sql(`insert into auth.users(id,email)values(${q(uid)},${q(email)});insert into public.usuarios(id_usuario,nome,email,status)values(${q(uid)},'C sender smoke',${q(email)},'ativo');`)
  const workout=sql(`insert into public.treinos(nome,id_usuario)values('V3.2-C sender smoke',${q(uid)})returning id_treino;`)
  const exercise=sql("insert into public.exercicios(nome)values('V3.2-C sender exercise')returning id_exercicio;")
  const section=sql(`insert into public.secoes_treino(id_treino,nome)values(${workout},'C sender smoke')returning id_secao;`)
  sql(`insert into public.treinos_exercicios(id_treino,id_secao,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem)values(${workout},${section},${exercise},4,10,20,1,'1');`)
  const subscriptions=[]
  activeStage='one owner, two subscriptions and legitimate Session V2 fixture'
  for(let i=0;i<2;i++)subscriptions.push(sql(`insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth)values(${q(uid)},${q('https://fcm.googleapis.com/fcm/send/sender-smoke-'+suffix+'-'+i)},${q(key.getPublicKey().toString('base64url'))},${q(randomBytes(16).toString('base64url'))})returning id;`))
  const rpc=(fn,args)=>value(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(uid)},true);select public.${fn}(${args.join(',')});commit;`)
  let session=rpc('iniciar_treino_sessao',[workout,'1']);session=rpc('concluir_treino_serie',[q(session.id_sessao),session.revisao,'20','10'])
  sql('select pg_sleep(1.2);');value('select gymio_workout_push_private.capture_events();')
  assert.equal(sql(`select count(*) from gymio_workout_push_private.deliveries d join gymio_workout_push_private.outbox e on e.id=d.event_id where e.id_sessao=${q(session.id_sessao)};`),'2')
  const claims=value('select public.workout_push_claim(10);');assert.equal(claims.length,2)
  activeStage='two C sender payloads, authentic B title/body and exact subscription bindings'
  const bearers=new Set(),generationIds=new Set(),verified=[]
  for(const claim of claims){
   // Read the authentic B payload in a rolled-back attempt, then call C on the
   // same still-claimed delivery. Neither raw payload nor bearer is logged.
   const expected=value(`begin;select public.workout_push_begin(${q(claim.id)},${q(claim.claim_token)});rollback;`)
   assert.ok(expected?.payload?.version===2)
   const payload=value(`select public.workout_push_begin_controls(${q(claim.id)},${q(claim.claim_token)});`)
   assert.ok(payload&&payload.payload&&payload.snapshot)
   const actual=payload.payload,subscription=payload.snapshot.id
   assert.ok(subscriptions.includes(subscription));assert.equal(payload.snapshot.id_usuario,uid)
   assert.equal(actual.version,3);assert.equal(actual.type,'workout_control')
   assert.equal(actual.title,expected.payload.title);assert.equal(actual.title,'Gym.io · Descanso concluído');assert.equal(actual.body,expected.payload.body)
   for(const name of ['id_sessao','revisao','id_treino','id_treino_exercicio','proxima_serie','descanso_iniciado_em','descanso_termina_em','fase'])assert.equal(actual[name],expected.payload[name])
   assert.equal(actual.controls_status,'emitted');assert.equal(actual.eligible_state,'rest_finished')
   assert.ok(typeof actual.generation_id==='string'&&Number.isFinite(Date.parse(actual.expires_at)))
   assert.equal(actual.controls.length,1);assert.equal(actual.controls[0].action,'rest_continue')
   const token=actual.controls[0].capability;assert.match(token,/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/)
   assert.ok(!bearers.has(token),'no bearer crosses subscriptions');bearers.add(token);generationIds.add(actual.generation_id)
   assert.equal(sql(`select exists(select 1 from gymio_workout_actions_private.generations where id=${q(actual.generation_id)} and subscription_id=${q(subscription)} and id_usuario=${q(uid)} and id_sessao=${q(session.id_sessao)})
    and (select count(*)from gymio_workout_actions_private.capabilities where generation_id=${q(actual.generation_id)})=1
    and not exists(select 1 from gymio_workout_actions_private.capabilities where generation_id=${q(actual.generation_id)} and(subscription_id<>${q(subscription)} or id_usuario<>${q(uid)} or id_sessao<>${q(session.id_sessao)}))
    and exists(select 1 from gymio_workout_actions_private.capabilities where generation_id=${q(actual.generation_id)} and token_hash=extensions.digest(convert_to(${q(token)},'UTF8'),'sha256'));
   `),'t','exact generation/capability delivery binding')
   assert.equal(sql(`select state='attempted' and attempted_at is not null and accepted_at is null from gymio_workout_push_private.deliveries where id=${q(claim.id)};`),'t')
   verified.push({subscription_id:subscription,jsonb:true,b_title_preserved:true,b_body_preserved:true,c_projection:true,exact_capability_binding:true,attempted_before_any_transport:true})
  }
  assert.equal(generationIds.size,2);assert.equal(bearers.size,2)
  assert.equal(sql('select count(*) from auth.users;'),'1')
  assert.equal(sql("select count(*) from cron.job where jobname='gymio-workout-push' and not active;"),'1')
  assertActionsHistory();result.verified=verified;result.noCrossSubscriptionBearer=true;result.network='none';result.passed=true
 }catch(error){
  failure=error;result.failure={stage:error instanceof SmokeFailure?error.stage:activeStage,sqlstate:error instanceof SmokeFailure?error.sqlstate:null}
 }finally{
  try{
   if(containerId){
    const inspect=JSON.parse(docker(['inspect',containerId]).stdout)[0]
    assert.equal(inspect.Id,containerId);assert.equal(inspect.Name,'/'+name)
    assert.equal(inspect.Config.Labels['com.gymio.validation'],owner);assert.equal(inspect.Config.Labels['com.gymio.validation.root'],root)
    assert.equal(inspect.HostConfig.NetworkMode,'none');assert.equal(inspect.Config.Image,image)
    if(failure&&activeStage==='official image startup/TCP readiness'){
     const diagnostics=docker(['logs',containerId],{allowFailure:true})
     result.startupDiagnostics=(diagnostics.stdout+'\n'+diagnostics.stderr).split(/\r?\n/)
      .filter((line)=>/FATAL|ERROR|PANIC|invalid|unrecognized|No such|Usage|usage|requires|not permitted/.test(line))
      .map((line)=>line.replace(/\b[A-Za-z0-9_-]{43,}\b/g,'[REDACTED]')).slice(-8)
    }
    docker(['rm','-f',containerId])
    assert.notEqual(docker(['inspect',containerId],{allowFailure:true}).status,0)
   }
   if(fs.existsSync(root)){
    const resolved=fs.realpathSync(root),relative=path.relative(fs.realpathSync(os.tmpdir()),resolved)
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^gymio-c-sender-smoke-[a-f0-9]{32}$/.test(path.basename(resolved)))
    assert.equal(fs.readFileSync(path.join(resolved,'.owner'),'utf8').trim(),owner)
    const remove=spawnSync('powershell',['-NoProfile','-NonInteractive','-Command',`Remove-Item -LiteralPath ${q(resolved)} -Recurse -Force`],{encoding:'utf8',windowsHide:true})
    assert.equal(remove.status,0);assert.ok(!fs.existsSync(resolved))
   }
   result.cleanup='exact owned no-network container removed; tmpfs data and guarded temporary root/secrets removed; A/B untouched'
  }catch{result.cleanup='FAILED exact owned cleanup verification';result.passed=false;failure??=new SmokeFailure('sender smoke cleanup failed')}
  const output=path.join(workspace,'supabase/testing/actions-sender-smoke-result.json'),prior=path.join(workspace,'supabase/testing/actions-sender-smoke-initial-setup-result.json')
  if(fs.existsSync(output)&&!fs.existsSync(prior))fs.copyFileSync(output,prior,fs.constants.COPYFILE_EXCL)
  const diagnosed=path.join(workspace,'supabase/testing/actions-sender-smoke-diagnosed-setup-result.json')
  if(fs.existsSync(output)&&JSON.parse(fs.readFileSync(output,'utf8')).startupDiagnostics&&!fs.existsSync(diagnosed))fs.copyFileSync(output,diagnosed,fs.constants.COPYFILE_EXCL)
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n')
 }
 if(failure)throw new SmokeFailure(result.failure?.stage??'sender smoke failed',result.failure?.sqlstate??null)
 console.log('PASS isolated PostgreSQL sender smoke: two V3 payloads, B title/body preserved, exact subscription bindings, no network, cleanup complete')
 return result
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv[2],'--run','explicit --run required')
 senderSmoke().catch((error)=>{console.error(error.message+(error.sqlstate?' SQLSTATE '+error.sqlstate:''));process.exitCode=1})
}

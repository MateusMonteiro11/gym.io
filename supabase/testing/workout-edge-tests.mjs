import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createECDH,randomBytes,randomUUID} from 'node:crypto'
import {workoutContext} from './workout-context.mjs'
import http from 'node:http'
const {context,status,api,sql,value,users,literal:q}=workoutContext(process.argv[2]),[a,b]=users,schema='gymio_workout_push_private'
const anon=status.ANON_KEY??status.anon_key,results=[]
// Node fetch injects Sec-Fetch-Mode. Use the actual server-to-server wire shape.
const request=(name,body,jwt=a.jwt,headers={})=>new Promise((resolve,reject)=>{
 const req=http.request(`${api}/functions/v1/${name}`,{method:'POST',headers:{apikey:anon,...(jwt?{Authorization:`Bearer ${jwt}`}:{ }),...headers,'Content-Type':'application/json'},timeout:30000},(res)=>{
  let text='';res.setEncoding('utf8');res.on('data',(part)=>text+=part);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(text),headers:new Headers(res.headers)})}catch(error){reject(error)}})
 });req.on('error',reject);req.on('timeout',()=>req.destroy(Error('local_test_timeout')));req.end(typeof body==='string'?body:JSON.stringify(body))
})
const endpoint='https://fcm.googleapis.com/fcm/send/b-edge-',key=createECDH('prime256v1');key.generateKeys()
const p256dh=key.getPublicKey().toString('base64url'),auth=randomBytes(16).toString('base64url')
const workout=sql(`insert into public.treinos(nome,id_usuario)values('B Edge fixture',${q(a.id)})returning id_treino;`),exercise=sql("insert into public.exercicios(nome)values('Supino Edge')returning id_exercicio;"),section=sql(`insert into public.secoes_treino(id_treino,nome)values(${workout},'B')returning id_secao;`)
sql(`insert into public.treinos_exercicios(id_treino,id_secao,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem)values(${workout},${section},${exercise},4,10,20,1,'1');`)
const reset=()=>sql(`delete from public.treino_sessao_series where id_sessao in(select id_sessao from public.treino_sessoes where id_treino=${workout});delete from public.treino_sessoes where id_treino=${workout};delete from ${schema}.outbox;delete from public.push_subscriptions where endpoint like ${q(endpoint+'%')};`)
const rpc=(name,args)=>value(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(a.id)},true);select public.${name}(${args.join(',')});commit;`)
const add=(group,user=a)=>sql(`insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth)values(${q(user.id)},${q(endpoint+group+'-'+randomUUID())},${q(p256dh)},${q(auth)});`)
try{
 const token=fs.readFileSync(path.join(context.root,'edge.env'),'utf8').match(/^GYMIO_WORKOUT_WORKER_TOKEN=(.+)$/m)?.[1];assert.match(token,/^[A-Za-z0-9_-]{43}$/)
 for(const workerToken of [null,'invalid'])assert.equal((await request('workout-push',{},null,workerToken?{'X-Gymio-Workout-Worker-Token':workerToken}:{})).status,401)
 assert.equal((await request('workout-push',{},null,{'X-Gymio-Workout-Worker-Token':token,Origin:'http://localhost:5173'})).status,403)
 assert.equal((await request('workout-push',{extra:1},null,{'X-Gymio-Workout-Worker-Token':token})).status,400)
 const real=await request('workout-push',{},null,{'X-Gymio-Workout-Worker-Token':token});assert.equal(real.status,200);assert.equal(real.data.attempted,0)
 const gatewayCors=real.headers.get('Access-Control-Allow-Origin')
 for(const group of ['boundary','batch','404','410','refresh','timeout','temporary','partial','removed','after_claim','crash_before','crash_after','stale','zero','concurrent']){
  reset();const devices=['boundary','zero'].includes(group)?0:group==='batch'?12:group==='concurrent'?8:group==='partial'?2:1
  for(let i=0;i<devices;i++)add(group);add(group,b)
  if(devices){let session=rpc('iniciar_treino_sessao',[workout,'1']);session=rpc('concluir_treino_serie',[q(session.id_sessao),session.revisao,'20.25','10']);await new Promise((r)=>setTimeout(r,1100));value(`select ${schema}.capture_events();`)
   if(group==='removed')sql(`delete from public.push_subscriptions where id_usuario=${q(a.id)} and endpoint like ${q(endpoint+group+'-%')};`)
   if(group==='stale')rpc('cancelar_treino_sessao',[q(session.id_sessao),session.revisao])
  }
  const result=await request('workout-integration',{group});assert.equal(result.status,200,`${group}: ${result.data.failedCheck??''}`);assert.equal(result.data.passed,true,group);assert.equal(result.data.externalPushRequests,0)
  assert.equal(sql(`select count(*)from public.push_subscriptions where id_usuario=${q(b.id)} and endpoint like ${q(endpoint+group+'-%')};`),'1','other user unchanged')
  if(['404','410'].includes(group))assert.equal(sql(`select count(*)from public.push_subscriptions where id_usuario=${q(a.id)} and endpoint like ${q(endpoint+group+'-%')};`),'0')
  if(['refresh','timeout','temporary','batch'].includes(group))assert.equal(sql(`select count(*)from public.push_subscriptions where id_usuario=${q(a.id)} and endpoint like ${q(endpoint+group+'-%')};`),String(devices))
  const states=value(`select coalesce(jsonb_agg(state),'[]')from ${schema}.deliveries;`)
  if(['timeout','temporary'].includes(group))assert.deepEqual(states,['failed'])
  if(group==='partial')assert.deepEqual(states.sort(),['accepted','failed'])
  if(group==='crash_after')assert.deepEqual(states,['attempted']);if(group==='crash_before')assert.deepEqual(states,['claimed'])
  results.push(result.data);console.log(`PASS real Edge B: ${group}`)
 }
 reset()
 // Complete remote cleanup and actual local Auth logout before invoking sender.
 const json=async(route,jwt,body)=>{const r=await fetch(api+route,{method:'POST',headers:{apikey:anon,...(jwt?{Authorization:`Bearer ${jwt}`}:{ }),'Content-Type':'application/json'},body:JSON.stringify(body)});const t=await r.text();return {status:r.status,data:t?JSON.parse(t):null}}
 const email=`workout-logout-${randomUUID()}@local.invalid`,signed=await json('/auth/v1/signup',null,{email,password:randomBytes(24).toString('base64url')+'A1!'})
 assert.equal(signed.status,200);const c=signed.data.user.id,cjwt=signed.data.access_token;assert.ok(cjwt)
 let cWorkout,cSession
 try{
  sql(`insert into public.usuarios(id_usuario,nome,email,status)values(${q(c)},'B logout',${q(email)},'ativo');`)
  cWorkout=sql(`insert into public.treinos(nome,id_usuario)values('B logout',${q(c)})returning id_treino;`)
  const cSection=sql(`insert into public.secoes_treino(id_treino,nome)values(${cWorkout},'B')returning id_secao;`)
  sql(`insert into public.treinos_exercicios(id_treino,id_secao,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem)values(${cWorkout},${cSection},${exercise},4,10,20,1,'1');`)
  const registered=await json('/rest/v1/rpc/registrar_push_subscription',cjwt,{p_endpoint:endpoint+'logout-'+randomUUID(),p_p256dh:p256dh,p_auth:auth});assert.equal(registered.status,200)
  cSession=(await json('/rest/v1/rpc/iniciar_treino_sessao',cjwt,{p_id_treino:cWorkout,p_descanso_padrao_segundos:1})).data
  cSession=(await json('/rest/v1/rpc/concluir_treino_serie',cjwt,{p_id_sessao:cSession.id_sessao,p_revisao_esperada:cSession.revisao,p_carga_utilizada:20.25,p_repeticoes_feitas:10})).data
  await new Promise((r)=>setTimeout(r,1100));value(`select ${schema}.capture_events();`);assert.equal(sql(`select count(*)from ${schema}.deliveries;`),'1')
  assert.equal((await json('/rest/v1/rpc/remover_push_subscription',cjwt,{p_subscription_id:registered.data})).status,204)
  assert.equal((await json('/auth/v1/logout',cjwt,{})).status,204);assert.equal(sql(`select count(*)from ${schema}.deliveries;`),'0')
  const sender=await request('workout-push',{},null,{'X-Gymio-Workout-Worker-Token':token});assert.equal(sender.status,200);assert.equal(sender.data.attempted,0)
  results.push({group:'actual_auth_logout_after_remote_cleanup',passed:true,sends:0,externalPushRequests:0});console.log('PASS real Edge B: actual Auth logout after completed subscription RPC cleanup -> zero attempts')
 }finally{
  if(cSession)sql(`delete from public.treino_sessao_series where id_sessao=${q(cSession.id_sessao)};delete from public.treino_sessoes where id_sessao=${q(cSession.id_sessao)};`)
  if(cWorkout)sql(`delete from public.treinos where id_treino=${cWorkout};`)
  sql(`delete from public.usuarios where id_usuario=${q(c)};delete from auth.users where id=${q(c)};`)
 }
 fs.writeFileSync(path.join(context.root,'workout-edge-result.json'),JSON.stringify({passed:true,results,externalPushRequests:0,gatewayCors,handlerCors:false,browserRequestsRejected:true},null,2))
}finally{reset();sql(`delete from public.treinos where id_treino=${workout};delete from public.exercicios where id_exercicio=${exercise};`)}

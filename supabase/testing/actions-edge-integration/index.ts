// COPY ONLY to the future disposable runtime as actions-integration/index.ts.
// Fixed groups, real local Auth/DB, production handlers, injected fake transport.
import {createClient} from 'npm:@supabase/supabase-js@2.106.0'
import webpush from 'npm:web-push@3.6.7'
import {createPushAdminClient} from '../_shared/pushAdminClient.js'
import {createWorkoutActionHandler} from '../_shared/workoutActionHandler.js'
import {createWorkoutActionRepository} from '../_shared/workoutActionRepository.js'
import {createWorkoutPushHandler} from '../_shared/workoutPushHandler.js'
import {createWorkoutPushRepository} from '../_shared/workoutPushRepository.js'
import {createWebPushTransport} from '../_shared/pushTransport.js'
const url=new URL(Deno.env.get('SUPABASE_URL')!)
if(url.protocol!=='http:'||!['kong','127.0.0.1','localhost'].includes(url.hostname)||Deno.env.get('GYMIO_ACTIONS_MATRIX')!=='local-only')throw Error('local_harness_only')
const {client:admin}=createPushAdminClient({createClient,env:(name:string)=>Deno.env.get(name)})
const jwt=Deno.env.get('PUSH_TEST_A_JWT')!,machineToken=Deno.env.get('GYMIO_WORKOUT_WORKER_TOKEN')!
const check=(condition:unknown)=>{if(!condition)throw Error('check_failed')}
const actionRequest=(capability:string,origin='http://localhost:5173')=>new Request('http://localhost/workout-action',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({capability})})
const groups=['boundary','timeout','sanitize','sender_bound','sender_removed','sender_after_claim','sender_logout','sender_user_cascade','sender_404','sender_410','sender_refresh','sender_temporary','sender_partial','sender_no_retry']
function encoded(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
Deno.serve(async(request)=>{
 const subscriptions:string[]=[],bindings:{generation:string,subscription:string}[]=[]
 try {
  const expected=await admin.auth.getUser(jwt),caller=await admin.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer /i,'')??'')
  if(expected.error||caller.error||caller.data.user?.id!==expected.data.user?.id)return Response.json({passed:false},{status:401})
  const {group}=await request.json();if(!groups.includes(group))return Response.json({passed:false},{status:400})
  const owner=expected.data.user!.id
  if(['boundary','timeout','sanitize'].includes(group)){
   let calls=0,aborted=false
   const handler=createWorkoutActionHandler({timeoutMs:group==='timeout'?25:10000,initialize:()=>({consume:async(_token:string,signal:AbortSignal)=>{
    calls++;signal.addEventListener('abort',()=>{aborted=true})
    if(group==='timeout')return await new Promise(()=>{})
    if(group==='sanitize')throw Error('internal_credentials_must_not_escape')
    return {result:'unavailable'}
   }})})
   const fake=encoded(crypto.getRandomValues(new Uint8Array(32)))
   if(group==='boundary'){
    check((await handler(actionRequest(fake,'http://localhost:5174'))).status===403)
    check((await handler(actionRequest('invalid'))).status===400);check(calls===0)
   }else{
    const response=await handler(actionRequest(fake));check(response.status===503);check(JSON.stringify(await response.json())==='{"result":"unavailable"}');check(calls===1)
    if(group==='timeout')check(aborted)
   }
   // Actual admin repository and real DB lookup, without a trusted pre-hash.
   const real=createWorkoutActionHandler({initialize:()=>createWorkoutActionRepository(admin)})
   check((await (await real(actionRequest(fake))).json()).result==='unavailable')
   return Response.json({passed:true,group,externalPushRequests:0,runtime:Deno.version})
  }
  const {data:sessions,error:sessionsError}=await admin.from('treino_sessoes').select('id_sessao,revisao,descanso_termina_em').eq('id_usuario',owner).eq('status','ativa')
  check(!sessionsError&&sessions?.length===1)
  const session=sessions![0]
  const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits'])
  const publicKey=encoded(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)))
  for(let i=0;i<2;i++){
   const {data,error}=await admin.from('push_subscriptions').insert({id_usuario:owner,endpoint:'https://fcm.googleapis.com/fcm/send/c-edge-'+crypto.randomUUID(),p256dh:publicKey,auth:encoded(crypto.getRandomValues(new Uint8Array(16)))}).select('id').single()
   check(!error);subscriptions.push(data!.id)
  }
  await new Promise((r)=>setTimeout(r,Math.max(0,Date.parse(session.descanso_termina_em)-Date.now())+80))
  // A test-only capture RPC must be installed by the SQL harness, service-only.
  const captured=await admin.rpc('actions_matrix_capture');check(!captured.error)
  const real=createWorkoutPushRepository(admin)
  if(['sender_removed','sender_logout'].includes(group)){
   const authClient=createClient(url.origin,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
   const signed=await authClient.auth.signInWithPassword({email:Deno.env.get('PUSH_TEST_A_EMAIL')!,password:Deno.env.get('PUSH_TEST_A_PASSWORD')!});check(!signed.error&&signed.data.user?.id===owner)
   for(const id of subscriptions)check(!(await authClient.rpc('remover_push_subscription',{p_subscription_id:id})).error)
   if(group==='sender_logout')check(!(await authClient.auth.signOut({scope:'local'})).error)
  }
  if(group==='sender_user_cascade'){
   // The harness moves only its two synthetic subscriptions to a synthetic user,
   // then deletes that user through Auth. It never deletes users A/B.
   const temporary=await admin.auth.admin.createUser({email:`c-cascade-${crypto.randomUUID()}@local.invalid`,password:encoded(crypto.getRandomValues(new Uint8Array(32))),email_confirm:true})
   check(!temporary.error);const uid=temporary.data.user!.id
   check(!(await admin.from('push_subscriptions').update({id_usuario:uid}).in('id',subscriptions)).error)
   check(!(await admin.auth.admin.deleteUser(uid)).error)
  }
  let sends=0,fetches=0
  const transport=createWebPushTransport({generateRequestDetails:webpush.generateRequestDetails.bind(webpush),
   vapid:{publicKey:Deno.env.get('VAPID_PUBLIC_KEY')!,privateKey:Deno.env.get('VAPID_PRIVATE_KEY')!,subject:Deno.env.get('VAPID_SUBJECT')!},
   fetchImpl:async(_input:unknown,options:any)=>{
    check(options.redirect==='error'&&Number(options.headers.TTL)===60&&options.body.byteLength>150);fetches++
    const status=group==='sender_404'||group==='sender_refresh'?404:group==='sender_410'?410:
      ['sender_temporary','sender_no_retry'].includes(group)||group==='sender_partial'&&fetches===1?503:201
    return new Response(null,{status})
   }})
  const repository={...real,claim:async(limit:number)=>{
   const claims=await real.claim(limit)
   if(group==='sender_after_claim')check(!(await admin.from('push_subscriptions').delete().eq('id_usuario',owner).in('id',subscriptions)).error)
   return claims
  }}
  const handler=createWorkoutPushHandler({workerToken:machineToken,initialize:()=>({repository,sendPush:async(snapshot:any,payload:any)=>{
   check(snapshot.id_usuario===owner&&subscriptions.includes(snapshot.id));check(payload.version===3&&payload.type==='workout_control')
   const binding=await admin.rpc('actions_matrix_binding',{p_generation:payload.generation_id,p_subscription:snapshot.id,p_user:owner});check(!binding.error&&binding.data===true)
   bindings.push({generation:payload.generation_id,subscription:snapshot.id});sends++
   if(group==='sender_refresh')check(!(await admin.from('push_subscriptions').update({auth:encoded(crypto.getRandomValues(new Uint8Array(16))),updated_at:new Date().toISOString()}).eq('id',snapshot.id).eq('id_usuario',owner)).error)
   return transport(snapshot,payload)
  }})})
  const workerRequest=()=>new Request('http://localhost/workout-push',{method:'POST',headers:{'Content-Type':'application/json','X-Gymio-Workout-Worker-Token':machineToken},body:'{}'})
  check((await handler(workerRequest())).status===200)
  const before=sends;check((await handler(workerRequest())).status===200);check(sends===before)
  check(sends===(['sender_removed','sender_after_claim','sender_logout','sender_user_cascade'].includes(group)?0:2))
  // Expired snapshots cascade away, so their bindings are asserted by SQL before
  // transport and are deliberately omitted from the later catalog check.
  return Response.json({passed:true,group,sends,fetches,bindingsVerified:bindings.length,externalPushRequests:0,runtime:Deno.version})
 }catch{return Response.json({passed:false,failedCheck:'actions_harness_failed'},{status:500})}
 finally{if(subscriptions.length)await admin.from('push_subscriptions').delete().in('id',subscriptions)}
})

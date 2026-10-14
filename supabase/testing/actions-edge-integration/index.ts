// COPY ONLY to the disposable C runtime. Fixed groups; real local Auth/DB;
// production handlers and encrypted requests with an injected fake transport.
// Origin validation is defense-in-depth and is forgeable outside a browser.
// Capability possession plus server-side one-time scope/revision is authorization.
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
class CheckFailure extends Error {}
const check=(condition:unknown,label='check_failed')=>{if(!condition)throw new CheckFailure(label)}
const actionRequest=(capability:unknown,origin:string|null='http://localhost:5173',options:{method?:string,query?:string,body?:string,headers?:Record<string,string>}={})=>{
 const method=options.method??'POST'
 return new Request('http://localhost/workout-action'+(options.query??''),{method,
  headers:{...(origin===null?{}:{Origin:origin}),'Content-Type':'application/json',...options.headers},
  ...(['GET','OPTIONS'].includes(method)?{}:{body:options.body??JSON.stringify({capability})})})
}
const groups=['boundary','timeout','sanitize','sender_bound','sender_unchanged','sender_removed','sender_after_claim','sender_logout','sender_user_cascade','sender_404','sender_410','sender_refresh','sender_temporary','sender_partial','sender_no_retry','sender_timeout']
function encoded(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
Deno.serve(async(request)=>{
 const subscriptions:string[]=[],bindings:{generation:string,subscription:string}[]=[]
 try {
  const expected=await admin.auth.getUser(jwt),caller=await admin.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer /i,'')??'')
  if(expected.error||caller.error||caller.data.user?.id!==expected.data.user?.id)return Response.json({passed:false},{status:401})
  const {group}=await request.json();if(!groups.includes(group))return Response.json({passed:false},{status:400})
  const owner=expected.data.user!.id
  // Fixture writes use the same authenticated registration RPC as the browser.
  // Foundation intentionally denies service_role INSERT and key-column UPDATE;
  // do not add privileges or bypass ownership to prepare this local test.
  const ownedRpcClient=createClient(url.origin,Deno.env.get('SUPABASE_ANON_KEY')!,{
   global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false},
  })
  if(['boundary','timeout','sanitize'].includes(group)){
   let initialized=0,calls=0,aborted=false
   // Exercise the production handler's actual 10-second timer in Edge. The
   // real PostgREST connection has an earlier 8-second SQL budget; this fixed
   // injected repository isolates AbortSignal behavior without changing it.
   const handler=createWorkoutActionHandler({initialize:()=>{
    initialized++;return {consume:async(_token:string,signal:AbortSignal)=>{
     calls++;signal.addEventListener('abort',()=>{aborted=true})
     if(group==='timeout')return await new Promise(()=>{})
     if(group==='sanitize')throw Error('internal_credentials_must_not_escape')
     return {result:'unavailable'}
    }}
   }})
   const fake=encoded(crypto.getRandomValues(new Uint8Array(32)))
   if(group==='boundary'){
    // HANDLER LEVEL: every rejected route fails before initialize() and consume().
    for(const origin of ['http://localhost:5174','null',null])check((await handler(actionRequest(fake,origin))).status===403,'handler_origin_rejected')
    for(const options of [
     {method:'OPTIONS',headers:{'Access-Control-Request-Method':'PUT'}},
     {method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization'}},
     {method:'GET'},{method:'PUT'},{query:'?extra=1'},
     {headers:{'Content-Type':'text/plain'}},{body:'{'},{body:'null'},{body:'[]'},
     {body:'{}'},{body:JSON.stringify({capability:fake,identity:owner})},{body:' '.repeat(257)},
    ] as {method?:string,query?:string,body?:string,headers?:Record<string,string>}[])check((await handler(actionRequest(fake,'http://localhost:5173',options))).status>=400,'handler_invalid_request')
    for(const invalid of [null,42,fake+'=',fake.slice(0,42),fake+'A','!'+fake.slice(1),' '+fake,fake+' ',fake.slice(0,42)+'B'])
     check((await handler(actionRequest(invalid))).status===400,'handler_noncanonical')
    check(initialized===0&&calls===0,'handler_zero_admin_initialization')
    const options=await handler(actionRequest(fake,'http://localhost:5173',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}}))
    check(options.status===204&&options.headers.get('Access-Control-Allow-Origin')==='http://localhost:5173','handler_allowed_preflight')
    check(initialized===0&&calls===0,'handler_preflight_no_admin')
    check((await handler(actionRequest(fake))).status===200&&initialized===1&&calls===1,'handler_allowed_origin')
   }else{
    const started=performance.now(),response=await handler(actionRequest(fake)),elapsedMs=performance.now()-started
    check(response.status===503,'handler_sanitized_failure')
    check(JSON.stringify(await response.json())==='{"result":"unavailable"}'&&initialized===1&&calls===1,'handler_sanitized_body')
    if(group==='timeout'){
     check(aborted&&elapsedMs>=9000&&elapsedMs<18000,'handler_real_ten_second_abort')
     const real=createWorkoutActionHandler({initialize:()=>createWorkoutActionRepository(admin)})
     check((await (await real(actionRequest(fake))).json()).result==='unavailable','real_unknown_capability')
     return Response.json({passed:true,group,initialized,calls,timeoutMs:10000,elapsedMs,
       abortObserved:aborted,automaticRetry:false,realDbUnknownCapabilityChecked:true,
       externalPushRequests:0,runtime:Deno.version})
    }
   }
   const real=createWorkoutActionHandler({initialize:()=>createWorkoutActionRepository(admin)})
   check((await (await real(actionRequest(fake))).json()).result==='unavailable','real_unknown_capability')
   return Response.json({passed:true,group,initialized,calls,externalPushRequests:0,runtime:Deno.version})
  }
  const {data:sessions,error:sessionsError}=await admin.from('treino_sessoes').select('id_sessao,revisao,descanso_termina_em').eq('id_usuario',owner).eq('status','ativa')
  check(!sessionsError&&sessions?.length===1,'sender_one_owned_session')
  const session=sessions![0]
  const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits'])
  const publicKey=encoded(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)))
  for(let i=0;i<2;i++){
   const {data,error}=await ownedRpcClient.rpc('registrar_push_subscription',{
    p_endpoint:'https://fcm.googleapis.com/fcm/send/c-edge-'+crypto.randomUUID(),p_p256dh:publicKey,p_auth:encoded(crypto.getRandomValues(new Uint8Array(16))),
   })
   check(!error&&typeof data==='string','sender_subscription_registration');subscriptions.push(data)
  }
  await new Promise((r)=>setTimeout(r,Math.max(0,Date.parse(session.descanso_termina_em)-Date.now())+80))
  check(!(await admin.rpc('actions_matrix_capture')).error,'sender_capture')
  const audit=async()=>{const result=await admin.rpc('actions_matrix_sender_audit',{p_session:session.id_sessao,p_subscriptions:subscriptions});check(!result.error,'sender_audit');return result.data}
  const captured=await audit();check(captured.deliveries.length===2&&captured.deliveries.every((d:any)=>d.state==='pending'&&d.attempted_at===null),'sender_two_pending')
  if(group==='sender_user_cascade'){
   const result=await admin.rpc('actions_matrix_user_cascade',{p_user:owner,p_session:session.id_sessao,p_subscriptions:subscriptions})
   check(!result.error&&result.data===true,'user_cascade_rollback_only')
   const restored=await audit();check(restored.subscriptions.length===2&&restored.deliveries.every((d:any)=>d.state==='pending'&&d.attempted_at===null),'user_cascade_restored')
   return Response.json({passed:true,group,sends:0,fetches:0,rollbackOnly:true,externalPushRequests:0,runtime:Deno.version})
  }
  const real=createWorkoutPushRepository(admin)
  if(['sender_removed','sender_logout','sender_unchanged'].includes(group)){
   const authClient=createClient(url.origin,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
   const signed=await authClient.auth.signInWithPassword({email:Deno.env.get('PUSH_TEST_A_EMAIL')!,password:Deno.env.get('PUSH_TEST_A_PASSWORD')!});check(!signed.error&&signed.data.user?.id===owner,'sender_auth')
   for(const id of subscriptions){
    if(group==='sender_unchanged'){
     const result=await authClient.rpc('emitir_controles_notificacao_treino',{p_session_id:session.id_sessao,p_subscription_id:id,p_expected_revision:session.revisao})
     check(!result.error&&result.data?.projection?.controls_status==='emitted','sender_first_controls')
    }else check(!(await authClient.rpc('remover_push_subscription',{p_subscription_id:id})).error,'sender_owned_removal')
   }
   if(group==='sender_logout')check(!(await authClient.auth.signOut({scope:'local'})).error,'sender_logout')
  }
  let sends=0,fetches=0,timeoutAborted=false,transportCheck:string|undefined
  const completions:{subscription:string,outcome:string,returned:string}[]=[],tokens=new Map<string,Set<string>>(),bPayloads=new Map<string,any>()
  const endpoint=await admin.from('push_subscriptions').select('endpoint').eq('id',subscriptions[0]).maybeSingle()
  const timeoutEndpoint=endpoint.data?.endpoint??'no-present-endpoint'
  const transport=createWebPushTransport({generateRequestDetails:webpush.generateRequestDetails.bind(webpush),
   vapid:{publicKey:Deno.env.get('VAPID_PUBLIC_KEY')!,privateKey:Deno.env.get('VAPID_PRIVATE_KEY')!,subject:Deno.env.get('VAPID_SUBJECT')!},
   fetchImpl:async(input:unknown,options:any)=>{
    check(options.redirect==='error'&&Number(options.headers.TTL)===60&&options.body.byteLength>150,'sender_encrypted_transport');fetches++
    if(group==='sender_timeout'&&String(input)===timeoutEndpoint)return await new Promise<Response>((_resolve,reject)=>{
     options.signal.addEventListener('abort',()=>{timeoutAborted=true;reject(Error('synthetic_timeout'))},{once:true})
    })
    const status=group==='sender_404'||group==='sender_refresh'?404:group==='sender_410'?410:
      ['sender_temporary','sender_no_retry'].includes(group)||group==='sender_partial'&&fetches===1?503:201
    return new Response(null,{status})
   }})
  const repository={...real,claim:async(limit:number)=>{
   const claims=await real.claim(limit)
   if(group==='sender_after_claim')check(!(await admin.from('push_subscriptions').delete().eq('id_usuario',owner).in('id',subscriptions)).error,'sender_remove_after_claim')
   return claims
  },begin:async(claim:any)=>{
   const expected=await admin.rpc('actions_matrix_b_payload',{p_delivery_id:claim.id,p_claim_token:claim.claim_token})
   if(expected.error){transportCheck='sender_B_baseline';throw Error('test_B_baseline_failed')}
   const result=await real.begin(claim)
   if(result){
    if(!expected.data||result.payload.title!==expected.data.title||result.payload.body!==expected.data.body){transportCheck='sender_B_title_body_preserved';throw Error('test_B_text_changed')}
    bPayloads.set(result.snapshot.id,expected.data)
   }else if(expected.data!==null){transportCheck='sender_B_C_authorization_disagreement';throw Error('test_sender_baseline_disagreement')}
   return result
  },complete:async(claim:any,outcome:string,snapshot:any)=>{
   const returned=await real.complete(claim,outcome,snapshot);completions.push({subscription:snapshot.id,outcome,returned});return returned
  }}
  const handler=createWorkoutPushHandler({workerToken:machineToken,initialize:()=>({repository,sendPush:async(snapshot:any,payload:any)=>{
   try {
   check(snapshot.id_usuario===owner&&subscriptions.includes(snapshot.id),'sender_exact_owned_subscription')
   const baseline=bPayloads.get(snapshot.id)
   check(baseline?.title==='Gym.io · Descanso concluído'&&payload.title===baseline.title&&payload.body===baseline.body,'sender_B_title_body_before_http')
   // Assert committed irreversible marker BEFORE encryption/fake HTTP. Do not
   // wait until finally/cascade has destroyed expired deliveries or capabilities.
   const before=await audit(),delivery=before.deliveries.find((d:any)=>d.subscription_id===snapshot.id)
   check(delivery?.state==='attempted'&&delivery.attempted_at!==null&&delivery.accepted_at===null,'attempted_before_http')
   if(group==='sender_unchanged')check(payload.version===2&&payload.type==='workout_rest_finished'&&!('controls'in payload),'sender_unchanged_v2_fallback')
   else{
    check(payload.version===3&&payload.type==='workout_control'&&payload.controls_status==='emitted','sender_v3_payload')
    const binding=await admin.rpc('actions_matrix_binding',{p_generation:payload.generation_id,p_subscription:snapshot.id,p_user:owner});check(!binding.error&&binding.data===true,'sender_generation_capability_binding')
    const generation=before.generations.find((g:any)=>g.id===payload.generation_id)
    check(generation?.subscription_id===snapshot.id&&generation.id_usuario===owner&&generation.capability_subscriptions?.length===payload.controls.length
      &&generation.capability_subscriptions.every((id:string)=>id===snapshot.id),'sender_exact_capability_subscription')
    const current=new Set<string>(payload.controls.map((control:any)=>control.capability))
    for(const [other,values] of tokens)if(other!==snapshot.id)for(const token of current)check(!values.has(token),'sender_no_cross_device_token')
    tokens.set(snapshot.id,current);bindings.push({generation:payload.generation_id,subscription:snapshot.id})
   }
   sends++
   if(group==='sender_refresh'){
    const refreshed=await ownedRpcClient.rpc('registrar_push_subscription',{
     p_endpoint:snapshot.endpoint,p_p256dh:snapshot.p256dh,p_auth:encoded(crypto.getRandomValues(new Uint8Array(16))),
    })
    check(!refreshed.error&&refreshed.data===snapshot.id,'sender_concurrent_owned_refresh')
   }
   return await transport(snapshot,payload)
   } catch(error) {if(error instanceof CheckFailure)transportCheck=error.message;throw error}
  }})})
  const workerRequest=()=>new Request('http://localhost/workout-push',{method:'POST',headers:{'Content-Type':'application/json','X-Gymio-Workout-Worker-Token':machineToken},body:'{}'})
  const started=Date.now(),first=await handler(workerRequest());check(first.status===200,'sender_first_status');const counts=await first.json()
  check(!transportCheck,transportCheck??'sender_transport_contract')
  const before=sends,second=await handler(workerRequest());check(second.status===200&&sends===before,'sender_no_retry')
  const repeated=await second.json();check(repeated.attempted===0&&repeated.claimed===0,'sender_no_reclaim')
  const zero=['sender_removed','sender_after_claim','sender_logout'].includes(group)
  check(sends===(zero?0:2)&&fetches===sends,'sender_transport_counts')
  const final=await audit() // All outcome assertions precede finally cleanup.
  if(zero)check(final.deliveries.length===0&&final.generations.length===0&&counts.attempted===0,'sender_cascade_zero_actions')
  else{
   check(counts.attempted===2&&completions.length===2,'sender_completed_attempts')
   const expired=['sender_404','sender_410','sender_refresh'].includes(group)
   const failed=['sender_temporary','sender_no_retry'].includes(group)
   check(counts.expired===(expired?2:0)&&counts.failed===(failed?2:['sender_partial','sender_timeout'].includes(group)?1:0)
     &&counts.accepted===(expired||failed?0:['sender_partial','sender_timeout'].includes(group)?1:2),'sender_outcome_counts')
   for(const completion of completions)check(completion.returned===completion.outcome,'sender_complete_result')
   if(expired&&group!=='sender_refresh')check(final.deliveries.length===0&&final.subscriptions.length===0&&final.generations.length===0,'sender_expired_snapshot_cascade')
   else{
    check(final.deliveries.length===2&&final.subscriptions.length===2,'sender_preserved_records')
    for(const d of final.deliveries){
     const completion=completions.find((item)=>item.subscription===d.subscription_id)
     check(d.state===completion?.outcome&&d.attempted_at!==null&&(d.accepted_at!==null)===(d.state==='accepted'),'sender_final_state')
     check(!['pending','claimed'].includes(d.state),'sender_irreversible')
    }
   }
   if(group!=='sender_unchanged')check(bindings.length===2&&new Set(bindings.map((b)=>b.subscription)).size===2&&new Set(bindings.map((b)=>b.generation)).size===2,'sender_distinct_bindings')
  }
  if(group==='sender_timeout')check(timeoutAborted&&Date.now()-started>=9000&&Date.now()-started<18000,'sender_real_ten_second_timeout')
  return Response.json({passed:true,group,sends,fetches,retries:0,bindingsVerified:bindings.length,bTitleBodyVerified:bPayloads.size,
    outcomes:completions.map((completion)=>completion.outcome),externalPushRequests:0,runtime:Deno.version})
 }catch(error){return Response.json({passed:false,failedCheck:error instanceof CheckFailure?error.message:'actions_harness_failed'},{status:500})}
 finally{if(subscriptions.length)await admin.from('push_subscriptions').delete().in('id',subscriptions)}
})

// Disposable harness only. Fixed groups, real local Auth/DB, injected transport.
import {createClient} from 'npm:@supabase/supabase-js@2.106.0'
import webpush from 'npm:web-push@3.6.7'
import {createPushAdminClient} from '../_shared/pushAdminClient.js'
import {createWebPushTransport} from '../_shared/pushTransport.js'
import {createWorkoutPushHandler} from '../_shared/workoutPushHandler.js'
import {createWorkoutPushRepository} from '../_shared/workoutPushRepository.js'
const url=Deno.env.get('SUPABASE_URL')!,host=new URL(url)
if(host.protocol!=='http:'||!['kong','localhost','127.0.0.1'].includes(host.hostname))throw Error('local_harness_only')
const token=Deno.env.get('GYMIO_WORKOUT_WORKER_TOKEN')!,jwt=Deno.env.get('PUSH_TEST_A_JWT')!
const {client:admin}=createPushAdminClient({createClient,env:(name:string)=>Deno.env.get(name)})
class CheckFailure extends Error {}
const check=(value:unknown,label:string)=>{if(!value)throw new CheckFailure(label)}
const groups=['boundary','batch','404','410','refresh','timeout','temporary','partial','removed','after_claim','crash_before','crash_after','stale','zero','concurrent']
const requestFor=(body='{}',headers:Record<string,string>={})=>new Request('http://localhost/workout-push',{method:'POST',headers:{'Content-Type':'application/json','X-Gymio-Workout-Worker-Token':token,...headers},body})
Deno.serve(async(request)=>{
 try {
  const caller=await admin.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer /i,'')??'')
  const expected=await admin.auth.getUser(jwt)
  if(caller.error||caller.data.user?.id!==expected.data.user?.id)return Response.json({passed:false},{status:401})
  const {group}=await request.json();if(!groups.includes(group))return Response.json({passed:false},{status:400})
  const owner=expected.data.user!.id,real=createWorkoutPushRepository(admin)
  let initialized=0,sends=0,active=0,maxActive=0,encryptedBytes=0,crashed=false,transportCalls=0
  const repository={...real,
   claim:async(limit:number)=>{
    const claims=await real.claim(limit)
    if(group==='after_claim'){
     const {error}=await admin.from('push_subscriptions').delete().eq('id_usuario',owner).like('endpoint','https://fcm.googleapis.com/fcm/send/b-edge-after_claim-%');check(!error,'claim_removal')
    }
    return claims
   },
   begin:async(claim:any)=>{
    if(group==='crash_before'&&!crashed){crashed=true;throw Error('simulated_process_loss')}
    const result=await real.begin(claim)
    if(group==='crash_after'&&result&&!crashed){crashed=true;throw Error('simulated_process_loss')}
    return result
   }}
  const transport=createWebPushTransport({generateRequestDetails:webpush.generateRequestDetails.bind(webpush),
   vapid:{publicKey:Deno.env.get('VAPID_PUBLIC_KEY')!,privateKey:Deno.env.get('VAPID_PRIVATE_KEY')!,subject:Deno.env.get('VAPID_SUBJECT')!},
   timeoutMs:group==='timeout'?25:10000,
   fetchImpl:async(_input:string|Request|URL,options:any)=>{
    check(options.redirect==='error'&&options.method==='POST','transport_contract');check(Number(options.headers.TTL)===60,'ttl');encryptedBytes=options.body.byteLength;check(encryptedBytes>150,'encrypted')
    active++;maxActive=Math.max(active,maxActive);const partialFailure=group==='partial'&&transportCalls++===0
    if(group==='timeout')return await new Promise<Response>(()=>{})
    await new Promise((r)=>setTimeout(r,40));active--
    return new Response(null,{status:group==='404'||group==='refresh'?404:group==='410'?410:group==='temporary'||partialFailure?503:201})
   }})
  const handler=createWorkoutPushHandler({workerToken:token,initialize:()=>{
   initialized++;return {repository,sendPush:async(snapshot:any,payload:any)=>{
    check(snapshot.id_usuario===owner,'ownership');check(payload.version===2&&payload.type==='workout_rest_finished','payload_type')
    check(typeof payload.id_treino==='string'&&typeof payload.revisao==='string'&&payload.data.url===`/treinar/${payload.id_treino}`,'payload_ids')
    check(payload.title==='Gym.io · Descanso concluído'&&payload.exercicio.length<=80&&payload.body.length<=160,'payload_text');check(!JSON.stringify(payload).includes(snapshot.endpoint),'payload_secret')
    sends++
    if(group==='refresh'){const {error}=await admin.from('push_subscriptions').update({auth:'AAAAAAAAAAAAAAAAAAAAAA',updated_at:new Date().toISOString()}).eq('id',snapshot.id).eq('id_usuario',owner);check(!error,'refresh')}
    return transport(snapshot,payload)
   }}
  }})
  if(group==='boundary'){
   for(const bad of ['', 'a'.repeat(43)])check((await handler(requestFor('{}',{'X-Gymio-Workout-Worker-Token':bad}))).status===401,'token')
   for(const body of ['{','[]','null','{"extra":1}'])check((await handler(requestFor(body))).status===400,'body')
   check((await handler(requestFor('{}',{Origin:'http://localhost:5173'}))).status===403,'browser')
   const query=new Request('http://localhost/workout-push?token=invalid',{method:'POST',headers:requestFor().headers,body:'{}'})
   check((await handler(query)).status===400,'query');check(initialized===0&&sends===0,'boundary_before_admin')
   const result=await handler(requestFor());check(result.status===200&&!result.headers.has('Access-Control-Allow-Origin'),'machine_auth')
  }else{
   const responses=await Promise.all(Array.from({length:group==='concurrent'?2:1},()=>handler(requestFor())))
   for(const response of responses){check(response.status===200,'handler');const body=await response.json();check(body.claimed<=10,'batch_limit')}
   const firstSends=sends;await handler(requestFor());check(sends===firstSends+(group==='batch'?2:0),'no_retry')
   check(maxActive<=4,'concurrency_limit')
   if(['zero','removed','after_claim','stale','crash_before','crash_after'].includes(group))check(sends===0,'zero_send')
   if(group==='batch')check(sends===12,'multiple_devices')
  }
  return Response.json({passed:true,group,sends,maxActive,encryptedBytes,externalPushRequests:0,runtime:Deno.version})
 }catch(error){return Response.json({passed:false,failedCheck:error instanceof CheckFailure?error.message:'harness_error'},{status:500})}
})

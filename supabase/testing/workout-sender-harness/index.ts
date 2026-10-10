// Replaces only the disposable runtime entrypoint, never the production source.
// Machine auth, RPC repository, encryption and HTTP contract remain real.
// No mock switch, endpoint, payload, identity or token is accepted in the body.
import {createClient} from 'npm:@supabase/supabase-js@2.106.0'
import webpush from 'npm:web-push@3.6.7'
import {createPushAdminClient} from '../_shared/pushAdminClient.js'
import {createWebPushTransport} from '../_shared/pushTransport.js'
import {createWorkoutPushHandler} from '../_shared/workoutPushHandler.js'
import {createWorkoutPushRepository} from '../_shared/workoutPushRepository.js'
const local=new URL(Deno.env.get('SUPABASE_URL')!)
if(local.protocol!=='http:'||local.hostname!=='kong')throw Error('local_harness_only')
Deno.serve(createWorkoutPushHandler({workerToken:Deno.env.get('GYMIO_WORKOUT_WORKER_TOKEN')??'',initialize:()=>{
 const {client}=createPushAdminClient({createClient,env:(name:string)=>Deno.env.get(name)})
 return {repository:createWorkoutPushRepository(client),sendPush:createWebPushTransport({
  generateRequestDetails:webpush.generateRequestDetails.bind(webpush),vapid:{publicKey:Deno.env.get('VAPID_PUBLIC_KEY')!,privateKey:Deno.env.get('VAPID_PRIVATE_KEY')!,subject:Deno.env.get('VAPID_SUBJECT')!},
  fetchImpl:async(_input:string|Request|URL,options:any)=>{
   if(options.redirect!=='error'||options.method!=='POST'||Number(options.headers.TTL)!==60||options.body.byteLength<150)throw Error('transport_contract')
   return new Response(null,{status:201})
  },
 })}
}}))

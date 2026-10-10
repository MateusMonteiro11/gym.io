// Compatibility probe, only copied into a disposable local Edge runtime.
import {createClient} from 'npm:@supabase/supabase-js@2.106.0'
import {createPushAdminClient} from '../_shared/pushAdminClient.js'
const url=Deno.env.get('SUPABASE_URL')!,token=Deno.env.get('PUSH_TEST_A_JWT')!
if(new URL(url).hostname!=='kong'||new URL(url).protocol!=='http:')throw Error('local_only')
const {client:admin}=createPushAdminClient({createClient,env:(name:string)=>Deno.env.get(name)})
const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label)}
Deno.serve(async(request)=>{
 const caller=await admin.auth.getUser(request.headers.get('authorization')?.replace(/^Bearer /i,'')??'')
 const expected=await admin.auth.getUser(token)
 if(caller.error||expected.error||caller.data.user?.id!==expected.data.user?.id)return Response.json({passed:false},{status:401})
 let id:string|null=null
 try{
  check(request.method==='POST'&&JSON.stringify(await request.json())==='{}','body')
  const endpoint=`https://fcm.googleapis.com/fcm/send/runtime-compat-${crypto.randomUUID()}`
  const registered=await client.rpc('registrar_push_subscription',{p_endpoint:endpoint,p_p256dh:'B'+'A'.repeat(86),p_auth:'A'.repeat(22)})
  check(!registered.error&&registered.data,'register');id=registered.data
  const lookup=await client.rpc('consultar_push_subscription',{p_endpoint:endpoint})
  check(!lookup.error&&lookup.data===id,'rpc')
  const own=await admin.from('push_subscriptions').select('id,id_usuario').eq('id',id!).eq('id_usuario',expected.data.user!.id).single()
  check(!own.error&&own.data.id===id,'admin_client')
  const controller=new AbortController();controller.abort()
  const aborted=await admin.from('push_subscriptions').select('id').limit(1).abortSignal(controller.signal)
  check(aborted.error&&/abort/i.test(aborted.error.message),'abort_signal')
  const invoked=await client.functions.invoke('push-compat-spike',{body:{}})
  check(!invoked.error&&invoked.data.imported&&invoked.data.transmitted===false,'functions_invoke')
  return Response.json({passed:true,supabaseJs:'2.106.0',rpc:true,abortSignal:true,functionsInvoke:true,adminClient:true,runtime:Deno.version,externalRequests:0})
 }catch{return Response.json({passed:false},{status:500})}
 finally{if(id)await client.rpc('remover_push_subscription',{p_subscription_id:id})}
})

import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import { buildWorkoutProjection, createWorkoutNotificationAdapter } from './workoutProjection.js'
import { createWorkoutControlsIssuer } from './workoutControlsClient.js'
import { publicPushConfig, pushPublicConfigPlugin } from '../../../tools/pushPublicConfig.js'

const now=Date.parse('2026-10-10T10:01:00Z'),id='11111111-1111-4111-8111-111111111111'
const generation='22222222-2222-4222-8222-222222222222'
const session={id_sessao:id,id_treino:'9007199254740993',id_treino_exercicio_atual:'2',serie_atual:2,revisao:'3',status:'ativa',fase:'descanso',pausada_em:null,
  iniciada_em:'2026-10-10T10:00:00Z',descanso_iniciado_em:'2026-10-10T10:01:00Z',descanso_termina_em:'2026-10-10T10:02:00Z',agora_servidor:'2026-10-10T10:01:00Z'}
const base=buildWorkoutProjection(session,[{id_treino_exercicio:2,nome:'Supino',series:4}])
const control=(action,index)=>({action,capability:String(index).repeat(42)+'A'})
const payload={...base,version:3,type:'workout_control',generation_id:generation,expires_at:'2026-10-10T10:16:00Z',eligible_state:'rest_active',controls_status:'emitted',
  controls:[control('rest_add_15',1),control('rest_skip',2),control('rest_pause',3)]}
const script=fs.readFileSync(new URL('../../../public/push-sw.js',import.meta.url),'utf8')
function worker(shared={},sendAction=async()=>({result:'stale'})) {
  const cards=shared.cards??=[],shown=[],handlers={},markers=shared.markers??new Map()
  const registration={getNotifications:async()=>cards.filter((c)=>!c.closed),showNotification:async(title,options)=>{
    for(const c of cards)if(c.tag===options.tag)c.closed=true
    const card={tag:options.tag,data:options.data,closed:false,close(){this.closed=true}}
    cards.push(card);shown.push({title,options})
  }}
  const store={decide:async(p,alert)=>{
    if(markers.get('disabled')||markers.get(`closed:${p.id_sessao}`)||markers.get(`generation:${p.generation_id}`))return {show:false}
    const previous=markers.get('projection')
    if(previous?.session===p.id_sessao&&BigInt(previous.revision)>BigInt(p.revisao))return {show:false}
    // Only metadata, matching the production IndexedDB boundary.
    markers.set('projection',{session:p.id_sessao,revision:p.revisao,generation:p.generation_id??null})
    return {show:true,alert}
  },closeGeneration:async(g)=>markers.set(`generation:${g}`,true),generationClosed:async(g)=>!!markers.get(`generation:${g}`),
  actionAllowed:async(p)=>{const current=markers.get('projection');return !markers.get('disabled')&&!markers.get(`closed:${p.id_sessao}`)&&!markers.get(`generation:${p.generation_id}`)&&current?.session===p.id_sessao&&current.revision===p.revisao&&current.generation===p.generation_id},
  close:async(s)=>markers.set(`closed:${s}`,true),disable:async()=>markers.set('disabled',true),enable:async()=>markers.delete('disabled')}
  const context=vm.createContext({self:{registration,location:{origin:'http://localhost:5173'},addEventListener:(t,f)=>handlers[t]=f},URL,Notification:{maxActions:2,prototype:{renotify:false,vibrate:[]}}})
  vm.runInContext(script,context)
  const processor=vm.runInContext('createWorkoutProcessor',context)({store,registration,sendAction,now:()=>now})
  return {processor,shown,cards,markers,handlers,valid:vm.runInContext('validControls',context)}
}
const unchanged=(value=payload)=>({...value,controls_status:'unchanged',controls:[]})
test('strict V3 controls preserve canonical IDs, fixed actions, state, TTL and safe route',()=>{
  const w=worker();assert.equal(w.valid(payload),true);assert.equal(w.valid(unchanged()),true)
  for(const p of [{...payload,revisao:'03'},{...payload,generation_id:'bad'},{...payload,endpoint:'https://evil.invalid'},
    {...payload,expires_at:'2026-10-10T10:16:01Z'},{...payload,eligible_state:'rest_finished'},
    {...payload,controls:[control('rest_add_999',1)]},{...payload,controls:[{...control('rest_add_15',1),hash:'bad'},...payload.controls.slice(1)]},
    {...payload,controls:payload.controls.map((c)=>({...c,capability:'a'.repeat(43)}))},{...payload,data:{url:'/dashboard'}},
    {...payload,controls:payload.controls.map((c)=>({...c,capability:c.capability+'='}))}])assert.equal(w.valid(p),false)
})
test('paused and due envelopes expose only their fixed controls; V2 execution stays action-free',async()=>{
  const w=worker(),paused={...payload,title:'Gym.io · Pausado',pausada:true,eligible_state:'rest_paused',controls:[control('rest_resume',4),control('rest_skip',5)]}
  const due={...payload,agora_servidor:'2026-10-10T10:02:01Z',eligible_state:'rest_finished',title:'Gym.io · Descanso concluído',controls:[control('rest_continue',6)]}
  assert.equal(w.valid(paused),true);assert.equal(w.valid(due),true)
  assert.equal(w.valid({...paused,controls:payload.controls}),false)
  await w.processor.project(paused);assert.deepEqual(w.shown.at(-1).options.actions.map((a)=>a.title),['Retomar','Pular'])
  await w.processor.project(due,true);assert.equal(w.shown.at(-1).options.renotify,true)
  const executed=buildWorkoutProjection({...session,revisao:'4',fase:'execucao',descanso_iniciado_em:null,descanso_termina_em:null},[])
  await w.processor.project(executed);assert.equal(w.shown.at(-1).options.actions,undefined);assert.equal(w.shown.at(-1).options.silent,true)
})
test('unchanged reuses only current matching card tokens, including a fresh worker instance',async()=>{
  const w=worker();await w.processor.project(payload);await w.processor.project(unchanged())
  assert.equal(w.shown.at(-1).options.data.projection.controls[0].capability,payload.controls[0].capability)
  const restarted=worker({cards:w.cards,markers:w.markers});await restarted.processor.project(unchanged())
  assert.equal(restarted.shown[0].options.actions.length,2)
  assert.ok(!JSON.stringify([...w.markers]).includes('capability'))
})
for(const [name,change] of [
  ['card missing',(w)=>w.cards.forEach((c)=>c.close())],
  ['generation differs',(w)=>{w.cards.at(-1).data.projection={...payload,generation_id:id}}],
  ['revision differs',(w)=>{w.cards.at(-1).data.projection={...payload,revisao:'2'}}],
  ['expired card',(w)=>{w.cards.at(-1).data.projection={...payload,expires_at:'2026-10-10T10:00:00Z'}}],
])test(`unchanged falls back without actions: ${name}`,async()=>{
  const w=worker();await w.processor.project(payload);change(w);await w.processor.project(unchanged())
  assert.equal(w.shown.at(-1).options.actions,undefined);assert.equal(w.shown.at(-1).options.data.projection,undefined)
})
test('queued projections inspect the card at replacement time and reject older revision',async()=>{
  const w=worker();const newer={...payload,revisao:'4',generation_id:id}
  await Promise.all([w.processor.project(payload),w.processor.project(newer),w.processor.project(unchanged())])
  assert.equal(w.shown.length,2);assert.equal(w.cards.at(-1).data.projection.revisao,'4')
})
test('action sends only bearer, confirms silently, closes generation without session tombstone',async()=>{
  const sent=[];const next={...payload,revisao:'4',generation_id:id,controls:[...payload.controls]}
  const w=worker({},async(token)=>{sent.push(token);return {result:'ok',projection:next}})
  await w.processor.project(payload,true);const card=w.cards.at(-1);await w.processor.action(card,'rest_add_15')
  assert.deepEqual(sent,[payload.controls[0].capability]);assert.equal(w.shown.at(-1).options.silent,true);assert.equal(w.shown.at(-1).options.vibrate,undefined)
  assert.equal(w.markers.get(`generation:${generation}`),true);assert.equal(w.markers.get(`closed:${id}`),undefined)
  await w.processor.project(unchanged());assert.equal(w.shown.length,2)
  for(const result of ['stale','expired','already_used','unavailable']){
    const stale=worker({},async()=>({result}));await stale.processor.project(payload);await stale.processor.action(stale.cards.at(-1),'rest_skip')
    assert.equal(stale.cards.at(-1).closed,false);assert.equal(stale.markers.get(`closed:${id}`),undefined)
    assert.equal(stale.shown.at(-1).options.body,'Abra o treino para atualizar')
    assert.equal(stale.cards.at(-1).data.projection,undefined)
    assert.equal(stale.shown.at(-1).options.actions,undefined)
    await stale.processor.project(next);assert.equal(stale.shown.length,3)
  }
})
test('offline makes one attempt and cannot confirm; logout blocks late action and projection',async()=>{
  let sends=0,finish;const w=worker({},async()=>{sends++;throw Error('offline')})
  await w.processor.project(payload);await w.processor.action(w.cards.at(-1),'rest_pause');assert.equal(sends,1);assert.equal(w.cards.at(-1).closed,false)
  const late=worker({},()=>new Promise((r)=>finish=r));await late.processor.project(payload)
  const action=late.processor.action(late.cards.at(-1),'rest_pause');await new Promise((r)=>setImmediate(r));const logout=late.processor.disable(true)
  finish({result:'ok',projection:{...payload,revisao:'4',generation_id:id}});await Promise.all([action,logout]);assert.equal(late.shown.length,1)
  await late.processor.project(payload);assert.equal(late.shown.length,1)
  let afterRestart=0;const restarted=worker({cards:late.cards,markers:late.markers},async()=>{afterRestart++;return {result:'ok'}})
  await restarted.processor.action({data:{projection:payload}},'rest_pause');assert.equal(afterRestart,0)
})
test('adapter retains current card for unchanged and suppresses late issuance',async()=>{
  const sent=[],resolve=[];const adapter=createWorkoutNotificationAdapter({project:(p)=>sent.push(p),controls:(p)=>sent.push(p),close:()=>{}},
    ()=>new Promise((done)=>resolve.push(done)))
  adapter.accept(null,session,[]);assert.equal(sent.length,0)
  adapter.accept(session,{...session,revisao:'4'},[]);resolve[0]({ ...payload,controls_status:'unchanged',controls:[] })
  resolve[1]({...payload,revisao:'4'});await new Promise((r)=>setImmediate(r));assert.equal(sent.length,1);assert.equal(sent[0].revisao,'4')
})
test('issuer reads existing dedicated subscription and never registers, subscribes or asks permission',async()=>{
  const calls=[];const browser={isSecureContext:true,Notification:{permission:'granted'},localStorage:{getItem:()=>null},location:{origin:'http://localhost:5173'},
    navigator:{serviceWorker:{getRegistration:async()=>({active:{scriptURL:'http://localhost:5173/push-sw.js'},pushManager:{getSubscription:async()=>({endpoint:'https://fcm.googleapis.com/fcm/send/local'})}})}}}
  const issuer=createWorkoutControlsIssuer({browser,rpc:async(name,args)=>{calls.push({name,args});return calls.length===1?id:{result:'unchanged',projection:unchanged()}}})
  assert.equal((await issuer(base)).controls_status,'unchanged');assert.equal(calls[1].args.p_expected_revision,'3')
  browser.Notification.permission='default';assert.equal(await issuer(base),null);assert.equal(calls.length,2)
})
test('public config emits only exact Supabase origin, never keys, and rejects unsafe URLs',()=>{
  assert.deepEqual(publicPushConfig('http://127.0.0.1:55451'),{supabaseUrl:'http://127.0.0.1:55451'})
  for(const bad of ['http://remote.invalid','https://user:pass@project.supabase.co','https://project.supabase.co/path','https://project.supabase.co?token=bad'])assert.throws(()=>publicPushConfig(bad))
  let asset;pushPublicConfigPlugin('https://project.supabase.co').generateBundle.call({emitFile:(a)=>asset=a})
  assert.equal(asset.fileName,'push-config.json');assert.deepEqual(JSON.parse(asset.source),{supabaseUrl:'https://project.supabase.co'})
})
test('action click waits for completion without opening app; endpoint comes only from same-origin config',async()=>{
  const calls=[],handlers={},registration={showNotification:async()=>{},getNotifications:async()=>[]}
  const self={registration,location:{origin:'http://localhost:5173'},addEventListener:(type,fn)=>handlers[type]=fn,
    clients:{openWindow:()=>{throw Error('must not open')},matchAll:()=>{throw Error('must not focus')}}}
  const context=vm.createContext({self,URL,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{
    calls.push({url:String(url),options})
    return calls.length===1?{ok:true,json:async()=>({supabaseUrl:'http://127.0.0.1:55451'})}:{ok:true,json:async()=>({result:'stale'})}
  }})
  vm.runInContext(script,context)
  vm.runInContext("workoutProcessor.action=createWorkoutProcessor({registration:self.registration,store:{generationClosed:async()=>false,closeGeneration:async()=>{},decide:async()=>({show:true})}}).action",context)
  // Test actual click routing using an unexpired synthetic card.
  const current={...payload,agora_servidor:new Date().toISOString(),descanso_termina_em:new Date(Date.now()+60000).toISOString(),expires_at:new Date(Date.now()+120000).toISOString()}
  let waited
  handlers.notificationclick({action:'rest_add_15',notification:{data:{projection:current},close(){}},waitUntil:(promise)=>waited=promise})
  assert.ok(waited);await waited
  assert.equal(calls[0].url,'/push-config.json');assert.equal(calls[1].url,'http://127.0.0.1:55451/functions/v1/workout-action')
  assert.deepEqual(JSON.parse(calls[1].options.body),{capability:current.controls[0].capability});assert.equal(calls[1].options.redirect,'error')
})

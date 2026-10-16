import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import { buildWorkoutProjection, buildConfirmedRestSignal, createWorkoutNotificationAdapter } from './workoutProjection.js'
import { createWorkoutNotificationBridge } from './workoutNotificationBridge.js'

const session={id_sessao:'11111111-1111-4111-8111-111111111111',id_treino:'9007199254740993',id_treino_exercicio_atual:'2',serie_atual:2,revisao:'3',status:'ativa',fase:'descanso',pausada_em:null,
  iniciada_em:'2026-10-10T10:00:00Z',descanso_iniciado_em:'2026-10-10T10:01:00Z',descanso_termina_em:'2026-10-10T10:02:00Z',agora_servidor:'2026-10-10T10:02:01Z'}
const items=[{id_treino_exercicio:2,nome:'Supino reto',series:4}]
const finished={...session,fase:'execucao',revisao:'4',descanso_iniciado_em:null,descanso_termina_em:null}
const script=fs.readFileSync(new URL('../../../public/push-sw.js',import.meta.url),'utf8')
function worker(store) {
  const shown=[],cards=[],handlers={},closed=[]
  const registration={showNotification:async(title,options)=>{
    for(const card of cards)if(!card.closed&&card.tag===options.tag)card.close()
    shown.push({title,options});cards.push({tag:options.tag,data:options.data,closed:false,close(){this.closed=true;closed.push(options.tag)}})
  },getNotifications:async(options={})=>cards.filter(card=>!card.closed&&(!options.tag||card.tag===options.tag))}
  const context=vm.createContext({self:{registration,location:{origin:'http://localhost:5173'},addEventListener:(type,fn)=>handlers[type]=fn,clients:{matchAll:async()=>[],openWindow:async()=>{}}},URL,Notification:{maxActions:3,prototype:{renotify:false,vibrate:[]}}})
  vm.runInContext(script,context)
  const processor=vm.runInContext('createWorkoutProcessor',context)({store,registration})
  return {processor,shown,closed,handlers,valid:vm.runInContext('validWorkout',context)}
}
function receipts() {
  const seen=new Set(),closed=new Set();let disabled=false,current
  return {decide:async(value,alert)=>{
    if(disabled||closed.has(value.id_sessao)||current?.id_sessao===value.id_sessao&&BigInt(value.revisao)<BigInt(current.revisao))return {show:false}
    const key=`${value.id_sessao}:${value.id_treino_exercicio}:${value.proxima_serie}`;const fresh=!seen.has(key)
    const closeOthers=Boolean(current&&current.id_sessao!==value.id_sessao);if(closeOthers)closed.add(current.id_sessao)
    if(alert)seen.add(key);current=value;return {show:true,alert:alert&&fresh,closeOthers}
  },close:async(id)=>closed.add(id),disable:async(logout)=>{disabled=true;if(logout&&current)closed.add(current.id_sessao)},enable:async()=>{disabled=false}}
}
test('projection and server-confirmed rest preserve bigint strings, sanitize text and use backend time',()=>{
  const projection=buildWorkoutProjection(session,items),signal=buildConfirmedRestSignal(session,finished,items)
  assert.equal(projection.data.url,'/treinar/9007199254740993');assert.equal(projection.body,'Supino reto · Próxima série 2/4')
  assert.equal(signal.revisao,'4');assert.equal(signal.proxima_serie,'2')
  assert.equal(buildWorkoutProjection({...session,id_treino:9007199254740993},items),null)
  assert.equal(buildConfirmedRestSignal(session,{...finished,agora_servidor:'2026-10-10T10:01:59Z'},items),null)
  assert.equal(buildConfirmedRestSignal(session,{...finished,revisao:'3'},items),null)
  assert.equal(buildConfirmedRestSignal({...session,pausada_em:session.agora_servidor},finished,items),null)
  assert.equal(buildConfirmedRestSignal(session,{...finished,serie_atual:3},items),null)
  assert.equal(buildWorkoutProjection({...session,status:'finalizada'},items),null)
  const safe=buildWorkoutProjection(session,[{...items[0],nome:'\u0000'+'a'.repeat(100),series:1}]);assert.equal(safe.exercicio.length,80);assert.equal(safe.serie_total,null)
})
test('small adapter closes ended/replaced sessions and never propagates notification failures',async()=>{
  const calls=[];const adapter=createWorkoutNotificationAdapter({project:(p)=>{calls.push(p.type);throw Error('notification')},restFinished:()=>Promise.reject(Error('storage')),close:(id)=>calls.push(id)})
  assert.doesNotThrow(()=>adapter.accept(null,session,items));assert.doesNotThrow(()=>adapter.restFinished(session,finished,items))
  adapter.accept(session,null,items);adapter.accept(session,{...session,status:'finalizada'},items)
  assert.deepEqual(calls,['workout_projection',session.id_sessao,session.id_sessao]);await new Promise((r)=>setImmediate(r))
})
test('bridge uses only an existing dedicated worker, no automatic permission/subscription, and blocks late work on logout',async()=>{
  const messages=[];let registered=0
  const browser={isSecureContext:true,location:{origin:'http://localhost:5173'},Notification:{permission:'granted'},localStorage:{getItem:()=>null},navigator:{serviceWorker:{
    getRegistration:async()=>({active:{scriptURL:'http://localhost:5173/push-sw.js',postMessage:(m)=>messages.push(m)}}),register:()=>registered++}}}
  const bridge=createWorkoutNotificationBridge(browser)
  assert.equal(await bridge.project({}),true);await bridge.disable('logout');assert.equal(await bridge.project({}),false);await bridge.enable();assert.equal(await bridge.project({}),true)
  browser.Notification.permission='default';assert.equal(await bridge.project({}),false);assert.equal(registered,0)
  browser.Notification.permission='granted';browser.navigator.serviceWorker.getRegistration=async()=>({active:{scriptURL:'http://localhost:5173/unrelated.js'}})
  assert.equal(await bridge.project({}),false)
  assert.equal(messages[1].reason,'logout')
})
test('workout envelope fails closed for versions, UUID, decimals, extra data, sizes and external routes',()=>{
  const w=worker(receipts()),payload=buildConfirmedRestSignal(session,finished,items)
  assert.equal(w.valid(payload),true);assert.equal(w.valid(buildWorkoutProjection(session,items),true),true)
  for(const value of [{...payload,version:3},{...payload,type:'test'},{...payload,id_sessao:'invalid'},{...payload,id_treino:'01'},{...payload,revisao:4},{...payload,id_treino:'9223372036854775808'},
    {...payload,exercicio:'a'.repeat(81)},{...payload,body:'b'.repeat(161)},{...payload,data:{url:'https://evil.example/'}},{...payload,jwt:'forbidden'},{...payload,pausada:true}])assert.equal(w.valid(value),false)
})
test('one card: local silent update, Push/local dedup, restart, terminal and logout tombstones',async()=>{
  const store=receipts(),w=worker(store),signal=buildConfirmedRestSignal(session,finished,items)
  await w.processor.project(buildWorkoutProjection(session,items));assert.equal(w.shown[0].options.silent,true);assert.equal(w.shown[0].options.vibrate,undefined)
  await Promise.all([w.processor.project(signal,true),w.processor.project(signal,true)])
  assert.equal(w.shown.filter((c)=>c.options.renotify).length,1)
  assert.deepEqual(Array.from(w.shown[1].options.vibrate),[200,100,200]);assert.equal(w.shown[1].options.tag,`gymio-workout-${session.id_sessao}`)
  const restarted=worker(store);await restarted.processor.project(signal,true);assert.equal(restarted.shown[0].options.silent,true)
  await restarted.processor.close(session.id_sessao);await restarted.processor.project(signal,true);assert.equal(restarted.shown.length,1)
  const newer={...signal,id_sessao:'22222222-2222-4222-8222-222222222222',iniciada_em:'2026-10-10T10:02:00Z'}
  await w.processor.project(newer,true);assert.ok(w.closed.length);await w.processor.disable(true);await w.processor.enable();await w.processor.project(newer,true)
  assert.equal(w.shown.length,4)
})
test('older projections are ignored; failed receipt persistence cannot cause another alert',async()=>{
  const store=receipts(),w=worker(store),signal=buildConfirmedRestSignal(session,finished,items)
  await w.processor.project(signal,true);await w.processor.project({...signal,revisao:'2'},true);assert.equal(w.shown.length,1)
  store.decide=async()=>{throw Error('IDB unavailable')};await w.processor.project({...signal,revisao:'5'},true)
  assert.equal(w.shown[1].options.silent,true);assert.equal(w.shown[1].options.vibrate,undefined)
  const cold=worker(store);await cold.processor.project(signal,true);assert.equal(cold.shown.length,0)
})

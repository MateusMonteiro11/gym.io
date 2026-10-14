// Test-only fake IndexedDB 6.2.5; run with the workspace mounted read-only.
import {IDBFactory} from 'npm:fake-indexeddb@6.2.5'
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const script=fs.readFileSync('/workspace/public/push-sw.js','utf8')
const now=Date.parse('2026-10-10T10:02:01Z')
const payload={version:3,type:'workout_control',title:'Gym.io · Descanso',body:'Supino · Série 2/4',id_sessao:'11111111-1111-4111-8111-111111111111',
 revisao:'1',id_treino:'1',id_treino_exercicio:'2',proxima_serie:'2',serie_total:'4',iniciada_em:'2026-10-10T10:00:00Z',descanso_iniciado_em:'2026-10-10T10:01:00Z',
 descanso_termina_em:'2026-10-10T10:02:00Z',agora_servidor:'2026-10-10T10:01:00Z',exercicio:'Supino',fase:'descanso',pausada:false,data:{url:'/treinar/1'},
 generation_id:'22222222-2222-4222-8222-222222222222',expires_at:'2026-10-10T10:16:00Z',eligible_state:'rest_active',controls_status:'emitted',
 controls:['rest_add_15','rest_skip','rest_pause'].map((action,i)=>({action,capability:String(i+1).repeat(42)+'A'}))}
const unchanged=(value=payload)=>({...value,controls_status:'unchanged',controls:[]})
const finished={...payload,title:'Gym.io · Descanso concluído',agora_servidor:'2026-10-10T10:02:01Z',eligible_state:'rest_finished',
 controls:[{action:'rest_continue',capability:'4'.repeat(42)+'A'}]}
const next={...payload,revisao:'2',generation_id:'33333333-3333-4333-8333-333333333333',agora_servidor:'2026-10-10T10:01:01Z',
 controls:payload.controls.map((control,i)=>({...control,capability:String(i+5).repeat(42)+'A'}))}

function scenario({maxActions=2,failInitially=false,result='stale'}={}) {
 const factory=new IDBFactory(),cards=[],shown=[],calls=[],databases=new Set()
 const failure={enabled:failInitially},cacheOperations=[]
 // Use the actual fake-IDB database, injecting failure at its transaction API.
 // This covers a working database becoming unavailable, rather than a fake store.
 const guardedFactory={open(...args){
  const request=factory.open(...args)
  request.addEventListener('success',()=>{
   const database=request.result,transaction=database.transaction.bind(database)
   database.transaction=(...transactionArgs)=>{
    if(failure.enabled)throw new Error('test_storage_unavailable')
    return transaction(...transactionArgs)
   }
   databases.add(database)
  })
  return request
 }}
 const registration={getNotifications:async(options={})=>cards.filter((card)=>!card.closed&&(!options.tag||card.tag===options.tag)),
  showNotification:async(title,options)=>{
   for(const card of cards)if(card.tag===options.tag)card.closed=true
   const card={tag:options.tag,data:options.data,closed:false,close(){this.closed=true}}
   cards.push(card);shown.push({title,...options})
  }}
 function restart({sendResult=result}={}) {
  const events=new Map()
  const context=vm.createContext({URL,Notification:{maxActions},
   caches:{open:async()=>{cacheOperations.push('open');throw new Error('unexpected_token_cache')}},
   self:{registration,indexedDB:guardedFactory,addEventListener:(name,handler)=>events.set(name,handler)}})
  vm.runInContext(script,context)
  const store=vm.runInContext('createWorkoutStore',context)(guardedFactory)
  const processor=vm.runInContext('createWorkoutProcessor',context)({store,registration,now:()=>now,
   sendAction:async(token)=>{calls.push(token);return {result:sendResult}}})
  assert.ok(vm.runInContext('validControls',context)(payload),'synthetic active controls must satisfy the real validator')
  return {store,processor,events,context}
 }
 async function inspectStorage() {
  const request=factory.open('gymio-workout-notification-receipts',1)
  const database=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('test_idb_read_failed'))})
  assert.equal(Array.from(database.objectStoreNames).join(','),'markers','the receipt database must not gain a token store')
  const markerStore=database.transaction('markers').objectStore('markers'),read=markerStore.getAll(),readKeys=markerStore.getAllKeys()
  const readResult=(request)=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('test_idb_read_failed'))})
  const [values,keys]=await Promise.all([readResult(read),readResult(readKeys)])
  const stored=JSON.stringify({keys,values})
  assert.ok(!/(capability|authorization|access_token|refresh_token|service_role|jwt)/i.test(stored),'IndexedDB must contain no credentials or capability fields')
  for(const control of [...payload.controls,...next.controls,...finished.controls])assert.ok(!stored.includes(control.capability),'IndexedDB must contain no control bearer')
  assert.equal(cacheOperations.length,0,'the worker must not reconstruct or persist controls through Cache Storage')
  database.close()
 }
 function close(){for(const database of databases)database.close()}
 return {restart,registration,cards,shown,calls,failure,inspectStorage,close}
}

// Existing restart, exact-card reuse, absent-card fallback and logout coverage.
{
 const s=scenario(),first=s.restart();await first.processor.project(payload)
 const second=s.restart();await second.processor.project(unchanged())
 assert.equal(s.shown.at(-1).actions.length,2)
 assert.ok(s.cards.at(-1).data.projection.controls.every((control,i)=>control.capability===payload.controls[i].capability),'restart reuse must use only the matching browser card')
 s.cards.forEach((card)=>card.close());const third=s.restart();await third.processor.project(unchanged())
 assert.equal(s.shown.at(-1).actions,undefined)
 assert.equal(s.cards.at(-1).data.projection,undefined,'an absent card must yield a control-free projection')
 await third.processor.project(payload);const old=s.cards.at(-1)
 await third.processor.disable(true);const fourth=s.restart();await fourth.processor.action(old,'rest_skip')
 await fourth.processor.project(payload)
 assert.equal(s.calls.length,0)
 assert.equal(s.cards.filter((card)=>!card.closed).length,0,'persisted logout must prevent delayed reappearance after restart')
 await s.inspectStorage();s.close()
 console.log('PASS C actual IndexedDB: restart exact-card reuse; absent-card fallback; persisted logout; no bearer persistence')
}

// Both workers use independent VM/processors and independent DB connections.
// Their atomic readwrite reservations share one real IDBFactory/database.
{
 const s=scenario(),first=s.restart(),second=s.restart()
 await Promise.all([first.processor.project(finished,true),second.processor.project(finished,true)])
 assert.equal(s.shown.length,2)
 assert.equal(s.shown.filter((notification)=>notification.renotify).length,1,'concurrent processors must reserve only one alert')
 assert.equal(s.shown.filter((notification)=>notification.vibrate).length,1,'concurrent processors must never vibrate twice for the same rest')
 assert.equal(s.cards.filter((card)=>!card.closed).length,1,'one session tag must leave only one live card')
 const third=s.restart();await third.processor.project(finished,true)
 assert.equal(s.shown.at(-1).silent,true)
 assert.equal(s.shown.filter((notification)=>notification.vibrate).length,1,'a restart must preserve the alert receipt')
 await s.inspectStorage();s.close()
 console.log('PASS C actual IndexedDB: two concurrent processors; one durable alert; no duplicate vibration after restart')
}

// Terminal markers close one generation, without closing its entire session.
for(const result of ['stale','expired','already_used']) {
 const s=scenario({result}),first=s.restart();await first.processor.project(payload)
 const original=s.cards.at(-1);await first.processor.action(original,'rest_skip')
 assert.equal(s.calls.length,1);assert.equal(original.closed,true)
 const count=s.shown.length,second=s.restart()
 await second.processor.project(payload)
 await second.processor.project(unchanged())
 await second.processor.action(original,'rest_skip')
 assert.equal(s.shown.length,count,'a terminal generation must not reappear after worker restart')
 assert.equal(s.calls.length,1,'a terminal generation must not resend its bearer after restart')
 await second.processor.project(next)
 assert.equal(s.shown.length,count+1,'a fresh generation in the same session must remain displayable')
 assert.equal(s.cards.at(-1).data.projection.generation_id,next.generation_id)
 await s.inspectStorage();s.close()
 console.log('PASS C actual IndexedDB: '+result+' generation remains terminal after restart; new generation remains eligible')
}

for(const maxActions of [1,2,3,5]) {
 const s=scenario({maxActions}),first=s.restart();await first.processor.project(payload)
 assert.equal(s.shown.at(-1).actions.length,Math.min(maxActions,3))
 assert.equal(s.shown.at(-1).actions.map((control)=>control.action).join(','),payload.controls.slice(0,maxActions).map((control)=>control.action).join(','))
 const paused={...next,title:'Gym.io · Pausado',pausada:true,eligible_state:'rest_paused',
  controls:[{action:'rest_resume',capability:'8'.repeat(42)+'A'},{action:'rest_skip',capability:'9'.repeat(42)+'A'}]}
 await first.processor.project(paused)
 assert.equal(s.shown.at(-1).actions.map((control)=>control.action).join(','),paused.controls.slice(0,maxActions).map((control)=>control.action).join(','))
 const due={...finished,revisao:'3',generation_id:'44444444-4444-4444-8444-444444444444'}
 await first.processor.project(due)
 assert.equal(s.shown.at(-1).actions.map((control)=>control.action).join(','),'rest_continue')
 await s.inspectStorage();s.close()
 console.log('PASS C actual IndexedDB: Notification.maxActions='+maxActions+'; active/paused/finished priorities')
}

// A real transaction failure permits only a known silent projection. A fresh
// worker has no known projection and therefore cannot reconstruct any controls.
{
 const unknown=scenario({failInitially:true}),worker=unknown.restart()
 await worker.processor.project(finished,true)
 assert.equal(unknown.shown.length,0,'storage failure before a known projection must not create a card')
 assert.equal(unknown.calls.length,0)
 await unknown.inspectStorage();unknown.close()
 const s=scenario(),first=s.restart();await first.processor.project(finished,true)
 const original=s.cards.at(-1),vibrations=s.shown.filter((notification)=>notification.vibrate).length
 s.failure.enabled=true
 await first.processor.project({...next,revisao:'2'},true)
 assert.equal(s.shown.at(-1).silent,true);assert.equal(s.shown.at(-1).renotify,false)
 assert.equal(s.shown.at(-1).actions,undefined);assert.equal(s.shown.at(-1).vibrate,undefined)
 assert.equal(s.cards.at(-1).data.projection,undefined,'storage failure must strip all control data')
 await first.processor.action(original,'rest_continue')
 assert.equal(s.calls.length,0,'storage failure must block capability transport')
 const second=s.restart(),before=s.shown.length
 await Promise.all([first.processor.project({...next,revisao:'3'},true),second.processor.project(next,true)])
 assert.equal(s.shown.length,before+1,'only the processor with a known projection may update silently')
 assert.equal(s.shown.filter((notification)=>notification.vibrate).length,vibrations)
 assert.equal(s.shown.at(-1).actions,undefined)
 assert.equal(s.calls.length,0)
 await s.inspectStorage();s.close()
 console.log('PASS C actual IndexedDB failure: only known silent projection; no controls, transport, reconstruction or duplicate vibration')
}

// Exercise existing push entry points rather than only direct processor calls.
{
 const s=scenario(),worker=s.restart()
 async function push(value) {
  const waits=[];worker.events.get('push')({data:{json:()=>value},waitUntil:(promise)=>waits.push(promise)})
  await Promise.all(waits)
 }
 await push({version:1,type:'test',title:'Gym.io',body:'Notificações de treino ativadas.',data:{url:'/dashboard'}})
 assert.equal(s.shown.at(-1).tag,'gymio-push-test')
 const v2={...finished,version:2,type:'workout_rest_finished'}
 for(const key of ['generation_id','expires_at','eligible_state','controls_status','controls'])delete v2[key]
 await push(v2)
 assert.equal(s.shown.at(-1).tag,'gymio-workout-'+payload.id_sessao)
 assert.equal(s.shown.at(-1).actions,undefined)
 assert.equal(s.shown.at(-1).renotify,true)
 const previous=s.shown.length
 await push({...finished,jwt:'test-only-do-not-persist'})
 assert.equal(s.shown.length,previous,'invalid credential-bearing envelopes must be rejected at the push entry point')
 await s.inspectStorage();s.close()
 console.log('PASS C actual IndexedDB: existing V1/V2 push compatibility; invalid credential-bearing envelope rejected')
}

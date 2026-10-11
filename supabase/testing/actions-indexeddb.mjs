// Prepared only; run later with the same test-only fake IndexedDB used by B.
import {IDBFactory} from 'npm:fake-indexeddb@6.2.5'
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const factory=new IDBFactory(),cards=[],shown=[],calls=[]
const script=fs.readFileSync('/workspace/public/push-sw.js','utf8'),now=Date.parse('2026-10-10T10:01:00Z')
const payload={version:3,type:'workout_control',title:'Gym.io · Descanso',body:'Supino · Série 2/4',id_sessao:'11111111-1111-4111-8111-111111111111',
 revisao:'1',id_treino:'1',id_treino_exercicio:'2',proxima_serie:'2',serie_total:'4',iniciada_em:'2026-10-10T10:00:00Z',descanso_iniciado_em:'2026-10-10T10:01:00Z',
 descanso_termina_em:'2026-10-10T10:02:00Z',agora_servidor:'2026-10-10T10:01:00Z',exercicio:'Supino',fase:'descanso',pausada:false,data:{url:'/treinar/1'},
 generation_id:'22222222-2222-4222-8222-222222222222',expires_at:'2026-10-10T10:16:00Z',eligible_state:'rest_active',controls_status:'emitted',
 controls:['rest_add_15','rest_skip','rest_pause'].map((action,i)=>({action,capability:String(i+1).repeat(42)+'A'}))}
function restart(){
 const registration={getNotifications:async()=>cards.filter((c)=>!c.closed),showNotification:async(_title,options)=>{
  for(const card of cards)if(card.tag===options.tag)card.closed=true
  cards.push({tag:options.tag,data:options.data,closed:false,close(){this.closed=true}});shown.push(options)
 }}
 const context=vm.createContext({URL,self:{registration,indexedDB:factory,addEventListener:()=>{}}});vm.runInContext(script,context)
 const store=vm.runInContext('createWorkoutStore',context)(factory)
 const processor=vm.runInContext('createWorkoutProcessor',context)({store,registration,now:()=>now,sendAction:async(token)=>{calls.push(token);return {result:'stale'}}})
 return {store,processor}
}
const first=restart();await first.processor.project(payload)
const second=restart();await second.processor.project({...payload,controls_status:'unchanged',controls:[]})
assert.equal(shown.at(-1).actions.length,2)
cards.forEach((card)=>card.close());const third=restart();await third.processor.project({...payload,controls_status:'unchanged',controls:[]})
assert.equal(shown.at(-1).actions,undefined)
await third.processor.project(payload);const old=cards.at(-1)
await third.processor.disable(true);const fourth=restart();await fourth.processor.action(old,'rest_skip');assert.equal(calls.length,0)
const request=factory.open('gymio-workout-notification-receipts',1)
const database=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=reject})
const read=database.transaction('markers').objectStore('markers').getAll()
const values=await new Promise((resolve,reject)=>{read.onsuccess=()=>resolve(read.result);read.onerror=reject})
const stored=JSON.stringify(values);assert.ok(!stored.includes('capability'));for(const c of payload.controls)assert.ok(!stored.includes(c.capability))
database.close()
console.log('PASS C actual IndexedDB: restart reuse only from current card; no reconstruction; persistent logout containment; no token persistence')

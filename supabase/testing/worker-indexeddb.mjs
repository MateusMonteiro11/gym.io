// Test-only IndexedDB API implementation, never bundled with the PWA.
import { IDBFactory } from 'npm:fake-indexeddb@6.2.5'
import vm from 'node:vm'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const script=fs.readFileSync('/workspace/public/push-sw.js','utf8'),factory=new IDBFactory(),shown=[]
const payload={version:2,type:'workout_rest_finished',title:'Gym.io · Descanso concluído',body:'Supino · Série 2/4',id_sessao:'11111111-1111-4111-8111-111111111111',revisao:'1',id_treino:'1',id_treino_exercicio:'2',proxima_serie:'2',serie_total:'4',iniciada_em:'2026-10-10T10:00:00Z',descanso_iniciado_em:'2026-10-10T10:01:00Z',descanso_termina_em:'2026-10-10T10:02:00Z',agora_servidor:'2026-10-10T10:02:01Z',exercicio:'Supino',fase:'descanso',pausada:false,data:{url:'/treinar/1'}}
function restart() {
  const self={indexedDB:factory,registration:{showNotification:async(_title,options)=>shown.push(options),getNotifications:async()=>[]},addEventListener:()=>{}}
  const context=vm.createContext({self,URL});vm.runInContext(script,context)
  return {store:vm.runInContext('createWorkoutStore',context)(factory),processor:vm.runInContext('workoutProcessor',context)}
}
const first=restart(),second=restart()
await Promise.all([first.processor.project(payload,true),second.processor.project(payload,true)])
assert.equal(shown.length,2);assert.equal(shown.filter((o)=>o.renotify).length,1)
const third=restart();await third.processor.project(payload,true);assert.equal(shown.at(-1).silent,true)
await third.processor.close(payload.id_sessao);const fourth=restart();await fourth.processor.project(payload,true);assert.equal(shown.length,3)
const newer={...payload,id_sessao:'22222222-2222-4222-8222-222222222222',iniciada_em:'2026-10-10T10:02:00Z'}
await fourth.processor.project(newer,true);await fourth.processor.disable(true);const fifth=restart();await fifth.processor.project(newer,true);assert.equal(shown.length,4)
await fifth.processor.enable();await fifth.processor.project(newer,true);assert.equal(shown.length,4)
const newest={...newer,id_sessao:'33333333-3333-4333-8333-333333333333',iniciada_em:'2026-10-10T10:02:01Z',revisao:'4'}
await fifth.processor.project(newest,true);await fifth.processor.project({...newest,revisao:'3'},true);await fifth.processor.project(payload,true);assert.equal(shown.length,5)
console.log('PASS actual IndexedDB transactions: atomic receipt across workers; persisted restart, logout and terminal tombstones; stale ordering. Test-only fake-indexeddb 6.2.5; no production dependency.')

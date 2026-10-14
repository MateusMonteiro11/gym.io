// Explicit complete B SQL diagnostic, using the unchanged historical runtime
// module. No SQL clocks or additional database calls inside its assertions.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {actionsContext} from './actions-context.mjs'

assert.ok(process.argv.includes('--run-original-b-sql-diagnostic'),'explicit full historical diagnostic flag required')
const c=actionsContext(process.argv[2]),root=c.context.root
const source=fs.readFileSync('supabase/testing/workout-local-tests.mjs')
const runtimeModule=path.join(root,'tests','workout-local-tests.mjs')
assert.ok(source.equals(fs.readFileSync(runtimeModule)),'historical B SQL body must remain byte-identical')
const identityBaseline=()=>c.value(`select jsonb_build_object(
 'auth',(select jsonb_agg(jsonb_build_object('id',id,'email',email)order by id)from auth.users),
 'profiles',(select jsonb_agg(jsonb_build_object('id',id_usuario,'email',email)order by id_usuario)from public.usuarios));`)
const counts=()=>c.value(`select jsonb_build_object('authUsers',(select count(*)from auth.users),'profiles',(select count(*)from public.usuarios),
 'sessions',(select count(*)from public.treino_sessoes),'subscriptions',(select count(*)from public.push_subscriptions),
 'events',(select count(*)from gymio_workout_push_private.outbox),'deliveries',(select count(*)from gymio_workout_push_private.deliveries),
 'generations',(select count(*)from gymio_workout_actions_private.generations),'capabilities',(select count(*)from gymio_workout_actions_private.capabilities),
 'activeJobs',(select count(*)from cron.job where active));`)
const identitiesBefore=identityBaseline(),beforeCounts=counts()
assert.equal(identitiesBefore.auth.length,2);assert.equal(identitiesBefore.profiles.length,2)
assert.ok(Object.entries(beforeCounts).every(([name,count])=>['authUsers','profiles'].includes(name)?count===2:count===0),'empty inactive diagnostic baseline required')
const evidence={passed:false,startedAt:new Date().toISOString(),startedMs:Date.now(),passLabels:[],waitMarkers:[],failure:null,
 beforeCounts,historicalSourceSha256:createHash('sha256').update(source).digest('hex'),historicalBodyUnchanged:true,
 extraSqlPerAssertion:false,productionModified:false,leaseTimestampsRewritten:false,externalPushRequests:0}
const sanitizedError=(error)=>{
 const match=String(error?.stack??'').match(/workout-local-tests\.mjs:(\d+):(\d+)/)
 const scalar=(value)=>typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean'||value===null?value:undefined
 return {name:['AssertionError','TypeError','Error'].includes(error?.name)?error.name:'other',
  code:error?.code==='ERR_ASSERTION'?'ERR_ASSERTION':'other',historicalLine:match?Number(match[1]):null,column:match?Number(match[2]):null,
  actualType:Array.isArray(error?.actual)?'array':error?.actual===null?'null':typeof error?.actual,
  expectedType:Array.isArray(error?.expected)?'array':error?.expected===null?'null':typeof error?.expected,
  ...(scalar(error?.actual)!==undefined?{actual:scalar(error.actual)}:{}),
  ...(scalar(error?.expected)!==undefined?{expected:scalar(error.expected)}:{}),
  ...(Array.isArray(error?.actual)?{actualLength:error.actual.length}:{}),
  ...(Array.isArray(error?.expected)?{expectedLength:error.expected.length}:{}),
  sqlErrorDetected:typeof error?.stderr==='string'&&/ERROR:|SQLSTATE/.test(error.stderr)}
}
const methods=Object.fromEntries(['ok','equal','notEqual','deepEqual','throws'].map((name)=>[name,assert[name]]))
let assertionsSinceLastPass=0
for(const [name,method]of Object.entries(methods))assert[name]=(...args)=>{
 const position=++assertionsSinceLastPass
 try{return method(...args)}catch(error){evidence.failure??={...sanitizedError(error),assertionKind:name,assertionPositionSinceLastPass:position,lastPassedGroup:evidence.passLabels.at(-1)??null};throw error}
}
const write=process.stdout.write.bind(process.stdout)
process.stdout.write=(chunk,...args)=>{
 const text=String(chunk)
 for(const line of text.split(/\r?\n/)){
  if(line.startsWith('PASS SQL B: ')){evidence.passLabels.push(line);assertionsSinceLastPass=0}
  if(line==='Waiting for the actual PostgreSQL 60-second lease; no timestamp rewriting.')
   evidence.waitMarkers.push({at:new Date().toISOString(),elapsedMs:Date.now()-evidence.startedMs})
 }
 return write(chunk,...args)
}
try{
 // Natural process.argv[2] remains the verified C context; the imported module
 // executes its original setup, every test and its own unchanged finally.
 await import(pathToFileURL(runtimeModule).href)
 evidence.passed=true
}catch(error){evidence.failure??=sanitizedError(error);process.exitCode=1}
finally{
 for(const [name,method]of Object.entries(methods))assert[name]=method
 process.stdout.write=write
 evidence.elapsedMs=Date.now()-evidence.startedMs;delete evidence.startedMs
 evidence.finishedAt=new Date().toISOString()
 evidence.exact_A_B_auth_profiles_restored=JSON.stringify(identitiesBefore)===JSON.stringify(identityBaseline())
 evidence.finalCounts=counts()
 evidence.fixtureCleanupCompleted=Object.entries(evidence.finalCounts).every(([name,count])=>['authUsers','profiles'].includes(name)?count===2:count===0)
 fs.writeFileSync(path.join(root,'actions-b-sql-diagnostic.json'),JSON.stringify(evidence,null,2))
 assert.equal(evidence.exact_A_B_auth_profiles_restored,true,'historical diagnostic changed Auth/profile baseline; no automatic repair')
 assert.equal(evidence.fixtureCleanupCompleted,true,'historical diagnostic left fixture data; no automatic repair')
 console.log(JSON.stringify(evidence))
}

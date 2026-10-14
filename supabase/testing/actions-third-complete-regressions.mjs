// Explicit continuation after a body-identical complete B SQL diagnostic.
// Preserve the original failed aggregate and its unresolved cause. This writes
// separate execution evidence, never a matrix verdict or stage-manifest repair.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {performance} from 'node:perf_hooks'
import {actionsContext} from './actions-context.mjs'

const contextFile=process.argv[2]
assert.ok(process.argv.includes('--continue-after-complete-b-sql-diagnostic'),'explicit continuation flag required')
assert.ok(process.argv.includes('--allow-local-auxiliary-cleanup'),'human-authorized local auxiliary cleanup exception must remain explicit')
const c=actionsContext(contextFile),root=c.context.root,tests=path.join(root,'tests')
const read=(name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''))
const original=read('actions-regressions-result.json'),diagnostic=read('actions-b-sql-diagnostic.json')
const aStages=['A ready','A spike','A sql','A data-api','A edge']
assert.equal(original.passed,false);assert.equal(original.results.length,6)
assert.deepEqual(original.results.slice(0,5).map((row)=>row.stage),aStages)
assert.ok(original.results.slice(0,5).every((row)=>row.passed&&row.exit_code===0&&row.exact_A_B_auth_profiles_restored))
const failed=original.results[5]
assert.equal(failed.stage,'B SQL');assert.equal(failed.passed,false);assert.equal(failed.exit_code,1)
assert.equal(failed.assertion_failure,true);assert.equal(failed.exact_A_B_auth_profiles_restored,true)
const sourceHash=(name)=>createHash('sha256').update(fs.readFileSync(path.join('supabase','testing',name))).digest('hex')
assert.equal(diagnostic.passed,true);assert.equal(diagnostic.fixtureCleanupCompleted,true)
assert.equal(diagnostic.exact_A_B_auth_profiles_restored,true)
assert.equal(diagnostic.historicalBodyUnchanged,true);assert.equal(diagnostic.extraSqlPerAssertion,false)
assert.equal(diagnostic.historicalSourceSha256,sourceHash('workout-local-tests.mjs'))
assert.equal(diagnostic.passLabels.at(-1),'PASS SQL B: idle tick and repeated capture produce zero Session/countdown writes')
for(const name of ['workout-data-api.mjs','workout-edge-tests.mjs','workout-performance.mjs','workout-dispatch.mjs'])
 assert.ok(fs.readFileSync(path.join('supabase','testing',name)).equals(fs.readFileSync(path.join(tests,name))),`STOP changed historical body ${name}`)
const schedulerSource=fs.readFileSync('supabase/testing/scheduler-spike.mjs','utf8'),schedulerAdapter=fs.readFileSync(path.join(tests,'scheduler-spike.mjs'),'utf8')
assert.equal(schedulerAdapter.slice(schedulerAdapter.indexOf('const sql =')),schedulerSource.slice(schedulerSource.indexOf('const sql =')))
const identities=()=>c.value(`select jsonb_build_object('auth',(select jsonb_agg(jsonb_build_object('id',id,'email',email)order by id)from auth.users),
 'profiles',(select jsonb_agg(jsonb_build_object('id',id_usuario,'email',email)order by id_usuario)from public.usuarios));`)
const baseline=identities();assert.equal(baseline.auth.length,2);assert.equal(baseline.profiles.length,2)
const verify=()=>{
 actionsContext(contextFile)
 assert.ok(JSON.stringify(identities())===JSON.stringify(baseline),'STOP exact Auth/profile baseline changed; no repair')
 for(const table of ['public.treino_sessoes','public.push_subscriptions','gymio_workout_push_private.outbox','gymio_workout_push_private.deliveries',
  'gymio_workout_actions_private.generations','gymio_workout_actions_private.capabilities'])
  assert.equal(c.sql(`select count(*)from ${table};`),'0','STOP isolated fixture cleanup incomplete; no repair')
 assert.equal(c.sql('select count(*)from cron.job where active;'),'0','STOP active scheduler before/after stage')
}
verify()
const resultFile=path.join(root,'actions-regressions-third-complete-result.json')
assert.ok(!fs.existsSync(resultFile),'do not overwrite earlier continuation evidence')
const results=[...original.results.slice(0,5),{stage:'B SQL',passed:true,exit_code:0,elapsed_ms:diagnostic.elapsedMs,
 pass_labels:[...diagnostic.passLabels],exact_A_B_auth_profiles_restored:true,evidence:'actions-b-sql-diagnostic.json',
 diagnosticRepeat:true,originalFailureResolved:false}]
const evidence={passed:false,matrixApproved:false,originalFailureResolved:false,
 originalAttempt:{file:'actions-regressions-result.json',stage:'B SQL',passed:false,elapsed_ms:failed.elapsed_ms,
  assertion_failure:true,exact_A_B_auth_profiles_restored:true,cause:'unresolved original assertion; raw stderr was not retained'},
 sourceHashes:Object.fromEntries(['workout-local-tests.mjs','workout-data-api.mjs','workout-edge-tests.mjs','workout-performance.mjs','workout-dispatch.mjs','scheduler-spike.mjs'].map((name)=>[name,sourceHash(name)])),
 results,externalPushRequests:0,authUsersBaseline:2,profilesBaseline:2,
 scope:'remaining historical stages only; original reports/manifest preserved; human-authorized local auxiliary cleanup'}
const persist=()=>fs.writeFileSync(resultFile,JSON.stringify(evidence,null,2))
const errorMetadata=(text)=>{
 const location=text.match(/(?:workout-(?:data-api|edge-tests|performance|dispatch)|scheduler-spike)\.mjs:(\d+):(\d+)/)
 const scalar=(name)=>{const match=text.match(new RegExp('^\\s*'+name+':\\s*(-?[0-9]+(?:\\.[0-9]+)?|true|false|null),?\\s*$','m'));return match?JSON.parse(match[1]):undefined}
 const actual=scalar('actual'),expected=scalar('expected')
 return {assertion_failure:text.includes('AssertionError'),sql_failure:/ERROR:|SQLSTATE/.test(text),
  line:location?Number(location[1]):null,column:location?Number(location[2]):null,
  ...(actual!==undefined?{actual}:{}),...(expected!==undefined?{expected}:{})}
}
const execute=(file,args)=>new Promise((resolve)=>{
 const child=spawn(process.execPath,[file,...args],{cwd:process.cwd(),env:{...process.env},windowsHide:true,stdio:['ignore','pipe','pipe']})
 let output='',errors=''
 child.stdout.on('data',(part)=>{output+=part;if(output.length>16*1024*1024)child.kill()})
 child.stderr.on('data',(part)=>{errors+=part;if(errors.length>16*1024*1024)child.kill()})
 child.on('error',()=>resolve({exit_code:1,pass_labels:[],failure:{name:'process_failed'}}))
 child.on('close',(code)=>resolve({exit_code:code??1,
  pass_labels:output.split(/\r?\n/).filter((line)=>/^PASS [A-Za-z0-9 :,+_.()/→-]+$/.test(line)),failure:code===0?null:errorMetadata(errors)}))
})
const stage=async(stage,file,args)=>{
 verify();const started=performance.now(),execution=await execute(file,args)
 let restored=true;try{verify()}catch{restored=false}
 const row={stage,passed:execution.exit_code===0&&restored,elapsed_ms:Number((performance.now()-started).toFixed(3)),
  ...execution,exact_A_B_auth_profiles_restored:restored}
 results.push(row);persist()
 console.log(`${row.passed?'PASS':'FAIL'} explicit third regression continuation: ${stage}; ${row.elapsed_ms} ms`)
 assert.ok(row.passed,`STOP new failure in ${stage}; no automatic correction or continuation`)
}
persist()
try{
 for(const [name,file]of [['B Data API','workout-data-api.mjs'],['B Edge','workout-edge-tests.mjs'],
  ['B performance','workout-performance.mjs'],['B scheduler','scheduler-spike.mjs']])
  await stage(name,path.join(tests,file),[contextFile])
 await stage('install sender test transport',path.resolve('supabase/testing/actions-reexecution-setup.mjs'),['install-sender-harness',contextFile])
 assert.ok(fs.readFileSync(path.join(root,'supabase/functions/workout-push/index.ts')).equals(fs.readFileSync('supabase/testing/workout-sender-harness/index.ts')),
  'STOP dispatch requires byte-identical local-only fake sender harness')
 await stage('B dispatch',path.join(tests,'workout-dispatch.mjs'),[contextFile])
 verify();assert.equal(results.length,12)
 evidence.passed=results.every((row)=>row.passed);evidence.fixtureCleanupCompleted=true
 persist();console.log('PASS complete repeated historical regression evidence; original failed attempt remains unresolved and preserved; no matrix verdict issued')
}catch(error){persist();throw Error(error instanceof Error?error.message:'historical_continuation_failed')}

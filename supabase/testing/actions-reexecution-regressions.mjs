// C-only orchestration. Historical A/B test bodies and assertions stay intact;
// only disposable entry/context guards are adapted to the stronger C boundary.
// Run after C installation. No stack start, production call or Vite process.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {actionsContext} from './actions-context.mjs'
import {createCredentialRedactor,observeChildProcess} from './actions-regression-observer.mjs'

const contextFile=process.argv[2]
assert.ok(contextFile,'C context file is required')
assert.ok(process.argv.includes('--allow-local-auxiliary-cleanup'),
 'The human-authorized historical local auxiliary-user cleanup exception must be explicit')
const c=actionsContext(contextFile),{context,sql,value,users}=c
assert.equal(sql("select to_regnamespace('gymio_workout_actions_private') is not null;"),'t','install C before regressions')
const workspace=process.cwd(),tests=path.join(context.root,'tests'),resultFile=path.join(context.root,'actions-regressions-result.json')
assert.ok(fs.existsSync(tests),'prepare owned C test adapters first')
assert.ok(!fs.existsSync(resultFile),'STOP original continuous gate already has evidence; preserve it and use a fresh owned runtime')
const digest=(bytes)=>createHash('sha256').update(bytes).digest('hex')
const source=(name)=>fs.readFileSync(path.join(workspace,'supabase','testing',name))
const adapter=(name)=>fs.readFileSync(path.join(tests,name))
const checkedBody=(name,marker=null)=>{
 const original=source(name),adapted=adapter(name)
 if(marker){
  const originalIndex=original.indexOf(Buffer.from(marker)),adaptedIndex=adapted.indexOf(Buffer.from(marker))
  assert.ok(originalIndex>=0&&adaptedIndex>=0,`historical body marker ${name}`)
  assert.ok(original.subarray(originalIndex).equals(adapted.subarray(adaptedIndex)),`STOP historical body changed: ${name}`)
  return {source_sha256:digest(original),body_sha256:digest(original.subarray(originalIndex)),adapter_sha256:digest(adapted),guard_only:true}
 }
 assert.ok(original.equals(adapted),`STOP historical source changed: ${name}`)
 return {source_sha256:digest(original),body_sha256:digest(original),guard_only:false}
}
const sources={
 'local-tests.mjs':checkedBody('local-tests.mjs','const runtime ='),
 'scheduler-spike.mjs':checkedBody('scheduler-spike.mjs','const sql ='),
 ...Object.fromEntries(['workout-local-tests.mjs','workout-data-api.mjs','workout-edge-tests.mjs','workout-performance.mjs','workout-dispatch.mjs']
  .map((name)=>[name,checkedBody(name)])),
}
const facade=fs.readFileSync(path.join(tests,'workout-context.mjs'),'utf8')
assert.ok(facade.includes('actionsContext')&&facade.includes('workoutContext'),'C context facade is required')

// Prove the actual historical Edge test bodies as well as the MJS runners.
// B has exactly the already-approved repository context import adapter; all
// remaining bytes, including assertions, must match its historical source.
const edgeSources={}
for(const [entry,original]of [['push-compat-spike','compat-spike'],['push-integration','edge-integration'],['workout-integration','workout-edge-integration']]){
 const before=source(`${original}/index.ts`),after=fs.readFileSync(path.join(context.root,'supabase','functions',entry,'index.ts'))
 if(entry==='workout-integration'){
  const from="from '../_shared/workoutPushRepository.js'",to="from '../_shared/actions-b-regression-repository.js'"
  const beforeText=before.toString('utf8'),afterText=after.toString('utf8')
  assert.equal(beforeText.split(from).length-1,1,'STOP historical B repository import must be unique')
  assert.equal(afterText.split(to).length-1,1,'STOP B context import adapter must be unique')
  assert.ok(Buffer.from(afterText.replace(to,from),'utf8').equals(before),'STOP historical B Edge test/assertion body changed')
  edgeSources[entry]={source_sha256:digest(before),adapter_sha256:digest(after),exactly_one_repository_context_import:true,
   import_from:from,import_to:to,all_other_bytes_identical:true}
 }else{
  assert.ok(before.equals(after),`STOP historical A Edge test/assertion body changed: ${entry}`)
  edgeSources[entry]={source_sha256:digest(before),adapter_sha256:digest(after),byte_identical:true}
 }
}
const portAdapter=fs.readFileSync(path.join(context.root,'supabase','functions','_shared','actions-b-regression-repository.js'))
assert.ok(portAdapter.equals(source('actions-b-regression-repository.js')),'STOP B repository context port adapter changed')
edgeSources.repository_context_port={source_sha256:digest(portAdapter),byte_identical:true}

const identityBaseline=()=>value(`select jsonb_build_object(
 'auth',coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email)order by id)from auth.users),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',id_usuario,'email',email)order by id_usuario)from public.usuarios),'[]'::jsonb));`)
const baseline=identityBaseline()
assert.equal(baseline.auth.length,2);assert.equal(baseline.profiles.length,2)
for(const user of users){
 assert.ok(user.email.endsWith('@local.invalid'))
 assert.ok(baseline.auth.some((row)=>row.id===user.id&&row.email===user.email))
 assert.ok(baseline.profiles.some((row)=>row.id===user.id&&row.email===user.email))
}
const verifyBaseline=()=>assert.ok(JSON.stringify(identityBaseline())===JSON.stringify(baseline),
 'STOP historical auxiliary fixture survived cleanup/rollback: Auth or profiles diverged from exact A/B baseline')
const emptyFixtureBaseline=()=>{
 for(const table of ['public.push_subscriptions','public.treino_sessoes','gymio_workout_push_private.outbox','gymio_workout_push_private.deliveries',
  'gymio_workout_actions_private.generations','gymio_workout_actions_private.capabilities'])
  assert.equal(sql(`select count(*)from ${table};`),'0',`isolated empty fixture baseline required: ${table}`)
}
emptyFixtureBaseline()
const knownCredentials=[]
for(const user of users)for(const [key,entry]of Object.entries(user))if(/jwt|password|token|key|secret/i.test(key)&&typeof entry==='string')knownCredentials.push(entry)
for(const [key,entry]of Object.entries(c.status))if(/key|jwt|password|token|secret|db_url/i.test(key)&&typeof entry==='string')knownCredentials.push(entry)
const envFile=path.join(context.root,'edge.env')
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
 const separator=line.indexOf('=');if(separator<1)continue
 if(/jwt|token|password|secret|private|key/i.test(line.slice(0,separator)))knownCredentials.push(line.slice(separator+1).replace(/^['"]|['"]$/g,''))
}
const redact=createCredentialRedactor(knownCredentials)
const results=[],gateStartedAt=new Date().toISOString()
let gateFinishedAt=null,finalBaseline=null,gateFailure=null
const persist=()=>fs.writeFileSync(resultFile,JSON.stringify({
 passed:results.length===12&&results.every((row)=>row.passed)&&finalBaseline?.passed===true,
 execution:'original 12 stages in one continuous invocation',started_at:gateStartedAt,finished_at:gateFinishedAt,
 process_timeouts:{global_timeout_ms:null,per_stage_timeout_ms:null,changed:false},
 buffer_limit_characters_per_stream:16*1024*1024,results,sources,edge_sources:edgeSources,final_baseline:finalBaseline,failure:gateFailure,
 auxiliary_user_policy:{rollback_only:'TRANSIENT ROLLBACK-ONLY TEST FIXTURE',
  historical_non_rollback_cleanup:'Explicit human approval: local auxiliary user with proven cleanup; historical test body unchanged'},
 identity_baseline:{auth_users:2,profiles:2,only_matrix_A_B:true},externalPushRequests:0,
},null,2))
const stage=async(name,script,args)=>{
 actionsContext(contextFile);verifyBaseline()
 const ordinal=results.length+1,stem=`regression-step-${String(ordinal).padStart(2,'0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`
 const evidenceFile=path.join(context.root,`${stem}.json`),stdoutFile=path.join(context.root,`${stem}.stdout.log`),stderrFile=path.join(context.root,`${stem}.stderr.log`)
 assert.ok(!fs.existsSync(evidenceFile),'STOP stage evidence exists; preserve the original attempt')
 const command=['node',path.relative(workspace,script).split(path.sep).join('/'),...args.map((arg)=>arg===contextFile?'<owned-local-context>':arg)]
 const row={stage:name,ordinal,command,cwd:workspace,environment:'inherited process environment; no override',windows_hide:true,shell:false,
  passed:false,exact_A_B_auth_profiles_restored:null,evidence_file:path.basename(evidenceFile),stdout_file:path.basename(stdoutFile),stderr_file:path.basename(stderrFile)}
 results.push(row)
 const saveStage=()=>{fs.writeFileSync(evidenceFile,JSON.stringify(row,null,2));persist()}
 const outcome=await observeChildProcess({executable:process.execPath,args:[script,...args],cwd:workspace,env:{...process.env},
  stdoutFile,stderrFile,redact,onState:(state)=>{Object.assign(row,state);saveStage()}})
 Object.assign(row,outcome)
 let exactBaseline=true
 try{verifyBaseline()}catch{exactBaseline=false}
 row.passed=outcome.exit_code===0&&outcome.termination_reason==='completed'&&exactBaseline
 row.exact_A_B_auth_profiles_restored=exactBaseline
 row.pass_labels=outcome.stdout.split(/\r?\n/).filter((line)=>/^PASS [A-Za-z0-9 :,+_.()/→-]+$/.test(line))
 row.assertion_failure=outcome.stderr.includes('AssertionError');row.sql_failure=/ERROR:|SQLSTATE/.test(outcome.stderr)
 saveStage()
 console.log(`${row.passed?'PASS':'FAIL'} C historical regression: ${name}; ${row.elapsed_ms} ms; Auth/profiles baseline ${exactBaseline?'restored':'DIVERGED'}`)
 assert.ok(row.passed,`STOP historical regression ${name}; no automatic correction`)
}
try{
 for(const name of ['ready','spike','sql','data-api','edge'])
  await stage(`A ${name}`,path.join(tests,'local-tests.mjs'),[name,contextFile])
 for(const [name,file]of [['B SQL','workout-local-tests.mjs'],['B Data API','workout-data-api.mjs'],['B Edge','workout-edge-tests.mjs'],
  ['B performance','workout-performance.mjs'],['B scheduler','scheduler-spike.mjs']])
  await stage(name,path.join(tests,file),[contextFile])
 // The actual entry was used by the B Edge boundary with an empty queue. Only
 // now install the owned disposable encrypted fake transport for cron dispatch.
 await stage('install sender test transport',path.join(workspace,'supabase','testing','actions-reexecution-setup.mjs'),
  ['install-sender-harness',contextFile])
 const installed=fs.readFileSync(path.join(context.root,'supabase','functions','workout-push','index.ts'))
 assert.ok(installed.equals(source('workout-sender-harness/index.ts')),'STOP dispatch requires exact local-only injected fake transport entry')
 await stage('B dispatch',path.join(tests,'workout-dispatch.mjs'),[contextFile])
}catch(error){gateFailure=redact(error instanceof Error?error.stack??error.message:'historical_regression_failed')}
finally{
 // Verification only: historical tests own their fixture cleanup. This runner
 // never repairs a failed baseline or changes grants, jobs or application data.
 let boundary=true,exactIdentity=true,fixturesEmpty=true,jobInactive=true
 try{actionsContext(contextFile)}catch{boundary=false}
 try{verifyBaseline()}catch{exactIdentity=false}
 try{emptyFixtureBaseline()}catch{fixturesEmpty=false}
 try{jobInactive=sql("select not active from cron.job where jobname='gymio-workout-push';")==='t'}catch{jobInactive=false}
 finalBaseline={passed:boundary&&exactIdentity&&fixturesEmpty&&jobInactive,six_hashes_and_owned_runtime_verified:boundary,
  exact_A_B_auth_profiles_restored:exactIdentity,auth_users:exactIdentity?2:null,profiles:exactIdentity?2:null,
  fixture_tables_empty:fixturesEmpty,global_workout_job_inactive:jobInactive,cleanup_policy:'verify only; no automatic data repair'}
 gateFinishedAt=new Date().toISOString();persist()
}
assert.ok(!gateFailure,'STOP original continuous A/B regression; inspect sanitized per-stage evidence; no automatic correction')
assert.ok(results.length===12&&results.every((row)=>row.passed)&&finalBaseline.passed,'STOP final original A/B regression baseline')
console.log('A/B ORIGINAL REGRESSION GATE PASS')

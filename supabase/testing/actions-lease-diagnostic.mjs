// Explicit diagnostic repetition ONLY. Historical B setup, lease block and
// finally remain byte-identical; observability delegates to original asserts.
// No production/history change, no lease rewriting, no provider HTTP.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {actionsContext} from './actions-context.mjs'

const contextFile=process.argv[2]
assert.ok(process.argv.includes('--run-isolated-lease-diagnostic'),'explicit diagnostic execution flag required')
const c=actionsContext(contextFile),root=c.context.root
const baseline=()=>c.value(`select jsonb_build_object(
 'auth',(select jsonb_agg(jsonb_build_object('id',id,'email',email)order by id)from auth.users),
 'profiles',(select jsonb_agg(jsonb_build_object('id',id_usuario,'email',email)order by id_usuario)from public.usuarios));`)
const before=baseline();assert.equal(before.auth.length,2);assert.equal(before.profiles.length,2)
for(const table of ['public.treino_sessoes','public.push_subscriptions','gymio_workout_push_private.outbox','gymio_workout_push_private.deliveries',
 'gymio_workout_actions_private.generations','gymio_workout_actions_private.capabilities'])
 assert.equal(c.sql(`select count(*)from ${table};`),'0','isolated empty diagnostic baseline required')
assert.equal(c.sql("select count(*)from cron.job where active;"),'0','diagnostic requires inactive scheduler')

const source=fs.readFileSync('supabase/testing/workout-local-tests.mjs','utf8')
const prefix=source.slice(0,source.indexOf('try {'))
const blockStart=source.indexOf(" await run('real 60-second lease:")
const blockEnd=source.indexOf(" await run('404/410",blockStart)
assert.ok(blockStart>0&&blockEnd>blockStart)
const block=source.slice(blockStart,blockEnd)
const finallyStart=source.lastIndexOf('} finally {')
const finallyBody=source.slice(finallyStart+'} finally {'.length,source.lastIndexOf('}'))
assert.ok(block.includes('await sleep(61000)')&&finallyBody.includes('reset();'))
const digest=(text)=>createHash('sha256').update(text).digest('hex')
const metadata={historical_source_sha256:digest(source),setup_sha256:digest(prefix),lease_block_sha256:digest(block),finally_sha256:digest(finallyBody),
 original_block_line:source.slice(0,blockStart).split('\n').length,original_finally_line:source.slice(0,finallyStart).split('\n').length,
 historicalAssertionsUnchanged:true,waitMs:61000,productionModified:false,leaseTimestampsRewritten:false,externalPushRequests:0}

const instrumentation=`
const diagnostic={passed:false,waitMs:61000,observations:[],failure:null,fixtureCleanupCompleted:false};
const pgClock=()=>sql('select clock_timestamp();');
diagnostic.startedAtPostgres=pgClock();
const originalAssertions={ok:assert.ok,equal:assert.equal,notEqual:assert.notEqual};
const originalWrite=process.stdout.write.bind(process.stdout);
let assertionNumber=0;
const sanitizedError=(error)=>{
 const location=String(error?.stack??'').match(/actions-lease-diagnostic-execution\\.mjs:(\\d+):(\\d+)/);
 return {name:['AssertionError','TypeError','Error'].includes(error?.name)?error.name:'other',
 code:['ERR_ASSERTION','ERR_INVALID_ARG_TYPE'].includes(error?.code)?error.code:'other',
 generated_line:location?Number(location[1]):null,column:location?Number(location[2]):null,
 ...(typeof error?.actual==='number'&&Number.isFinite(error.actual)?{actual_numeric:error.actual}:{}),
 ...(typeof error?.expected==='number'&&Number.isFinite(error.expected)?{expected_numeric:error.expected}:{})};
};
for(const kind of Object.keys(originalAssertions))assert[kind]=(...args)=>{
 const row={number:++assertionNumber,kind,atPostgres:pgClock(),passed:false,
  actual_type:args[0]===null?'null':typeof args[0],actual_null:args[0]===null,
  ...(typeof args[0]==='number'&&Number.isFinite(args[0])?{actual_numeric:args[0]}:{}),
  ...(typeof args[1]==='number'&&Number.isFinite(args[1])?{expected_numeric:args[1]}:{}),
  ...(kind==='ok'?{actual_truthy:Boolean(args[0])}:{}),
  ...(kind==='equal'||kind==='notEqual'?{comparison_equal:args[0]===args[1]}:{})};
 try{const result=originalAssertions[kind](...args);row.passed=true;return result}
 catch(error){diagnostic.failure=sanitizedError(error);throw error}
 finally{diagnostic.observations.push(row)}
};
process.stdout.write=(part,...args)=>{
 if(String(part).includes('Waiting for the actual PostgreSQL 60-second lease'))diagnostic.waitStartedAtPostgres=pgClock();
 return originalWrite(part,...args);
};
`
const executionFile=path.join(root,'tests','actions-lease-diagnostic-execution.mjs')
const composed=prefix+instrumentation+`\ntry {\ntry {\n`+block+`\n diagnostic.passed=true;\n} catch(error){diagnostic.failure??=sanitizedError(error);process.exitCode=1}\n} finally {\ntry {`+
 finallyBody+`\n diagnostic.fixtureCleanupCompleted=true;\n} finally {\nfor(const [kind,method]of Object.entries(originalAssertions))assert[kind]=method;process.stdout.write=originalWrite;
 diagnostic.endedAtPostgres=pgClock();
 fs.writeFileSync(path.join(context.root,'actions-lease-diagnostic.json'),JSON.stringify(diagnostic,null,2));\n}\n}\n`
fs.writeFileSync(executionFile,composed,{flag:'wx'})
const blockGeneratedLine=composed.slice(0,composed.indexOf(block)).split('\n').length
metadata.generated_block_line=blockGeneratedLine;metadata.generated_file_sha256=digest(composed)
const exitCode=await new Promise((resolve)=>{
 const child=spawn(process.execPath,[executionFile,contextFile],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']})
 // Do not persist or publish raw stderr: Node AssertionError can expose a
 // server-only claim token even though the historical assertion is unchanged.
 child.stdout.on('data',()=>{});child.stderr.on('data',()=>{})
 child.on('error',()=>resolve(1));child.on('close',(code)=>resolve(code??1))
})
const resultPath=path.join(root,'actions-lease-diagnostic.json')
const result=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath,'utf8')):{passed:false,failure:{name:'execution_failed'},observations:[]}
result.metadata=metadata;result.exitCode=exitCode
if(result.failure?.generated_line>=blockGeneratedLine&&result.failure.generated_line<blockGeneratedLine+block.split('\n').length)
 result.failure.historical_line=metadata.original_block_line+result.failure.generated_line-blockGeneratedLine
result.exact_A_B_auth_profiles_restored=JSON.stringify(before)===JSON.stringify(baseline())
result.finalCounts=c.value(`select jsonb_build_object('authUsers',(select count(*)from auth.users),'profiles',(select count(*)from public.usuarios),
 'sessions',(select count(*)from public.treino_sessoes),'subscriptions',(select count(*)from public.push_subscriptions),
 'events',(select count(*)from gymio_workout_push_private.outbox),'deliveries',(select count(*)from gymio_workout_push_private.deliveries),
 'generations',(select count(*)from gymio_workout_actions_private.generations),'capabilities',(select count(*)from gymio_workout_actions_private.capabilities),
 'activeJobs',(select count(*)from cron.job where active));`)
fs.writeFileSync(resultPath,JSON.stringify(result,null,2))
assert.equal(result.exact_A_B_auth_profiles_restored,true,'diagnostic Auth/profile baseline diverged; no automatic repair')
console.log(JSON.stringify(result))
process.exitCode=exitCode

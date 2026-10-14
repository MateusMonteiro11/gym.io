import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {actionsContext} from './actions-context.mjs'
import {actionsFixture} from './actions-fixture.mjs'
const c=actionsContext(process.argv[2]),f=actionsFixture(c),sub=f.subscribe(),origin={Origin:'http://localhost:5173'}
const route='/functions/v1/workout-action'
const boundary=()=>c.value('select public.actions_matrix_boundary_snapshot();')
const evidence={passed:false,fixtureCleanupCompleted:false,externalPushRequests:0,
 requestBoundary:{apikeySent:false,authorizationSent:false,callerIdentitySent:false},
 gateway:{classification:'PLATFORM GATEWAY CORS BASELINE',wildcardObserved:false,rejectedOriginChecks:0,
  rejectedOriginsZeroAdministrativeRpc:false,rejectedOriginsZeroSqlMutation:false,rejectedBodiesZeroAdministrativeRpc:false,rejectedBodiesZeroSqlMutation:false,
  preflightZeroAdministrativeRpc:false,preflightZeroSqlMutation:false},
 productionResults:[],sqlTimeoutBaseline:null,productionTimeout:null,groups:[]}
const readSqlTimeoutBaseline=()=>{
 const rows=c.value(`select coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'database',coalesce(d.datname,'*'),
  'statement',(select split_part(setting,'=',2)from unnest(s.setconfig)setting where setting like 'statement_timeout=%'),
  'lock',(select split_part(setting,'=',2)from unnest(s.setconfig)setting where setting like 'lock_timeout=%'))order by r.rolname,s.setdatabase),'[]'::jsonb)
  from pg_db_role_setting s join pg_roles r on r.oid=s.setrole left join pg_database d on d.oid=s.setdatabase
  where r.rolname in ('authenticator','authenticated','service_role')
   and s.setdatabase in (0,(select oid from pg_database where datname=current_database()));`)
 const milliseconds=(raw)=>{
  if(raw===null)return null
  assert.ok(typeof raw==='string'&&/^[0-9]+(ms|s)?$/.test(raw),'unknown platform SQL timeout representation; refuse to infer a budget')
  const match=raw.match(/^([0-9]+)(ms|s)?$/),number=Number(match[1])*(match[2]==='s'?1000:1)
  assert.ok(Number.isSafeInteger(number)&&number>=0);return number
 }
 const database=c.sql('select current_database();'),settings=rows.map((row)=>({role:row.role,database:row.database,
  statement_timeout_ms:milliseconds(row.statement),lock_timeout_ms:milliseconds(row.lock)}))
 const effective=(role,field)=>{
  const specific=settings.find((row)=>row.role===role&&row.database===database&&row[field]!==null)
  return specific?.[field]??settings.find((row)=>row.role===role&&row.database==='*'&&row[field]!==null)?.[field]??null
 }
 // This is the official local baseline already observed in the failed test,
 // not a role/configuration change. Unknown/different budgets fail closed.
 assert.equal(effective('authenticator','statement_timeout_ms'),8000,'unexpected authenticator statement timeout baseline')
 assert.equal(effective('authenticator','lock_timeout_ms'),8000,'unexpected authenticator lock timeout baseline')
 assert.equal(effective('authenticated','statement_timeout_ms'),8000,'unexpected authenticated statement timeout baseline')
 assert.equal(effective('authenticated','lock_timeout_ms'),null,'unexpected authenticated lock timeout override')
 assert.equal(effective('service_role','statement_timeout_ms'),null,'unexpected service statement timeout override')
 assert.equal(effective('service_role','lock_timeout_ms'),null,'unexpected service lock timeout override')
 return {classification:'PLATFORM SQL TIMEOUT BASELINE',database,settings,earliestSqlDeadlineMs:8000,
  productionHandlerTimeoutMs:10000,modified:false}
}
const resultMetric=(stage,result)=>{evidence.productionResults.push({stage,httpStatus:result.status,result:
 ['ok','stale','expired','already_used','unavailable'].includes(result.data?.result)?result.data.result:'unexpected'})}
const safeGroupMetrics=(group,response,elapsedMs)=>{
 const allowed={group,httpStatus:response.status,elapsed_ms:elapsedMs,passed:response.data?.passed===true}
 for(const name of ['initialized','calls','sends','fetches','retries','bindingsVerified','bTitleBodyVerified','externalPushRequests']){
  const number=response.data?.[name];if(Number.isSafeInteger(number)&&number>=0)allowed[name]=number
 }
 for(const name of ['timeoutMs','elapsedMs']){
  const number=response.data?.[name];if(typeof number==='number'&&Number.isFinite(number)&&number>=0&&number<=60000)allowed[name]=number
 }
 for(const name of ['abortObserved','automaticRetry','realDbUnknownCapabilityChecked'])
  if(typeof response.data?.[name]==='boolean')allowed[name]=response.data[name]
 if(typeof response.data?.rollbackOnly==='boolean')allowed.rollbackOnly=response.data.rollbackOnly
 if(Array.isArray(response.data?.outcomes)&&response.data.outcomes.every((outcome)=>['accepted','expired','failed','stale'].includes(outcome)))
  allowed.outcomes=[...response.data.outcomes]
 const runtime=response.data?.runtime
 if(runtime&&typeof runtime==='object')allowed.runtime=Object.fromEntries(['deno','v8','typescript'].flatMap((name)=>
  typeof runtime[name]==='string'&&/^[0-9A-Za-z.+_-]{1,50}$/.test(runtime[name])?[[name,runtime[name]]]:[]))
 if(group==='boundary'&&allowed.passed)allowed.rejectedHandlerRequestsInitializedZero=true
 return allowed
}
// Origin is defense-in-depth, never authentication. The real gateway may expose
// wildcard CORS/preflight; capability scope and one-time consumption authorize.
// No apikey, Authorization, JWT, or caller identity accompanies these requests.
const raw=async({method='POST',headers=origin,body,url=route}={})=>{
 const response=await fetch(c.api+url,{method,headers:{'Content-Type':'application/json',...headers},
  ...(body===undefined?{}:{body}),signal:AbortSignal.timeout(20000),redirect:'error'})
 const text=await response.text();let data
 try{data=JSON.parse(text)}catch{data=null}
 return {status:response.status,data,text,headers:response.headers}
}
const unavailable=(result,status)=>{
 assert.equal(result.status,status);assert.deepEqual(result.data,{result:'unavailable'})
 assert.ok(!/postgres|sqlstate|stack|service_role|token_hash|internal_credentials/i.test(result.text))
}
try {
 f.start();const issued=f.issue(sub),capability=issued.projection.controls[0].capability
 // GATEWAY LEVEL: rejected origins must cause no admin RPC or state mutation.
 // The SQL observer excludes token hashes and never prints the in-memory bearer.
 const before=boundary()
 for(const headers of [{Origin:'http://localhost:5174'},{Origin:'null'},{}]){
  const rejected=await raw({headers,body:JSON.stringify({capability})});resultMetric('gateway_origin_rejected',rejected)
  unavailable(rejected,403)
  assert.deepEqual(boundary(),before,'gateway rejected origin must leave SQL and RPC counter unchanged')
  evidence.gateway.rejectedOriginChecks++
 }
 evidence.gateway.rejectedOriginsZeroAdministrativeRpc=true;evidence.gateway.rejectedOriginsZeroSqlMutation=true
 for(const [request,status] of [
  [{method:'GET'},405],[{method:'PUT',body:JSON.stringify({capability})},405],
  [{url:route+'?extra=1',body:JSON.stringify({capability})},403],
  [{headers:{...origin,'Content-Type':'text/plain'},body:JSON.stringify({capability})},400],
  [{body:'{'},400],[{body:'null'},400],[{body:'[]'},400],[{body:'{}'},400],
  [{body:JSON.stringify({capability,identity:f.b.id})},400],[{body:' '.repeat(257)},400],
 ]){const rejected=await raw(request);resultMetric('gateway_request_rejected',rejected);unavailable(rejected,status)}
 for(const invalid of [null,42,capability+'=',capability.slice(0,42),capability+'A',
  '!'+capability.slice(1),capability.slice(0,42)+'B',' '+capability,capability+' '])
  {const rejected=await raw({body:JSON.stringify({capability:invalid})});resultMetric('gateway_bearer_rejected',rejected);unavailable(rejected,400)}
 assert.deepEqual(boundary(),before,'rejected bodies must not initialize administrative consume')
 evidence.gateway.rejectedBodiesZeroAdministrativeRpc=true;evidence.gateway.rejectedBodiesZeroSqlMutation=true
 const options=await raw({method:'OPTIONS',headers:{...origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}})
 assert.ok(options.status>=200&&options.status<300)
 assert.ok(['*','http://localhost:5173'].includes(options.headers.get('Access-Control-Allow-Origin')))
 evidence.gateway.wildcardObserved=options.headers.get('Access-Control-Allow-Origin')==='*'
 evidence.gateway.allowedPreflightHttpStatus=options.status
 const foreignOptions=await raw({method:'OPTIONS',headers:{Origin:'http://localhost:5174','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}})
 // Kong can intercept foreign OPTIONS. Neither result grants POST authorization.
 assert.ok((foreignOptions.status>=200&&foreignOptions.status<300)||foreignOptions.status===403)
 evidence.gateway.foreignPreflightHttpStatus=foreignOptions.status
 assert.deepEqual(boundary(),before,'preflight must not mutate or call administrative consume')
 evidence.gateway.preflightZeroAdministrativeRpc=true;evidence.gateway.preflightZeroSqlMutation=true
 console.log('PASS C real gateway: PLATFORM GATEWAY CORS BASELINE; unauthorized POST zero RPC/SQL mutations')
 const success=await raw({body:JSON.stringify({capability})})
 resultMetric('authorized_action',success)
 assert.equal(success.status,200);assert.equal(success.data.result,'ok');assert.equal(success.data.projection.version,3)
 assert.ok(['*','http://localhost:5173'].includes(success.headers.get('Access-Control-Allow-Origin')))
 const after=boundary()
 assert.ok(Number(after.rpc_calls)>Number(before.rpc_calls),'RPC counter must observe the real authorized call')
 evidence.gateway.authorizedAdministrativeRpcObserved=true
 const replay=await raw({body:JSON.stringify({capability})});resultMetric('replay',replay);assert.equal(replay.data.result,'already_used')
 // Real expired/stale response sanitization, without inference from browser state.
 f.start();const expired=f.issue(sub).projection.controls[0].capability
 c.sql(`update gymio_workout_actions_private.generations set created_at=statement_timestamp()-interval '16 minutes',expires_at=statement_timestamp()-interval '1 minute' where id_sessao=${c.literal(f.session.id_sessao)};`)
 const expiration=await raw({body:JSON.stringify({capability:expired})});resultMetric('expired',expiration);assert.equal(expiration.status,200);assert.deepEqual(expiration.data,{result:'expired'})
 f.start();const stale=f.issue(sub).projection.controls[0].capability
 f.mutate('ajustar_descanso_treino_sessao','15')
 const obsolete=await raw({body:JSON.stringify({capability:stale})});resultMetric('stale',obsolete);assert.equal(obsolete.status,200);assert.deepEqual(obsolete.data,{result:'stale'})
 // Real production endpoint against a locked local Session V2 row. The
 // official SQL 8s deadline can preempt the handler's unchanged 10s timer;
 // a separate real-Edge handler group proves that timer and abort directly.
 // The request is ambiguous: zero or one committed action; never infer rollback.
 f.start();const timed=f.issue(sub).projection.controls[0].capability,beforeRevision=Number(f.session.revisao)
 evidence.sqlTimeoutBaseline=readSqlTimeoutBaseline()
 const lock=c.concurrentSql(`begin;set local application_name='gymio_c_timeout';select 1 from public.treino_sessoes where id_sessao=${c.literal(f.session.id_sessao)} for update;select pg_sleep(12);commit;`)
 for(let i=0;i<30;i++){
  if(c.sql("select exists(select 1 from pg_stat_activity where application_name='gymio_c_timeout' and wait_event='PgSleep');")==='t')break
  await new Promise((r)=>setTimeout(r,100));if(i===29)throw Error('timeout_lock_not_ready')
 }
 const beforeTimeoutCalls=Number(boundary().rpc_calls),started=Date.now(),timeout=await raw({body:JSON.stringify({capability:timed})}),elapsed=Date.now()-started
 resultMetric('production_timeout',timeout)
 evidence.productionTimeout={elapsed_ms:elapsed,httpStatus:timeout.status,result:timeout.data?.result==='unavailable'?'unavailable':'unexpected',outcome:'ambiguous',atMostOneMutation:false,
  automaticRetry:false,rollbackInferred:false,classification:'SQL DEADLINE MAY PREEMPT HANDLER TIMEOUT',
  sqlDeadlineMs:evidence.sqlTimeoutBaseline.earliestSqlDeadlineMs,handlerDeadlineMs:10000}
 unavailable(timeout,503);assert.ok(elapsed>=evidence.sqlTimeoutBaseline.earliestSqlDeadlineMs-1000&&elapsed<18000)
 await lock
 const afterRevision=Number(c.sql(`select revisao from public.treino_sessoes where id_sessao=${c.literal(f.session.id_sessao)};`))
 assert.ok(afterRevision<=beforeRevision+1);assert.ok(afterRevision>=beforeRevision)
 evidence.productionTimeout.mutationCount=afterRevision-beforeRevision;evidence.productionTimeout.atMostOneMutation=true
 evidence.productionTimeout.observedAdministrativeRpcDelta=Number(boundary().rpc_calls)-beforeTimeoutCalls
 assert.ok(evidence.productionTimeout.observedAdministrativeRpcDelta>=0&&evidence.productionTimeout.observedAdministrativeRpcDelta<=1,'production timeout cannot retry administrative consumption')
 console.log('PASS C real Edge: verified platform SQL deadline before handler timeout, ambiguous outcome bounded to at most one mutation')
 f.rpc('remover_push_subscription',[c.literal(sub)])
 // Fixed test-only harness requires real JWT A, Auth and DB. Production routes
 // expose no transport injection, arbitrary destination, or administrative bypass.
 for(const group of ['boundary','timeout','sanitize','sender_bound','sender_unchanged','sender_removed','sender_after_claim','sender_logout','sender_user_cascade',
   'sender_404','sender_410','sender_refresh','sender_temporary','sender_partial','sender_no_retry','sender_timeout']) {
  f.start(1)
  const groupStarted=Date.now()
  const response=await c.request('/functions/v1/actions-integration',f.a.jwt,{group},{headers:origin})
  evidence.groups.push(safeGroupMetrics(group,response,Date.now()-groupStarted))
  assert.equal(response.status,200,`${group}: ${response.data?.failedCheck??'unexpected status'}`)
  assert.equal(response.data.passed,true,group);assert.equal(response.data.externalPushRequests,0)
  if(group==='timeout'){
   assert.equal(response.data.timeoutMs,10000)
   assert.ok(response.data.elapsedMs>=9000&&response.data.elapsedMs<18000)
   assert.equal(response.data.abortObserved,true);assert.equal(response.data.automaticRetry,false)
   assert.equal(response.data.initialized,1);assert.equal(response.data.calls,1)
   assert.equal(response.data.realDbUnknownCapabilityChecked,true)
  }
  console.log(`PASS C real Edge: ${group}`)
 }
 evidence.passed=true
} finally {
 try{f.clean();evidence.fixtureCleanupCompleted=true}finally{
  // Only selected booleans/counts/statuses/versions are persisted. Never save a
  // response body/projection, capability/hash, headers, endpoint or credential.
  fs.writeFileSync(path.join(c.context.root,'actions-edge-result.json'),JSON.stringify(evidence,null,2))
 }
}

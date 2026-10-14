// C-only supplement. The original pre-C Extension Security Gate is unchanged.
// Snapshot after that gate, verify after C, BEFORE installing test-only RPCs.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {actionsContext,historicalHashes} from './actions-context.mjs'

const [contextFile,mode]=process.argv.slice(2)
assert.ok(['--snapshot','--verify'].includes(mode),'explicit --snapshot or --verify required')
const c=actionsContext(contextFile),{sql,value,request,literal:q}=c
const baselineFile=path.join(c.context.root,'actions-extension-before-c.json')
const resultFile=path.join(c.context.root,'actions-extension-after-c.json')
const hash=(text)=>createHash('sha256').update(text).digest('hex')
const appSchemas=['public','graphql_public','gymio_private','gymio_push_private','gymio_workout_push_private','gymio_workout_actions_private']
const extensionNames=['pg_cron','pg_net','supabase_vault']
const extensionSchemas=['cron','net','vault']
const rows=(query)=>value(`begin isolation level repeatable read read only;${query}commit;`)
const list=(values)=>values.map(q).join(',')
const snapshot=()=>rows(`select jsonb_build_object(
 'extensions',(select coalesce(jsonb_agg(to_jsonb(t)order by extname),'[]'::jsonb)from
  (select extname,extversion,extowner::regrole::text owner,extnamespace::regnamespace::text schema
   from pg_extension where extname in(${list(extensionNames)}))t),
 'schemas',(select coalesce(jsonb_agg(to_jsonb(t)order by nspname),'[]'::jsonb)from
  (select nspname,nspowner::regrole::text owner,nspacl from pg_namespace where nspname in(${list(extensionSchemas)}))t),
 'relations',(select coalesce(jsonb_agg(to_jsonb(t)order by name),'[]'::jsonb)from
  (select n.nspname||'.'||c.relname name,c.relkind,c.relowner::regrole::text owner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
   e.extname extension,(select jsonb_agg(jsonb_build_object('column',attname,'type',format_type(atttypid,atttypmod),'notnull',attnotnull,
    'identity',attidentity,'generated',attgenerated,'acl',attacl,'default',pg_get_expr(adbin,adrelid))order by attnum)
    from pg_attribute left join pg_attrdef on adrelid=attrelid and adnum=attnum where attrelid=c.oid and attnum>0 and not attisdropped)columns,
   (select jsonb_agg(pg_get_constraintdef(oid)order by conname)from pg_constraint where conrelid=c.oid)constraints,
   (select jsonb_agg(pg_get_indexdef(indexrelid)order by indexrelid::regclass::text)from pg_index where indrelid=c.oid)indexes,
   (select to_jsonb(s)-'seqrelid' from pg_sequence s where s.seqrelid=c.oid)sequence
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   left join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
   left join pg_extension e on e.oid=d.refobjid where n.nspname in(${list(extensionSchemas)}) or e.extname in(${list(extensionNames)}))t),
 'functions',(select coalesce(jsonb_agg(to_jsonb(t)order by signature),'[]'::jsonb)from
  (select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'signature,p.proowner::regrole::text owner,
   p.proacl,p.prosecdef,p.proconfig,p.prosrc,p.probin,p.prokind,p.provolatile,p.proparallel,p.proisstrict,e.extname extension,
   pg_get_function_arguments(p.oid)arguments,pg_get_function_result(p.oid)result
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   left join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.refclassid='pg_extension'::regclass and d.deptype='e'
   left join pg_extension e on e.oid=d.refobjid where n.nspname in(${list(extensionSchemas)}) or e.extname in(${list(extensionNames)}))t),
 'policies',(select coalesce(jsonb_agg(to_jsonb(t)order by name),'[]'::jsonb)from
  (select n.nspname||'.'||c.relname||'.'||p.polname name,p.polcmd,p.polroles,p.polpermissive,
   pg_get_expr(p.polqual,p.polrelid)qual,pg_get_expr(p.polwithcheck,p.polrelid)as check
   from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in(${list(extensionSchemas)}))t),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(t)order by schema,owner,type),'[]'::jsonb)from
  (select coalesce(n.nspname,'*')schema,d.defaclrole::regrole::text owner,d.defaclobjtype type,d.defaclacl
   from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclnamespace=0 or n.nspname in(${list(extensionSchemas)}))t),
 'roles',(select jsonb_agg(to_jsonb(t)order by rolname)from
  (select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolconnlimit,rolvaliduntil,rolbypassrls from pg_roles)t),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(t)order by role,member,grantor),'[]'::jsonb)from
  (select roleid::regrole::text role,member::regrole::text member,grantor::regrole::text grantor,admin_option,inherit_option,set_option from pg_auth_members)t));`)

// All public/helper bodies, including unknown overloads/procedures, fail closed.
// Source functions remain pinned to the six hashes checked by actionsContext.
const appFunctions=()=>rows(`select coalesce(jsonb_agg(to_jsonb(t)order by name,arguments),'[]'::jsonb)from(
 select n.nspname||'.'||p.proname name,pg_get_function_identity_arguments(p.oid)arguments,p.proowner::regrole::text owner,
 p.prosecdef definer,p.proconfig config,p.prosrc source,l.lanname language,p.prokind kind,p.proacl acl,
 has_function_privilege('anon',p.oid,'EXECUTE')anon,has_function_privilege('authenticated',p.oid,'EXECUTE')authenticated,
 has_function_privilege('service_role',p.oid,'EXECUTE')service,
 has_function_privilege('gymio_push_executor',p.oid,'EXECUTE')push_executor,
 has_function_privilege('gymio_workout_executor',p.oid,'EXECUTE')workout_executor,
 (select jsonb_agg(jsonb_build_object('grantor',a.grantor::regrole::text,'grantee',case when a.grantee=0 then 'PUBLIC' else a.grantee::regrole::text end,
   'privilege',a.privilege_type,'grantable',a.is_grantable)order by a.grantee::regrole::text,a.privilege_type)
  from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a)effective_acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname in(${list(appSchemas)}) and p.prokind in('f','p'))t;`)
const assertVersions=(catalog)=>{
 assert.equal(catalog.extensions.length,3)
 for(const [name,version]of [['pg_cron','1.6.4'],['pg_net','0.20.0'],['supabase_vault','0.3.1']])
  assert.equal(catalog.extensions.find((extension)=>extension.extname===name)?.extversion,version)
}
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
if(mode==='--snapshot') {
 assert.equal(sql("select to_regnamespace('gymio_workout_actions_private')is null;"),'t','snapshot must precede C')
 const gate=read(path.join(c.context.root,'extension-result.json'))
 assert.equal(gate.passed,true,'the unchanged original Extension Security Gate must pass first')
 assert.deepEqual(gate.effectiveSchemas,['public','graphql_public'])
 const catalog=snapshot();assertVersions(catalog)
 const result={project:c.context.project,root:c.context.root,hashes:historicalHashes,catalog,appFunctions:appFunctions()}
 fs.writeFileSync(baselineFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log('PASS C extension supplement: immutable pre-C catalog/roles/memberships snapshot saved after the original gate')
}else{
 assert.equal(sql("select to_regnamespace('gymio_workout_actions_private')is not null;"),'t','verification requires installed C')
 const baseline=read(baselineFile)
 assert.equal(baseline.project,c.context.project);assert.equal(baseline.root,c.context.root)
 assert.deepEqual(baseline.hashes,historicalHashes,'snapshot must bind all six canonical migrations')
 const after=snapshot();assertVersions(after)
 assert.deepEqual(after,baseline.catalog,'C must preserve extension ACLs, owners, columns, RLS, policies, defaults, role attributes and memberships')
 const functions=appFunctions(),byName=new Map(),reviewed=new Map()
 const sourceFiles=Object.keys(historicalHashes).filter((name)=>!name.endsWith('_auth_email_security.sql'))
 const bName='20261010183821_workout_notifications.sql',cName='20261011021351_workout_notification_actions.sql'
 for(const file of sourceFiles) {
  const source=fs.readFileSync(`supabase/migrations/${file}`,'utf8').replace(/\r\n/g,'\n')
  const pattern=/create(?: or replace)? function ((?:public|gymio_private|gymio_push_private|gymio_workout_push_private|gymio_workout_actions_private)\.[a-z_]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?\blanguage\s+([a-z]+)[\s\S]*?\bas\s+(\$[a-z_]*\$)([\s\S]*?)\4\s*;/gi
  for(const match of source.matchAll(pattern)) {
   assert.ok(!reviewed.has(match[1]),'ambiguous source function')
   reviewed.set(match[1],{source:match[5],arguments:match[2],language:match[3].toLowerCase(),file})
  }
 }
 assert.ok(reviewed.size>=30,'complete frozen source inventory')
 const wrapperAudit=[]
 for(const fn of functions) {
  assert.ok(!byName.has(fn.name),'unreviewed overload in application schema');byName.set(fn.name,fn)
  assert.equal(fn.kind,'f','procedures are not part of the reviewed application surface')
  if(fn.name==='graphql_public.graphql') {
   assert.equal(hash(fn.source),'d2330ee1a8a4e6fbe400b0e12c15a6cff5d26a37c8c499cea45bab56a43d3bcb')
   assert.equal(fn.owner,'supabase_admin');assert.equal(fn.definer,false);assert.equal(fn.language,'plpgsql');assert.equal(fn.config,null)
   continue
  }
  const expected=reviewed.get(fn.name);assert.ok(expected,'unreviewed callable or helper after C')
  assert.equal(fn.source.replace(/\r\n/g,'\n'),expected.source,'function body must equal its frozen migration source')
  assert.equal(fn.language,expected.language)
  const push=fn.name.startsWith('gymio_push_private.')||/public\.(registrar|consultar|remover)_push_subscription/.test(fn.name)
  const memory=fn.name==='public.buscar_memorias_exercicios',trigger=fn.name==='gymio_push_private.touch_updated_at'
  const admin=expected.file===bName||expected.file===cName
  assert.equal(fn.owner,memory||trigger||admin?'postgres':push?'gymio_push_executor':'gymio_workout_executor')
  assert.equal(fn.definer,fn.name.startsWith('public.')&&!memory)
  assert.deepEqual(fn.config,['search_path=""'])
  assert.equal(fn.anon,false)
  if(expected.file===cName) {
   assert.equal(fn.arguments.replace(/\s+/g,' ').replace(/,\s*/g,','),expected.arguments.replace(/public\./g,'').replace(/\s+/g,' ').replace(/,\s*/g,','))
   const issuer=fn.name==='public.emitir_controles_notificacao_treino',publicFunction=fn.name.startsWith('public.')
   assert.equal(fn.authenticated,issuer);assert.equal(fn.service,publicFunction&&!issuer)
   assert.equal(fn.push_executor,false);assert.equal(fn.workout_executor,false)
   const callers=['postgres',...(publicFunction?[issuer?'authenticated':'service_role']:[])].sort()
   assert.equal(fn.effective_acl.length,callers.length,'C ACL contains only its owner and exact caller')
   assert.equal(fn.effective_acl.map((acl)=>acl.grantee).sort().join(','),callers.join(','))
   assert.ok(fn.effective_acl.every((acl)=>acl.grantor==='postgres'&&acl.privilege==='EXECUTE'&&!acl.grantable),'C exact owner/caller ACL')
  }else{
   assert.equal(fn.authenticated,fn.name.startsWith('public.')&&!admin)
   if(admin)assert.equal(fn.service,fn.name.startsWith('public.'))
  }
  wrapperAudit.push({name:fn.name,arguments:fn.arguments,owner:fn.owner,definer:fn.definer,language:fn.language,
   authenticated:fn.authenticated,service:fn.service,bodyHash:hash(fn.source)})
 }
 assert.equal(byName.size,reviewed.size+1,'complete inventory, including the official GraphQL disabled stub')
 for(const previous of baseline.appFunctions) {
  const current=byName.get(previous.name);assert.ok(current,'historical function cannot disappear')
  assert.deepEqual(current,previous,'all historical function definitions, effective privileges and raw ACLs remain unchanged')
 }
 // Run each original assertion block without adding any executor exception.
 const assertionBlocks=[]
 for(const file of ['20261007215944_push_foundation.sql',bName]) {
  const source=fs.readFileSync(`supabase/migrations/${file}`,'utf8'),block=source.match(/do \$assertions\$[\s\S]*?\$assertions\$;/)?.[0]
  assert.ok(block,'original A/B assertion block required');assertionBlocks.push(block)
 }
 const source=fs.readFileSync(`supabase/migrations/${cName}`,'utf8')
 const capture=source.slice(source.indexOf('create temporary table gymio_c_historical'),source.indexOf('create schema gymio_workout_actions_private'))
 const cAssertions=source.match(/do \$assert\$[\s\S]*?\$assert\$;/)?.[0]
 assert.ok(capture.startsWith('create temporary table')&&cAssertions,'original C snapshot/assertion required')
 sql(`begin;${assertionBlocks.join('\n')}${capture}${cAssertions}rollback;`)
 const count=()=>rows(`select jsonb_build_object('jobs',(select count(*)from cron.job),'active_jobs',(select count(*)from cron.job where active),
  'requests',(select count(*)from net.http_request_queue),'responses',(select count(*)from net._http_response),
  'secrets',(select count(*)from vault.secrets),'sessions',(select count(*)from public.treino_sessoes),
  'generations',(select count(*)from gymio_workout_actions_private.generations),'capabilities',(select count(*)from gymio_workout_actions_private.capabilities));`)
 const beforeProbes=count();assert.equal(beforeProbes.active_jobs,0,'scheduler must remain inactive for this audit')
 const http=[]
 const probes=[['cron','job?select=jobid&limit=0'],['cron','job_run_details?select=jobid&limit=0'],
  ['net','http_request_queue?select=id&limit=0'],['net','_http_response?select=id&limit=0'],['vault','decrypted_secrets?select=id&limit=0'],
  ['gymio_private','rpc/request_uid',{}],['gymio_push_private','rpc/request_uid',{}],
  ['gymio_workout_push_private','rpc/tick',{}],['gymio_workout_actions_private','generations?select=id&limit=0'],
  ['gymio_workout_actions_private','capabilities?select=id&limit=0'],['gymio_workout_actions_private','rpc/request_uid',{}],
  ['cron','rpc/schedule',{schedule:'0 0 1 1 *',command:'select 1'}],['cron','rpc/unschedule',{job_id:-1}],
  ['net','rpc/http_post',{url:'http://127.0.0.1:1/',body:{},params:{},headers:{},timeout_milliseconds:1}]]
 for(const [role,jwt]of [['anon',null],['authenticated-A',c.users[0].jwt],['authenticated-B',c.users[1].jwt]]) {
  assert.equal((await request('/rest/v1/exercicios?select=id_exercicio&limit=0',jwt,undefined,{method:'GET'})).status,200,'a valid public read must prove API and JWT availability')
  for(const [schema,resource,body]of probes) {
   const method=body===undefined?'GET':'POST',response=await request(`/rest/v1/${resource}`,jwt,body,{method,
    headers:{[method==='GET'?'Accept-Profile':'Content-Profile']:schema}})
   assert.equal(response.status,406,'administrative/private schema must remain unexposed')
   assert.equal(response.data?.code,'PGRST106')
   const description=response.data.hint??response.data.message
   assert.match(description,/^(Only the following schemas are exposed: |The schema must be one of the following: )/)
   assert.deepEqual(description.split(': ').slice(1).join(': ').split(',').map((name)=>name.trim()),['public','graphql_public'])
   http.push({role,schema,resource,status:response.status,code:response.data.code})
  }
  for(const [name,args]of [['workout_notification_action',{p_capability:'A'.repeat(43)}],
   ['workout_push_begin_controls',{p_delivery_id:'11111111-1111-4111-8111-111111111111',p_claim_token:'11111111-1111-4111-8111-111111111111'}]]) {
   const response=await request(`/rest/v1/rpc/${name}`,jwt,args)
   assert.ok([401,403].includes(response.status),'administrative C wrappers must reject all client roles')
   http.push({role,schema:'public',resource:`rpc/${name}`,status:response.status,code:response.data?.code})
  }
 }
 const vault=rows(`select coalesce(jsonb_agg(to_jsonb(t)order by role),'[]'::jsonb)from(
  select r.rolname role,has_schema_privilege(r.oid,'vault','USAGE')can_use,has_schema_privilege(r.oid,'vault','CREATE')can_create,
   exists(select 1 from pg_class c where case when c.relnamespace='vault'::regnamespace and c.relkind in('r','p','v','m','f')then
    (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))else false end)relations,
   exists(select 1 from pg_class c where case when c.relnamespace='vault'::regnamespace and c.relkind='S'then has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE')else false end)sequences,
   exists(select 1 from pg_proc p where p.pronamespace='vault'::regnamespace and has_function_privilege(r.oid,p.oid,'EXECUTE'))functions
  from pg_roles r where r.rolname in('anon','authenticated'))t;`)
 assert.ok(vault.length===2&&vault.every((row)=>!row.can_use&&!row.can_create&&!row.relations&&!row.sequences&&!row.functions),'strict Vault effective schema/table/column/sequence/function boundary')
 assert.deepEqual(count(),beforeProbes,'all boundary probes must perform zero administrative or workout writes')
 assert.deepEqual(snapshot(),baseline.catalog,'effective boundary tests must leave the original extension catalog and memberships unchanged')
 const result={passed:true,project:c.context.project,catalogSha256:hash(JSON.stringify(after)),effectiveSchemas:['public','graphql_public'],
  historicalAppFunctionsUnchanged:baseline.appFunctions.length,wrapperAudit,http,vault,counts:beforeProbes,
  assertions:'A/B/C original blocks unchanged; no executor allowlist expansion',externalRequests:0}
 fs.writeFileSync(resultFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(`PASS C post-extension supplement: exact catalog/roles/memberships preserved; ${wrapperAudit.length} source-pinned functions; ${http.length} HTTP boundary rejections; original A/B/C assertions`)
}

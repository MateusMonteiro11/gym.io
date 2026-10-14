// Read-only evidence for the interrupted C run; never repeats an action.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {actionsContext,historicalHashes} from './actions-context.mjs'
const c=actionsContext(process.argv[2]),root=c.context.root
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''))
const tables=['auth.users','public.usuarios','public.treinos','public.exercicios','public.secoes_treino','public.treinos_exercicios','public.treino_sessoes',
 'public.push_subscriptions','gymio_workout_push_private.outbox','gymio_workout_push_private.deliveries','gymio_workout_actions_private.generations','gymio_workout_actions_private.capabilities']
const counts=Object.fromEntries(tables.map(name=>[name,Number(c.sql(`select count(*)from ${name};`))]))
assert.equal(counts['auth.users'],2);assert.equal(counts['public.usuarios'],2)
for(const name of tables.slice(2))assert.equal(counts[name],0,`test fixture cleanup ${name}`)
assert.equal(c.sql("select count(*)from cron.job where active;"),'0')
const resources=read('created-resources.json')
const current=execFileSync('docker',['ps','-a','--filter','label=com.supabase.cli.project=gymio-workout-actions-local','--format','{{.ID}}'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const owned=current.map(id=>{
 const x=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8'}))[0]
 assert.equal(x.Config.Labels['com.supabase.cli.project'],c.context.project)
 assert.equal(fs.realpathSync(x.Config.Labels['com.supabase.cli.workdir']),root)
 return {id:x.Id,name:x.Name,image:x.Config.Image,imageId:x.Image,mounts:x.Mounts.map(m=>({type:m.Type,name:m.Name,destination:m.Destination})),network:Object.keys(x.NetworkSettings.Networks)}
})
const log=fs.readFileSync(path.join(root,'actions-sql.log'),'utf8'),labels=log.split(/\r?\n/).filter(line=>line.startsWith('PASS C SQL:'))
assert.ok(log.includes('operator is not unique: unknown - unknown'))
const result={phase:'V3.2-C corrected matrix reexecution',verdict:'V3.2-C TEST MATRIX REPROVADA',createdAt:new Date().toISOString(),project:c.context.project,runtimeRoot:root,
 ports:{api:55451,db:55452,shadow:55450},hashes:historicalHashes,cPreFix:'8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42',
 smoke:JSON.parse(fs.readFileSync('supabase/testing/actions-correction-smoke-result.json','utf8').replace(/^\uFEFF/,'')),
 application:{passed:true,completeTransaction:true,historicalAssertionsPreserved:true},extensionBefore:read('extension-result.json'),extensionAfter:read('actions-extension-after-c.json'),
 sql:{passed:false,passedGroups:labels.length,labels,failedGroup:'sender binds two deliveries to their exact subscription, same user is insufficient',
 failure:{function:'public.workout_push_begin_controls(uuid,uuid)',migrationLine:255,message:'operator is not unique: unknown - unknown',
  expression:"v_controls->'projection'-'title'-'body'",classification:'New functional SQL defect; execution stopped per item 19; no further implementation fix'},
 pending:['sender remaining SQL cases','C Data API complete suite','C Edge/handler/gateway/sender matrix','A/B complete regressions after C','scheduler/dispatch/performance','db lint'],performance:'Final C timing output was not reached; no consume was repeated to collect metrics'},
 quality:{npm:{passed:true,tests:80,failures:0,duration_ms:4360.4099},build:{passed:true,duration_s:14.48,isolatedEnvDir:true,warning:'Existing chunk larger than 500 kB'},
  deno:{passed:true,version:'2.1.4',frozen:true,entries:['push-test','workout-push','workout-action','actions-integration']},
  indexedDB:{C:true,B:true,dependency:'fake-indexeddb@6.2.5'},frontendLint:'No frontend lint script exists'},
 versions:{node:process.version,docker:execFileSync('docker',['version','--format','{{.Server.Version}}'],{encoding:'utf8'}).trim(),supabaseCLI:'2.120.0',
  postgres:c.sql('select version();'),extensions:c.value("select jsonb_object_agg(extname,extversion)from pg_extension where extname in('pg_cron','pg_net','supabase_vault');")},
 resources,ownedAtClose:owned,fixtureCounts:counts,users:c.users.map(({id,email})=>({id,email})),globalJobInactive:true,
 scope:{remoteOperations:0,providerRequests:0,productionSourceChanges:false,manualA_BPreserved:true,authHistoricalExecuted:false,contractExecuted:false,commitPushPRMerge:false},
 cleanup:{pending:true},auxiliaryApproval:'User authorized strictly local historical auxiliary users with proven cleanup. Those regression stages were not reached.'}
fs.writeFileSync('supabase/testing/actions-test-matrix-reexecution.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({sqlPassedGroups:labels.length,counts,globalJobInactive:true,ownedContainerIds:owned.map(x=>x.id)}))

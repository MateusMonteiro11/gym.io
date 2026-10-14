// Evidence only: collect after explicitly executed stages; finalize after cleanup.
// Does not start services, repeat tests, mutate SQL or send any provider request.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {actionsContext,assertActionsHistory,historicalHashes} from './actions-context.mjs'

const requiredStages=['sender-smoke','application','extension-before','extension-after','sql-C','data-api-C','edge-C',
 'regressions-A-B','idb-C','idb-B','npmtest','build','deno-frozen','db-lint-before','db-lint-after','source-audit','performance']
const setupStages=['credentials','bootstrap','adapters']
const regressionPlan=['A ready','A spike','A sql','A data-api','A edge','B SQL','B Data API','B Edge','B performance','B scheduler',
 'install sender test transport','B dispatch']
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const scrub=(text)=>String(text).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED]')
 .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[REDACTED]')
 .replace(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g,'[REDACTED]')
 .replace(/(?:\\x)?\b[0-9a-f]{64}\b/gi,'[REDACTED_HASH]')
const forbidden=/^(jwt|password|access_token|refresh_token|capability|capabilities|token_hash|claim_token|worker_token|workerToken|vapid_private_key|authorization|headers|snapshot|endpoint|p256dh|auth)$/i
function sanitize(value){
 if(typeof value==='string')return scrub(value)
 if(Array.isArray(value))return value.map(sanitize)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!forbidden.test(key)).map(([key,item])=>[key,sanitize(item)]))
 return value
}
function labels(root,name){
 const file=path.join(root,name)
 if(!fs.existsSync(file))return {present:false,passLabels:[],complete:false}
 const text=fs.readFileSync(file,'utf8')
 return {present:true,passLabels:text.split(/\r?\n/).filter((line)=>line.startsWith('PASS ')).map(scrub),
  complete:text.includes('C SQL matrix complete: no external Push requests'),
  assertionFailure:text.includes('AssertionError'),sqlStates:[...new Set([...text.matchAll(/(?:SQLSTATE\s+|ERROR:\s+)([0-9A-Z]{5}):?/g)].map((match)=>match[1]))]}
}
function optional(root,name){const file=path.join(root,name);return fs.existsSync(file)?sanitize(read(file)):null}
function stageEvidence(root,name){
 if(typeof name!=='string'||!/^[-a-zA-Z0-9_.]+\.(json|log)$/.test(name)||/^(status|users|context|setup)\.json$/.test(name))return null
 const runtimeFile=path.join(root,name)
 if(fs.existsSync(runtimeFile))return runtimeFile
 const sourceFile=path.join(process.cwd(),'supabase/testing',name)
 if(/^actions-third-[a-z0-9-]+\.json$/.test(name)&&fs.existsSync(sourceFile))return sourceFile
 return null
}
function render(result){
 const stage=(name)=>result.stages.find((entry)=>entry.stage===name)
 const status=(name)=>stage(name)?.status??'blocked'
 const lines=['# Gym.io V3.2-C — terceira matriz','',`**${result.verdict}**`,'',
  '## A. Sender fix','',"A composição tipada remove exclusivamente `title` e `body` da projection C e conserva os textos fixos B. Smoke específico: "+status('sender-smoke')+'.',
  '', '## B. Novo hash C','',`C original: \`${result.cLineage.original}\`.`,
  `C após correção sintática: \`${result.cLineage.syntaxFix}\`.`,`C sender-fix: \`${result.hashes['20261011021351_workout_notification_actions.sql']}\`.`,
  '', '## C. Runtime/bootstrap','',`Projeto \`${result.project}\`; API 55451, DB 55452, shadow 55450. Runtime novo: \`${result.runtimeRoot}\`.`,
  'Ordem: fixture legada → EXPAND → Memory → A → B → Extension Security Gate → C sender-fix. Auth histórico e CONTRACT não executados.',
  `Imagem: \`${result.versions.postgresImage}\`. PostgreSQL observado: ${result.versions.postgres}.`,
  `Node ${result.versions.node}; CLI ${result.versions.supabaseCLI}; Deno compiler ${result.versions.denoCompiler??'não registrado'}; Edge runtime \`${JSON.stringify(result.versions.edgeRuntime)}\`. Imagens/digests estão registrados na evidência JSON.`,
  '', '## D. Migration/assertions','',`Aplicação C: ${status('application')}; gate antes: ${status('extension-before')}; complemento pós-C: ${status('extension-after')}.`,
  'Os blocos de assertions A/B/C e o catálogo de ACLs/owners/memberships são auditados sem reparos ou novas exceções.',
  '', '## E. Issuance/unchanged','',`SQL C: ${status('sql-C')}; ${result.sql.passLabels.length} grupos PASS registrados; término integral: ${result.sql.complete}.`,
  'Contagens, invalidation e hashes persistidos de unchanged são comparados pelo harness; tokens não são reconstruídos.',
  '', '## F. Bearer/ownership','',`SQL C: ${status('sql-C')}; Data API C: ${status('data-api-C')}. Casos executados constam dos labels e evidências JSON.`,
  '', '## G. Cinco actions','',`SQL C: ${status('sql-C')}; chamadas +15, pause, resume, continue e skip são verificadas com estado/revisão do backend.`,
  '', '## H. Atomicidade/UID','',`SQL C: ${status('sql-C')}. O harness cobre rollback de skip pausado e restauração/isolamento de UID na mesma conexão física.`,
  '', '## I. Concurrency/replay/expiry','',`SQL C: ${status('sql-C')}. Resultados parciais são preservados; um grupo não alcançado permanece pendente.`,
  '', '## J. Lifecycle/retention','',`SQL C: ${status('sql-C')}; Edge C: ${status('edge-C')}; regressões A/B: ${status('regressions-A-B')}.`,
  `Contagens finais antes do teardown: \`${JSON.stringify(result.fixtureCounts)}\`.`,
  '', '## K. Data API','',`Matriz C: ${status('data-api-C')}; ${result.dataApi.passLabels.length} labels PASS. Clients não recebem acesso administrativo ou direto ao schema C.`,
  ...(result.harnessDiagnoses?.dataApi?['Correção do harness: DELETE sem filtro era rejeitado primeiro por safeupdate (21000/HTTP 400). DML com alvo concreto verifica separadamente ACL/RLS sem modificar policies/grants; a tentativa anterior permanece registrada.']:[]),
  '', '## L. Edge/CORS/timeout','',`Matriz real Edge: ${status('edge-C')}; ${result.edge.passLabels.length} labels PASS.`,
  'Origin é defesa adicional; capability é autorização. Wildcard/preflight global permanece PLATFORM GATEWAY CORS BASELINE. Timeout não comprova rollback SQL.',
  ...(result.harnessDiagnoses?.timeout?['O baseline local de timeout SQL pode preemptar a espera de dez segundos da Edge. A evidência separa o cancelamento SQL observado da prova de abort do handler/transporte; nenhum timeout de produção ou role foi alterado.']:[]),
  ...(result.harnessDiagnoses?.pushPrivileges?['A fixture utiliza a RPC autenticada aprovada para registrar/rotacionar subscriptions; não pressupõe INSERT/UPDATE administrativo onde os grants existentes não o autorizam.']:[]),
  '', '## M. Sender B→C','',`Matriz Edge: ${status('edge-C')}; SQL: ${status('sql-C')}. Evidência de bindings/outcomes/transporte: ${result.edgeResults?'presente':'não disponível'}.`,
  'A política permanece at-most-once; 2xx significa accepted pelo provider. Transporte é falso e não há requisição a provider.',
  '', '## N. Regressão A/B','',`Gate da regressão original: ${status('regressions-A-B')}; etapas registradas na tentativa inicial: ${result.regressions?.results?.length??0}.`,
  ...(result.regressionContinuation?[`Execução complementar preservada: ${result.regressionContinuation.passed?'PASS':'FAIL'}; ${result.regressionContinuation.results.length} etapas registradas, incluindo os resultados A anteriores e SQL B repetido. A causa da falha original continua não resolvida; esta evidência não altera o gate nem apaga a tentativa inicial.`]:[]),
  '',...(result.regressionStages??[]).map((entry)=>`- ${entry.stage}: ${entry.status}${entry.elapsed_ms===null?'':` — ${entry.elapsed_ms} ms`}`), '',
  `Scheduler de dez segundos: ${result.regressionStages?.find((entry)=>entry.stage==='B scheduler')?.status??'blocked'}; dispatch local falso: ${result.regressionStages?.find((entry)=>entry.stage==='B dispatch')?.status??'blocked'}; benchmark B de mil usuários: ${result.regressionStages?.find((entry)=>entry.stage==='B performance')?.status??'blocked'}. Etapas bloqueadas não foram executadas. Fixtures auxiliares precisam restaurar o baseline A/B.`,
  ...(result.leaseDiagnostic?[`Diagnóstico isolado de lease: ${result.leaseDiagnostic.passed?'PASS':'FAIL'}; assertions históricas e espera de 61 segundos preservadas. Resultado: \`${JSON.stringify(result.leaseDiagnostic.failure)}\`. A repetição diagnóstica não aprova a regressão integral nem explica, por si só, a falha original cujo stderr foi descartado pelo runner.`]:[]),
  ...(result.bSqlDiagnostic?[`Repetição diagnóstica SQL B completa, com corpo byte-idêntico e sem SQL extra nas assertions: ${result.bSqlDiagnostic.passed?'PASS':'FAIL'}; ${result.bSqlDiagnostic.passLabels.length} grupos. Falha sanitizada: \`${JSON.stringify(result.bSqlDiagnostic.failure)}\`. Baseline A/B restaurado: ${result.bSqlDiagnostic.exact_A_B_auth_profiles_restored}.`]:[]),
  `Limitação identificada por leitura no harness histórico B: refresh tenta admin.update das chaves e não verifica a negação de privilégio; esse caso isolado não comprova rotação real. B Edge nesta matriz: ${result.regressionStages?.find((entry)=>entry.stage==='B Edge')?.status??'blocked'}. A cobertura complementar C sender_refresh usa RPC autenticada e verifica cleanup snapshot-safe, quando essa etapa passa. O teste histórico permanece intacto.`,
  '', '## O. SW/IndexedDB','',`C: ${status('idb-C')}; B: ${status('idb-B')}; npm: ${status('npmtest')}. Produção SW/frontend permanece preservada.`,
  `Suíte npm desta execução: ${result.quickResults?.npmtest?.pass??'não registrado'}/${result.quickResults?.npmtest?.tests??'não registrado'}, falhas ${result.quickResults?.npmtest?.fail??'não registrado'}, duração ${result.quickResults?.npmtest?.duration_ms??'não registrada'} ms.`,
  '', '## P. Quality/performance/db lint','',`Build: ${status('build')}; Deno frozen: ${status('deno-frozen')}; source audit: ${status('source-audit')}; performance: ${status('performance')}.`,
  `db lint antes: ${status('db-lint-before')} — \`${JSON.stringify(result.dbLint.before?.counts??null)}\`.`,
  `db lint depois: ${status('db-lint-after')} — \`${JSON.stringify(result.dbLint.after?.counts??null)}\`.`,
  '',...['before','after'].flatMap((phase)=>(result.dbLint[phase]?.diagnostics??[]).map((entry)=>`- ${phase}: ${entry.level} — ${entry.function}: ${entry.message}`)), '',
  'CLI 2.120.0 oferece níveis warning/error, sem nível info; INFO retornado é contado e essa limitação permanece explícita. Não existe lint frontend. Nenhum ERROR é permitido.',
  `Tempos C, em ms (incluem transporte do harness): \`${JSON.stringify(result.performance?.timings??null)}\`.`,
  `Build desta execução: ${result.quickResults?.build?.duration_ms??'não registrado'} ms; warning: ${result.quickResults?.build?.warning??'nenhum registrado'}. Deno frozen: ${(result.quickResults?.['deno-frozen']?.entries??[]).join(', ')||'não registrado'}.`,
  'Sem novo cron C, polling ou countdown writes; nenhuma meta arbitrária de latência.',
  `Tentativas anteriores de harness preservadas: ${result.harnessAttempts?.length??0}; snapshots Edge parciais: ${result.partialEdgeAttempts?.length??0}. Critérios corrigidos não equivalem a correções de implementação ou aprovação das tentativas anteriores.`,
  '', '## Q. Hashes/cleanup/remoto','',...Object.entries(result.hashes).map(([file,sha])=>`- ${file}: \`${sha}\``),
  '', `Cleanup: ${result.cleanup.completed?'concluído':'pendente'}; A/B preservados: ${Boolean(result.cleanup.preservedA_B)}; zero operações remotas e zero requests a providers.`,
  ...(result.sourceAudit?.ignoredArtifactDrift?[`Drift fora do escopo: \`${result.sourceAudit.ignoredArtifactDrift.file}\` mudou de ${result.sourceAudit.ignoredArtifactDrift.priorBytes} para ${result.sourceAudit.ignoredArtifactDrift.currentBytes} bytes (${result.sourceAudit.ignoredArtifactDrift.cacheVersion}); o cache foi preservado para análise, sem restauração nem exceção à allowlist.`]:[]),
  'Resolução/download de dependências npm/Deno fixadas ocorre fora do projeto; isso não constitui consulta/deploy/mutação em Supabase remoto, Vercel ou Push provider.',
  'Sem db push, repair, CONTRACT, deploy, commit, push, PR, merge, Vercel Preview ou teste manual.',
  '', '## R. Veredito','',`**${result.verdict}**`,'',
  ...(result.blockers.length?['Pendências/falhas: '+result.blockers.join('; ')+'.']:['Toda cobertura obrigatória registrada passou; o resultado segue para auditoria externa, sem autorização de rollout.'])]
 return lines.join('\n')+'\n'
}

const [mode,...args]=process.argv.slice(2)
if(mode==='--collect'){
 assert.equal(args.length,1,'--collect requires one owned C context')
 const c=actionsContext(args[0]),root=c.context.root
 const manifest=read(path.join(root,'actions-third-stages.json'));assert.ok(Array.isArray(manifest.stages))
 const records=new Map()
 for(const record of manifest.stages){assert.ok(requiredStages.includes(record.stage)||setupStages.includes(record.stage),'unknown stage id');assert.ok(!records.has(record.stage),'duplicate stage evidence');records.set(record.stage,record)}
 const stages=requiredStages.map((name)=>{
  const record=records.get(name),evidence=stageEvidence(root,record?.evidence)
  const status=record?.status==='passed'&&record.exit_code===0&&evidence?'passed':record?.status==='failed'?'failed':'blocked'
  return {stage:name,status,exit_code:record?.exit_code??null,elapsed_ms:record?.elapsed_ms??null,
   evidence:record?.evidence??null,evidencePresent:Boolean(evidence),details:sanitize(record?.details??null)}
 })
 const evidenceFor=(name,fallback)=>{
  const file=stageEvidence(root,records.get(name)?.evidence??fallback)
  return file?.endsWith('.json')?sanitize(read(file)):optional(root,fallback)
 }
 const dbLint={before:evidenceFor('db-lint-before','actions-third-db-lint-before.json'),after:evidenceFor('db-lint-after','actions-third-db-lint-after.json')}
 const recordedSourceAudit=stageEvidence(root,records.get('source-audit')?.evidence??'actions-source-audit-result.json')
 const sourceAuditFile=recordedSourceAudit?.endsWith('.json')?recordedSourceAudit:
  stageEvidence(root,'actions-source-audit-result.json')
 const sourceAudit=sourceAuditFile?read(sourceAuditFile):null,performance=optional(root,'actions-performance-result.json')
 if(sourceAudit)assert.deepEqual(sourceAudit.hashes,historicalHashes,'source audit must belong to the current C hash')
 const regressions=optional(root,'actions-regressions-result.json'),edgeResults=optional(root,'actions-edge-result.json')
 const leaseDiagnostic=optional(root,'actions-lease-diagnostic.json')
 const bSqlDiagnostic=optional(root,'actions-b-sql-diagnostic.json')
 const regressionContinuation=optional(root,'actions-regressions-third-complete-result.json')
 const regressionStages=regressionPlan.map((stage)=>{
  const executed=(regressionContinuation??regressions)?.results?.find((entry)=>entry.stage===stage)
  return {stage,status:executed?(executed.passed?'passed':'failed'):'blocked',elapsed_ms:executed?.elapsed_ms??null,
   exit_code:executed?.exit_code??null,authProfilesBaselineRestored:executed?.exact_A_B_auth_profiles_restored??null}
 })
 const quickResults=optional(root,'actions-third-quick-results.json'),senderSmoke=optional(root,'actions-sender-smoke-result.json')
 const harnessAttempts=sanitize(manifest.attempts??[])
 assert.ok(Array.isArray(harnessAttempts),'harness attempts must remain an explicit history, separate from mandatory stages')
 const harnessDiagnoses={dataApi:optional(root,'actions-data-api-harness-diagnosis.json'),
  timeout:optional(root,'actions-timeout-baseline.json'),pushPrivileges:optional(root,'actions-push-fixture-privilege-baseline.json')}
 const partialEdgeAttempts=[1,2].map((attempt)=>({attempt,evidence:optional(root,`actions-edge-harness-attempt-${attempt}.json`)})).filter((entry)=>entry.evidence)
 const sql=labels(root,'actions-sql.log'),dataApi=labels(root,'actions-data-api.log'),edge=labels(root,'actions-edge.log')
 const blockers=stages.filter((entry)=>entry.status!=='passed').map((entry)=>`${entry.stage}: ${entry.status}`)
 if(!sql.complete)blockers.push('SQL C did not reach its completion marker')
 if(!performance?.matrixComplete||!performance.fixtureCleanupCompleted)blockers.push('C SQL performance/cleanup evidence incomplete')
 if(regressions?.passed!==true)blockers.push('complete A/B regressions not approved')
 if(regressionContinuation?.originalFailureResolved===false)blockers.push('original B SQL assertion failure was not reproduced but its cause remains unresolved')
 if(sourceAudit?.passed!==true)blockers.push('source preservation evidence incomplete')
 for(const phase of ['before','after'])if(dbLint[phase]?.passed!==true||dbLint[phase]?.counts?.ERROR!==0)blockers.push(`db lint ${phase} failed or missing`)
 const tables=['auth.users','public.usuarios','public.treinos','public.exercicios','public.secoes_treino','public.treinos_exercicios','public.treino_sessoes',
  'public.treino_sessao_series','public.historico_treinos','public.historico_exercicios',
  'public.push_subscriptions','gymio_workout_push_private.outbox','gymio_workout_push_private.deliveries','gymio_workout_actions_private.generations','gymio_workout_actions_private.capabilities']
 const fixtureCounts={}
 for(const table of tables)fixtureCounts[table]=c.sql(`select to_regclass(${c.literal(table)})is not null;`)==='t'?Number(c.sql(`begin read only;select count(*)from ${table};commit;`)):null
 if(fixtureCounts['auth.users']!==2||fixtureCounts['public.usuarios']!==2||tables.slice(2).some((table)=>fixtureCounts[table]!==0))blockers.push('final isolated fixture baseline not restored')
 const globalJobInactive=c.sql('select count(*)from cron.job where active;')==='0'
 if(!globalJobInactive)blockers.push('an administrative cron remains active')
 const resources=read(path.join(root,'created-resources.json'))
 const ids=execFileSync('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${c.context.project}`,'--format','{{.ID}}'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
 const owned=ids.map((id)=>{
  const container=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8'}))[0]
  assert.equal(container.Config.Labels['com.supabase.cli.project'],c.context.project);assert.equal(fs.realpathSync(container.Config.Labels['com.supabase.cli.workdir']),root)
  return {id:container.Id,name:container.Name,image:container.Config.Image,imageId:container.Image,
   mounts:container.Mounts.map(({Type:type,Name:name,Destination:destination})=>({type,name,destination})),networks:Object.keys(container.NetworkSettings.Networks)}
 })
 const result={phase:'Gym.io V3.2-C third fresh matrix',createdAt:new Date().toISOString(),project:c.context.project,runtimeRoot:root,
  ports:{api:55451,db:55452,shadow:55450},hashes:historicalHashes,
  cLineage:{original:'8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42',syntaxFix:'a643da0340c8b2a84c5a2a715184cedf45b6b403e789fd91858dd08f18925820'},
  versions:{node:process.version,supabaseCLI:'2.120.0',postgres:c.sql('select version();'),postgresImage:'public.ecr.aws/supabase/postgres:17.6.1.113',
   extensions:c.value("begin read only;select jsonb_object_agg(extname,extversion)from pg_extension where extname in('pg_cron','pg_net','supabase_vault');commit;"),
   edgeRuntime:edgeResults?.runtime??edgeResults?.groups?.find((group)=>group.runtime)?.runtime??null,
   denoCompiler:quickResults?.['deno-frozen']?.version??null,supabaseJs:'2.106.0',webPush:'3.6.7',fakeIndexedDB:'6.2.5'},
  stages,setupStages:setupStages.filter((name)=>records.has(name)).map((name)=>sanitize(records.get(name))),
  sql,dataApi,edge,edgeResults,regressions,regressionStages,regressionContinuation,leaseDiagnostic,bSqlDiagnostic,performance,dbLint,sourceAudit,quickResults,senderSmoke,
  bPerformance:optional(root,'workout-performance.json'),scheduler:optional(root,'scheduler-spike-result.json'),dispatch:optional(root,'workout-dispatch-result.json'),
  credentialRefresh:optional(root,'actions-credentials-refresh.json'),
  harnessAttempts,harnessDiagnoses,partialEdgeAttempts,
  extensionBefore:optional(root,'extension-result.json'),extensionAfter:optional(root,'actions-extension-after-c.json'),
  fixtureCounts,globalJobInactive,users:c.users.map(({id,email})=>({id,email})),resources,ownedAtCollect:owned,
  scope:{remoteOperations:0,providerRequests:0,productionSourceChanges:false,authHistoricalExecuted:false,contractExecuted:false,
   commitPushPRMerge:false,manualTestStarted:false,rollout:false,
   dependencyResolution:'Pinned npm/Deno dependency resolution outside the project; no production-service operation or project dependency installation'},
  blockers,coverageApproved:blockers.length===0,cleanup:{completed:false,preservedA_B:null}}
 assertActionsHistory();write(path.join(root,'actions-third-collection.json'),result)
 console.log(`C third evidence collected: ${stages.filter((entry)=>entry.status==='passed').length}/${requiredStages.length} mandatory stages passed; ${blockers.length} blockers; cleanup pending`)
}else if(mode==='--finalize'){
 assert.equal(args.length,2,'--finalize requires copied collection JSON and cleanup JSON')
 assertActionsHistory()
 const result=read(args[0]),cleanup=read(args[1])
 assert.equal(result.project,'gymio-workout-actions-local');assert.deepEqual(result.hashes,historicalHashes)
 assert.equal(cleanup.project,result.project);assert.equal(cleanup.runtimeRoot,result.runtimeRoot)
 assert.equal(cleanup.completed,true);assert.equal(cleanup.preservedA_B,true);assert.equal(cleanup.noPrune,true)
 for(const kind of ['containers','volumes','network','runtime'])assert.equal(cleanup.removed[kind],true,`cleanup ${kind} must be confirmed`)
 const expected=result.ownedAtCollect.map((entry)=>entry.id).sort()
 assert.deepEqual([...cleanup.removedContainerIds].sort(),expected,'remove exactly the owned C containers')
 result.cleanup={...sanitize(cleanup),removedContainerIds:[...cleanup.removedContainerIds]};result.finalizedAt=new Date().toISOString()
 result.verdict=result.coverageApproved?'V3.2-C TEST MATRIX APROVADA':'V3.2-C TEST MATRIX REPROVADA'
 write('supabase/testing/actions-third-test-matrix-result.json',result)
 fs.writeFileSync('supabase/testing/WORKOUT_ACTIONS_TEST_MATRIX_THIRD.md',render(result),{flag:'wx'})
 console.log(result.verdict)
}else throw Error('explicit --collect or --finalize required; no matrix starts automatically')

// Closure evidence only. It never starts tests, services, jobs or transports.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {actionsContext,assertActionsHistory,historicalHashes} from './actions-context.mjs'

const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const expectedStages=['A ready','A spike','A sql','A data-api','A edge','B SQL','B Data API','B Edge',
 'B performance','B scheduler','install sender test transport','B dispatch']
const thirdFile='supabase/testing/actions-third-test-matrix-result.json'
const [mode,...args]=process.argv.slice(2)
if(mode==='--collect'){
 assert.equal(args.length,1)
 const c=actionsContext(args[0]),root=c.context.root
 const third=read(thirdFile),original=read(path.join(root,'actions-regressions-result.json'))
 const source=read('supabase/testing/actions-closure-source-audit-result.json')
 const lintFile=path.join(root,'actions-third-db-lint-after.json')
 const lint=fs.existsSync(lintFile)?read(lintFile):null
 assert.deepEqual(third.hashes,historicalHashes)
 assert.deepEqual(third.stages.filter(row=>row.status!=='passed').map(row=>row.stage).sort(),['regressions-A-B','source-audit'])
 const reusedStages=['sender-smoke','application','extension-before','extension-after','sql-C','data-api-C','edge-C',
  'idb-C','idb-B','npmtest','build','deno-frozen','performance']
 const functionalEvidence=Object.fromEntries(reusedStages.map(name=>[name,third.stages.find(row=>row.stage===name)?.status==='passed']))
 assert.ok(Object.values(functionalEvidence).every(Boolean),'third functional evidence must remain approved')
 assert.equal(third.sql.complete,true)
 assert.equal(third.cleanup.completed,true)
 const blockers=[]
 if(original.passed!==true||original.execution!=='original 12 stages in one continuous invocation'||
  JSON.stringify(original.results.map(row=>row.stage))!==JSON.stringify(expectedStages)||
  !original.results.every(row=>row.passed&&row.exit_code===0&&!row.timed_out&&row.termination_reason==='completed'))
  blockers.push('original continuous A/B regression gate failed or incomplete')
 if(original.final_baseline?.passed!==true)blockers.push('original regression final baseline failed')
 if(source.passed!==true||source.production.byteExactPreserved!==true||source.negativeFixtures.length!==3||
  !source.negativeFixtures.every(row=>row.rejected&&row.memoryOnly&&!row.actualFilesModified))blockers.push('closure source audit failed')
 if(!lint?.passed||lint.counts.ERROR!==0)blockers.push('closure db lint failed or missing')
 const tables=['auth.users','public.usuarios','public.treinos','public.exercicios','public.secoes_treino','public.treinos_exercicios',
  'public.treino_sessoes','public.treino_sessao_series','public.historico_treinos','public.historico_exercicios',
  'public.push_subscriptions','gymio_workout_push_private.outbox','gymio_workout_push_private.deliveries',
  'gymio_workout_actions_private.generations','gymio_workout_actions_private.capabilities']
 const counts={}
 for(const table of tables)counts[table]=Number(c.sql(`begin read only;select count(*)from ${table};commit;`))
 if(counts['auth.users']!==2||counts['public.usuarios']!==2||tables.slice(2).some(table=>counts[table]!==0))
  blockers.push('closure fixture baseline not restored')
 const jobs=c.value("begin read only;select jsonb_build_object('active',(select count(*)from cron.job where active),'global_job_inactive',(select not active from cron.job where jobname='gymio-workout-push'),'c_jobs',(select count(*)from cron.job where jobname like '%workout-actions%' or command like '%gymio_workout_actions_private%'));commit;")
 if(jobs.active!==0||jobs.global_job_inactive!==true||jobs.c_jobs!==0)blockers.push('unexpected final job state')
 const ids=execFileSync('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${c.context.project}`,'--format','{{.ID}}'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
 const owned=ids.map(id=>{
  const container=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8'}))[0]
  assert.equal(container.Config.Labels['com.supabase.cli.project'],c.context.project)
  assert.equal(fs.realpathSync(container.Config.Labels['com.supabase.cli.workdir']),root)
  return {id:container.Id,name:container.Name,image:container.Config.Image,imageId:container.Image,
   volumes:container.Mounts.filter(m=>m.Type==='volume').map(m=>m.Name),networks:Object.keys(container.NetworkSettings.Networks)}
 })
 const versions={node:process.version,supabaseCLI:'2.120.0',postgresImage:'public.ecr.aws/supabase/postgres:17.6.1.113',
  postgres:c.sql('begin read only;select version();commit;'),extensions:c.value("begin read only;select jsonb_object_agg(extname,extversion)from pg_extension where extname in('pg_cron','pg_net','supabase_vault');commit;")}
 const result={phase:'V3.2-C MATRIX CLOSURE GATE',collectedAt:new Date().toISOString(),project:c.context.project,runtimeRoot:root,
  ports:{api:55451,db:55452,shadow:55450},hashes:historicalHashes,versions,ownedAtCollect:owned,
  createdResources:read(path.join(root,'created-resources.json')),runtime:read(path.join(root,'actions-closure-runtime-result.json')),
  thirdEvidence:{file:thirdFile,sha256:sha(thirdFile),functionalEvidence,sqlGroups:third.sql.passLabels.length,edgeGroups:third.edgeResults.groups.length,
   sourceUnmodifiedSinceThird:true,fullCMatrixRepeated:false,originalVerdict:third.verdict,originalReportPreserved:true},
  originalRegression:original,runnerDiagnosis:read('supabase/testing/actions-closure-runner-diagnosis.json'),
  sourceAudit:source,cliStateProof:read('supabase/testing/actions-closure-cli-state-proof.json'),dbLint:lint,
  extensionGate:read(path.join(root,'extension-result.json')),scheduler:fs.existsSync(path.join(root,'scheduler-spike-result.json'))?read(path.join(root,'scheduler-spike-result.json')):null,
  bPerformance:fs.existsSync(path.join(root,'workout-performance.json'))?read(path.join(root,'workout-performance.json')):null,
  dispatch:fs.existsSync(path.join(root,'workout-dispatch-result.json'))?read(path.join(root,'workout-dispatch-result.json')):null,
  counts,jobs,blockers,gatesPassed:blockers.length===0,
  scope:{productionCodeChanged:false,remoteSupabaseOperations:0,vercelOperations:0,realProviderRequests:0,
   authHistoricalExecuted:false,contractExecuted:false,commitPushPRMerge:false,manualTestStarted:false,rollout:false,
   cliUpdateNotifierDisabled:true,originalTestBodiesAndAssertionsUnmodified:true},cleanup:{completed:false}}
 assertActionsHistory();write(path.join(root,'actions-closure-evidence.json'),result)
 for(const [from,to]of [['actions-regressions-result.json','actions-closure-regressions-result.json'],
  ['actions-closure-runtime-result.json','actions-closure-runtime-result.json']])
  fs.copyFileSync(path.join(root,from),path.join('supabase/testing',to),fs.constants.COPYFILE_EXCL)
 if(lint)fs.copyFileSync(lintFile,'supabase/testing/actions-closure-db-lint-result.json',fs.constants.COPYFILE_EXCL)
 console.log(`Closure evidence collected; ${blockers.length} gate blockers; physical cleanup pending.`)
}else if(mode==='--finalize'){
 assert.equal(args.length,2);assertActionsHistory()
 const result=read(args[0]),cleanup=read(args[1])
 assert.deepEqual(result.hashes,historicalHashes)
 assert.equal(result.project,'gymio-workout-actions-local');assert.equal(cleanup.project,result.project)
 assert.equal(cleanup.runtimeRoot,result.runtimeRoot);assert.equal(cleanup.completed,true);assert.equal(cleanup.preservedA_B,true)
 assert.equal(cleanup.noPrune,true)
 for(const kind of ['containers','volumes','network','runtime'])assert.equal(cleanup.removed[kind],true)
 assert.deepEqual([...cleanup.removedContainerIds].sort(),result.ownedAtCollect.map(row=>row.id).sort())
 result.cleanup=cleanup;result.finalizedAt=new Date().toISOString()
 result.verdict=result.gatesPassed?'V3.2-C TEST MATRIX APROVADA':'V3.2-C TEST MATRIX REPROVADA'
 write('supabase/testing/actions-closure-test-matrix-result.json',result)
 const lines=['# Gym.io V3.2-C — Matrix Closure Gate','',`**${result.verdict}**`,'',
  'A decisão combina a evidência funcional da terceira matriz, preservada sem alterações, com o closure gate A/B original e a auditoria de fontes. Não constitui rollout.',
  '', '## Runner e execução original','',
  `Resultado: ${result.originalRegression.passed?'A/B ORIGINAL REGRESSION GATE PASS':'FAIL'}. Execução: ${result.originalRegression.execution}.`,
  'Nos runners inspecionados, não havia limite global ou por etapa de 300000 ms. Limites históricos externos não foram preservados. A falha histórica foi uma assertion com exit 1 em aproximadamente 241794 ms; sua causa não pode ser recuperada retroativamente e não foi atribuída a timeout.',
  'Não foi acrescentado ou aumentado timeout. Cada etapa preserva comando lógico, cwd/environment, início/fim, duração, exit, timeout, sinal/motivo e stdout/stderr sanitizados.',
  '', '| Etapa | Resultado | ms | Exit | Timeout | Término |','|---|---|---:|---:|---|---|',
  ...result.originalRegression.results.map(row=>`| ${row.stage} | ${row.passed?'PASS':'FAIL'} | ${row.elapsed_ms??''} | ${row.exit_code??''} | ${row.timed_out} | ${row.termination_reason??''} |`),
  '', `Baseline final: \`${JSON.stringify(result.originalRegression.final_baseline)}\`.`,
  'Corpos e assertions A/B MJS/Edge byte-idênticos; adapters limitados ao contexto local e ao import do repository B aprovado. Nenhum complemento ou retry foi usado neste closure.',
  '', '## Source audit e estado gerado','',
  `Source audit: ${result.sourceAudit.passed?'PASS':'FAIL'}; ${result.sourceAudit.production.verifiedFiles} arquivos de produção/suporte byte-idênticos à terceira matriz. HEAD mantém exatamente os nove diffs anteriores revisados.`,
  'Categorias: PROTECTED SOURCE; AUTHORIZED TEST/HARNESS CHANGES; GENERATED TOOL/RUNTIME STATE. Paths autorizados são uma lista explícita, sem wildcard.',
  '`supabase/.temp/cli-latest` é classificado exclusivamente como GENERATED SUPABASE CLI STATE: oito bytes, v2.120.0, sem secret, migration ou consumidor na aplicação. Writer comprovado no binário instalado; a invocação histórica exata permanece inferência, pois não há trace de processo.',
  'A mudança histórica 0 → 8 bytes permanece registrada. Nenhuma allowlist supabase/.temp/* foi criada. SUPABASE_NO_UPDATE_NOTIFIER=1 é process-local e evita cache/network do notifier; CLI cwd usa o runtime temporário.',
  `Fixtures negativas em memória: \`${JSON.stringify(result.sourceAudit.negativeFixtures)}\`.`,
  '', '## Runtime, lint e evidência reutilizada','',
  `Runtime novo: \`${result.runtimeRoot}\`; projeto \`${result.project}\`; API 55451, DB 55452, shadow 55450.`,
  `Versões: \`${JSON.stringify(result.versions)}\`. Digests das imagens estão registrados na evidência JSON.`,
  'Bootstrap: fixture → EXPAND → Memory → A → B → Extension Gate → C atual intacta. Auth histórico e CONTRACT não executados.',
  'C foi conferida por suas assertions e smoke de catálogo. Atomicidade/UID/concurrency/Edge C/IndexedDB completos não foram repetidos.',
  'O destino do dispatcher permaneceu ausente até o stage original de instalação do transporte falso. Token de máquina ficou apenas em runtime/Vault e header dedicado.',
  `db lint: \`${JSON.stringify(result.dbLint?.counts??null)}\`.`,
  ...(result.dbLint?.diagnostics??[]).map(row=>`- ${row.level}: ${row.function} — ${row.message}`),
  '', 'O WARN de gymio_workout_actions_private.issue, target type is different type than source type, fica para hardening/avaliação posterior. Não foi corrigido nesta tarefa.',
  `Terceira matriz reutilizada: ${result.thirdEvidence.sqlGroups} grupos SQL C e ${result.thirdEvidence.edgeGroups} grupos Edge C; demais etapas funcionais aprovadas constam da evidência original imutável.`,
  `Contagens finais: \`${JSON.stringify(result.counts)}\`. Jobs finais: \`${JSON.stringify(result.jobs)}\`.`,
  '', '## Hashes e cleanup','',...Object.entries(result.hashes).map(([file,hash])=>`- ${file}: \`${hash}\``),
  '', 'Closure containers/volumes/rede/root removidos após verificação de owner, project, caminho e IDs. A/B preservados; sem prune.',
  ...(cleanup.dockerDaemonRestartedAfterGates?['Após os gates aprovados, o collector encontrou o daemon Docker indisponível. Docker Desktop foi reaberto apenas para coleta e cleanup; nenhum teste foi repetido.']:[]),
  'Zero operações Supabase remoto/Vercel/Push provider, deploy, db push, repair, commit/push/PR/merge. Nenhum teste manual, rollout ou Preview iniciado.',
  '', '## Veredito','',`**${result.verdict}**`,'',
  ...(result.blockers.length?result.blockers.map(reason=>`- ${reason}`):['Os dois gates pendentes foram fechados pelo resultado contínuo A/B original e pela auditoria fail-closed das fontes, com seis hashes preservados e db lint sem ERROR.'])]
 fs.writeFileSync('supabase/testing/WORKOUT_ACTIONS_MATRIX_CLOSURE_GATE.md',lines.join('\n')+'\n',{flag:'wx'})
 console.log(result.verdict)
}else throw Error('explicit --collect or --finalize required; tests never start automatically')

// Closure-only filesystem/Git gate. No Docker, SQL, network or production edit.
// All paths are protected unless named explicitly below; no wildcard exception.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assertActionsHistory,historicalHashes} from './actions-context.mjs'

const thirdBaselinePath='supabase/testing/actions-third-inventory-after.json'
const closureBaselinePath='supabase/testing/actions-closure-inventory-before.json'
const cliProofPath='supabase/testing/actions-closure-cli-state-proof.json'
const outputPath='supabase/testing/actions-closure-source-audit-result.json'
const generatedPath='supabase/.temp/cli-latest'
const authorizedPaths=new Set([
 'supabase/testing/actions-reexecution-setup.mjs',
 'supabase/testing/actions-third-matrix-db-lint.mjs',
 'supabase/testing/actions-reexecution-regressions.mjs',
 'supabase/testing/actions-regression-observer.mjs',
 'supabase/testing/actions-regression-observer.test.mjs',
 'supabase/testing/actions-closure-inventory-before.json',
 'supabase/testing/actions-closure-inventory-after.json',
 'supabase/testing/actions-closure-source-audit.mjs',
 'supabase/testing/actions-closure-source-audit-result.json',
 'supabase/testing/actions-closure-cli-state-proof.json',
 'supabase/testing/actions-closure-runner-diagnosis.json',
 'supabase/testing/actions-closure-regressions-result.json',
 'supabase/testing/actions-closure-runtime-result.json',
 'supabase/testing/actions-closure-db-lint-result.json',
 'supabase/testing/actions-closure-cleanup-result.json',
 'supabase/testing/actions-closure-test-matrix-result.json',
 'supabase/testing/actions-closure-evidence.mjs',
 'supabase/testing/actions-closure-evidence.json',
 'supabase/testing/WORKOUT_ACTIONS_MATRIX_CLOSURE_GATE.md',
])
const trackedChangesFromHead=new Set([
 'supabase/migrations/20261011021351_workout_notification_actions.sql',
 'supabase/testing/actions-context.mjs',
 'supabase/testing/actions-data-api.mjs',
 'supabase/testing/actions-edge-fixture.sql',
 'supabase/testing/actions-edge-integration/index.ts',
 'supabase/testing/actions-edge-tests.mjs',
 'supabase/testing/actions-fixture.mjs',
 'supabase/testing/actions-indexeddb.mjs',
 'supabase/testing/actions-local-tests.mjs',
])
const category=(file)=>file===generatedPath?'GENERATED SUPABASE CLI STATE':
 authorizedPaths.has(file)?'AUTHORIZED TEST/HARNESS CHANGES':'PROTECTED SOURCE'
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex')
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{encoding:null,stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024})
const workspace=fs.realpathSync(process.cwd())
function resolve(file){
 assert.ok(typeof file==='string'&&!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'),'contained relative inventory path required')
 const absolute=path.resolve(workspace,file),relative=path.relative(workspace,absolute)
 assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'inventory path escapes workspace')
 return absolute
}
function validateCliProof(proof,current){
 assert.equal(proof.passed,true,'generated state requires proven CLI attribution')
 assert.equal(proof.path,generatedPath);assert.equal(proof.producerVersion,'2.120.0')
 for(const flag of ['versionOnlyCurrent','approvedExactPathClassification'])assert.equal(proof[flag],true,`generated state proof missing ${flag}`)
 for(const flag of ['notMigration','noSecrets','notConsumedByApplication','doesNotContainRuntimeConfiguration'])
  assert.equal(proof.facts?.[flag],true,`generated state proof missing fact ${flag}`)
 assert.ok(current[generatedPath],'the one proven generated state path must exist')
 const text=fs.readFileSync(resolve(generatedPath),'utf8')
 assert.ok(/^(?:v)?2\.120\.0(?:\r?\n)?$/.test(text),'cli-latest must contain only the pinned CLI version')
 assert.equal(proof.current?.sha256,current[generatedPath].sha256,'generated state proof must bind the current bytes')
 return {path:generatedPath,classification:'GENERATED SUPABASE CLI STATE',producerVersion:'2.120.0',
  value:text.replace(/\r?\n$/,''),bytes:Buffer.byteLength(text),sha256:hash(Buffer.from(text)),notMigration:true,
  noSecrets:true,notConsumedByApplication:true,doesNotContainRuntimeConfiguration:true}
}
function validateInventory(baseline,current){
 for(const [file,expected]of Object.entries(historicalHashes)){
  const source=`supabase/migrations/${file}`
  assert.equal(current[source]?.sha256,expected,`frozen migration hash drift: ${source}`)
 }
 const changes=[],added=[]
 for(const [file,entry]of Object.entries(baseline)){
  assert.ok(current[file],`removed inventoried path: ${file}`)
  if(current[file].sha256!==entry.sha256){
   assert.ok(authorizedPaths.has(file)||file===generatedPath,`protected source drift: ${file}`)
   changes.push({path:file,category:category(file),before:entry.sha256,after:current[file].sha256})
  }
 }
 for(const file of Object.keys(current))if(!(file in baseline)){
  assert.ok(authorizedPaths.has(file)||file===generatedPath,`unauthorized new path: ${file}`)
  added.push({path:file,category:category(file),sha256:current[file].sha256})
 }
 return {changes,added}
}
const options=process.argv.slice(2)
assert.ok(options.length===0||(options.length===1&&options[0]==='--check-only'),'only optional --check-only is accepted')
assertActionsHistory()
const third=read(thirdBaselinePath),closure=read(closureBaselinePath),proof=read(cliProofPath)
const head=git('rev-parse','HEAD').toString('utf8').trim(),branch=git('branch','--show-current').toString('utf8').trim()
assert.equal(head,third.head);assert.equal(head,closure.head);assert.equal(branch,'gym.io-v3.2');assert.equal(branch,third.branch);assert.equal(branch,closure.branch)
assert.equal(hash(fs.readFileSync(thirdBaselinePath)),closure.files[thirdBaselinePath]?.sha256,'third after-inventory is immutable')
const files=execFileSync('rg',['--files','--hidden','--no-ignore','-g','!.git','-g','!node_modules','-g','!dist'],
 {encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024}).trim().split(/\r?\n/).filter(Boolean).map((file)=>file.replaceAll('\\','/')).sort()
const current=Object.fromEntries(files.map((file)=>{
 const bytes=fs.readFileSync(resolve(file));return [file,{bytes:bytes.length,sha256:hash(bytes)}]
}))
const generated=validateCliProof(proof,current)
// Both manifests deliberately exclude their own file; anchor each to the actual
// immutable third baseline or the explicitly authorized closure evidence path.
const thirdFiles={...third.files,[thirdBaselinePath]:closure.files[thirdBaselinePath]}
const thirdComparison=validateInventory(thirdFiles,current)
const closureComparison=validateInventory(closure.files,current)
const negatives=[]
for(const [name,mutation,pattern]of [
 ['protected source alteration',(map)=>{map['public/push-sw.js']={...map['public/push-sw.js'],sha256:'0'.repeat(64)}},/protected source drift: public\/push-sw\.js/],
 ['frozen C hash alteration',(map)=>{map['supabase/migrations/20261011021351_workout_notification_actions.sql']={sha256:'0'.repeat(64),bytes:0}},/frozen migration hash drift/],
 ['unapproved new path',(map)=>{map['supabase/testing/actions-closure-unauthorized-probe.mjs']={sha256:'0'.repeat(64),bytes:0}},/unauthorized new path/],
]){
 const simulated=structuredClone(current);mutation(simulated)
 assert.throws(()=>validateInventory(thirdFiles,simulated),pattern,`negative fixture must fail: ${name}`)
 negatives.push({name,rejected:true,memoryOnly:true,actualFilesModified:false})
}
const tree=git('ls-tree','-rz','--full-tree','HEAD').toString('utf8').split('\0').filter(Boolean)
const actualTrackedChanges=[],lineEndingOnly=[]
for(const row of tree){
 const split=row.indexOf('\t'),[mode,type,object]=row.slice(0,split).split(' '),file=row.slice(split+1)
 assert.equal(type,'blob','unexpected Git submodule/tree in source audit')
 const original=git('cat-file','blob',object),actual=fs.readFileSync(resolve(file))
 if(actual.equals(original))continue
 if(!actual.includes(0)&&!original.includes(0)&&actual.toString('latin1').replace(/\r\n/g,'\n')===original.toString('latin1').replace(/\r\n/g,'\n')){
  lineEndingOnly.push(file);continue
 }
 assert.ok(trackedChangesFromHead.has(file),`unexpected tracked content drift: ${file}`)
 actualTrackedChanges.push(file)
}
assert.deepEqual(actualTrackedChanges.sort(),[...trackedChangesFromHead].sort(),'tracked HEAD content differences must remain exactly the nine reviewed paths')
const production=(file)=>file.startsWith('src/')||file.startsWith('public/')||file.startsWith('supabase/functions/')||
 ['.env','.env.push.local','.gitignore','supabase/config.toml','vite.config.js','package.json','package-lock.json',
  'supabase/testing/legacy-baseline.sql','supabase/testing/seed-manual-workout.mjs'].includes(file)||file.startsWith('supabase/migrations/')
const productionFiles=Object.keys(thirdFiles).filter(production)
assert.ok(productionFiles.every((file)=>current[file]?.sha256===thirdFiles[file].sha256),'zero production changes since third matrix required')
const counts={'PROTECTED SOURCE':0,'AUTHORIZED TEST/HARNESS CHANGES':0,'GENERATED SUPABASE CLI STATE':0}
for(const file of Object.keys(current))counts[category(file)]++
assertActionsHistory()
const result={passed:true,head,branch,baselines:{third:thirdBaselinePath,closure:closureBaselinePath,thirdImmutable:true},
 hashes:historicalHashes,files:Object.keys(current).length,categoryCounts:counts,
 exactAuthorizedPaths:[...authorizedPaths].sort(),generatedState:generated,thirdComparison,closureComparison,
 tracked:{files:tree.length,exactContentDifferences:actualTrackedChanges,crlfOnlyDifferences:lineEndingOnly,
  normalized:'CRLF to LF only for nonbinary Git blobs; comparison against third baseline remains byte-exact'},
 production:{verifiedFiles:productionFiles.length,byteExactPreserved:true,frontend:true,serviceWorker:true,edgeFunctions:true,
  frozenMigrations:true,ignoredEnvironmentFiles:true,manualFixture:true},negativeFixtures:negatives,
 originalThirdReportsPreserved:true,dockerOperations:0,sqlOperations:0,networkOperations:0}
if(!options.length)fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(`PASS closure source audit: ${productionFiles.length} production/support files byte-exact; exactly nine reviewed HEAD differences; one proven CLI-generated path; three in-memory negatives rejected`)

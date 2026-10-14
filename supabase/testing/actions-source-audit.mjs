// Filesystem/Git evidence only. Never opens Docker, SQL, Auth or a network target.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import {syncBuiltinESMExports} from 'node:module'
import {createHash} from 'node:crypto'
import {actionsContext,assertActionsHistory,historicalHashes} from './actions-context.mjs'

const [contextFile,...options]=process.argv.slice(2)
assert.ok(options.length===0||(options.length===2&&options[0]==='--baseline'),'only optional --baseline <file> is accepted')
const baselineFile=options.length===2?options[1]:'supabase/testing/actions-reexecution-inventory-before.json'
assert.ok(/^supabase[\\/]testing[\\/]actions-[a-z0-9-]+-before\.json$/.test(baselineFile),'baseline must be a C inventory artifact in supabase/testing')
assert.ok(contextFile,'owned C runtime context file required')
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const context=read(contextFile),workspace=fs.realpathSync(process.cwd())
assert.equal(context.project,'gymio-workout-actions-local');assert.equal(context.port,'55451')
const root=fs.realpathSync(context.root)
assert.ok(/^gymio-workout-actions-[a-f0-9]{32}$/.test(path.basename(root)))
const temporaryRoots=[os.tmpdir(),path.join(os.homedir(),'AppData','Local','Temp')].filter((folder)=>fs.existsSync(folder)).map((folder)=>fs.realpathSync(folder))
assert.ok(temporaryRoots.some((folder)=>{const relative=path.relative(folder,root);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)}),'C runtime must be inside an expected temporary directory')
assert.equal(fs.readFileSync(path.join(root,'.owner'),'utf8').trim(),context.project)
const baseline=read(baselineFile)
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex')
const git=(...args)=>childProcess.execFileSync('git',['--no-optional-locks',...args],{encoding:null,stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024})
const head=git('rev-parse','HEAD').toString('utf8').trim(),branch=git('branch','--show-current').toString('utf8').trim()
assert.equal(head,baseline.head,'HEAD must remain unchanged; no commit or restoration')
assert.equal(branch,baseline.branch);assert.equal(branch,'gym.io-v3.2')
const migrationPath='supabase/migrations/20261011021351_workout_notification_actions.sql'
const allowed=(file)=>file===migrationPath||/^supabase\/testing\/actions-[a-z0-9-]+\.(mjs|js|json|sql)$/.test(file)||
 file==='supabase/testing/actions-edge-integration/index.ts'||file==='supabase/testing/run-workout-actions-matrix.ps1'||
 /^supabase\/testing\/WORKOUT_ACTIONS_[A-Z_]+\.md$/.test(file)||file==='supabase/testing/WORKOUT_NOTIFICATION_ACTIONS.md'
const resolve=(relative)=>{
 assert.ok(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'),'inventory path must be relative and contained')
 const absolute=path.resolve(workspace,relative),contained=path.relative(workspace,absolute)
 assert.ok(contained&&!contained.startsWith('..')&&!path.isAbsolute(contained),'inventory path cannot escape the workspace')
 return absolute
}
const secretFile=(file)=>/(^|\/)\.env(?:\.|$)/.test(file)
const inventory={},changed=[],removed=[],added=[],protectedEvidence=[]
for(const [file,previous]of Object.entries(baseline.files)) {
 const absolute=resolve(file)
 if(!fs.existsSync(absolute)){removed.push(file);continue}
 const bytes=fs.readFileSync(absolute),sha256=hash(bytes),same=sha256===previous.sha256
 inventory[file]={bytes:bytes.length,...(secretFile(file)?{preserved:same}:{sha256})}
 if(!same)changed.push(file)
 if(secretFile(file)||['.gitignore','supabase/functions/deno.lock','supabase/testing/legacy-baseline.sql','supabase/testing/seed-manual-workout.mjs'].includes(file))
  protectedEvidence.push({path:file,byteExactPreserved:same})
}
const trackedTree=git('ls-tree','-rz','--full-tree','HEAD').toString('utf8').split('\0').filter(Boolean)
let trackedPreserved=0,trackedLineEndingOnly=0
const trackedChanges=[],trackedInventory=[]
const normalize=(bytes)=>bytes.toString('latin1').replace(/\r\n/g,'\n')
for(const row of trackedTree) {
 const separator=row.indexOf('\t'),[mode,type,object]=row.slice(0,separator).split(' '),file=row.slice(separator+1)
 assert.equal(type,'blob','embedded Git trees/submodules are not part of this source audit')
 const absolute=resolve(file)
 if(!fs.existsSync(absolute)){if(!removed.includes(file))removed.push(file);continue}
 const original=git('cat-file','blob',object),current=fs.readFileSync(absolute)
 const same=current.equals(original)
 const normalized=same||(!original.includes(0)&&!current.includes(0)&&normalize(original)===normalize(current))
 if(normalized){trackedPreserved++;if(!same)trackedLineEndingOnly++}else trackedChanges.push(file)
 trackedInventory.push({path:file,mode,headObject:object,byteExact:same,lineEndingNormalizedEqual:normalized,
  ...(secretFile(file)?{}:{worktreeSha256:hash(current)})})
}
const present=new Set(git('ls-files','-z','--cached','--others','--exclude-standard').toString('utf8').split('\0').filter(Boolean))
// Include ignored Supabase support/migrations/runtime markers in addition to Git.
function supportFiles(directory) {
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
  const absolute=path.join(directory,entry.name),relative=path.relative(workspace,absolute).replace(/\\/g,'/')
  if(entry.isDirectory())supportFiles(absolute)
  else if(entry.isFile())present.add(relative)
  else assert.fail('Supabase support inventory cannot contain an unreviewed symlink')
 }
}
supportFiles(path.join(workspace,'supabase'))
for(const file of [...present].sort()) {
 const absolute=resolve(file);if(!fs.existsSync(absolute))continue
 if(!(file in inventory)) {
  const bytes=fs.readFileSync(absolute)
  inventory[file]={bytes:bytes.length,...(secretFile(file)?{newSecretFile:true}:{sha256:hash(bytes)})}
 }
 if(!(file in baseline.files))added.push(file)
}
assert.equal(removed.length,0,'no inventoried or tracked file may be removed')
assert.ok(changed.every(allowed),'byte changes must remain within C migration/harness/reports')
assert.ok(trackedChanges.every(allowed),'tracked content changes must remain within C migration/harness/reports')
assert.ok(added.every(allowed),'new source/support files must remain within C harness/reports')
assert.ok(protectedEvidence.every((file)=>file.byteExactPreserved),'ignored environment files and protected support must remain byte-exact')
assertActionsHistory()

// The syntax repair must retain all ten exact historical comparison queries.
const oldC=git('show',`HEAD:${migrationPath}`).toString('utf8').replace(/\r\n/g,'\n')
const currentC=fs.readFileSync(migrationPath,'utf8').replace(/\r\n/g,'\n')
const queries=(source)=>{
 const entries=[...source.matchAll(/when '(function|relation|schema|policy|role|membership|column|constraint|index|default_acl)' then (\(select[^\n]*\))/g)]
 assert.equal(entries.length,10,'exactly ten historical snapshot comparison queries required')
 return Object.fromEntries(entries.map((match)=>[match[1],match[2]]))
}
const oldQueries=queries(oldC),newQueries=queries(currentC)
assert.deepEqual(newQueries,oldQueries,'SQL syntax repair must preserve every historical comparison query exactly')
const capture=(source)=>source.slice(source.indexOf('create temporary table gymio_c_historical'),source.indexOf('create schema gymio_workout_actions_private'))
assert.equal(capture(currentC),capture(oldC),'the original historical capture must remain unchanged')

// Inject drift only in this process's filesystem read. Calling the real context
// entry point must reject that drift before it can read the context or Docker.
const originalRead=fs.readFileSync,originalExec=childProcess.execFileSync
let dockerAttempts=0,contextReads=0,driftRejected=false
try {
 fs.readFileSync=(file,...args)=>{
  if(path.resolve(String(file))===path.resolve(contextFile))contextReads++
  const result=originalRead(file,...args)
  if(path.resolve(String(file))===path.resolve(migrationPath)) {
   const changedBytes=Buffer.concat([Buffer.isBuffer(result)?result:Buffer.from(result,'utf8'),Buffer.from('\n-- process-only negative hash probe\n')])
   return Buffer.isBuffer(result)?changedBytes:changedBytes.toString('utf8')
  }
  return result
 }
 childProcess.execFileSync=(...args)=>{
  if(args[0]==='docker'){dockerAttempts++;throw new Error('unexpected_docker_before_hash_guard')}
  return originalExec(...args)
 }
 syncBuiltinESMExports()
 assert.throws(()=>actionsContext(contextFile),/STOP historical hash 20261011021351_workout_notification_actions\.sql; no restoration/)
 driftRejected=true
}finally{
 fs.readFileSync=originalRead;childProcess.execFileSync=originalExec;syncBuiltinESMExports()
}
assert.equal(contextReads,0);assert.equal(dockerAttempts,0);assertActionsHistory()
const result={passed:true,head,branch,baselineFile,trackedFiles:trackedTree.length,trackedPreserved,trackedLineEndingOnly,
 trackedComparison:'byte exact; CRLF -> LF only for nonbinary Git blobs; no whitespace or newline-final normalization',
 baselineFiles:Object.keys(baseline.files).length,inventoryFiles:Object.keys(inventory).length,changed,trackedChanges,added,removed,
 protectedFiles:protectedEvidence,hashes:historicalHashes,preFixC:'8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42',
 historicalComparisonQueries:{count:10,unchanged:true,queryHashes:Object.fromEntries(Object.entries(newQueries).map(([kind,query])=>[kind,hash(query)]))},
 driftNegative:{processOnly:true,rejected:driftRejected,contextReads,dockerAttempts,actualFilesModified:false},
 inventory,trackedInventory,networkOperations:0,dockerOperations:0}
fs.writeFileSync(path.join(root,'actions-source-audit-result.json'),JSON.stringify(result,null,2)+'\n')
console.log(`PASS C source audit: ${trackedPreserved}/${trackedTree.length} tracked files preserved or explicitly scoped; five historical hashes + corrected C; ten unchanged SQL queries; C drift rejects before context/Docker; protected ignored files byte-exact`)

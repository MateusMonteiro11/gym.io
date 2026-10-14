// Explicit local-only lint phase. Does not start services or apply any SQL.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {performance} from 'node:perf_hooks'
import {actionsContext,assertActionsHistory,historicalHashes} from './actions-context.mjs'

const [contextFile,phase,...options]=process.argv.slice(2)
assert.ok(['before','after'].includes(phase),'explicit before/after phase required')
assert.ok(options.length===0||(options.length===2&&options[0]==='--attempt'&&/^[1-9][0-9]?$/.test(options[1])))
const attempt=options.length?Number(options[1]):1,c=actionsContext(contextFile),root=c.context.root
assert.equal(c.sql("select to_regnamespace('gymio_workout_actions_private')is not null;"),'t','lint follows complete C application')
const cliPath=path.join(process.env.APPDATA??'','npm/node_modules/supabase/dist/supabase.js')
assert.ok(fs.existsSync(cliPath),'pinned installed CLI required; do not install a dependency')
const home=path.join(root,'cli-home')
const env={...process.env,APPDATA:path.join(home,'roaming'),LOCALAPPDATA:path.join(home,'local'),
 XDG_CONFIG_HOME:path.join(home,'config'),XDG_CACHE_HOME:path.join(home,'cache'),SUPABASE_HOME:home,
 SUPABASE_TELEMETRY_DISABLED:'1',SUPABASE_NO_UPDATE_NOTIFIER:'1',DO_NOT_TRACK:'1',NO_COLOR:'1'}
delete env.SUPABASE_ACCESS_TOKEN
for(const folder of [env.APPDATA,env.LOCALAPPDATA,env.XDG_CONFIG_HOME,env.XDG_CACHE_HOME])fs.mkdirSync(folder,{recursive:true})
const invoke=(args)=>spawnSync(process.execPath,[cliPath,...args],{cwd:root,env,windowsHide:true,
 encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
const version=invoke(['--version']);assert.equal(version.status,0);assert.equal(version.stdout.trim(),'2.120.0')
const help=invoke(['db','lint','--help','--workdir',root]);assert.equal(help.status,0)
for(const flag of ['--local','--schema','--level','--fail-on'])assert.ok(help.stdout.includes(flag),'discover all local lint flags first')
assert.ok(/--level[^\n]*choices:\s*warning,\s*error/.test(help.stdout),'report pinned CLI lint levels without inventing info support')
const schemas=['public','graphql_public','gymio_private','gymio_push_private','gymio_workout_push_private','gymio_workout_actions_private']
const args=['db','lint','--local','--schema',schemas.join(','),'--level','warning','--fail-on','error','--workdir',root]
const started=performance.now(),result=invoke(args),elapsed_ms=Number((performance.now()-started).toFixed(3))
const scrub=(text)=>String(text).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED]')
 .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[REDACTED]')
 .replace(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g,'[REDACTED]')
 .replace(/(?:\\x)?\b[0-9a-f]{64}\b/gi,'[REDACTED_HASH]')
 .replace(/(?:Bearer\s+|(?:capability|token_hash|VAPID_PRIVATE_KEY|WORKER_TOKEN)\s*[=:]\s*)[^\s,;]+/gi,'[REDACTED]')
function jsonBlocks(text){
 const found=[]
 for(let start=0;start<text.length;start++){
  if(!['[','{'].includes(text[start]))continue
  let quote=false,escaped=false,depth=0
  for(let end=start;end<text.length;end++){
   const char=text[end]
   if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quote=false;continue}
   if(char==='"'){quote=true;continue}
   if(char==='['||char==='{')depth++
   if(char===']'||char==='}')depth--
   if(depth===0){try{found.push(JSON.parse(text.slice(start,end+1)));start=end}catch{};break}
  }
 }
 return found
}
const diagnostics=[],seen=new Set()
function walk(value,scope=null){
 if(Array.isArray(value)){for(const entry of value)walk(entry,scope);return}
 if(!value||typeof value!=='object'||seen.has(value))return
 seen.add(value)
 const name=value.function??value.function_name??scope
 if(name&&typeof(value.level??value.severity)==='string'&&typeof value.message==='string')
  diagnostics.push({function:scrub(name),level:String(value.level??value.severity).toUpperCase(),message:scrub(value.message),
   ...(Number.isInteger(value.lineno)?{line:value.lineno}:{})})
 for(const [key,entry]of Object.entries(value)){
  if(key==='message'&&typeof entry==='string')for(const nested of jsonBlocks(entry))walk(nested,name)
  else if(entry&&typeof entry==='object')walk(entry,name)
 }
}
for(const block of jsonBlocks(result.stdout??''))walk(block)
const counts={ERROR:0,WARN:0,INFO:0},unclassifiedDiagnostics=[]
for(const diagnostic of diagnostics){
 if(/^(?:ERROR|FATAL|PANIC)\b/.test(diagnostic.level))counts.ERROR++
 else if(/^WARN(?:ING)?\b/.test(diagnostic.level))counts.WARN++
 else if(/^(?:INFO|NOTICE)\b/.test(diagnostic.level))counts.INFO++
 else unclassifiedDiagnostics.push(diagnostic)
}
const passed=!result.error&&result.status===0&&counts.ERROR===0
const evidence={phase,attempt,passed,exit_code:result.status??1,elapsed_ms,counts,diagnostics,unclassifiedDiagnostics,schemas,
 command:{cli:'Supabase CLI',version:'2.120.0',local:true,minimumDiagnosticLevel:'warning',failOn:'error',linked:false,dbUrl:false},
 infoCoverage:'Pinned CLI --level choices are warning/error; INFO is counted if returned, but CLI does not offer an info diagnostic level.',
 hashes:historicalHashes,stdout:scrub(result.stdout??''),stderr:scrub(result.stderr??''),
 failure:result.error?'local_cli_execution_failed_or_timed_out':result.status!==0?'local_db_lint_failed':counts.ERROR?'db_lint_errors':null,
 remoteOperations:0,sqlApplied:false,servicesStarted:false}
assertActionsHistory()
const suffix=attempt===1?'':`-retry-${attempt}`
fs.writeFileSync(path.join(root,`actions-third-db-lint-${phase}${suffix}.json`),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'})
console.log(`${passed?'PASS':'FAIL'} C third db lint ${phase}: ERROR=${counts.ERROR} WARN=${counts.WARN} INFO=${counts.INFO}; ${elapsed_ms} ms; local CLI only`)
if(!passed)process.exitCode=1

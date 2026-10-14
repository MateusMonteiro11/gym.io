// Explicit C test-stage runner. Saves sanitized diagnostics and outcome even
// on failure, and never continues into another stage by itself.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {performance} from 'node:perf_hooks'
import {assertActionsHistory} from './actions-context.mjs'
const [file,stage,script,...args]=process.argv.slice(2)
const harnessRetry=args.at(-1)==='--retry-confirmed-harness';if(harnessRetry)args.pop()
assertActionsHistory()
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),context=read(file),root=fs.realpathSync(context.root)
assert.equal(context.project,'gymio-workout-actions-local');assert.equal(context.port,'55451')
const relative=path.relative(fs.realpathSync(os.tmpdir()),root)
assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^gymio-workout-actions-[a-f0-9]{32}$/.test(path.basename(root)))
assert.equal(fs.readFileSync(path.join(root,'.owner'),'utf8').trim(),context.project)
assert.ok(/^[a-zA-Z0-9-]+$/.test(stage))
const scriptPath=fs.realpathSync(script),workspace=fs.realpathSync(process.cwd()),scriptRelative=path.relative(workspace,scriptPath)
assert.ok(!scriptRelative.startsWith('..')&&!path.isAbsolute(scriptRelative)&&scriptRelative.startsWith('supabase'+path.sep+'testing'+path.sep)&&scriptPath.endsWith('.mjs'))
const known=[]
if(fs.existsSync(path.join(root,'edge.env')))for(const line of fs.readFileSync(path.join(root,'edge.env'),'utf8').split('\n')){
 const i=line.indexOf('=');if(i>0&&/JWT|PASSWORD|SECRET|PRIVATE_KEY|WORKER_TOKEN/.test(line.slice(0,i)))known.push(line.slice(i+1).trim())
}
const scrub=input=>{let output=String(input);for(const value of known)if(value)output=output.replaceAll(value,'[REDACTED]');return output.replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+|[A-Za-z0-9_-]{40,}/g,'[REDACTED]')}
const manifestPath=path.join(root,'actions-third-stages.json'),initial=fs.existsSync(manifestPath)?read(manifestPath):{stages:[]}
const existing=initial.stages.find(row=>row.stage===stage)
if(existing)assert.ok(harnessRetry&&existing.status==='failed','reject repeat before executing any test')
else assert.ok(!harnessRetry,'a harness retry must identify an earlier failed stage')
const start=performance.now(),child=spawn(process.execPath,[scriptPath,...args],{cwd:workspace,env:{...process.env},windowsHide:true,stdio:['ignore','pipe','pipe']})
let output='',errors=''
child.stdout.on('data',part=>{output+=part;if(output.length>32*1024*1024)child.kill()});child.stderr.on('data',part=>{errors+=part;if(errors.length>32*1024*1024)child.kill()})
const code=await new Promise(resolve=>{child.on('error',()=>resolve(1));child.on('close',code=>resolve(code??1))})
const evidence=stage==='sql-C'?'actions-sql.log':stage==='data-api-C'?'actions-data-api.log':stage==='edge-C'?'actions-edge.log':stage+'.log'
const manifest=fs.existsSync(manifestPath)?read(manifestPath):{stages:[]}
const previous=manifest.stages.find(row=>row.stage===stage)
if(previous){
 assert.ok(harnessRetry&&previous.status==='failed','a stage may be repeated only after a confirmed harness failure')
 const archived=`${stage}-harness-attempt-${(manifest.attempts??[]).filter(row=>row.stage===stage).length+1}.log`
 fs.renameSync(path.join(root,previous.evidence),path.join(root,archived))
 ;(manifest.attempts??=[]).push({...previous,evidence:archived,classification:'confirmed harness-only failure',reason:process.env.GYMIO_CONFIRMED_HARNESS_CAUSE??'documented in matrix report'})
 manifest.stages=manifest.stages.filter(row=>row.stage!==stage)
}
fs.writeFileSync(path.join(root,evidence),scrub(output+'\n'+errors))
const row={stage,status:code===0?'passed':'failed',exit_code:code,elapsed_ms:Number((performance.now()-start).toFixed(3)),evidence}
manifest.stages.push(row);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
if(code!==0){console.error(scrub(errors).split('\n').slice(-35).join('\n'));console.error('STOP failed stage; classify before continuing')}
else console.log(scrub(output))
console.log(JSON.stringify(row));process.exitCode=code

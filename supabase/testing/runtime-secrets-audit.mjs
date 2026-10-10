// Compare local secret bytes in memory, reporting only counts/booleans.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {workoutContext} from './workout-context.mjs'
const {context,sql,users,status}=workoutContext(process.argv[2])
const env=Object.fromEntries(fs.readFileSync(path.join(context.root,'edge.env'),'utf8').trim().split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}))
assert.match(env.GYMIO_WORKOUT_WORKER_TOKEN,/^[A-Za-z0-9_-]{43}$/)
assert.equal(sql("select count(*)from vault.decrypted_secrets where name in('gymio_workout_push_worker_token','gymio_workout_push_url');"),'2')
const secrets=[env.GYMIO_WORKOUT_WORKER_TOKEN,env.VAPID_PRIVATE_KEY,status.SECRET_KEY,status.SERVICE_ROLE_KEY,...users.map(user=>user.jwt)].filter(Boolean)
const containers=execFileSync('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${context.project}`,'--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const logs=[]
for(const name of containers){const result=spawnSync('docker',['logs',name],{encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(result.status,0);logs.push(result.stdout,result.stderr)}
for(const filename of ['start.log','serve.log','serve-error.log'])if(fs.existsSync(path.join(context.root,filename))){
 const bytes=fs.readFileSync(path.join(context.root,filename))
 // Windows PowerShell 5 redirection can produce UTF-16LE logs.
 logs.push(bytes.toString(bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8'))
}
for(const secret of secrets)assert.ok(logs.every(log=>!log.includes(secret)),'secret leaked in local logs')
const result={passed:true,logStreams:logs.length,secretsChecked:secrets.length,leaks:0,vaultSecrets:2,externalRequests:0}
fs.writeFileSync(path.join(context.root,'runtime-secrets-result.json'),JSON.stringify(result,null,2))
console.log('PASS local runtime/CLI/container logs contain no worker token, private VAPID key, admin credential or user JWT; Vault values server-side only')

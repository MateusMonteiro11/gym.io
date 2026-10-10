import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync,execFile } from 'node:child_process'
export function workoutContext(file) {
  const context=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
  assert.equal(context.project,'gymio-workout-push-local');assert.equal(context.port,'55441')
  assert.ok(path.isAbsolute(context.root)&&/^gymio-workout-push-/.test(path.basename(context.root)))
  assert.equal(fs.readFileSync(path.join(context.root,'.owner'),'utf8').trim(),context.project)
  const hashes={
    '20260725194232_auth_email_security.sql':'cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6',
    '20260821190134_workout_session_persistence_expand.sql':'6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db',
    '20260823003337_exercise_memory_read.sql':'7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02',
    '20261007215944_push_foundation.sql':'225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823',
    '20261010183821_workout_notifications.sql':'c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b'}
  for(const [name,hash]of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(`supabase/migrations/${name}`)).digest('hex'),hash,`STOP historical hash ${name}`)
  const status=JSON.parse(fs.readFileSync(path.join(context.root,'status.json'),'utf8').replace(/^\uFEFF/,'')),api=status.API_URL??status.api_url
  assert.ok(['localhost','127.0.0.1'].includes(new URL(api).hostname));assert.equal(new URL(api).port,'55441')
  const args=['exec','-i',`supabase_db_${context.project}`,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
  const sql=(input)=>execFileSync('docker',args,{input,encoding:'utf8',maxBuffer:4*1024*1024}).trim()
  const concurrentSql=(input)=>new Promise((resolve,reject)=>{const child=execFile('docker',args,{encoding:'utf8',maxBuffer:4*1024*1024},(err,out)=>err?reject(err):resolve(out.trim()));child.stdin.end(input)})
  const value=(text)=>JSON.parse(sql(text).split('\n').filter((line)=>line.startsWith('{')||line.startsWith('[')||line==='null').at(-1)??'null')
  const users=JSON.parse(fs.readFileSync(path.join(context.root,'users.json'),'utf8'))
  const literal=(v)=>`'${String(v).replace(/'/g,"''")}'`
  return {context,status,api,sql,concurrentSql,value,users,literal,hashes}
}

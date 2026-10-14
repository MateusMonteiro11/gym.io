// Isolated matrix only. The preserved B project is deliberately not accepted.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, execFile } from 'node:child_process'

export const historicalHashes={
  '20260725194232_auth_email_security.sql':'cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6',
  '20260821190134_workout_session_persistence_expand.sql':'6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db',
  '20260823003337_exercise_memory_read.sql':'7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02',
  '20261007215944_push_foundation.sql':'225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823',
  '20261010183821_workout_notifications.sql':'c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b',
  '20261011021351_workout_notification_actions.sql':'b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca',
}
export function assertActionsHistory() {
  for(const [name,hash] of Object.entries(historicalHashes))assert.equal(createHash('sha256').update(fs.readFileSync(`supabase/migrations/${name}`)).digest('hex'),hash,`STOP historical hash ${name}; no restoration`)
}
export function actionsContext(file) {
  assertActionsHistory()
  const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
  const context=read(file)
  assert.equal(context.project,'gymio-workout-actions-local');assert.equal(context.port,'55451')
  const root=fs.realpathSync(context.root),temporary=fs.realpathSync(os.tmpdir())
  const relative=path.relative(temporary,root)
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^gymio-workout-actions-[a-f0-9]{32}$/.test(path.basename(root)))
  assert.equal(fs.readFileSync(path.join(root,'.owner'),'utf8').trim(),context.project)
  const container=`supabase_db_${context.project}`
  const inspect=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8',stdio:['pipe','pipe','pipe']}))[0]
  assert.equal(inspect.Config.Labels['com.supabase.cli.project'],context.project)
  assert.equal(fs.realpathSync(inspect.Config.Labels['com.supabase.cli.workdir']),root)
  assert.equal(inspect.Config.Image,'public.ecr.aws/supabase/postgres:17.6.1.113')
  assert.ok(inspect.NetworkSettings.Ports['5432/tcp'].every((port)=>port.HostPort==='55452'))
  const status=read(path.join(root,'status.json')),api=status.API_URL??status.api_url,url=new URL(api)
  assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='55451'&&url.pathname==='/'&&!url.username&&!url.password&&!url.search&&!url.hash)
  const users=read(path.join(root,'users.json'))
  assert.equal(users.length,2);for(const user of users)assert.ok(user.email.endsWith('@local.invalid'))
  const args=['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
  const sql=(input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024}).trim()
  const concurrentSql=(input)=>new Promise((resolve,reject)=>{const child=execFile('docker',args,{encoding:'utf8',maxBuffer:8*1024*1024},(error,out)=>error?reject(Error('isolated_sql_failed')):resolve(out.trim()));child.stdin.end(input)})
  const value=(text)=>JSON.parse(sql(text).split('\n').filter((line)=>line.startsWith('{')||line.startsWith('[')||line==='null').at(-1)??'null')
  const literal=(value)=>`'${String(value).replace(/'/g,"''")}'`
  for(const user of users)assert.equal(sql(`select exists(select 1 from auth.users a join public.usuarios u on u.id_usuario=a.id where a.id=${literal(user.id)} and a.email=${literal(user.email)} and u.email=a.email);`),'t')
  const request=async(route,jwt,body,options={})=>{
    assert.ok(route.startsWith('/rest/v1/')||route.startsWith('/functions/v1/'))
    const response=await fetch(`${url.origin}${route}`,{method:options.method??'POST',headers:{...(options.publicOnly?{}:{apikey:status.ANON_KEY??status.anon_key}),
      ...(jwt?{Authorization:`Bearer ${jwt}`}:{ }),'Content-Type':'application/json',...options.headers},
      ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'})
    let data;try{data=await response.json()}catch{data=null}
    return {status:response.status,data,headers:response.headers}
  }
  return {context:{...context,root},status,api:url.origin,sql,concurrentSql,value,users,literal,request}
}

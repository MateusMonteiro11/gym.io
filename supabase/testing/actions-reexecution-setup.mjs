// C MATRIX SETUP ONLY. Every phase is explicit; importing this file starts
// nothing. No production env files, linked projects, remote URLs or new grants.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes,createECDH,createHash} from 'node:crypto'
import {spawnSync,spawn} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {assertActionsHistory,actionsContext,historicalHashes} from './actions-context.mjs'

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const project='gymio-workout-actions-local',image='public.ecr.aws/supabase/postgres:17.6.1.113'
const readJSON=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const writeJSON=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx'})
const q=(text)=>`'${String(text).replace(/'/g,"''")}'`
const digest=(text)=>createHash('sha256').update(text).digest('hex')
const scrub=(text)=>String(text).replace(/(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|\b[A-Za-z0-9_-]{43,}\b)/g,'[REDACTED]')
const exec=(command,args,options={})=>{
 const result=spawnSync(command,args,{cwd:workspace,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,...options})
 if(result.error||result.status!==0)throw Error(`local command failed: ${path.basename(command)} ${args[0]??''}`)
 return result.stdout.trim()
}
function runtime(file){
 assertActionsHistory()
 const context=readJSON(file),root=fs.realpathSync(context.root),temporary=fs.realpathSync(os.tmpdir()),relative=path.relative(temporary,root)
 assert.equal(context.project,project);assert.equal(context.port,'55451')
 assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^gymio-workout-actions-[a-f0-9]{32}$/.test(path.basename(root)))
 assert.equal(fs.readFileSync(path.join(root,'.owner'),'utf8').trim(),project)
 return {...context,root}
}
const localEnv=(root)=>{
 const home=path.join(root,'cli-home')
 const paths={APPDATA:path.join(home,'roaming'),LOCALAPPDATA:path.join(home,'local'),XDG_CONFIG_HOME:path.join(home,'config'),XDG_CACHE_HOME:path.join(home,'cache')}
 for(const folder of Object.values(paths))fs.mkdirSync(folder,{recursive:true})
 const env={...process.env,...paths,SUPABASE_HOME:home,SUPABASE_TELEMETRY_DISABLED:'1',SUPABASE_NO_UPDATE_NOTIFIER:'1',DO_NOT_TRACK:'1'}
 delete env.SUPABASE_ACCESS_TOKEN
 return env
}
function cliPath(){
 const file=path.join(process.env.APPDATA??'', 'npm/node_modules/supabase/dist/supabase.js')
 assert.ok(fs.existsSync(file),'installed pinned CLI missing; do not install dependencies')
 return file
}
function cli(root,args,{json=false}={}){
 const result=spawnSync(process.execPath,[cliPath(),...args,'--workdir',root],{cwd:root,env:localEnv(root),encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024})
 fs.writeFileSync(path.join(root,`${args.join('-').replace(/[^a-z-]/g,'')}.log`),scrub(result.stderr))
 if(result.error||result.status!==0)throw Error(`local CLI failed: ${args[0]}`)
 // start's credential summary is deliberately discarded, never logged.
 return json?JSON.parse(result.stdout):scrub(result.stdout)
}
function database(context){
 const container=`supabase_db_${project}`
 const inspect=JSON.parse(exec('docker',['inspect',container]))[0]
 assert.equal(inspect.Config.Labels['com.supabase.cli.project'],project)
 assert.equal(fs.realpathSync(inspect.Config.Labels['com.supabase.cli.workdir']),context.root)
 assert.equal(inspect.Config.Image,image)
 assert.ok(inspect.NetworkSettings.Ports['5432/tcp']?.every((port)=>port.HostPort==='55452'))
 return (input)=>{
  const result=spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
   {input,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024})
  if(result.error||result.status!==0){
   const state=result.stderr?.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??'unknown'
   fs.writeFileSync(path.join(context.root,'setup-sql-error.log'),scrub(result.stderr))
   throw Error(`isolated SQL setup failed: SQLSTATE ${state}`)
  }
  return result.stdout.trim()
 }
}
async function free(port){
 await new Promise((resolve,reject)=>{
  const server=net.createServer();server.once('error',()=>reject(Error(`dedicated port ${port} is occupied`)))
  server.listen({host:'::',port,ipv6Only:false},()=>server.close(resolve))
 })
}
export async function createRuntime(){
 assertActionsHistory()
 assert.equal(exec('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${project}`,'--format','{{.ID}}']),'','refuse any existing C stack')
 try{exec('docker',['image','inspect',image])}catch{throw Error('C MATRIX BLOCKED: TARGET POSTGRES IMAGE UNAVAILABLE')}
 for(const port of [55450,55451,55452])await free(port)
 const root=path.join(os.tmpdir(),'gymio-workout-actions-'+randomUUID().replaceAll('-',''))
 fs.mkdirSync(path.join(root,'supabase/.temp'),{recursive:true})
 fs.mkdirSync(path.join(root,'cli-home'))
 fs.writeFileSync(path.join(root,'.owner'),project+'\n',{flag:'wx'})
 writeJSON(path.join(root,'context.json'),{root,project,port:'55451'})
 const source=fs.readFileSync(path.join(workspace,'supabase/config.toml'),'utf8')
 const config=source.replaceAll('gymio-push-foundation-local',project).replaceAll('55431','55451').replaceAll('55432','55452').replaceAll('55430','55450')
 assert.ok(config.includes(`project_id = "${project}"`)&&config.includes('port = 55451')&&config.includes('port = 55452')&&config.includes('shadow_port = 55450'))
 fs.writeFileSync(path.join(root,'supabase/config.toml'),config,{flag:'wx'})
 fs.writeFileSync(path.join(root,'supabase/.temp/postgres-version'),'17.6.1.113',{flag:'wx'})
 fs.cpSync(path.join(workspace,'supabase/functions'),path.join(root,'supabase/functions'),{recursive:true,errorOnExist:true})
 for(const [name,sourceFolder] of [
  ['push-compat-spike','compat-spike'],['push-integration','edge-integration'],['workout-integration','workout-edge-integration'],
  ['actions-integration','actions-edge-integration'],['runtime-libs','runtime-libs'],
 ]){
  const target=path.join(root,`supabase/functions/${name}`);fs.mkdirSync(target)
  let text=fs.readFileSync(path.join(workspace,`supabase/testing/${sourceFolder}/index.ts`),'utf8')
  if(name==='workout-integration'){
   const original="from '../_shared/workoutPushRepository.js'",replacement="from '../_shared/actions-b-regression-repository.js'",before=text
   assert.equal(text.split(original).length,2,'exactly one repository import test port')
   text=text.replace(original,replacement);assert.equal(text.replace(replacement,original),before,'historical B body/assertions unchanged')
  }
  fs.writeFileSync(path.join(target,'index.ts'),text,{flag:'wx'})
 }
 fs.copyFileSync(path.join(workspace,'supabase/testing/actions-b-regression-repository.js'),path.join(root,'supabase/functions/_shared/actions-b-regression-repository.js'),fs.constants.COPYFILE_EXCL)
 const protectedIds=['gymio-push-foundation-local','gymio-workout-push-local'].flatMap((preservedProject)=>
  exec('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${preservedProject}`,'--format','{{.ID}} {{.Names}}']).split('\n').filter(Boolean))
 writeJSON(path.join(root,'setup.json'),{project,root,image,createdAt:new Date().toISOString(),protectedIds,
  historicalHashes,bootstrapOrder:['legacy fixture','EXPAND','Memory','Foundation A','Notifications B','Extension Security Gate','C corrected (explicit later)'],phases:['created']})
 console.log(`C_RUNTIME_CREATED ${path.join(root,'context.json')}`)
 return path.join(root,'context.json')
}
export function startRuntime(file){
 const context=runtime(file)
 assert.equal(exec('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${project}`,'--format','{{.ID}}']),'','fresh start only')
 const version=exec(process.execPath,[cliPath(),'--version'],{cwd:context.root,env:localEnv(context.root)})
 assert.equal(version,'2.120.0','pinned Supabase CLI version')
 cli(context.root,['start','--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor'])
 database(context)
 const status=cli(context.root,['status','--output','json'],{json:true})
 const api=new URL(status.API_URL??status.api_url)
 assert.ok(api.protocol==='http:'&&['localhost','127.0.0.1'].includes(api.hostname)&&api.port==='55451'&&api.pathname==='/'&&!api.username&&!api.password&&!api.search&&!api.hash)
 writeJSON(path.join(context.root,'status.json'),status)
 const ids=exec('docker',['ps','-a','--filter',`label=com.supabase.cli.project=${project}`,'--format','{{.ID}}']).split('\n').filter(Boolean)
 const containers=ids.map((id)=>{
  const value=JSON.parse(exec('docker',['inspect',id]))[0]
  assert.equal(value.Config.Labels['com.supabase.cli.project'],project)
  const pin=JSON.parse(exec('docker',['image','inspect',value.Image]))[0]
  return {id:value.Id,name:value.Name,image:value.Config.Image,imageId:value.Image,digests:pin.RepoDigests,ports:value.NetworkSettings.Ports}
 })
 writeJSON(path.join(context.root,'created-resources.json'),{project,root:context.root,containers})
 console.log('PASS fresh C stack with exact PostgreSQL image; local credentials retained only in runtime')
}
export async function credentials(file){
 const context=runtime(file),sql=database(context),status=readJSON(path.join(context.root,'status.json')),api=new URL(status.API_URL??status.api_url)
 assert.equal(sql('select count(*) from auth.users;'),'0','credentials require empty new Auth catalog')
 assert.ok(api.protocol==='http:'&&['localhost','127.0.0.1'].includes(api.hostname)&&api.port==='55451')
 const anon=status.ANON_KEY??status.anon_key,users=[]
 for(const letter of ['a','b']){
  const password=randomBytes(24).toString('base64url')+'A1!',email=`actions-${letter}-${Date.now()}@local.invalid`
  const response=await fetch(api.origin+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(20000),redirect:'error'})
  assert.equal(response.status,200,'local synthetic Auth signup')
  const data=await response.json();assert.ok(data.access_token&&data.user.id&&data.user.email===email)
  users.push({id:data.user.id,jwt:data.access_token,email,password})
 }
 assert.equal(sql('select count(*) from auth.users;'),'2')
 writeJSON(path.join(context.root,'users.json'),users)
 const vapid=createECDH('prime256v1');vapid.generateKeys()
 const secret=status.SECRET_KEY??status.secret_key;assert.ok(secret?.startsWith('sb_secret_'),'local modern secret missing')
 const edge={PUSH_ALLOWED_ORIGINS:'http://localhost:5173',GYMIO_WORKOUT_ACTION_ORIGINS:'http://localhost:5173',GYMIO_ACTIONS_MATRIX:'local-only',
  PUSH_TEST_A_JWT:users[0].jwt,PUSH_TEST_B_JWT:users[1].jwt,PUSH_TEST_A_EMAIL:users[0].email,PUSH_TEST_A_PASSWORD:users[0].password,
  PUSH_TEST_SECRET_KEY:secret,VAPID_PUBLIC_KEY:vapid.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:vapid.getPrivateKey().toString('base64url'),VAPID_SUBJECT:'mailto:local-test@gym.io'}
 fs.writeFileSync(path.join(context.root,'edge.env'),Object.entries(edge).map(([name,value])=>`${name}=${value}`).join('\n')+'\n',{flag:'wx'})
 fs.writeFileSync(path.join(context.root,'frontend.env'),`VITE_SUPABASE_URL=${api.origin}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anon}\nVITE_VAPID_PUBLIC_KEY=${edge.VAPID_PUBLIC_KEY}\n`,{flag:'wx'})
 console.log('PASS exactly two local synthetic Auth users; no credentials logged')
}
export function bootstrap(file){
 const context=runtime(file),sql=database(context),users=readJSON(path.join(context.root,'users.json'))
 assert.equal(sql("select to_regclass('public.push_subscriptions') is null and to_regclass('public.treino_sessoes') is null;"),'t','fresh reconstructed baseline required')
 sql(fs.readFileSync(path.join(workspace,'supabase/testing/legacy-baseline.sql'),'utf8'))
 for(const name of ['20260821190134_workout_session_persistence_expand.sql','20260823003337_exercise_memory_read.sql']){
  assertActionsHistory();sql('begin;\n'+fs.readFileSync(path.join(workspace,'supabase/migrations',name),'utf8')+'\ncommit;')
 }
 sql(fs.readFileSync(path.join(workspace,'supabase/migrations/20261007215944_push_foundation.sql'),'utf8'))
 for(const user of users){assert.ok(user.email.endsWith('@local.invalid'));sql(`insert into public.usuarios(id_usuario,nome,email,status)values(${q(user.id)},'C matrix',${q(user.email)},'ativo');`)}
 sql("create extension pg_cron version '1.6.4';create extension pg_net version '0.20.0';")
 assert.equal(sql("select extversion from pg_extension where extname='supabase_vault';"),'0.3.1')
 assertActionsHistory();sql(fs.readFileSync(path.join(workspace,'supabase/migrations/20261010183821_workout_notifications.sql'),'utf8'))
 assert.equal(sql("select count(*) from cron.job where jobname='gymio-workout-push' and not active;"),'1','global workout job stays inactive')
 sql("notify pgrst,'reload schema';")
 actionsContext(file)
 console.log('PASS fixture -> EXPAND -> Memory -> A -> B; official extension ACLs unchanged; Auth/CONTRACT not applied')
}
function replaceOnce(source,before,after){assert.equal(source.split(before).length,2,`adapter expected one guard ${before}`);return source.replace(before,after)}
export function adapters(file){
 const context=runtime(file),folder=path.join(context.root,'tests');assert.ok(!fs.existsSync(folder),'adapters immutable once prepared');fs.mkdirSync(folder)
 const contextURL=pathToFileURL(path.join(workspace,'supabase/testing/actions-context.mjs')).href
 const records=[]
 const write=(name,source,adapted=source)=>{
  fs.writeFileSync(path.join(folder,name),adapted,{flag:'wx'})
  const marker=name==='local-tests.mjs'?'const runtime =':name==='scheduler-spike.mjs'?'const sql =':null
  const sourceBody=marker?source.slice(source.indexOf(marker)):source,adaptedBody=marker?adapted.slice(adapted.indexOf(marker)):adapted
  if(marker)assert.equal(adaptedBody,sourceBody,'historical behavior body must remain unchanged')
  records.push({name,sourceSha256:digest(source),adapterSha256:digest(adapted),bodyMarker:marker,
   sourceBodySha256:digest(sourceBody),adapterBodySha256:digest(adaptedBody),contextOnly:source!==adapted})
 }
 write('workout-context.mjs','C context adapter',`import {actionsContext,historicalHashes} from ${JSON.stringify(contextURL)};export function workoutContext(file){return {...actionsContext(file),hashes:historicalHashes}}\n`)
 let original=fs.readFileSync(path.join(workspace,'supabase/testing/local-tests.mjs'),'utf8'),source=original
 source=replaceOnce(source,"['gymio-extension-security-local', 'gymio-workout-push-local']","['gymio-workout-actions-local']")
 source=replaceOnce(source,"assert.equal(context.port, '55441')","assert.equal(context.port, '55451')")
 source=replaceOnce(source,'/^(gymio-extension-gate-|gymio-workout-push-)/','/^gymio-workout-actions-[a-f0-9]{32}$/')
 source=`import {actionsContext as strictCContext} from ${JSON.stringify(contextURL)};strictCContext(process.argv[3]);\n`+source
 write('local-tests.mjs',original,source)
 original=fs.readFileSync(path.join(workspace,'supabase/testing/extension-gate.mjs'),'utf8');source=original
 source=replaceOnce(source,"['gymio-extension-security-local','gymio-workout-push-local']","['gymio-workout-actions-local']")
 source=replaceOnce(source,"assert.equal(context.port, '55441')","assert.equal(context.port, '55451')")
 source=replaceOnce(source,'/^(gymio-extension-gate-|gymio-workout-push-)/','/^gymio-workout-actions-[a-f0-9]{32}$/')
 source=replaceOnce(source,"context.project === 'gymio-workout-push-local'","context.project === 'gymio-workout-actions-local'")
 source=`import {actionsContext as strictCContext} from ${JSON.stringify(contextURL)};strictCContext(process.argv[2]);\n`+source
 write('extension-gate.mjs',original,source)
 for(const name of fs.readdirSync(path.join(workspace,'supabase/testing')).filter((name)=>/^workout-.*\.mjs$/.test(name)&&name!=='workout-context.mjs'))write(name,fs.readFileSync(path.join(workspace,'supabase/testing',name),'utf8'))
 original=fs.readFileSync(path.join(workspace,'supabase/testing/scheduler-spike.mjs'),'utf8');source=original
 source=replaceOnce(source,"assert.equal(context.project, 'gymio-workout-push-local')","assert.equal(context.project, 'gymio-workout-actions-local')")
 source=replaceOnce(source,"assert.equal(context.port, '55441')","assert.equal(context.port, '55451')")
 source=replaceOnce(source,"path.basename(context.root).startsWith('gymio-workout-push-')","/^gymio-workout-actions-[a-f0-9]{32}$/.test(path.basename(context.root))")
 source=`import {actionsContext as strictCContext} from ${JSON.stringify(contextURL)};strictCContext(process.argv[2]);\n`+source
 write('scheduler-spike.mjs',original,source)
 writeJSON(path.join(context.root,'adapter-manifest.json'),records)
 console.log('PASS explicit C guard adapters prepared; historical regression test bodies unchanged')
}
export function gate(file){
 const context=runtime(file);actionsContext(file)
 assert.equal(database(context)("select to_regnamespace('gymio_workout_actions_private') is null;"),'t','historical extension gate runs before C')
 const script=path.join(context.root,'tests/extension-gate.mjs');assert.ok(fs.existsSync(script),'prepare adapters first')
 const result=spawnSync(process.execPath,[script,file],{cwd:workspace,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024})
 fs.writeFileSync(path.join(context.root,'gate.log'),scrub(result.stdout+'\n'+result.stderr))
 if(result.error||result.status!==0)throw Error('C extension gate failed; stop without official ACL repairs')
 console.log(scrub(result.stdout.trim()))
}
export function secrets(file){
 const context=runtime(file),sql=database(context),result=readJSON(path.join(context.root,'extension-result.json'))
 assert.equal(result.passed,true,'extension gate must pass before local Vault setup')
 assert.equal(sql("select count(*) from vault.secrets where name in('gymio_workout_push_worker_token','gymio_workout_push_url');"),'0')
 const token=randomBytes(32).toString('base64url'),env=fs.readFileSync(path.join(context.root,'edge.env'),'utf8')
 assert.ok(!env.includes('GYMIO_WORKOUT_WORKER_TOKEN='),'do not reuse worker token')
 sql(`select vault.create_secret(${q(token)},'gymio_workout_push_worker_token');select vault.create_secret('http://kong:8000/functions/v1/workout-push','gymio_workout_push_url');`)
 fs.appendFileSync(path.join(context.root,'edge.env'),`GYMIO_WORKOUT_WORKER_TOKEN=${token}\n`)
 fs.writeFileSync(file,JSON.stringify({...context,expectedSecrets:2},null,2)+'\n')
 console.log('PASS exclusive local worker token in Edge runtime/Vault only; global job inactive')
}
export function serve(file){
 const context=runtime(file);actionsContext(file);assert.ok(!fs.existsSync(path.join(context.root,'serve.pid')),'do not restart or reuse a serving helper')
 const stdout=fs.openSync(path.join(context.root,'serve.log'),'wx'),stderr=fs.openSync(path.join(context.root,'serve-error.log'),'wx')
 const child=spawn(process.execPath,[cliPath(),'functions','serve','--workdir',context.root,'--env-file',path.join(context.root,'edge.env')],
  {cwd:context.root,env:localEnv(context.root),detached:true,windowsHide:true,stdio:['ignore',stdout,stderr]})
 child.unref();fs.closeSync(stdout);fs.closeSync(stderr)
 fs.writeFileSync(path.join(context.root,'serve.pid'),String(child.pid)+'\n',{flag:'wx'})
 console.log('C Edge Functions local serving helper started; PID retained only in owned runtime')
}
export async function ready(file){
 const c=actionsContext(file)
 for(let i=0;i<60;i++){
  try{
   const response=await fetch(c.api+'/functions/v1/push-test',{method:'OPTIONS',headers:{apikey:c.status.ANON_KEY??c.status.anon_key},signal:AbortSignal.timeout(2000),redirect:'error'})
   await response.body?.cancel();if(response.status===204){console.log('PASS local Edge runtime ready');return}
  }catch{}
  await new Promise((resolve)=>setTimeout(resolve,500))
 }
 throw Error('C Edge Functions failed readiness')
}
export function installSenderHarness(file){
 const context=runtime(file);actionsContext(file)
 const source=fs.readFileSync(path.join(workspace,'supabase/testing/workout-sender-harness/index.ts'))
 fs.writeFileSync(path.join(context.root,'supabase/functions/workout-push/index.ts'),source)
 assert.equal(digest(fs.readFileSync(path.join(context.root,'supabase/functions/workout-push/index.ts'))),digest(source))
 if(context.closureGate===true&&context.dispatchUrlDeferred===true){
  const sql=database(context)
  assert.equal(sql("select count(*)from vault.secrets where name='gymio_workout_push_url';"),'0','closure dispatch URL must remain absent until fake transport is installed')
  sql("select vault.create_secret('http://kong:8000/functions/v1/workout-push','gymio_workout_push_url');")
  fs.writeFileSync(file,JSON.stringify({...context,dispatchUrlDeferred:false,expectedSecrets:2},null,2)+'\n')
 }
 console.log('PASS test-only encrypted fake transport installed in C runtime snapshot; production source unchanged')
}
const phases={create:createRuntime,start:startRuntime,credentials,bootstrap,adapters,gate,secrets,serve,ready,'install-sender-harness':installSenderHarness}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [phase,file]=process.argv.slice(2)
 assert.ok(Object.hasOwn(phases,phase),'explicit setup phase required')
 assert.equal(process.cwd(),workspace,'run from Gym.io workspace')
 try{await phases[phase](file)}catch(error){console.error(error.message);process.exitCode=1}
}

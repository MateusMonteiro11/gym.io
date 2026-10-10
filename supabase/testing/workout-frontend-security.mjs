import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn}from 'node:child_process'
import {workoutContext}from './workout-context.mjs'
const {context,status}=workoutContext(process.argv[2]),env=fs.readFileSync(path.join(context.root,'edge.env'),'utf8')
const secrets=[env.match(/^VAPID_PRIVATE_KEY=(.+)$/m)?.[1],env.match(/^GYMIO_WORKOUT_WORKER_TOKEN=(.+)$/m)?.[1],status.SERVICE_ROLE_KEY,status.SECRET_KEY].filter(Boolean)
for(const file of fs.readdirSync('dist/assets'))if(/\.(js|css)$/.test(file)){
 const content=fs.readFileSync(`dist/assets/${file}`,'utf8');assert.ok(secrets.every((secret)=>!content.includes(secret)),'no server secret in bundle')
}
const publicEnv=Object.fromEntries(fs.readFileSync(path.join(context.root,'frontend.env'),'utf8').trim().split('\n').map((line)=>line.split(/=(.*)/s).slice(0,2)))
assert.deepEqual(Object.keys(publicEnv).sort(),['VITE_SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_URL','VITE_VAPID_PUBLIC_KEY'])
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','push','--host','localhost','--strictPort'],{env:{...process.env,...publicEnv},stdio:'ignore',windowsHide:true})
let exited=false;server.on('exit',()=>exited=true)
try{
 let ready=false
 for(let i=0;i<50&&!ready&&!exited;i++){await new Promise((r)=>setTimeout(r,300));try{const r=await fetch('http://localhost:5173',{signal:AbortSignal.timeout(1000)});await r.body?.cancel();ready=r.status===200}catch{}}
 assert.ok(ready&&!exited,'dedicated localhost Vite; strictPort preserves any existing server')
 for(const target of ['/.env','/supabase/.runtime/edge.env','/supabase/.runtime/status.json','/SUPABASE/.runtime/edge.env']){
  const r=await fetch(`http://localhost:5173${target}`,{signal:AbortSignal.timeout(5000)});assert.equal(r.status,403);const text=await r.text();assert.ok(secrets.every((secret)=>!text.includes(secret)))
 }
 console.log('PASS B client bundle secret scan and four real localhost Vite HTTP denials; no remote URL, unchanged CORS, no env-file edits')
}finally{server.kill()}

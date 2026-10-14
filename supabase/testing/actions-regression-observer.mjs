// Local harness observability only. No default process deadline, shell, SQL or
// provider transport. Unredacted child streams remain private in memory.
import fs from 'node:fs'
import {spawn} from 'node:child_process'
import {StringDecoder} from 'node:string_decoder'
import {performance} from 'node:perf_hooks'

const safeIdentifiers=new Set(['gymio_workout_actions_private','gymio_workout_push_private','gymio_workout_executor',
 'gymio_push_executor','workout_notification_action','workout_push_begin_controls','emitir_controles_notificacao_treino',
 'actions_reexecution_regressions','actions-reexecution-regressions','actions-regression-observer','actions-reexecution-setup',
 'workout-edge-integration','actions-b-regression-repository','workout-sender-harness'])
export function createCredentialRedactor(values=[]){
 const known=[...new Set(values.filter((value)=>typeof value==='string'&&value.length>0))].sort((a,b)=>b.length-a.length)
 const key=/\b(?:["']?(?:jwt|password|access_token|refresh_token|capability|capabilities|token_hash|claim_token|worker_token|workerToken|vapid_private_key|privateKey|publicKey|p256dh|auth|endpoint|apikey|authorization|headers|snapshot)["']?)\s*[:=]\s*/i
 return (input)=>{
  let text=String(input)
  for(const value of known){text=text.replaceAll(value,'[REDACTED]');const escaped=JSON.stringify(value).slice(1,-1);if(escaped!==value)text=text.replaceAll(escaped,'[REDACTED]')}
  text=text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED_JWT]')
   .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[REDACTED_KEY]')
   .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'[REDACTED_UUID]')
   .replace(/https:\/\/[^\s'"<>)]+/g,'[REDACTED_HTTPS_URL]')
   .replace(/<Buffer(?:\s+[0-9a-f]{2})+[^>]*>/gi,'[REDACTED_BYTES]')
   .replace(/(?:Buffer|Uint8Array|ArrayBuffer)\(\d+\)\s*\[[\s\S]*?\]/g,'[REDACTED_BYTES]')
   .replace(/[A-Za-z0-9_-]{22,}/g,(value)=>safeIdentifiers.has(value)?value:'[REDACTED_OPAQUE]')
  let depth=0,continuation=false
  return text.split('\n').map((line)=>{
   const balance=(value)=>(value.match(/[\[{]/g)?.length??0)-(value.match(/[\]}]/g)?.length??0)
   if(depth>0||continuation){depth+=balance(line);continuation=/\+\s*$/.test(line);if(depth<0)depth=0;return '[REDACTED_FIELD_CONTINUATION]'}
   const match=line.match(key)
   if(!match)return line
   const tail=line.slice(match.index+match[0].length);depth=Math.max(0,balance(tail));continuation=/\+\s*$/.test(tail)
   return line.slice(0,match.index+match[0].length)+'[REDACTED_FIELD]'
  }).join('\n')
 }
}

export function observeChildProcess({executable,args,cwd,env,stdoutFile,stderrFile,redact=(text)=>String(text),
 maxOutputChars=16*1024*1024,onState=()=>{}}){
 const started=performance.now(),state={started_at:new Date().toISOString(),finished_at:null,elapsed_ms:null,exit_code:null,
  signal:null,timed_out:false,timeout_ms:null,termination_reason:null,requested_signal:null,pid:null,
  stdout:'',stderr:'',combined_output:'',stdout_characters:0,stderr_characters:0,buffer_limit_characters:maxOutputChars,
  spawn_error_code:null,exit_observed_at:null}
 const streams={stdout:{raw:'',decoder:new StringDecoder('utf8'),file:stdoutFile},stderr:{raw:'',decoder:new StringDecoder('utf8'),file:stderrFile}}
 for(const stream of Object.values(streams))fs.writeFileSync(stream.file,'',{flag:'wx'})
 return new Promise((resolve)=>{
  let child,done=false,observerFailed=false
  const update=()=>{if(observerFailed)return;try{onState({...state})}catch{observerFailed=true;state.termination_reason='observer_write_failure';requestTermination('observer_write_failure')}}
  const requestTermination=(reason,signal='SIGTERM')=>{
   if(!state.termination_reason)state.termination_reason=reason
   state.requested_signal=signal
   try{child?.kill(signal)}catch{state.termination_reason+=':kill_failed'}
  }
  const flush=(name,final=false)=>{
   const stream=streams[name],prefix=final?stream.raw:stream.raw.slice(0,Math.max(0,stream.raw.lastIndexOf('\n')+1))
   state[name]=redact(prefix)
   try{fs.writeFileSync(stream.file,state[name])}catch{observerFailed=true;requestTermination('observer_write_failure')}
  }
  const append=(name,chunk)=>{
   streams[name].raw+=streams[name].decoder.write(chunk);state[`${name}_characters`]=streams[name].raw.length
   if(streams[name].raw.length>maxOutputChars)requestTermination(`${name}_buffer_limit`)
   flush(name);update()
  }
  const terminateFromParent=(signal)=>{requestTermination(`parent_${signal.toLowerCase()}`,signal);update()}
  const onInterrupt=()=>terminateFromParent('SIGINT'),onTerminate=()=>terminateFromParent('SIGTERM')
  const finish=(code,signal)=>{
   if(done)return;done=true
   process.removeListener('SIGINT',onInterrupt);process.removeListener('SIGTERM',onTerminate)
   for(const name of Object.keys(streams)){streams[name].raw+=streams[name].decoder.end();state[`${name}_characters`]=streams[name].raw.length;flush(name,true)}
   state.combined_output=redact(streams.stdout.raw+'\n[STDERR]\n'+streams.stderr.raw)
   state.exit_code=code;state.signal=signal??null;state.finished_at=new Date().toISOString()
   state.elapsed_ms=Number((performance.now()-started).toFixed(3))
   state.termination_reason??=state.spawn_error_code?'spawn_error':signal?'child_signal':code===0?'completed':'child_exit_nonzero'
   update();resolve({...state})
  }
  update()
  if(observerFailed){finish(null,null);return}
  try{
   child=spawn(executable,args,{cwd,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']})
   child.once('spawn',()=>{state.pid=child.pid??null;update()})
   child.stdout?.on('data',(chunk)=>append('stdout',chunk));child.stderr?.on('data',(chunk)=>append('stderr',chunk))
   child.once('error',(error)=>{state.spawn_error_code=/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'SPAWN_ERROR';state.termination_reason??='spawn_error';update()})
   child.once('exit',()=>{state.exit_observed_at=new Date().toISOString();update()})
   child.once('close',finish)
   process.once('SIGINT',onInterrupt);process.once('SIGTERM',onTerminate)
  }catch{state.spawn_error_code='SPAWN_ERROR';finish(null,null)}
 })
}

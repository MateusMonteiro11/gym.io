import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { actionOrigins, canonicalCapability, createWorkoutActionHandler } from './workoutActionHandler.js'
import { createWorkoutActionRepository } from './workoutActionRepository.js'
import { createWorkoutPushRepository } from './workoutPushRepository.js'
const token=randomBytes(32).toString('base64url')
const request=(body={capability:token},options={})=>new Request('http://localhost/functions/v1/workout-action'+(options.query??''),{
  method:options.method??'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json',...options.headers},
  ...((options.method??'POST')==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})})
test('canonical validation rejects noncanonical representations; hashing belongs only to SQL',()=>{
  assert.equal(canonicalCapability(token),true)
  for(const value of [token+'=',token.slice(0,42)+'B','a'.repeat(64),null,123])assert.equal(canonicalCapability(value),false)
  // A canonical encoding of a hash can look like a random token; SQL must hash it
  // again and reject it by lookup. This property is covered in the prepared SQL matrix.
  assert.equal(canonicalCapability(createHash('sha256').update(token).digest('base64url')),true)
  for(const origin of ['*','null','http://localhost:5173/','https://user@host.invalid','http://evil.invalid'])assert.throws(()=>actionOrigins(origin))
})
test('strict boundary rejects malformed requests before administrative initialization',async()=>{
  let initialized=0;const handler=createWorkoutActionHandler({initialize:()=>{initialized++;return {consume:async()=>({result:'ok'})}}})
  for(const bad of [request({},{}),request({capability:token,user:'bad'}),request([]),request('x'.repeat(257)),request('{'),request({capability:token},{query:'?x=1'}),
    request({capability:token},{headers:{Origin:'http://localhost:5174'}}),request({capability:token},{headers:{'Content-Type':'text/plain'}}),request(undefined,{method:'GET'})]){
    assert.ok((await handler(bad)).status>=400)
  }
  assert.equal(initialized,0)
  const preflight=await handler(request(undefined,{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}}))
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'http://localhost:5173');assert.equal(initialized,0)
})
test('Edge returns only allowed outcomes and projection, with no token or internal error',async()=>{
  for(const result of ['ok','stale','expired','already_used','unavailable']){
    const handler=createWorkoutActionHandler({initialize:()=>({consume:async(value)=>{assert.equal(value,token);return {result,projection:{version:2},internal:'private'}}})})
    const response=await handler(request());const text=await response.text();assert.ok(!text.includes(token)&&!text.includes('private'))
    assert.deepEqual(JSON.parse(text),{result,...(result==='ok'?{projection:{version:2}}:{})})
  }
  const handler=createWorkoutActionHandler({initialize:()=>{throw Error('secret') }})
  assert.deepEqual(await (await handler(request())).json(),{result:'unavailable'})
})
test('timeout aborts the only call, without retry or reporting success',async()=>{
  let calls=0,signal;const handler=createWorkoutActionHandler({timeoutMs:10,initialize:()=>({consume:async(_token,s)=>{calls++;signal=s;return new Promise(()=>{})}})})
  const result=await handler(request());assert.equal(result.status,503);assert.equal(calls,1);assert.equal(signal.aborted,true)
})
test('slow body timeout cancels consumption and cannot initialize admin later',async()=>{
  let initialized=0,cancelled=false
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'))},cancel(){cancelled=true}})
  const req=new Request('http://localhost/workout-action',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:stream,duplex:'half'})
  const handler=createWorkoutActionHandler({timeoutMs:10,initialize:()=>{initialized++;return {consume:async()=>({result:'ok'})}}})
  assert.equal((await handler(req)).status,503);assert.equal(cancelled,true);assert.equal(initialized,0)
})
test('repository passes canonical text only, disables retries and sender uses bound C bridge',async()=>{
  const calls=[];const query={abortSignal:()=>query,retry:(retry)=>{assert.equal(retry,false);return Promise.resolve({data:{result:'stale'}})}}
  const client={rpc:(name,args)=>{calls.push({name,args});return query}}
  await createWorkoutActionRepository(client).consume(token,new AbortController().signal)
  assert.deepEqual(calls,[{name:'workout_notification_action',args:{p_capability:token}}])
  const repository=createWorkoutPushRepository({rpc:async(name,args)=>{calls.push({name,args});return {data:null}}})
  await repository.begin({id:'delivery',claim_token:'claim'})
  assert.equal(calls.at(-1).name,'workout_push_begin_controls')
})

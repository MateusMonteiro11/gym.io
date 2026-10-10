import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkoutPushHandler } from './workoutPushHandler.js'
const token = 'A'.repeat(43)
const request = (body='{}', headers={}, url='http://localhost/workout-push', method='POST') => new Request(url, {
  method, headers: { 'Content-Type':'application/json','X-Gymio-Workout-Worker-Token':token,...headers }, ...(method==='POST'?{body}:{}) })

test('workout machine boundary rejects browser/token/body/query before administrative initialization', async () => {
  let initialized=0
  const handler=createWorkoutPushHandler({workerToken:token,initialize:()=>{initialized++; throw new Error('unexpected')}})
  for (const [req,status] of [
    [request('{}',{'X-Gymio-Workout-Worker-Token':''}),401], [request('{}',{'X-Gymio-Workout-Worker-Token':'B'.repeat(43)}),401],
    [request('{}',{Origin:'http://localhost:5173'}),403], [request('{}',{'Sec-Fetch-Site':'same-origin'}),403],
    [request('{"subscription_id":"arbitrary"}'),400], [request('[]'),400], [request('null'),400], [request('{bad'),400],
    [request('{}',{},'http://localhost/workout-push?token='+token),400], [request('{}',{},'http://localhost/workout-push','OPTIONS'),405],
  ]) {
    const result=await handler(req); assert.equal(result.status,status); assert.equal(result.headers.get('Access-Control-Allow-Origin'),null)
    assert.ok(!(await result.text()).includes(token))
  }
  assert.equal(initialized,0)
})
test('workout batch bounds transport at four, isolates failures and reports provider acceptance', async () => {
  const claims=Array.from({length:10},(_,id)=>({id,claim_token:'claim'})); let active=0,max=0,attempts=0
  const outcomes=[]
  const handler=createWorkoutPushHandler({workerToken:token,initialize:()=>({
    repository:{claim:async(limit)=>{assert.equal(limit,10);return claims},begin:async(claim)=>({snapshot:{id:claim.id},payload:{version:2}}),
      complete:async(claim,outcome)=>outcomes.push([claim.id,outcome])},
    sendPush:async(snapshot)=>{attempts++;active++;max=Math.max(max,active); await new Promise((r)=>setTimeout(r,1));active--;
      if(snapshot.id===0)throw new Error('timeout');return snapshot.id===1?404:snapshot.id===2?410:snapshot.id===3?503:201},
  })})
  const result=await handler(request());const counts=await result.json()
  assert.equal(result.status,200);assert.equal(max,4);assert.equal(attempts,10)
  assert.deepEqual(counts,{claimed:10,attempted:10,accepted:6,expired:2,failed:2,skipped:0})
  assert.equal(outcomes.length,10);assert.ok(!JSON.stringify(counts).includes('delivered'))
})
test('removed or unavailable subscriptions never use a previously claimed snapshot', async () => {
  let sends=0
  const handler=createWorkoutPushHandler({workerToken:token,initialize:()=>({repository:{
    claim:async()=>[{id:1,endpoint:'forbidden'},{id:2}],begin:async(c)=>{if(c.id===2)throw new Error('db');return null},complete:()=>assert.fail()},
    sendPush:()=>sends++,})})
  const counts=await (await handler(request())).json();assert.equal(sends,0);assert.equal(counts.skipped,2)
})

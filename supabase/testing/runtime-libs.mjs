import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {workoutContext} from './workout-context.mjs'
const {context,status,users,api}=workoutContext(process.argv[2])
const response=await fetch(`${api}/functions/v1/runtime-libs`,{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:`Bearer ${users[0].jwt}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)})
assert.equal(response.status,200,'real Edge library integration')
const result=await response.json();assert.equal(result.passed,true)
for(const key of ['rpc','abortSignal','functionsInvoke','adminClient'])assert.equal(result[key],true,key)
assert.equal(result.supabaseJs,'2.106.0')
assert.equal(result.runtime.deno,'supabase-edge-runtime-1.77.4 (compatible with Deno v2.1.4)')
assert.equal(result.externalRequests,0)
fs.writeFileSync(path.join(context.root,'runtime-libs-result.json'),JSON.stringify(result,null,2))
console.log('PASS supabase-js 2.106.0: actual local RPC, aborted Data API query, Functions invoke and server admin wrapper in Edge Runtime')

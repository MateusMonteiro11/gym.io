import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createCredentialRedactor,observeChildProcess} from './actions-regression-observer.mjs'

const temporary=()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gymio-regression-observer-test-'))
 const clean=()=>{const resolved=fs.realpathSync(directory),relative=path.relative(fs.realpathSync(os.tmpdir()),resolved)
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(resolved).startsWith('gymio-regression-observer-test-'))
  fs.rmSync(resolved,{recursive:true,force:true})}
 return {directory,clean}
}
const options=(directory,name,redact)=>({executable:process.execPath,cwd:process.cwd(),env:{...process.env},
 stdoutFile:path.join(directory,`${name}.stdout.log`),stderrFile:path.join(directory,`${name}.stderr.log`),redact})

test('redacts dynamic credentials, UUID claims, byte hashes and multiline secrets, while retaining useful locations',()=>{
 const secret='short-local-password-A1!',capability='Q'.repeat(43),auth='r'.repeat(22),key='P'.repeat(87)
 const redact=createCredentialRedactor([secret])
 const output=redact(`password: '${secret}'\nauth: '${auth}'\np256dh: '${key}'\nactual: '${capability}'\nclaim_token: '12345678-1234-1234-1234-123456789abc'\n`+
  `headers: {\n authorization: 'eyJheader.eyJpayload.signature'\n}\nactual: <Buffer 01 02 03 04>\n`+
  `password: 'tiny' +\n 'pieces',\nAssertionError: 0 !== 1\n at workout-local-tests.mjs:76:24\nCONTEXT: gymio_workout_push_private.begin_attempt`)
 for(const value of [secret,capability,auth,key,'12345678-1234-1234-1234-123456789abc','eyJheader.eyJpayload.signature','tiny','pieces','01 02 03 04'])
  assert.ok(!output.includes(value),'credential or byte material must not survive redaction')
 assert.ok(output.includes('AssertionError: 0 !== 1')&&output.includes('workout-local-tests.mjs:76:24'))
 assert.ok(output.includes('gymio_workout_push_private.begin_attempt'))
})

test('records nonzero exit, stdout/stderr and timestamps without introducing a deadline',async()=>{
 const temporaryRoot=temporary()
 try{
  const result=await observeChildProcess({...options(temporaryRoot.directory,'failure',createCredentialRedactor()),
   args:['-e',"console.log('PASS original prior step');console.error('AssertionError: 0 !== 1 at workout-local-tests.mjs:76:24');process.exitCode=1"]})
  assert.equal(result.exit_code,1);assert.equal(result.termination_reason,'child_exit_nonzero')
  assert.equal(result.timed_out,false);assert.equal(result.timeout_ms,null)
  assert.ok(result.started_at&&result.finished_at&&result.elapsed_ms>=0)
  assert.ok(result.stdout.includes('PASS original prior step')&&result.stderr.includes('workout-local-tests.mjs:76:24'))
  assert.ok(result.combined_output.includes('[STDERR]')&&result.combined_output.includes('AssertionError: 0 !== 1'))
 }finally{temporaryRoot.clean()}
})

test('holds incomplete stream lines so split credentials never reach incremental evidence',async()=>{
 const temporaryRoot=temporary(),secret='S'.repeat(43),auth='K'.repeat(22),observed=[]
 try{
  const result=await observeChildProcess({...options(temporaryRoot.directory,'split',createCredentialRedactor([secret])),
   args:['-e',`process.stdout.write('capability: '+${JSON.stringify(secret.slice(0,10))});process.stderr.write('auth: '+${JSON.stringify(auth.slice(0,9))});setTimeout(()=>{process.stdout.write(${JSON.stringify(secret.slice(10))}+'\\n');process.stderr.write(${JSON.stringify(auth.slice(9))}+'\\n')},20)`],
   onState:(state)=>observed.push(state.stdout+'\n'+state.stderr)})
  assert.equal(result.exit_code,0)
  assert.ok(observed.every((text)=>!text.includes(secret)&&!text.includes(secret.slice(0,10))&&!text.includes(auth)&&!text.includes(auth.slice(0,9))),'partial secret must not be persisted')
  assert.ok(!fs.readFileSync(path.join(temporaryRoot.directory,'split.stdout.log'),'utf8').includes(secret))
  assert.ok(!result.combined_output.includes(secret)&&!result.combined_output.includes(auth))
 }finally{temporaryRoot.clean()}
})

test('makes the preserved buffer limit termination explicit rather than a timeout',async()=>{
 const temporaryRoot=temporary()
 try{
  const result=await observeChildProcess({...options(temporaryRoot.directory,'overflow',createCredentialRedactor()),maxOutputChars:1024,
   args:['-e',"process.stdout.write('x'.repeat(4096)+'\\n');setTimeout(()=>{},500)"]})
  assert.equal(result.termination_reason,'stdout_buffer_limit');assert.equal(result.requested_signal,'SIGTERM')
  assert.equal(result.timed_out,false);assert.ok(result.stdout_characters>1024)
 }finally{temporaryRoot.clean()}
})

test('preserves spawn error and final observation when the executable is unavailable',async()=>{
 const temporaryRoot=temporary()
 try{
  const result=await observeChildProcess({...options(temporaryRoot.directory,'spawn',createCredentialRedactor()),
   executable:path.join(temporaryRoot.directory,'missing-node'),args:[]})
  assert.equal(result.termination_reason,'spawn_error');assert.equal(result.spawn_error_code,'ENOENT')
  assert.equal(result.timed_out,false);assert.ok(result.finished_at)
 }finally{temporaryRoot.clean()}
})

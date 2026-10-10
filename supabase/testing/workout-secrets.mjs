import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {workoutContext} from './workout-context.mjs'
const {context,sql,literal:q}=workoutContext(process.argv[2])
const envPath=path.join(context.root,'edge.env'),previous=fs.readFileSync(envPath,'utf8')
assert.ok(!previous.includes('GYMIO_WORKOUT_WORKER_TOKEN='),'do not reuse worker token')
assert.equal(sql("select count(*)from vault.secrets where name in('gymio_workout_push_worker_token','gymio_workout_push_url');"),'0')
const token=randomBytes(32).toString('base64url')
sql(`select vault.create_secret(${q(token)},'gymio_workout_push_worker_token');select vault.create_secret('http://kong:8000/functions/v1/workout-push','gymio_workout_push_url');`)
fs.writeFileSync(envPath,previous+`GYMIO_WORKOUT_WORKER_TOKEN=${token}\n`)
fs.writeFileSync(path.join(context.root,'context.json'),JSON.stringify({...context,expectedSecrets:2}))
console.log('PASS random server-only local worker token, dedicated header, two Vault secrets; no secret output')

import fs from 'node:fs'
import assert from 'node:assert/strict'
import {actionsContext} from './actions-context.mjs'
const {sql}=actionsContext(process.argv[2])
assert.equal(sql("select to_regnamespace('gymio_workout_actions_private') is null;"),'t','fresh C namespace required')
assert.equal(sql("select to_regprocedure('public.workout_push_begin(uuid,uuid)') is not null;"),'t','fixture, EXPAND, Memory, A and B must already exist')
const file='supabase/migrations/20261011021351_workout_notification_actions.sql'
sql(fs.readFileSync(file,'utf8'))
sql("notify pgrst,'reload schema';")
console.log('PASS unchanged C migration and embedded historical/security assertions on new isolated C runtime')

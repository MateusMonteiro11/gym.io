import fs from 'node:fs'
import assert from 'node:assert/strict'
import {workoutContext} from './workout-context.mjs'
const {sql}=workoutContext(process.argv[2])
assert.equal(sql("select to_regnamespace('gymio_workout_push_private')is null;"),'t','fresh B schema required')
sql(fs.readFileSync('supabase/migrations/20261010183821_workout_notifications.sql','utf8'))
sql("notify pgrst,'reload schema';")
console.log('PASS complete unchanged UTF-8 B migration and assertions in a fresh schema')

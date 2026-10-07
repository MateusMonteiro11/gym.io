import fs from 'node:fs'
import assert from 'node:assert/strict'

const env = fs.readFileSync('supabase/.runtime/edge.env', 'utf8')
const privateKey = env.match(/^VAPID_PRIVATE_KEY=(.+)$/m)[1]
const status = JSON.parse(fs.readFileSync('supabase/.runtime/status.json', 'utf8').replace(/^\uFEFF/, ''))
const secrets = [privateKey, status.SERVICE_ROLE_KEY, status.SECRET_KEY].filter(Boolean)
for (const file of fs.readdirSync('dist/assets')) {
  if (!/\.(js|css)$/.test(file)) continue
  const contents = fs.readFileSync(`dist/assets/${file}`, 'utf8')
  assert.ok(secrets.every((secret) => !contents.includes(secret)), 'no local privileged secret in client bundle')
}
for (const url of ['/.env', '/supabase/.runtime/edge.env', '/supabase/.runtime/status.json', '/SUPABASE/.runtime/edge.env']) {
  const response = await fetch(`http://127.0.0.1:5173${url}`, { signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, 403, `Vite denies ${url}`)
  const text = await response.text()
  assert.ok(secrets.every((secret) => !text.includes(secret)), 'no HTTP secret exposure')
}
console.log('PASS frontend bundle secret scan and actual Vite HTTP denials, including Windows case variants')

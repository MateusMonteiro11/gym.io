// Start only after port 5173 is free. Never stops any existing A/B process.
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { actionsContext } from './actions-context.mjs'

try {
  assert.equal(process.argv.length, 3)
  const c = actionsContext(process.argv[2]), root = c.context.root
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  assert.equal(process.cwd(), workspace)
  assert.ok(!fs.existsSync(path.join(root, 'frontend.pid')))
  const values = Object.fromEntries(fs.readFileSync(path.join(root, 'frontend.env'), 'utf8').trim().split(/\r?\n/)
    .map(line => { const separator = line.indexOf('='); assert.ok(separator > 0); return [line.slice(0, separator), line.slice(separator + 1)] }))
  assert.deepEqual(Object.keys(values).sort(), ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL', 'VITE_VAPID_PUBLIC_KEY'])
  assert.equal(values.VITE_SUPABASE_URL, c.api)
  assert.equal(values.VITE_SUPABASE_PUBLISHABLE_KEY, c.status.ANON_KEY ?? c.status.anon_key)
  assert.equal(Buffer.from(values.VITE_VAPID_PUBLIC_KEY, 'base64url').length, 65)
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', () => reject(Error('Port 5173 occupied; existing frontend preserved')))
    server.listen({ host: '::', port: 5173, ipv6Only: false }, () => server.close(resolve))
  })
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(VITE_|SUPABASE_|VAPID_|GYMIO_|PUSH_TEST_)/.test(name)))
  Object.assign(env, values)
  const stdout = fs.openSync(path.join(root, 'frontend.log'), 'wx'), stderr = fs.openSync(path.join(root, 'frontend-error.log'), 'wx')
  const child = spawn(process.execPath, [path.join(workspace, 'node_modules/vite/bin/vite.js'), '--mode', 'push', '--host', 'localhost', '--strictPort', '--port', '5173'],
    { cwd: workspace, env, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr] })
  child.unref(); fs.closeSync(stdout); fs.closeSync(stderr)
  fs.writeFileSync(path.join(root, 'frontend.pid'), String(child.pid) + '\n', { flag: 'wx' })
  console.log('MANUAL_C_FRONTEND_STARTED')
} catch { console.error('MANUAL_C_FRONTEND_FAILED: existing runtimes preserved'); process.exitCode = 1 }

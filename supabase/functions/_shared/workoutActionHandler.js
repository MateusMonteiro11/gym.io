const CANONICAL = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/
const RESULTS = new Set(['ok', 'stale', 'expired', 'already_used', 'unavailable'])
export function canonicalCapability(value) { return typeof value === 'string' && CANONICAL.test(value) }

export function actionOrigins(value = 'http://localhost:5173') {
  const origins = value.split(',').map((origin) => origin.trim())
  if (!origins.length || origins.some((origin) => {
    try {
      const url = new URL(origin)
      return url.origin !== origin || url.username || url.password ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost'))
    } catch { return true }
  })) throw new Error('action_origins_invalid')
  return new Set(origins)
}

async function body(request,signal) {
  if (!request.body) return null
  const reader = request.body.getReader(); const chunks = []; let size = 0
  const abort=()=>{reader.cancel().catch(()=>{})}
  signal.addEventListener('abort',abort,{once:true})
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 256) { await reader.cancel(); return null }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    return parsed && !Array.isArray(parsed) && Object.keys(parsed).length === 1 && canonicalCapability(parsed.capability) ? parsed.capability : null
  } catch { return null } finally { signal.removeEventListener('abort',abort);reader.releaseLock() }
}

// No JWT or browser identity is accepted here: authorization is the opaque bearer.
// The injected repository is the only administrative operation this handler uses.
export function createWorkoutActionHandler({ initialize, origins = actionOrigins(), timeoutMs = 10000 }) {
  return async (request) => {
    const origin = request.headers.get('origin')
    const allowed = origins.has(origin)
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}) }
    const response = (result, status = 200, projection) => new Response(JSON.stringify({ result, ...(projection ? { projection } : {}) }), { status, headers })
    const url = new URL(request.url)
    if (!allowed || url.search || url.pathname.split('/').pop() !== 'workout-action') return response('unavailable', 403)
    if (request.method === 'OPTIONS') {
      if (request.headers.get('access-control-request-method') !== 'POST' ||
        (request.headers.get('access-control-request-headers') ?? '').split(',').some((h) => h.trim() && h.trim().toLowerCase() !== 'content-type')) return response('unavailable', 403)
      return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } })
    }
    if (request.method !== 'POST') return response('unavailable', 405)
    if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return response('unavailable', 400)
    const controller = new AbortController(); let timer
    try {
      // Limit both body consumption and SQL transport; timeout cannot prove rollback.
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')) }, timeoutMs) })
      const operation = (async () => {
        const token = await body(request,controller.signal)
        if (controller.signal.aborted) return response('unavailable',503)
        if (!token) return response('unavailable', 400)
        const repository = initialize()
        const value = await repository.consume(token, controller.signal)
        if (!value || !RESULTS.has(value.result)) return response('unavailable', 503)
        // SQL owns projection construction. Never return arbitrary fields/errors.
        return response(value.result, 200, value.result === 'ok' ? value.projection : undefined)
      })()
      return await Promise.race([operation, deadline])
    } catch { return response('unavailable', 503) } finally { clearTimeout(timer) }
  }
}

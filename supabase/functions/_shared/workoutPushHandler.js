const HEADER = 'X-Gymio-Workout-Worker-Token'
const TOKEN = /^[A-Za-z0-9_-]{43}$/
function sameToken(received, expected) {
  if (!TOKEN.test(expected ?? '') || !TOKEN.test(received ?? '')) return false
  let difference = 0
  for (let i = 0; i < 43; i++) difference |= received.charCodeAt(i) ^ expected.charCodeAt(i)
  return difference === 0
}
const response = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

// Transport/repository injection is a test port, never an HTTP option.
// initialize() is intentionally invoked only after the machine boundary passes.
export function createWorkoutPushHandler({ workerToken, initialize }) {
  return async (request) => {
    if (!sameToken(request.headers.get(HEADER), workerToken)) return response(401, { error: 'unauthorized' })
    if (request.headers.has('Origin') || [...request.headers.keys()].some((key) => key.startsWith('sec-fetch-'))) {
      return response(403, { error: 'browser_not_allowed' })
    }
    if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' })
    if (new URL(request.url).search || !/\/workout-push$/.test(new URL(request.url).pathname)) return response(400, { error: 'invalid_request' })
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return response(400, { error: 'invalid_request' })
    try {
      if (Number(request.headers.get('content-length') ?? 0) > 512) return response(400, { error: 'invalid_request' })
      const text = await request.text()
      if (new TextEncoder().encode(text).length > 512) return response(400, { error: 'invalid_request' })
      const body = JSON.parse(text)
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length) return response(400, { error: 'invalid_request' })
    } catch { return response(400, { error: 'invalid_request' }) }
    const counts = { claimed: 0, attempted: 0, accepted: 0, expired: 0, failed: 0, skipped: 0 }
    try {
      const { repository, sendPush } = await initialize()
      const claims = await repository.claim(10)
      if (!Array.isArray(claims) || claims.length > 10) throw new Error('invalid_batch')
      counts.claimed = claims.length
      let cursor = 0
      await Promise.all(Array.from({ length: Math.min(4, claims.length) }, async () => {
        while (cursor < claims.length) {
          const claim = claims[cursor++]
          // No endpoint/key snapshot is accepted from claim(). Re-read, lock and
          // authorize it in begin(), which commits attempted_at before transport.
          let attempt
          try { attempt = await repository.begin(claim) }
          catch { counts.skipped++; continue }
          if (!attempt) { counts.skipped++; continue }
          counts.attempted++
          let outcome = 'failed'
          try {
            const status = await sendPush(attempt.snapshot, attempt.payload)
            outcome = status >= 200 && status < 300 ? 'accepted' : [404, 410].includes(status) ? 'expired' : 'failed'
          } catch { /* Unknown transport results are definitive; never retry. */ }
          try { await repository.complete(claim, outcome, attempt.snapshot) }
          catch { outcome = 'failed' /* The irreversible marker still prevents retry. */ }
          counts[outcome]++
        }
      }))
      return response(200, counts)
    } catch { return response(503, { error: 'worker_unavailable', ...counts }) }
  }
}

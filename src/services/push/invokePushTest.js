import { sanitizePushTestResult } from './pushResults.js'

async function readKnownBody(response, signal) {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('push_test_failed')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('push_test_failed')
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  const chunks = []
  let length = 0
  try {
    while (true) {
      if (signal?.aborted) throw new Error('push_test_failed')
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 1024) { abort(); throw new Error('push_test_failed') }
      chunks.push(value)
    }
    if (signal?.aborted) throw new Error('push_test_failed')
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder().decode(bytes))
  } finally {
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

export async function invokePushTest(invoke, id, signal) {
  try {
    const { data, error, response } = await invoke('push-test', { body: { subscription_id: id }, signal })
    if (!error) return sanitizePushTestResult(data, response?.status ?? 200)
    if (error.name !== 'FunctionsHttpError' || !(error.context instanceof Response)) throw new Error('push_test_failed')
    return sanitizePushTestResult(await readKnownBody(error.context, signal), error.context.status)
  } catch {
    // Never expose context, headers, provider/Supabase messages or raw exceptions.
    throw new Error('push_test_failed')
  }
}

// Server-only credentials. A modern secret belongs in apikey, never Bearer.
export function createPushAdminClient({ createClient, env, fetchImpl = fetch }) {
  const url = env('SUPABASE_URL')
  let keys
  const encoded = env('SUPABASE_SECRET_KEYS')
  if (encoded) {
    try { keys = JSON.parse(encoded) } catch { throw new Error('push_server_credentials_invalid') }
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('push_server_credentials_invalid')
  }
  const modern = keys?.default
  if (modern !== undefined && (typeof modern !== 'string' || !/^sb_secret_[A-Za-z0-9_-]+$/.test(modern))) {
    throw new Error('push_server_credentials_invalid')
  }
  const key = modern ?? env('SUPABASE_SERVICE_ROLE_KEY')
  if (!key || (!modern && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))) {
    throw new Error('push_server_credentials_invalid')
  }
  const origin = new URL(url).origin
  const serverFetch = (input, init = {}) => {
    if (new URL(input instanceof Request ? input.url : input).origin !== origin) throw new Error('push_server_destination_invalid')
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
    // supabase-js can derive Authorization from its key when no JWT is present.
    // Keep a caller JWT from getUser(jwt); strip only a secret used as Bearer.
    if (/^Bearer sb_secret_/i.test(headers.get('authorization') ?? '')) headers.delete('authorization')
    return fetchImpl(input, { ...init, headers, redirect: 'error' })
  }
  return {
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: serverFetch } }),
    credentialKind: modern ? 'secret_key' : 'legacy_service_role',
  }
}

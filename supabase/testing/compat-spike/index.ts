// Executed only in a disposable, authenticated local Edge Function.
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const base64url = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const vapid = webpush.generateVAPIDKeys()
  const request = webpush.generateRequestDetails({
    endpoint: 'https://fcm.googleapis.com/fcm/send/local-synthetic',
    keys: { p256dh: base64url(raw), auth: base64url(crypto.getRandomValues(new Uint8Array(16))) },
  }, JSON.stringify({ version: 1, type: 'test', title: 'Gym.io', body: 'Notificações de treino ativadas.', data: { url: '/dashboard' } }), {
    vapidDetails: { publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'mailto:local-test@gym.io' },
    TTL: 60,
  })
  const result = {
    imported: true,
    method: request.method,
    encryptedBytes: request.body.length,
    contentEncoding: request.headers['Content-Encoding'] ?? request.headers['content-encoding'],
    hasAuthorization: Boolean(request.headers.Authorization ?? request.headers.authorization),
    runtime: Deno.version,
    library: 'web-push@3.6.7',
    transmitted: false,
  }
  return Response.json(result)
})

export async function registerPushSubscription(client, value, signal) {
  let request = client
    .rpc('registrar_push_subscription', {
      p_endpoint: value.endpoint,
      p_p256dh: value.p256dh,
      p_auth: value.auth,
    })
    .retry(false)
  if (signal) request = request.abortSignal(signal)
  const { data, error, status } = await request
  if (error) {
    const failure = new Error('push_backend_failed')
    failure.registrationRejected =
      status >= 400 && status < 500 && /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(error.code ?? '')
    throw failure
  }
  if (
    typeof data !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data)
  ) {
    throw new Error('push_registration_unconfirmed')
  }
  return data
}

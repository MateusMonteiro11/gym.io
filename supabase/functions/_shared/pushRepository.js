const FIELDS = 'id,id_usuario,endpoint,p256dh,auth,updated_at,last_test_requested_at'
function checked(result) { if (result.error) throw new Error('push_repository_failed'); return result.data }

export function createPushRepository(client) {
  return {
    get: async (userId, id) => checked(await client.from('push_subscriptions').select(FIELDS).eq('id', id).eq('id_usuario', userId).maybeSingle()),
    claim: async (userId, id, now) => {
      const cutoff = new Date(now.getTime() - 30000).toISOString()
      return checked(await client.from('push_subscriptions').update({ last_test_requested_at: now.toISOString() })
        .eq('id', id).eq('id_usuario', userId).or(`last_test_requested_at.is.null,last_test_requested_at.lt.${cutoff}`)
        .select(FIELDS).maybeSingle())
    },
    removeSnapshot: async (userId, snapshot) => {
      const removed = checked(await client.from('push_subscriptions').delete().eq('id', snapshot.id)
        .eq('id_usuario', userId).eq('updated_at', snapshot.updated_at)
        .eq('endpoint', snapshot.endpoint).eq('p256dh', snapshot.p256dh).eq('auth', snapshot.auth).select('id'))
      return removed.length === 1
    },
  }
}

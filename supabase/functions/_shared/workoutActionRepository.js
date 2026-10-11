export function createWorkoutActionRepository(client) {
  return {
    consume: async (capability, signal) => {
      const { data, error } = await client.rpc('workout_notification_action', { p_capability: capability })
        .abortSignal(signal).retry(false)
      if (error) throw new Error('action_unavailable')
      return data
    },
  }
}

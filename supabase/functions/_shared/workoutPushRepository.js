function checked(result) { if (result.error) throw new Error('workout_repository_failed'); return result.data }
export function createWorkoutPushRepository(client) {
  return {
    claim: async (limit) => checked(await client.rpc('workout_push_claim', { p_limit: limit })),
    begin: async (claim) => checked(await client.rpc('workout_push_begin', { p_delivery_id: claim.id, p_claim_token: claim.claim_token })),
    complete: async (claim, outcome, snapshot) => checked(await client.rpc('workout_push_complete', {
      p_delivery_id: claim.id, p_claim_token: claim.claim_token, p_outcome: outcome, p_snapshot: snapshot,
    })),
  }
}

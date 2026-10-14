// C HARNESS ONLY: unchanged historical B assertions exercise B's preserved
// administrative wrappers after C. Actual B->C is independently exercised by
// actions-edge-integration. Never replace the production repository/entry.
export function createWorkoutPushRepository(client) {
  const checked = (result) => {
    if (result.error) throw new Error('workout_repository_failed')
    return result.data
  }
  return {
    claim: async (limit) => checked(await client.rpc('workout_push_claim', {p_limit: limit})),
    begin: async (claim) => checked(await client.rpc('workout_push_begin', {
      p_delivery_id: claim.id, p_claim_token: claim.claim_token,
    })),
    complete: async (claim, outcome, snapshot) => checked(await client.rpc('workout_push_complete', {
      p_delivery_id: claim.id, p_claim_token: claim.claim_token, p_outcome: outcome, p_snapshot: snapshot,
    })),
  }
}

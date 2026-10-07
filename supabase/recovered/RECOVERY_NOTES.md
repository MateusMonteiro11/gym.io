# Gym.io backend recovery notes

Recovered on 2026-10-05 from ChatGPT Library artifacts and verified against the live Supabase project `mmtywgacruuxpzviriuh` (`ux-design-web`).

## Remote migration history

- `20260725194232_auth_email_security`
- `20260821190134_workout_session_persistence_expand`
- `20260823003337_exercise_memory_read`

## Recovered files

- `20260820181013_workout_session_persistence_expand_final.sql`
  - original local filename from August 2026
  - SHA-256: `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db`
  - this is the final audited EXPAND content that was applied remotely

- `20260821190134_workout_session_persistence_expand.sql`
  - byte-for-byte copy of the recovered final EXPAND, renamed to match the remote migration version

- `20260822192648_exercise_memory_read.sql`
  - original local Exercise Memory migration content

- `20260823003337_exercise_memory_read.sql`
  - same recovered Exercise Memory SQL, renamed to match the remote migration version

- `20260820181015_workout_session_persistence_contract.sql`
  - recovered pre-existing CONTRACT draft
  - DO NOT APPLY as-is before a fresh audit against the current frontend/backend state
  - its timestamp predates the remotely registered EXPAND/Exercise Memory versions, so it should not be reintroduced under that old migration version in a reconstructed local migration chain

- `WORKOUT_SESSION_V2_CONTRACT.md`
  - recovered integration contract from the V2 rollout period

## Current production state observed during recovery

The live database still contains the V2 session persistence model, server timestamps, revision guard, pause/rest deadline shifting, finalization materialization, and the read-only Exercise Memory RPC/index.

The legacy history write policies are still present, therefore CONTRACT has not yet been applied.

## Recommended reconstruction strategy

1. Recreate `supabase/migrations/` using the remote-aligned versions for migrations already applied:
   - `20260821190134_workout_session_persistence_expand.sql`
   - `20260823003337_exercise_memory_read.sql`
2. Keep the recovered old CONTRACT only as reference.
3. After auditing current frontend usage and live grants/policies, create a NEW CONTRACT migration with a version later than `20260823003337`.
4. Do not run `supabase db push` until local migration history is reconciled with the remote versions.

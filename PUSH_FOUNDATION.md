# Gym.io V3.2-A — Push Foundation

Session V2 remains the workout authority. This feature sends only an explicitly requested, fixed test notification; there is no workout scheduler or lock-screen action.

Correction status (08/10/2026): after the first run stopped on the official extension's PUBLIC SELECT, the user authorized a narrow audit exception for the two statistics views below. No new grant to those views or historical revocation was made. The complete local SQL/Data API/Edge matrix passed; the real browser/provider test remains manual and pending. Results are in `PUSH_FOUNDATION_VALIDATION.md`.

## Trust boundary

User gesture → permission → dedicated Service Worker → browser PushSubscription → authenticated RPC → stored subscription. An authenticated `push-test` Edge Function selects one subscription by verified user and ID, then sends encrypted Web Push. The worker validates the fixed v1 test envelope and opens `/dashboard`.

The database grants no direct subscription SELECT/DML to `anon` or `authenticated`. Three RPC wrappers use a dedicated NOLOGIN/NOBYPASSRLS executor. Its private `request_uid()` reads JWT request GUCs, exactly like Session V2; it has no Auth schema/table/sequence privileges. JWT signatures are validated at the HTTP boundary, not by accepting client-provided GUCs.

The migration audits effective relation and column privileges, including PUBLIC grants. The executor's only application relation is `public.push_subscriptions`, with SELECT/INSERT/UPDATE/DELETE. TRUNCATE/REFERENCES/TRIGGER/MAINTAIN are rejected even on that table. Besides PostgreSQL system metadata/temp schemas, the audit accepts only existing SELECT inherited from PUBLIC on exactly `extensions.pg_stat_statements` and `extensions.pg_stat_statements_info`. These must be views belonging to the official `pg_stat_statements` extension in the same schema/owner, with PUBLIC's non-grantable table SELECT and no direct executor relation/column ACL. No other privilege is exempt, and no schema-wide exception exists. Unexpected privileges stop validation; historical ACLs are never automatically repaired. Negative ACL tests use transactions that roll back on connection failure.

Only the sender uses the server-side service role, with explicit ownership checks. Neither endpoint/key data, provider responses, JWTs nor secrets are returned in its responses. Sender grants are SELECT, DELETE and UPDATE of the throttle timestamp. A 404/410 cleanup matches the snapshot and cannot erase a concurrently refreshed record. Temporary failures retain subscriptions. Test attempts are limited atomically to one per subscription per 30 seconds.

Supported provider hosts: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`. Destinations must use HTTPS/default port without credentials or fragments. Redirects are rejected, TTL is 60 seconds and transport timeout is 10 seconds. Other provider hosts require a reviewed update; the client is informed of failure without exposing endpoint details.

## Configuration

Frontend: `VITE_VAPID_PUBLIC_KEY` plus the existing Supabase URL/publishable key. Without the public key, activation is unavailable. Never put private/server secrets in a `VITE_` variable.

Server-only secrets required for future deployment: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (valid contact URI), `PUSH_ALLOWED_ORIGINS` (comma-separated exact origins). Supabase provisions `SUPABASE_URL` and server credentials. The sender prefers `SUPABASE_SECRET_KEYS` JSON with a `default` secret key. When the modern default is absent, it uses `SUPABASE_SERVICE_ROLE_KEY` for legacy/local environments. Malformed configured modern keys fail closed instead of silently falling back. See the official [runtime secret variables](https://supabase.com/docs/guides/functions/secrets) and [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

The administrative client places the modern secret in `apikey`; its custom fetch removes any SDK-generated `Authorization: Bearer sb_secret_...` header and prohibits redirects. `auth.getUser(jwt)` keeps the user's Bearer JWT and runs before administrative reads/writes. No caller identity is derived from a server key. No production credentials are generated or configured here.

Local keys are generated only into ignored `supabase/.runtime/edge.env`. The local frontend gets public values in ignored `.env.push.local`; the existing `.env` is preserved. Runtime secrets and synthetic users are removed after automated validation. `deno.json`/lockfile pin server dependencies after the mandatory compatibility spike passes.

## Local automated validation

Requires Docker Desktop and Supabase CLI 2.120.0. Configuration uses a distinct project ID and ports 55431/55432. It disables automatic migration replay: recovered migrations depend on missing legacy tables and Auth has known historical drift.

The local runtime uses `oneshot`, the [recommended development policy](https://supabase.com/docs/guides/local-development/cli/config#edge_runtime.policy). Initial runs in the synced workspace produced HTTP 502. The harness now serves immutable Function snapshots from its own disposable OS temporary directory, avoiding OneDrive watcher interference. CPU limits and application assertions were not increased or disabled.

```powershell
npm test
npm run test:push:local
npm run build
git diff --check
```

The local harness rejects remote API hosts, checks historical hashes, refuses an existing runtime/stack, and runs:

1. Authenticated compatibility spike inside the actual CLI-served Supabase Edge Runtime: import `web-push@3.6.7`, generate an encrypted request, inspect only sanitized metadata, transmit nothing.
2. Reconstructed catalog support fixture (not a historical migration), unchanged complete EXPAND and Exercise Memory, then the additive Push migration and its assertions. Auth historical migration and CONTRACT are not executed.
3. Transactional SQL tests, real local Data API tests with users A/B, and actual Edge Runtime integration with real Auth/database and a fixed injected fake transport. Fixed test groups run in separate authenticated harness requests, respecting the [documented runtime limits](https://supabase.com/docs/guides/functions/limits), without changing CPU limits or retrying failed assertions.
4. Local database lint. Containers/volumes created by this stack and generated credentials are discarded.

The harness exercises seven rolled-back negative ACL fixtures, validates the two official statistics view identities/no new executor grants/no write privileges, and compares both administrative credential formats against real local Auth/Data API. Frontend result tests use the actual installed Supabase SDK to cover HTTP errors, strict safe-body decoding, transport errors, stream timeout and UI operation completion. Deno checking uses the pinned isolated container with a read-only Functions mount and frozen lockfile. Actual results, including the first stopped run, are recorded in the validation report.

The disposable `push-integration` function is copied from `testing/` into that temporary snapshot, outside Git and never part of deployment. It validates the configured local caller and refuses a nonlocal Supabase URL. No mock switch or auth bypass exists in `push-test`. The original Functions source and lockfile are copied without editing; the temporary directory is removed automatically.

On compatibility failure, stop and report. Do not replace the library or implement Web Push encryption without approval. Docker failure or an incomplete SQL/Data API/Edge matrix prohibits the ready-for-audit verdict.

## Manual localhost test (separate, pending until performed)

```powershell
powershell -NoProfile -File supabase/testing/run-local.ps1 -KeepForManual
npm run dev:push
```

1. Open `http://localhost:5173`; authenticate with a synthetic account from ignored `.runtime/users.json`.
2. Open profile → Notificações → Ativar notificações. Accept the browser permission.
3. Confirm the own-ID lookup succeeds; no direct subscription listing is available to the browser.
4. Click Enviar teste; confirm notification receipt. Provider acceptance alone does not prove delivery. A second request within 30 seconds should show the wait message. Temporary unavailability must retain the own ID; an expired/changed/missing subscription must clear the ID and require explicit activation again.
5. Click the notification; confirm Gym.io opens/focuses `/dashboard`.
6. Desativar neste navegador; verify the own-ID lookup is null and browser subscription is absent.
7. Reactivate explicitly and logout; verify normal sign-out and attempted Push cleanup. Repeat with network failures and confirm explicit partial-cleanup feedback without blocked logout.
8. Stop only this stack with `supabase stop --project-id gymio-push-foundation-local --no-backup`. Stop its own Functions server PID recorded in `supabase/.runtime/serve.pid` (`taskkill /PID <recorded PID> /T /F`), then remove the exact temporary snapshot recorded in `supabase/.runtime/serve-workdir.txt`, its ignored runtime and generated `.env.push.local`. Check the owner marker and resolved paths before deleting. Stop the Vite terminal as well. Do not use `--all` or Docker prune.

The manual Push test uses a real browser/provider with **local VAPID credentials and local backend only**. Permission/platform limitations (including installation requirements on some devices) are reported separately.

## Lifecycle and limits

Accounts support multiple devices. Endpoint uniqueness prevents cross-account ownership transfer. Registration is idempotent; explicit activation reconciles rotated endpoints/VAPID keys. Successful account deletion cascades subscriptions.

Logout cleanup is bounded and best-effort: remote removal and local unsubscribe are attempted, failed cleanup triggers containment of only the dedicated worker and explicit UI feedback, and Auth signOut still runs. No JWT is queued or retained for future cleanup; no automatic reactivation occurs.

All remote Push operations (inspection lookup, activation lookup/registration, old-ID removal, canceled-activation removal and test request) have a 10-second limit and an AbortSignal passed to the SDK. There are no automatic retries. The hook clears its busy state after success/failure/timeout and ignores completions from a previous account. A failed/timed-out registration undoes a freshly created native subscription; failed rollback marks local opt-out and attempts containment of the dedicated worker. A response lost after a server commit cannot prove remote rollback, so no remote removal is promised when cleanup fails.

HTTP errors from `functions.invoke` are decoded only as an application/json object containing a single known `result`, within a 1 KiB limit and with its expected status. The safe result codes are `sent`, `expired`, `subscription_changed`, `rate_limited`, `temporarily_unavailable`, `provider_not_supported`, `subscription_not_found`, `invalid_request`, `authentication_required`, `origin_not_allowed` and `method_not_allowed`. UI messages come from fixed local text. Unknown/malformed bodies and transport errors become `push_test_failed`; no raw response or SDK/provider error crosses into UI state. Expired/changed/missing results invalidate the local own-ID reference without automatically subscribing again.

No offline mode, rest scheduler, session notification, workout outbox, ±5 kg, notification series completion or lock-screen controls exists. No remote migration, secrets, deployment or history repair is authorized.

The existing branch already contains commit `104a00b052f02cdb4d8c2d596de823bb18f82d82`, one commit ahead of main; its remote presence was confirmed by the user's audit. The earlier statement that no commit/push existed was incorrect. This correction round creates no additional commit, push, PR, merge or change to main. The revised migration remains unapplied remotely; its current hash and executed checks are recorded in `PUSH_FOUNDATION_VALIDATION.md`.

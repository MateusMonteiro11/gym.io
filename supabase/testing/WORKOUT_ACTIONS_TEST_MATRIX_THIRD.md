# Gym.io V3.2-C — terceira matriz

**V3.2-C TEST MATRIX REPROVADA**

## A. Sender fix

A composição tipada remove exclusivamente `title` e `body` da projection C e conserva os textos fixos B. Smoke específico: passed.

## B. Novo hash C

C original: `8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42`.
C após correção sintática: `a643da0340c8b2a84c5a2a715184cedf45b6b403e789fd91858dd08f18925820`.
C sender-fix: `b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca`.

## C. Runtime/bootstrap

Projeto `gymio-workout-actions-local`; API 55451, DB 55452, shadow 55450. Runtime novo: `C:\Users\mateu\AppData\Local\Temp\gymio-workout-actions-7bfed995de8a491988d371fca20e37e1`.
Ordem: fixture legada → EXPAND → Memory → A → B → Extension Security Gate → C sender-fix. Auth histórico e CONTRACT não executados.
Imagem: `public.ecr.aws/supabase/postgres:17.6.1.113`. PostgreSQL observado: PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit.
Node v22.15.1; CLI 2.120.0; Deno compiler 2.1.4; Edge runtime `{"v8":"11.6.189.12","typescript":"5.1.6"}`. Imagens/digests estão registrados na evidência JSON.

## D. Migration/assertions

Aplicação C: passed; gate antes: passed; complemento pós-C: passed.
Os blocos de assertions A/B/C e o catálogo de ACLs/owners/memberships são auditados sem reparos ou novas exceções.

## E. Issuance/unchanged

SQL C: passed; 37 grupos PASS registrados; término integral: true.
Contagens, invalidation e hashes persistidos de unchanged são comparados pelo harness; tokens não são reconstruídos.

## F. Bearer/ownership

SQL C: passed; Data API C: passed. Casos executados constam dos labels e evidências JSON.

## G. Cinco actions

SQL C: passed; chamadas +15, pause, resume, continue e skip são verificadas com estado/revisão do backend.

## H. Atomicidade/UID

SQL C: passed. O harness cobre rollback de skip pausado e restauração/isolamento de UID na mesma conexão física.

## I. Concurrency/replay/expiry

SQL C: passed. Resultados parciais são preservados; um grupo não alcançado permanece pendente.

## J. Lifecycle/retention

SQL C: passed; Edge C: passed; regressões A/B: failed.
Contagens finais antes do teardown: `{"auth.users":2,"public.usuarios":2,"public.treinos":0,"public.exercicios":0,"public.secoes_treino":0,"public.treinos_exercicios":0,"public.treino_sessoes":0,"public.treino_sessao_series":0,"public.historico_treinos":0,"public.historico_exercicios":0,"public.push_subscriptions":0,"gymio_workout_push_private.outbox":0,"gymio_workout_push_private.deliveries":0,"gymio_workout_actions_private.generations":0,"gymio_workout_actions_private.capabilities":0}`.

## K. Data API

Matriz C: passed; 1 labels PASS. Clients não recebem acesso administrativo ou direto ao schema C.
Correção do harness: DELETE sem filtro era rejeitado primeiro por safeupdate (21000/HTTP 400). DML com alvo concreto verifica separadamente ACL/RLS sem modificar policies/grants; a tentativa anterior permanece registrada.

## L. Edge/CORS/timeout

Matriz real Edge: passed; 18 labels PASS.
Origin é defesa adicional; capability é autorização. Wildcard/preflight global permanece PLATFORM GATEWAY CORS BASELINE. Timeout não comprova rollback SQL.
O baseline local de timeout SQL pode preemptar a espera de dez segundos da Edge. A evidência separa o cancelamento SQL observado da prova de abort do handler/transporte; nenhum timeout de produção ou role foi alterado.
A fixture utiliza a RPC autenticada aprovada para registrar/rotacionar subscriptions; não pressupõe INSERT/UPDATE administrativo onde os grants existentes não o autorizam.

## M. Sender B→C

Matriz Edge: passed; SQL: passed. Evidência de bindings/outcomes/transporte: presente.
A política permanece at-most-once; 2xx significa accepted pelo provider. Transporte é falso e não há requisição a provider.

## N. Regressão A/B

Gate da regressão original: failed; etapas registradas na tentativa inicial: 6.
Execução complementar preservada: PASS; 12 etapas registradas, incluindo os resultados A anteriores e SQL B repetido. A causa da falha original continua não resolvida; esta evidência não altera o gate nem apaga a tentativa inicial.

- A ready: passed — 1985.234 ms
- A spike: passed — 1971.968 ms
- A sql: passed — 8354.136 ms
- A data-api: passed — 2339.955 ms
- A edge: passed — 12804.657 ms
- B SQL: passed — 295125 ms
- B Data API: passed — 19398.05 ms
- B Edge: passed — 132516.812 ms
- B performance: passed — 21821.646 ms
- B scheduler: passed — 43781.096 ms
- install sender test transport: passed — 6717.748 ms
- B dispatch: passed — 31468.964 ms

Scheduler de dez segundos: passed; dispatch local falso: passed; benchmark B de mil usuários: passed. Etapas bloqueadas não foram executadas. Fixtures auxiliares precisam restaurar o baseline A/B.
Diagnóstico isolado de lease: PASS; assertions históricas e espera de 61 segundos preservadas. Resultado: `null`. A repetição diagnóstica não aprova a regressão integral nem explica, por si só, a falha original cujo stderr foi descartado pelo runner.
Repetição diagnóstica SQL B completa, com corpo byte-idêntico e sem SQL extra nas assertions: PASS; 18 grupos. Falha sanitizada: `null`. Baseline A/B restaurado: true.
Limitação identificada por leitura no harness histórico B: refresh tenta admin.update das chaves e não verifica a negação de privilégio; esse caso isolado não comprova rotação real. B Edge nesta matriz: passed. A cobertura complementar C sender_refresh usa RPC autenticada e verifica cleanup snapshot-safe, quando essa etapa passa. O teste histórico permanece intacto.

## O. SW/IndexedDB

C: passed; B: passed; npm: passed. Produção SW/frontend permanece preservada.
Suíte npm desta execução: 80/80, falhas 0, duração 3557.4494 ms.

## P. Quality/performance/db lint

Build: passed; Deno frozen: passed; source audit: failed; performance: passed.
db lint antes: passed — `{"WARN":5,"INFO":0,"ERROR":0}`.
db lint depois: passed — `{"ERROR":0,"WARN":5,"INFO":0}`.

- before: WARNING EXTRA — graphql_public.graphql: unused parameter "operationName"
- before: WARNING EXTRA — graphql_public.graphql: unused parameter "query"
- before: WARNING EXTRA — graphql_public.graphql: unused parameter "variables"
- before: WARNING EXTRA — graphql_public.graphql: unused parameter "extensions"
- before: WARNING — gymio_workout_actions_private.issue: target type is different type than source type
- after: WARNING EXTRA — graphql_public.graphql: unused parameter "operationName"
- after: WARNING EXTRA — graphql_public.graphql: unused parameter "query"
- after: WARNING EXTRA — graphql_public.graphql: unused parameter "variables"
- after: WARNING EXTRA — graphql_public.graphql: unused parameter "extensions"
- after: WARNING — gymio_workout_actions_private.issue: target type is different type than source type

CLI 2.120.0 oferece níveis warning/error, sem nível info; INFO retornado é contado e essa limitação permanece explícita. Não existe lint frontend. Nenhum ERROR é permitido.
Tempos C, em ms (incluem transporte do harness): `[{"operation":"issuance","passed":true,"elapsed_ms":399.565},{"operation":"unchanged","passed":true,"elapsed_ms":440.69},{"operation":"consume_add_15","passed":true,"elapsed_ms":457.788},{"operation":"consume_rest_pause","passed":true,"elapsed_ms":614.665},{"operation":"consume_rest_resume_paused","passed":true,"elapsed_ms":398.539},{"operation":"consume_rest_skip","passed":true,"elapsed_ms":392.877},{"operation":"consume_rest_skip_paused","passed":true,"elapsed_ms":398.966},{"operation":"consume_rest_continue","passed":true,"elapsed_ms":411.406},{"operation":"concurrent_consumers","passed":true,"elapsed_ms":625.528},{"operation":"concurrent_issuers","passed":true,"elapsed_ms":619.377},{"operation":"bounded_cleanup","passed":true,"elapsed_ms":690.574},{"operation":"sender_begin_controls","passed":true,"elapsed_ms":562.15},{"operation":"sender_begin_controls","passed":true,"elapsed_ms":393.119},{"operation":"sender_begin_after_issuance_rollback","passed":true,"elapsed_ms":505.745},{"operation":"sender_begin_after_issuance_rollback","passed":true,"elapsed_ms":434.899}]`.
Build desta execução: 12440 ms; warning: Existing chunk >500kB. Deno frozen: push-test, workout-push, workout-action, actions-integration.
Sem novo cron C, polling ou countdown writes; nenhuma meta arbitrária de latência.
Tentativas anteriores de harness preservadas: 3; snapshots Edge parciais: 2. Critérios corrigidos não equivalem a correções de implementação ou aprovação das tentativas anteriores.

## Q. Hashes/cleanup/remoto

- 20260725194232_auth_email_security.sql: `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6`
- 20260821190134_workout_session_persistence_expand.sql: `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db`
- 20260823003337_exercise_memory_read.sql: `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02`
- 20261007215944_push_foundation.sql: `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823`
- 20261010183821_workout_notifications.sql: `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b`
- 20261011021351_workout_notification_actions.sql: `b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca`

Cleanup: concluído; A/B preservados: true; zero operações remotas e zero requests a providers.
Drift fora do escopo: `supabase/.temp/cli-latest` mudou de 0 para 8 bytes (v2.120.0); o cache foi preservado para análise, sem restauração nem exceção à allowlist.
Resolução/download de dependências npm/Deno fixadas ocorre fora do projeto; isso não constitui consulta/deploy/mutação em Supabase remoto, Vercel ou Push provider.
Sem db push, repair, CONTRACT, deploy, commit, push, PR, merge, Vercel Preview ou teste manual.

## R. Veredito

**V3.2-C TEST MATRIX REPROVADA**

Pendências/falhas: regressions-A-B: failed; source-audit: failed; complete A/B regressions not approved; original B SQL assertion failure was not reproduced but its cause remains unresolved; source preservation evidence incomplete.

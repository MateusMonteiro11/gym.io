# Gym.io V3.2-C — Matrix Closure Gate

**V3.2-C TEST MATRIX APROVADA**

A decisão combina a evidência funcional da terceira matriz, preservada sem alterações, com o closure gate A/B original e a auditoria de fontes. Não constitui rollout.

## Runner e execução original

Resultado: A/B ORIGINAL REGRESSION GATE PASS. Execução: original 12 stages in one continuous invocation.
Nos runners inspecionados, não havia limite global ou por etapa de 300000 ms. Limites históricos externos não foram preservados. A falha histórica foi uma assertion com exit 1 em aproximadamente 241794 ms; sua causa não pode ser recuperada retroativamente e não foi atribuída a timeout.
Não foi acrescentado ou aumentado timeout. Cada etapa preserva comando lógico, cwd/environment, início/fim, duração, exit, timeout, sinal/motivo e stdout/stderr sanitizados.

| Etapa | Resultado | ms | Exit | Timeout | Término |
|---|---|---:|---:|---|---|
| A ready | PASS | 13147.098 | 0 | false | completed |
| A spike | PASS | 9999.809 | 0 | false | completed |
| A sql | PASS | 34552.589 | 0 | false | completed |
| A data-api | PASS | 11106.715 | 0 | false | completed |
| A edge | PASS | 31447.48 | 0 | false | completed |
| B SQL | PASS | 402007.308 | 0 | false | completed |
| B Data API | PASS | 11574.361 | 0 | false | completed |
| B Edge | PASS | 111496.115 | 0 | false | completed |
| B performance | PASS | 8324.912 | 0 | false | completed |
| B scheduler | PASS | 37644.093 | 0 | false | completed |
| install sender test transport | PASS | 2843.617 | 0 | false | completed |
| B dispatch | PASS | 25523.293 | 0 | false | completed |

Baseline final: `{"passed":true,"six_hashes_and_owned_runtime_verified":true,"exact_A_B_auth_profiles_restored":true,"auth_users":2,"profiles":2,"fixture_tables_empty":true,"global_workout_job_inactive":true,"cleanup_policy":"verify only; no automatic data repair"}`.
Corpos e assertions A/B MJS/Edge byte-idênticos; adapters limitados ao contexto local e ao import do repository B aprovado. Nenhum complemento ou retry foi usado neste closure.

## Source audit e estado gerado

Source audit: PASS; 257 arquivos de produção/suporte byte-idênticos à terceira matriz. HEAD mantém exatamente os nove diffs anteriores revisados.
Categorias: PROTECTED SOURCE; AUTHORIZED TEST/HARNESS CHANGES; GENERATED TOOL/RUNTIME STATE. Paths autorizados são uma lista explícita, sem wildcard.
`supabase/.temp/cli-latest` é classificado exclusivamente como GENERATED SUPABASE CLI STATE: oito bytes, v2.120.0, sem secret, migration ou consumidor na aplicação. Writer comprovado no binário instalado; a invocação histórica exata permanece inferência, pois não há trace de processo.
A mudança histórica 0 → 8 bytes permanece registrada. Nenhuma allowlist supabase/.temp/* foi criada. SUPABASE_NO_UPDATE_NOTIFIER=1 é process-local e evita cache/network do notifier; CLI cwd usa o runtime temporário.
Fixtures negativas em memória: `[{"name":"protected source alteration","rejected":true,"memoryOnly":true,"actualFilesModified":false},{"name":"frozen C hash alteration","rejected":true,"memoryOnly":true,"actualFilesModified":false},{"name":"unapproved new path","rejected":true,"memoryOnly":true,"actualFilesModified":false}]`.

## Runtime, lint e evidência reutilizada

Runtime novo: `C:\Users\mateu\AppData\Local\Temp\gymio-workout-actions-d4500f82d7524db0a715b1641c74a828`; projeto `gymio-workout-actions-local`; API 55451, DB 55452, shadow 55450.
Versões: `{"node":"v22.15.1","supabaseCLI":"2.120.0","postgresImage":"public.ecr.aws/supabase/postgres:17.6.1.113","postgres":"PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit","extensions":{"pg_net":"0.20.0","pg_cron":"1.6.4","supabase_vault":"0.3.1"}}`. Digests das imagens estão registrados na evidência JSON.
Bootstrap: fixture → EXPAND → Memory → A → B → Extension Gate → C atual intacta. Auth histórico e CONTRACT não executados.
C foi conferida por suas assertions e smoke de catálogo. Atomicidade/UID/concurrency/Edge C/IndexedDB completos não foram repetidos.
O destino do dispatcher permaneceu ausente até o stage original de instalação do transporte falso. Token de máquina ficou apenas em runtime/Vault e header dedicado.
db lint: `{"ERROR":0,"WARN":5,"INFO":0}`.
- WARNING EXTRA: graphql_public.graphql — unused parameter "operationName"
- WARNING EXTRA: graphql_public.graphql — unused parameter "query"
- WARNING EXTRA: graphql_public.graphql — unused parameter "variables"
- WARNING EXTRA: graphql_public.graphql — unused parameter "extensions"
- WARNING: gymio_workout_actions_private.issue — target type is different type than source type

O WARN de gymio_workout_actions_private.issue, target type is different type than source type, fica para hardening/avaliação posterior. Não foi corrigido nesta tarefa.
Terceira matriz reutilizada: 37 grupos SQL C e 16 grupos Edge C; demais etapas funcionais aprovadas constam da evidência original imutável.
Contagens finais: `{"auth.users":2,"public.usuarios":2,"public.treinos":0,"public.exercicios":0,"public.secoes_treino":0,"public.treinos_exercicios":0,"public.treino_sessoes":0,"public.treino_sessao_series":0,"public.historico_treinos":0,"public.historico_exercicios":0,"public.push_subscriptions":0,"gymio_workout_push_private.outbox":0,"gymio_workout_push_private.deliveries":0,"gymio_workout_actions_private.generations":0,"gymio_workout_actions_private.capabilities":0}`. Jobs finais: `{"active":0,"c_jobs":0,"global_job_inactive":true}`.

## Hashes e cleanup

- 20260725194232_auth_email_security.sql: `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6`
- 20260821190134_workout_session_persistence_expand.sql: `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db`
- 20260823003337_exercise_memory_read.sql: `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02`
- 20261007215944_push_foundation.sql: `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823`
- 20261010183821_workout_notifications.sql: `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b`
- 20261011021351_workout_notification_actions.sql: `b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca`

Closure containers/volumes/rede/root removidos após verificação de owner, project, caminho e IDs. A/B preservados; sem prune.
Após os gates aprovados, o collector encontrou o daemon Docker indisponível. Docker Desktop foi reaberto apenas para coleta e cleanup; nenhum teste foi repetido.
Zero operações Supabase remoto/Vercel/Push provider, deploy, db push, repair, commit/push/PR/merge. Nenhum teste manual, rollout ou Preview iniciado.

## Veredito

**V3.2-C TEST MATRIX APROVADA**

Os dois gates pendentes foram fechados pelo resultado contínuo A/B original e pela auditoria fail-closed das fontes, com seis hashes preservados e db lint sem ERROR.

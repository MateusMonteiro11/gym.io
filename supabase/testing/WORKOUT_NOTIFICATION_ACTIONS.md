# Gym.io V3.2-C — implementação local preparada

Branch: `gym.io-v3.2`. Migration criada pelo Supabase CLI 2.120.0:
`20261011021351_workout_notification_actions.sql`.

**V3.2-C IMPLEMENTAÇÃO PRONTA PARA MATRIZ DE TESTES**

Este veredito cobre implementação e verificações rápidas. Não representa
aprovação SQL/Data API/Edge Runtime, execução da matriz, teste manual ou rollout.
Nenhum banco recebeu C nesta etapa, incluindo o runtime manual B preservado.

## A. Arquitetura

Card V3 → bearer textual → `workout-action` → RPC administrativa C → wrapper
Session V2 existente → projeção construída pelo backend → substituição silenciosa
da mesma tag. A sessão continua sendo a fonte de verdade; não há countdown no
banco, polling, scheduler novo, ações de série, cargas ou Exercise Memory.

## B. Migration

Schema `gymio_workout_actions_private`; tabelas `generations` e `capabilities`;
RLS habilitada/forçada, sem policies clientes; acesso direto revogado. Owners
esperados: `postgres`. Seis FKs cascade, incluindo sessão, subscription e binding
composto da capability à geração. Onze índices, incluindo hashes únicos,
unicidade generation/action e uma geração vigente por sessão/subscription.

Funções privadas INVOKER; três wrappers DEFINER, `search_path` vazio.
`emitir_controles_notificacao_treino(uuid,uuid,bigint)` concedida a authenticated;
`workout_notification_action(text)` e `workout_push_begin_controls(uuid,uuid)`
somente a service_role. PUBLIC/anon não recebem execução. Não há novos grants ou
memberships para executores A/V2. Assertions incluem ACLs efetivas de tabela e
coluna, owners, RLS, função, índice vigente, binding composto e cascades.

O snapshot transacional anterior a C compara definições/ACLs históricas de
funções, relações, schemas, policies, constraints, índices, memberships,
default ACLs e atributos dos executores. Essas assertions foram **preparadas;
não executadas no PostgreSQL nesta etapa**.

## C. Capability

32 bytes de `extensions.gen_random_bytes`; Base64URL canônico, 43 caracteres,
sem padding. Apenas SHA-256 do texto UTF-8 é persistido. SQL recebe texto e
calcula o hash internamente; nenhuma interface aceita pre-hash como credencial.
O último caractere canônico é validado na Edge e no SQL.

Vínculos: usuário, subscription, sessão, revisão, geração e action fixa.
TTL máximo: 15 minutos. Emissão serializada por sessão/subscription; mesma
revisão/estado/snapshot válido retorna `unchanged` com lista vazia. Mudança de
revisão, estado elegível ou expiração permite outra geração. Toda action aceita
consome um token, invalida gerações/siblings antigos da sessão e emite a próxima
projeção na mesma transação. Retenção oportunística limitada a 100 gerações
expiradas/terminais com mais de sete dias, preservando as ainda válidas.

## D. Ponte Session V2 e UID

Locks C: sessão → subscription → geração → capability. A consulta inicial pelo
hash localiza os locks e não constitui autorização. Todos os vínculos,
ownership, revisão, item, série, deadline, pausa e estado são relidos sob locks.

Após essa validação, a ponte salva `request.jwt.claim.sub`, usa exclusivamente
`set_config(..., true)` e chama os wrappers públicos V2 pelos privilégios
preexistentes de postgres. Restaura o valor anterior no sucesso e na exceção
tratada; não modifica `request.jwt.claims`. Um GUC ausente pode ser representado
como string vazia após uso; ambos preservam UID ausente/fallback de claims.

A subtransação PL/pgSQL reverte mutação, consumo, siblings e emissão diante de
falha. O harness verifica UID anterior presente, ausente e derivado de claims,
sucesso/exceção, commit/rollback e outra transação na **mesma conexão física**.
Essa comprovação comportamental continua pendente da matriz.

## E. Edge Function

`workout-action`: `verify_jwt=false`, autorização por capability bearer.
POST JSON exclusivamente `{ capability }`, limite de 256 bytes também durante
streaming, sem query ou campos extras; OPTIONS restrito. Origin obrigatório e
exato, inicialmente `http://localhost:5173`; configuração server-side
`GYMIO_WORKOUT_ACTION_ORIGINS` admite lista de origins exatas, sem wildcard.

Inicialização administrativa só depois de validar o pedido; única operação:
RPC `workout_notification_action`. Sem identidade/action/parâmetros de treino
arbitrários. Timeout total de dez segundos, AbortSignal e `.retry(false)`.
Respostas limitadas a ok/stale/expired/already_used/unavailable e projeção
autorizada quando ok. Sem logs de tokens, hashes ou erros internos. Timeout
permanece ambíguo e não comprova rollback. A matriz verifica a chamada sem
apikey/JWT, correspondente ao wire utilizado pelo worker.

## F. Actions

| Action | Operação V2 |
| --- | --- |
| rest_add_15 | Ajuste fixo de +15, respeitando limite V2 |
| rest_skip ativo | Encerrar forçadamente |
| rest_skip pausado | Retomar, obter revisão retornada, encerrar forçadamente na mesma transação |
| rest_pause | Definir pausa true |
| rest_resume | Definir pausa false |
| rest_continue | Encerrar não forçado, somente após vencimento |

Pulo pausado incrementa revisão duas vezes. Não há ação mutável fora do descanso.
Projeção em execução permanece V2, silenciosa e sem controles.

## G. Service Worker

V1 test e V2 preservados; validação V3 estrita com IDs/revisão decimais
canônicos, timestamps, limites de texto, estados e actions fixas. Destino seguro
`/treinar/<id>` e tag `gymio-workout-<session>`.

Endpoint obtido somente de `/push-config.json`, servido/emitido pelo Vite a
partir do origin público `VITE_SUPABASE_URL`; nenhuma URL de action no payload.
Clique de action usa waitUntil, envia somente bearer e atualiza silenciosamente
o card após confirmação, sem abrir/focar o app. Clique no corpo mantém navegação
segura. Quantidade visível de botões depende de Notification.maxActions; ordem
ativa é +15, Pular, Pausar; pausada Retomar, Pular; vencida Continuar.

`unchanged` é resolvido dentro da fila do processor e antes da substituição:
card real atual, mesma sessão/generation_id/revisão, mesma expiração, válido e
sem bloqueio. Card ausente/divergente/expirado → fallback V2 sem actions. Nenhum
token é reconstruído a partir do banco, IDB ou Cache Storage. Resultados
terminais fecham somente a geração antiga. Falha de rede não confirma ação e
não dispara retry. Falha de armazenamento permite apenas atualização silenciosa
conhecida, sem controles novos.

## H. Frontend

Adapter permanece no ponto de aceitação já guardado de useTreinoAtivo; guards
V2 inalterados. Issuer lê somente worker/subscription já existentes, consulta
ownership por RPC e solicita controles para a revisão aceita. Epoch descarta
respostas atrasadas. Nenhuma permission, registration, subscribe ou reativação
automática. Falhas usam fallback best-effort e não afetam treino/logout.

## I. Compatibilidade

60 testes preexistentes preservados; npm test executou 80 e aprovou os 80.
V1/V2, sinal local confirmado, ordering, deduplicação e silêncio/vibração
mantidos. Session V2/Memory/A/B SQL e ACLs não foram editados. push-test conserva
verify_jwt=true; workout-push conserva autenticação própria, transporte, TTL,
timeout, redirects proibidos e at-most-once.

O repository do sender passa a usar o wrapper C. Ele chama begin B sem modificar
sua definição e, no mesmo commit, emite controles. O wrapper C confere geração
e cada capability contra **a subscription exata da delivery bloqueada**.
Falha inesperada na emissão reverte attempted; unchanged/ausência esperada de
tokens retorna o envelope B sem actions. Provider 2xx continua significando
accepted, sem delivered_at ou promessa de recebimento.

## J. Segurança e lifecycle

Capability é bearer: copiar o token completo permite exercer a autorização
limitada enquanto válida; não existe prova independente do navegador. Hash
persistido não equivale ao bearer original. Tokens ficam somente em memória
transitória e Notification.data; IDB armazena recibos, bloqueios de geração,
encerramento e metadados de ordering, nunca tokens ou JWTs.

Cascade da subscription/sessão elimina gerações e capabilities; remoção antes de
begin impede emissão/envio. Logout/desativação fecham cards e os marcadores
persistidos bloqueiam actions antigas inclusive após reinício do worker. Falha
de limpeza remota não é apresentada como revogação server-side garantida.
Falhas de Push continuam sem bloquear signOut.

## K. Inventário

Sete arquivos existentes alterados intencionalmente:

- public/push-sw.js
- src/hooks/useTreinoAtivo.js
- src/services/push/workoutNotificationBridge.js
- src/services/push/workoutProjection.js
- supabase/config.toml
- supabase/functions/_shared/workoutPushRepository.js
- vite.config.js

Novos arquivos de implementação/testes:

- tools/pushPublicConfig.js
- src/services/push/workoutControlsClient.js
- src/services/push/workoutControlsService.js
- src/services/push/workoutControls.test.js
- supabase/functions/_shared/workoutActionHandler.js
- supabase/functions/_shared/workoutActionRepository.js
- supabase/functions/_shared/workoutAction.test.js
- supabase/functions/workout-action/index.ts
- supabase/migrations/20261011021351_workout_notification_actions.sql
- supabase/testing/actions-context.mjs
- supabase/testing/actions-apply.mjs
- supabase/testing/actions-fixture.mjs
- supabase/testing/actions-local-tests.mjs
- supabase/testing/actions-data-api.mjs
- supabase/testing/actions-edge-tests.mjs
- supabase/testing/actions-edge-fixture.sql
- supabase/testing/actions-edge-integration/index.ts
- supabase/testing/actions-indexeddb.mjs
- supabase/testing/run-workout-actions-matrix.ps1
- supabase/testing/WORKOUT_NOTIFICATION_ACTIONS.md
- supabase/testing/actions-inventory.json

Inventário JSON registra SHA-256 de cada arquivo C, exceto seu próprio hash e
o relatório. A comparação inicial/final inclui arquivos ignorados relevantes:
287 dos 294 arquivos preexistentes inventariados ficaram byte a byte intactos;
os outros sete são exatamente os edits autorizados acima. `.env`,
`.env.push.local`, `.gitignore`, lockfiles, recovered, baseline e
`seed-manual-workout.mjs` preservados. Esse helper preexistente continua
untracked e não é uma adição C. `dist/` foi regenerado pelo build e inclui
push-config.json; é saída derivada, não alteração de configuração/secrets.

## L. Hashes

| Migration | SHA-256 antes/depois |
| --- | --- |
| 20260725194232_auth_email_security.sql | cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6 |
| 20260821190134_workout_session_persistence_expand.sql | 6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db |
| 20260823003337_exercise_memory_read.sql | 7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02 |
| 20261007215944_push_foundation.sql | 225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823 |
| 20261010183821_workout_notifications.sql | c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b |
| 20261011021351_workout_notification_actions.sql (nova C) | 8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42 |

## M. Estado remoto e runtime manual

Zero consultas/operações remotas Supabase nesta etapa. Sem deploy, secrets remotos,
DDL/DML remoto, repair, db push, CONTRACT, commit, push, PR, merge ou V3.2-D.
Nenhuma execução de C, treino, cron, serviço de aplicação ou Push. O runtime
manual `gymio-workout-push-local` e sua fixture foram preservados; não foram
alvos de SQL ou de alterações de arquivos desta etapa.

Somente containers descartáveis de **compilação Deno** foram executados. Não
eram um stack Supabase nem execução de Edge Functions. Fonte montada read-only;
snapshot de compilação e containers removidos. Nenhum recurso do runtime manual
foi removido/reiniciado. A primeira consulta de help do CLI foi bloqueada por
tentativa de telemetry no home; as chamadas seguintes usaram apenas envs do
processo e home temporário, sem alteração de configuração global.

## N. Verificações e matriz preparada

| Verificação | Resultado desta etapa |
| --- | --- |
| npm test | 80/80 aprovados, 20 novos |
| Unitários focados C | 20/20 aprovados |
| Build Vite 8.2.1 | aprovado; aviso de chunks >500 kB |
| Deno check --frozen | aprovado para push-test, workout-push, workout-action e harness Edge C copiado para snapshot |
| Syntax check dos runners MJS/SW | aprovado |
| git diff --check | aprovado |
| Cinco hashes históricos | iguais antes/depois |
| SQL, Data API, assertions no PostgreSQL | preparados, NÃO EXECUTADOS |
| Edge Function no runtime real | preparada, NÃO EXECUTADA |
| Teste IndexedDB C separado | preparado, NÃO EXECUTADO |
| db lint local / timing / concorrência Docker | NÃO EXECUTADOS nesta fase |
| Manual browser / Push real | NÃO EXECUTADOS |

Node 22.15.1, npm 10.9.2, Supabase CLI 2.120.0; compilador Deno 2.1.4,
imagem/digest `denoland/deno@sha256:3bf75873714baa410dcf7fabaf76d806d20f0ac8a7579df11577b4ed97416e34`.
Dependências/deno.lock existentes congelados; nenhuma instalação no projeto.
Não existe script de lint frontend no package.json atual.

Matriz SQL preparada cobre ownership, geração/unchanged, hash original versus
hex/Base64URL do hash, replay/siblings, cinco actions, pulo pausado atômico,
concorrência de emissão/consumo, UID restaurado em todos os cenários,
expiração, constraints, retenção, pausa real além do deadline e timestamps de
resume, mudança de elegibilidade, cancelamento/cascade, subscription exata do
sender e rollback de attempted diante de emissão inesperadamente malsucedida.

Data API usa JWTs reais A/B e anon para negar RPCs administrativas e schemas
privados, além de executar as assertions A/B sem alterações. Edge inclui pedido
sem JWT/apikey, CORS/preflight, payload, replay, timeout real de dez segundos,
grupos fixos com Auth/DB locais, transporte falso, vínculo de duas subscriptions,
remoção antes/depois de claim, logout, exclusão de usuário sintético, 404/410,
refresh concorrente, falha temporária/parcial e ausência de retry.

### Preparação da futura execução — não executada

1. Sob nova autorização, criar stack descartável C, separado de B/A:
   project `gymio-workout-actions-local`, API 55451, DB 55452, shadow 55450,
   root temporário `gymio-workout-actions-<32 hex>` e .owner igual ao project.
   Pin PostgreSQL 17.6.1.113. Criar context.json (root/project/port), status.json
   e users.json com dois usuários sintéticos A/B e seus JWTs/passwords locais.
2. Aplicar fixture legada → EXPAND → Memory → A → B, bytes intactos. Não aplicar
   Auth histórico ou CONTRACT. Reexecutar extension gate aprovado sem alterar
   ACLs oficiais; manter cron inativo. Não reutilizar manual B.
3. Copiar functions para esse root; copiar actions-edge-integration/index.ts
   como functions/actions-integration/index.ts. Declarar verify_jwt=true para
   esse endpoint de testes. Segredos apenas em edge.env nesse root, incluindo
   VAPID/worker token locais e PUSH_TEST_A_JWT, PUSH_TEST_A_EMAIL,
   PUSH_TEST_A_PASSWORD, GYMIO_ACTIONS_MATRIX=local-only. Não usar envs remotos.
4. Servir as Functions nesse runtime local sob a autorização futura. O harness
   tem grupos fixos; não existe seletor de transporte/destino/autenticação de
   testes no HTTP dos endpoints de produção.
5. Executar explicitamente run-workout-actions-matrix.ps1 com ContextFile,
   RunPreparedMatrix e ApplyC. Sem o switch, ele para; rejeita manual B,
   roots/owners/imagem/portas estrangeiros ou hashes divergentes. O runner não
   inicia serviços/jobs nem provisiona secrets; seus testes só usam transporte
   falso. A fixture SQL Edge de testes oferece somente capture e auditoria de
   binding, ambas service-only, fora da migration C.
6. Executar separadamente actions-indexeddb.mjs no container de testes com
   workspace read-only e fake-indexeddb 6.2.5 (mesma dependência de testes B),
   os gates A/B completos e db lint local. Avaliar resultados antes de qualquer
   novo veredito; não confundir este runner com autorização de rollout.
7. Remover somente o novo stack/root C, conferindo ownership e paths absolutos.

Roteiro manual posterior, separado da matriz: no localhost configurado, ativar
Push explicitamente; iniciar o treino sintético; verificar controles de
descanso, +15, pausa/resume e pulo pausado; verificar Continue após vencimento,
um card e atualizações silenciosas; remover o card e verificar unchanged sem
actions; testar offline/replay, desativação e logout. Não executar no manual B
sem autorização para instalar C; nenhum desses passos foi realizado agora.

## O. Veredito

**V3.2-C IMPLEMENTAÇÃO PRONTA PARA MATRIZ DE TESTES**.

As verificações rápidas passaram. Assertions, segurança efetiva SQL, ponte UID,
atomicidade, concorrência e runtime Edge exigem a matriz isolada preparada.
Este relatório não aprova auditoria final, produção ou rollout.

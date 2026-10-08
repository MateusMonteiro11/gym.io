# Gym.io V3.2-A — rodada de correções, relatório A–L

08/10/2026. Branch `gym.io-v3.2`, HEAD `104a00b052f02cdb4d8c2d596de823bb18f82d82`, um commit à frente de main. Worktree inicialmente limpo. As alterações desta rodada permanecem locais e sem novo commit.

A primeira execução parou na nova assertion: `push executor relation allowlist violation: extensions.pg_stat_statements (SELECT)`. Após explicação, o usuário autorizou exclusivamente a exceção de auditoria para SELECT via PUBLIC nas duas views oficiais de estatísticas, sem novo GRANT. A execução seguinte passou integralmente em uma stack nova. Nenhum grant histórico foi alterado.

## A. Classificação dos achados

| Achado | Classificação | Evidência e tratamento |
| --- | --- | --- |
| Propagação dos resultados | Procede | `functions.invoke` retorna FunctionsHttpError em HTTP não-2xx; o serviço descartava seu resultado seguro. Agora decodifica somente o contrato conhecido. |
| Executor privilege allowlist | Procede | Faltava auditoria geral de relações/colunas. O baseline de estatísticas foi reconhecido com exceção exata autorizada; demais relações/privilégios permanecem fail-closed. |
| Timeouts frontend | Procede | Cleanup de logout já era bounded; lookup, register e envio de teste não eram uniformemente limitados. Agora as chamadas remotas recebem limite e AbortSignal. |
| Secret key moderna | Parcialmente procede | Service role legado continua válido. Suporte moderno simples foi implementado e validado em unitários, Deno e Auth/Data API locais reais; sem configuração remota. |

## B. Arquivos alterados

18 arquivos, incluindo cinco adições:

- `PUSH_FOUNDATION.md`
- `PUSH_FOUNDATION_VALIDATION.md`
- `src/components/PushNotificationSettings.jsx`
- `src/hooks/usePushNotifications.js`
- `src/services/push/push.test.js`
- `src/services/push/pushController.js`
- `src/services/push/pushService.js`
- `src/services/push/invokePushTest.js` — novo
- `src/services/push/pushResults.js` — novo
- `src/services/push/pushResults.test.js` — novo
- `supabase/functions/push-test/index.ts`
- `supabase/functions/_shared/pushAdminClient.js` — novo
- `supabase/functions/_shared/pushAdminClient.test.js` — novo
- `supabase/migrations/20261007215944_push_foundation.sql`
- `supabase/testing/edge-integration/index.ts`
- `supabase/testing/local-tests.mjs`
- `supabase/testing/push-security.sql`
- `supabase/testing/run-local.ps1`

Não houve alteração de dependências/lockfiles, `.gitignore`, `.env`, migrations históricas, fixture legada, Session V2, Exercise Memory, worker, manifest ou CONTRACT. Nenhuma segunda migration foi criada.

## C. Result mapping

Sucesso usa `data`; HTTP error usa exclusivamente a Response de `FunctionsHttpError.context`. O decoder exige JSON, objeto com uma única propriedade `result`, código string conhecido e status correspondente. Em erro HTTP, leitura limitada a 1 KiB, cancelável pelo AbortSignal. Unknown/malformed/extra fields/transport viram somente `push_test_failed`, sem cause/context bruto.

| Resultado seguro | HTTP | Efeito na UI |
| --- | --- | --- |
| sent | 200 | Informa aceitação do envio; não confirma recebimento. |
| expired | 200 | Limpa ID próprio, marca desativado e pede ativação explícita. |
| subscription_changed | 200 | Limpa ID, informa alteração e pede reativação. |
| rate_limited | 429 | Pede espera; preserva ID. |
| temporarily_unavailable | 503 | Informa indisponibilidade; preserva ID. |
| provider_not_supported | 422 | Informa incompatibilidade do serviço de Push. |
| subscription_not_found | 404 | Limpa ID e pede ativação explícita. |
| invalid_request | 400 | Mensagem local de falha da solicitação. |
| authentication_required | 401 | Solicita novo login. |
| origin_not_allowed | 403 | Informa indisponibilidade neste ambiente. |
| method_not_allowed | 405 | Mensagem local de falha neste ambiente. |

Textos fixos locais. Endpoint, keys, JWT, headers, stack e mensagens de provider/Supabase não entram na UI. Testes usam o SDK instalado real com transporte sintético, incluindo coerção de array para código, códigos desconhecidos e stream parado.

## D. Hardening do executor

A allowlist autoriza SELECT/INSERT/UPDATE/DELETE em `public.push_subscriptions` e, somente na auditoria, SELECT herdado de PUBLIC exatamente nas duas views abaixo. Audita relações r/p/v/m/f de todos os schemas não sistêmicos; inclui ACL efetiva via PUBLIC e privilégios apenas de coluna para SELECT/INSERT/UPDATE/REFERENCES. Também rejeita TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em Push e exige os quatro privilégios necessários. Exclusões sistêmicas: pg_catalog, information_schema, pg_toast/pg_temp e suas variantes.

Resultado inicial: SELECT em `extensions.pg_stat_statements` abortou a transação Push. O SQL original da imagem oficial concede SELECT dessas duas views a PUBLIC. A exceção posteriormente autorizada exige OIDs dos nomes qualificados `extensions.pg_stat_statements` e `extensions.pg_stat_statements_info`, tipo view, vínculo pg_depend com a extensão oficial pg_stat_statements, schema/owner coincidentes, SELECT de tabela a PUBLIC sem grant option e ausência de ACL direta de relação/coluna ao executor.

NOINHERIT não elimina privilégios concedidos a PUBLIC. Não foi executado REVOKE de PUBLIC nem GRANT novo nessas views ao executor. INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN continuam proibidos. Não existe SELECT genérico ou exceção por schema extensions. Nenhum grant histórico ou baseline foi adaptado. Testes SQL passaram para identidade das views, ausência de grants diretos ao executor e ausência de escrita nelas.

Sete testes negativos com as assertions reais da migration passaram: SELECT de tabela legada; SELECT/INSERT/UPDATE/REFERENCES de coluna legada; TRUNCATE de Push; REFERENCES de coluna Push. Os privilégios deliberadamente injetados nessas fixtures locais foram revertidos por transação ao falhar; nenhum foi persistido. O baseline real foi auditado antes e depois de cada fixture. Nenhum GRANT foi adicionado às views de estatísticas, inclusive nos testes.

## E. Timeout/rede

Limite de 10 segundos por chamada remota: inspect/lookup, lookup de ativação, register, remoção do ID anterior, remoção após ativação cancelada e sendTest. SDK RPC recebe `abortSignal`; Functions invoke recebe `signal`. Sem retry automático.

Registro falho/expirado desfaz somente subscription nativa recém-criada. Rollback malsucedido marca opt-out e tenta desregistrar somente o worker dedicado. Remoção anterior malsucedida preserva a subscription nova e produz aviso. O hook libera busy em finally e rejeita efeitos de uma conta anterior.

Cleanup/logout conserva signOut mesmo em erro remoto/local/simultâneo/timeout. APIs locais de consulta/subscription não ganharam timeouts indiscriminados; limites em rollback/contenção evitam operação pendente. Resposta perdida após commit não permite prometer exclusão remota; contenção é best-effort.

## F. Credencial administrativa

Novo helper prefere `SUPABASE_SECRET_KEYS` JSON com chave `default`; sem default moderno, usa `SUPABASE_SERVICE_ROLE_KEY`. JSON/default inválido falha fechado, sem fallback silencioso. Nenhum secret remoto foi criado ou alterado.

Fetch do cliente administrativo mantém apikey e remove qualquer `Authorization: Bearer sb_secret_...` gerado pelo SDK. Preserva o Bearer JWT explícito de `auth.getUser(jwt)` e proíbe redirects/destino fora da origem Supabase configurada. Autenticação do usuário continua por JWT, antes das consultas administrativas.

Unitários comprovaram headers com o SDK real, preferência, fallback e fail-closed. O grupo `credentials` passou no Edge Runtime real com Auth/Data API locais: ambas as credenciais validaram o JWT do usuário e selecionaram o registro por ID/owner; a secret nunca apareceu como Bearer. Referências: [secrets de runtime](https://supabase.com/docs/guides/functions/secrets), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## G. Segurança preservada

Inspeção estática e unitários confirmam `verify_jwt = true`, `auth.getUser(jwt)` antes do acesso administrativo, request apenas `{ subscription_id }`, ID + usuário autenticado em seleção/claim/cleanup, RLS forçada, helper JWT GUC sem Auth e executor NOLOGIN/NOINHERIT/NOBYPASSRLS. Schema privado permanece inacessível à Data API; nenhuma ACL histórica foi adaptada.

Providers exatos FCM/Mozilla/Apple; HTTPS/default port, sem credenciais/fragmento, redirect proibido, TTL 60 e timeout 10 segundos preservados. 404/410 usa snapshot do proprietário e preserva refresh concorrente. Payload fixo e worker sem treino intactos. Unitários cobrem SSRF, CORS, concorrência e falhas temporárias.

Credenciais sintéticas permaneceram em runtime ignorado e foram removidas. Bundle/Vite HTTP foram verificados sem revelar secrets. A aprovação SQL/Data API/Edge decorre também da matriz real isolada executada, separada das evidências estáticas/unitárias.

## H. Testes

| Verificação | Resultado desta rodada |
| --- | --- |
| npm test | **51 passaram, 0 falharam, 0 skipped**; 23 testes a mais que o baseline de 28. Resultado final após ajuste de validação estrita de strings. |
| Bootstrap SQL | **Passou** na execução final: fixture legada + EXPAND e Memory completos/intactos + Push integral e assertions. |
| SQL security / sete ACL negativos | **Passaram**: constraints/índices, RLS/owners/grants, GUCs legado/JSON/ausente/inválido, Auth inacessível, A/B, lifecycle/cascade, estatísticas oficiais SELECT-only e sete rejeições transacionais. |
| Data API real A/B | **Passou**: JWT ausente/inválido, múltiplos devices, idempotência, concorrência, ownership e GET/POST/PATCH/DELETE direto bloqueados. |
| Edge business integration | **8/8 grupos passaram**: core/CORS/SSRF, transporte, expiração 404/410, temporários, timeout, concorrência, refresh e credenciais. Auth/DB reais; transporte falso fixo; zero envios externos. |
| Spike Edge real | **Passou**: web-push 3.6.7 importado; generateRequestDetails gerou POST, 219 bytes criptografados, aes128gcm, autorização VAPID presente; zero transmissões. |
| npm run test:push:local | Execução final **passou, exit 0**, após autorização da exceção exata e correção de limpeza. Primeira tentativa interrompida e documentada abaixo. |
| npm run build | **Passou**, 2933 módulos; aviso existente de chunk acima de 500 kB. |
| Deno | **Passou**: container Deno 2.1.4, mount Functions read-only, `deno check --frozen push-test/index.ts`. |
| db lint local public/gymio_private/gymio_push_private | **Passou**: `--local --schema public,gymio_private,gymio_push_private --level warning --fail-on error`; zero erros. |
| git diff --check | **Passou**; sem staging. |
| Frontend secrets | **Passou** scan do primeiro build e HTTP real Vite; arquivos .env/runtime e variante Windows de maiúsculas retornaram 403. Depois, build repetido após validação estrita do tipo de result. |
| PowerShell harness | Parser passou após correção de limpeza. |
| Lint frontend | Não há script/configuração atual. |
| Manual browser/provider | **Não executado**; roteiro localhost preparado para o usuário. Aceitação não equivale a entrega. |

Docker Server 29.8.1, CLI 2.120.0, Postgres 17.11.0.004. Spike via Edge Runtime 1.77.4 (Deno compatível 2.1.4), V8 11.6.189.12, TypeScript 5.1.6. ID exclusivo gymio-push-foundation-local, portas 55431/55432. Imagem/digest Postgres: `06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108`.

A primeira tentativa cumpriu o gate e parou antes dos testes de negócio. A limpeza encontrou `start-secrets` como diretório, embora o harness o tratasse como arquivo. Corrigido para Remove-Item recursivo com validação do caminho absoluto; resíduos daquela execução foram removidos com owner/path checks. Na execução final, cleanup automático terminou sem erro: containers/volumes/rede da tarefa ausentes; snapshot, runtime, credenciais e .env.push.local removidos. .temp preexistente preservado. Sem prune; imagens compartilhadas mantidas.

## I. Hashes

| Migration | SHA-256 depois |
| --- | --- |
| Auth 20260725194232 | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND 20260821190134 | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Exercise Memory 20260823003337 | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| Push 20261007215944 | `582f93e0d9b61d616c7932aee9b53068828dc988256d6c55a4413eff0d87e387` |

Três históricos idênticos antes/depois. Push antes: `1fe175d92b2e6286e50faed00b09646bfb1e6c50a2e0f9c0d7289e7f7cfccf75`; mudou intencionalmente. .env preservado: `c711d3dfcf3e2aa913607172cac95d407408f1ffdb2f4d19669cc5a736b88149`. Não houve restauração automática.

## J. Documentação e Git

Corrigida a afirmação anterior sobre ausência de commit/push. O HEAD local já contém `104a00b052f02cdb4d8c2d596de823bb18f82d82`; sua presença remota foi informada pela auditoria do usuário. Nenhum novo commit/push/PR/merge/fetch foi feito nesta rodada. Main não foi alterada.

Guia atualizado com mapping, timeouts/rollback, credenciais e exceção de auditoria autorizada. Roteiro manual localhost foi preservado/ampliado, sem execução automática. Este relatório substitui o anterior como descrição do estado atual.

## K. Estado remoto

**Nenhuma operação Supabase remota nesta rodada**, inclusive read-only. Sem DDL/DML remoto, RPC Push remota, deployment, secrets, migration history, db push/repair ou CONTRACT. Estado remoto informado pelo usuário continua sendo o baseline de três migrations, sem V3.2-A aplicada; não foi reconsultado.

Sem scheduler, notificações de sessão, ações de treino, mudanças em Session V2/Memory ou avanço para V3.2-B. Baseline local é fixture reconstruída de suporte; Auth histórico não foi reaplicado, e seu historical drift conhecido não foi corrigido.

## L. Veredito

**V3.2 PUSH FOUNDATION CORRIGIDA E PRONTA PARA TESTE MANUAL**

Matriz SQL/Data API/Edge completa aprovada em stack isolada, com a exceção exata autorizada pelo usuário e grants históricos intactos. Unitários/build/Deno/db lint/diff passaram. Recebimento e clique em browser/provider reais permanecem exclusivamente como teste manual. Nenhum avanço para V3.2-B.

# Gym.io V3.2-A — relatório A–L

Validação concluída em 07/10/2026, branch `gym.io-v3.2`. Evidências sanitizadas; nenhuma credencial incluída. A matriz foi executada em stack nova, após as correções de reprodutibilidade do harness.

## A. Arquivos criados/alterados

- Frontend: `src/services/push/{pushUtils,pushController,pushService}.js`, `src/hooks/usePushNotifications.js`, `src/components/PushNotificationSettings.jsx`, `src/components/UserProfileModal.jsx`, `src/components/Sidebar.jsx`, `src/services/auth/{authService,logoutLifecycle}.js`.
- Service Worker/PWA: `public/push-sw.js`, `public/manifest.webmanifest`, PNGs `public/push-icon-{192,512}.png`, derivados de `public/favicon_old.png`; referência ao manifest e cor em `index.html`.
- Migration aditiva criada pelo CLI: `supabase/migrations/20261007215944_push_foundation.sql`. SHA-256: `1fe175d92b2e6286e50faed00b09646bfb1e6c50a2e0f9c0d7289e7f7cfccf75`.
- Edge: `supabase/functions/push-test/index.ts`, `_shared/{pushHandler,pushRepository,pushTransport}.js`, `deno.json`, `deno.lock`.
- Testes: `src/services/push/{push,worker}.test.js`, `_shared/{pushHandler,pushTransport}.test.js`; `supabase/testing/{legacy-baseline.sql,push-security.sql,local-tests.mjs,frontend-security.mjs,run-local.ps1}`, `testing/{compat-spike,edge-integration}/index.ts`.
- Configuração/documentação: `supabase/config.toml`, scripts em `package.json`, proteção de secrets em `vite.config.js`, exclusões adicionais em `.gitignore`, `PUSH_FOUNDATION.md` e este relatório.

A remoção preexistente de `supabase` do `.gitignore` foi preservada. Os artefatos históricos em `supabase/`, `.env` e `package-lock.json` não foram editados. Não houve instalação de dependências frontend.

## B. Arquitetura

Clique explícito → permission → worker dedicado → PushSubscription → RPC autenticada → persistência. A Edge Function valida o JWT, seleciona uma subscription do usuário, gera Web Push criptografado e envia. O worker aceita somente o teste fixo e abre `/dashboard`.

As RPCs evitam entregar endpoints/chaves ao browser por leitura da tabela. Os GUCs de identidade são fornecidos pela fronteira HTTP após validação criptográfica, não por parâmetros do cliente. Session V2 continua como autoridade do treino.

## C. Persistência

`public.push_subscriptions` contém UUID próprio, FK `id_usuario → auth.users` com cascade, endpoint, `p256dh`, `auth`, timestamps backend e `last_test_requested_at`. Sem metadata de device/browser.

Endpoint globalmente único, índice por usuário, checks de comprimento/HTTPS/providers e Base64URL. RLS habilitada e forçada. Registro repetido preserva ID/owner; múltiplos devices são permitidos; colisão com outra conta é rejeitada. Remoção própria é idempotente. Rotação explícita remove o vínculo anterior quando possível e apresenta aviso quando essa limpeza falha.

## D. Segurança

Executor `gymio_push_executor`: NOLOGIN, NOINHERIT, NOBYPASSRLS, sem privilégios administrativos ou membership de outras roles. Wrappers públicos DEFINER, implementações privadas INVOKER, `search_path` vazio. Schema privado inacessível à Data API.

Helper próprio de JWT GUC, sem `auth.uid()`. Assertions passaram para ausência de USAGE/CREATE efetivos em `auth`, acesso a tabelas/sequences de Auth e referências `auth.*` em funções executadas pelo executor. Nenhuma ACL histórica foi alterada para satisfazê-las.

`PUBLIC`, `anon` e `authenticated` não possuem leitura/DML direto. Só três RPCs são concedidas a `authenticated`. Service role fica exclusivamente no sender; sua tabela concede SELECT/DELETE e UPDATE apenas do throttle timestamp. Autorização por ID e usuário permanece explícita.

VAPID privado/service role ausentes do cliente e do bundle. Verificação HTTP real confirmou 403 para arquivos de secrets, incluindo variação de maiúsculas no Windows. Só a chave VAPID pública chega ao frontend.

## E. Frontend

Aba Notificações com ativação, teste e desativação. Estados `unsupported`, `default`, `granted`, `denied`, `subscribed`, `unsubscribed`, `error` e operação em andamento.

Inspeção não pede permission nem cria subscriptions. Permission somente no clique. Registro mal sucedido cancela subscription recém-criada. Logout tenta remoção remota/unsubscribe com limites, coleta falhas, marca desativação e tenta conter somente o worker dedicado. `signOut()` é chamado mesmo com falhas remotas, locais, simultâneas ou timeout. Erros próprios do Auth mantêm seu tratamento. Não há fila com JWT nem reativação automática.

## F. Service Worker

Somente `push` e `notificationclick`. Envelope estrito v1/type test, título Gym.io, corpo “Notificações de treino ativadas.” e destino `/dashboard`. Payload inválido ou destino diferente é rejeitado. Clique fecha a notificação e navega/foca uma janela da mesma origem ou abre o destino fixo. Sem cache offline ou ações de treino.

## G. Edge Function e spike

`push-test`: somente POST `{ subscription_id }`; `verify_jwt = true`; `auth.getUser(jwt)` antes de consultas administrativas. Registro inexistente/alheio tem o mesmo resultado. Claims de identidade, endpoint ou conteúdo arbitrários são rejeitados.

Throttle atômico de 30 segundos, TTL 60 segundos, timeout 10 segundos, redirect proibido, HTTPS/default port e hosts exatos FCM/Mozilla/Apple. 404/410 exclui somente a versão enviada pertencente ao usuário; refresh concorrente impede a exclusão. Falhas temporárias preservam o registro, sem retry automático. Resposta sanitizada de aceitação não confirma recebimento.

Spike obrigatório executado via CLI + Docker no runtime real: Edge Runtime **1.77.4**, Deno compatível **2.1.4**, V8 **11.6.189.12**, TypeScript **5.1.6**. `web-push@3.6.7` importou e gerou POST com corpo criptografado de **219 bytes**, `aes128gcm` e autorização VAPID presente. **Nenhuma requisição transmitida**. Só depois disso foi integrado o transporte e fixado o lockfile.

Integração posterior comprovou a composição desse mesmo transporte com Auth/banco reais e fetch falso, além do timeout. Não há opção de mock nem bypass de Auth exposta em `push-test`.

## H. Testes executados

| Camada | Evidência/resultados |
| --- | --- |
| Unitários | `npm test`: **28 passaram, 0 falharam**. VAPID, normalização, suporte, permission, lifecycle/rotação, rollback, logout com falhas/timeouts, worker, handler e transporte. |
| SQL | Bootstrap novo + EXPAND e Memory completos/intactos + Push/assertions; usuários A/B, checks/índices, múltiplos devices, idempotência, ownership, cascade, grants/RLS, GUC legado/JSON/ausente/inválido, Auth inacessível e DML/anon bloqueados: **passou**. |
| Data API real | JWT ausente/inválido, A/B, registro concorrente/idempotente, lookup próprio, remoção idempotente e GET/POST/PATCH/DELETE bloqueados: **passou**. |
| Edge Runtime real | Sete grupos: core, transporte criptografado, expiração 404/410, falhas temporárias, timeout, concorrência/throttle/cooldown, refresh concorrente. Auth e banco locais reais; apenas transporte HTTP simulado: **todos passaram**. |
| Spike real | Import, `generateRequestDetails`, POST/headers/corpo criptografado; **passou**, zero envios. |
| Banco | `supabase db lint --local --schema public,gymio_private,gymio_push_private --level warning --fail-on error`: **sem erros**. |
| Types | `deno check push-test/index.ts` em Deno Docker 2.1.4: **passou**. |
| Build | `npm run build`: **passou**; aviso existente de chunks maiores que 500 kB. |
| Secrets frontend | Scan de valores privilegiados reais locais no bundle e HTTP Vite com variação de maiúsculas: **passou**. |
| Whitespace | `git diff --check`: **passou**. |
| Lint frontend | Não há script/configuração existente de lint frontend. |
| Manual | Recebimento/clique em browser/provider reais: **pendente**, roteiro localhost em `PUSH_FOUNDATION.md`. |

`npm run test:push:local` terminou com exit code **0** na execução completa de banco vazio, usando Functions em snapshot temporário estável e política local `oneshot`. As tentativas anteriores tiveram 502 no workspace sincronizado; nenhuma assertion foi relaxada nem teste falho repetido automaticamente. Não se atribui apenas à CPU uma causa que não foi confirmada. A execução final preservou os limites de runtime.

Stack: Docker Server **29.8.1**, CLI **2.120.0**, Postgres **17.11.0.004**, PostgREST **16.4**, Auth **2.197.0**, Kong **2.8.1**. Identificador próprio `gymio-push-foundation-local`, portas 55431/55432, credenciais/usuários/VAPID sintéticos locais.

Digests utilizados:

| Imagem | SHA-256 |
| --- | --- |
| Supabase Postgres 17.11.0.004 | `06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108` |
| Edge Runtime 1.77.4 | `ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8` |
| PostgREST 16.4 | `d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df` |
| GoTrue 2.197.0 | `1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| Kong 2.8.1 | `1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d` |
| Deno 2.1.4 (check/cache) | `3bf75873714baa410dcf7fabaf76d806d20f0ac8a7579df11577b4ed97416e34` |

Containers, volumes e rede com o label deste projeto: **zero restantes**. Snapshot temporário, `.runtime`, JWTs, VAPID local e `.env.push.local`: removidos. Processos de serve e Vite encerrados. Imagens baixadas permanecem no cache Docker compartilhado; nenhum prune foi executado.

## I. Migrations históricas

Hashes antes/depois idênticos:

| Migration | SHA-256 |
| --- | --- |
| Auth — `20260725194232_auth_email_security.sql` | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND — `20260821190134_workout_session_persistence_expand.sql` | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Exercise Memory — `20260823003337_exercise_memory_read.sql` | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |

`.env` também preservado: `c711d3dfcf3e2aa913607172cac95d407408f1ffdb2f4d19669cc5a736b88149`.

## J. Limitações

Sem scheduler de descanso, notificações orientadas à sessão ou ações de treino/lock screen. CONTRACT permanece em `recovered/`, intacto e não executado. Nenhuma alteração de significado em Session V2 ou Exercise Memory.

Baseline local é fixture reconstruída de suporte por metadados, sem autenticidade histórica nem dados de produção. Auth histórico não foi reaplicado; sua ausência atual de trigger/função continua classificada como **historical drift**. O Postgres local usa o patch escolhido pelo CLI (17.11), diferente do remoto conhecido (17.6); não se afirma reprodução integral de produção.

O recebimento Web Push real e comportamento em plataformas/PWA ainda dependem do teste manual separado. Aceitação pelo provider não equivale a entrega. O scope autorizado requer preparação desse roteiro, não envio externo automatizado.

## K. Estado remoto

Nenhuma alteração remota. Consultas remotas exclusivamente de catálogos em transações READ ONLY para a fixture. Sem DDL/DML remoto, RPC de negócio remota, secrets, deployment, migration history, db push ou repair. Sem commit, push, PR ou merge; trabalho local permanece para auditoria. Alterações preexistentes preservadas.

## L. Veredito

**V3.2 PUSH FOUNDATION PRONTA PARA AUDITORIA**

Matriz obrigatória SQL/Data API/Edge passou no ambiente local isolado. Teste manual permanece explicitamente pendente. V3.2-B exige nova aprovação.

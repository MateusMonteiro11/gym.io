# Gym.io V3.2-B — execução local e auditoria

O Compatibility Gate usa exclusivamente PostgreSQL `17.6.1.113` / pg_net `0.20.0`:
`powershell -NoProfile -File supabase/testing/run-workout-local.ps1 -PostgresVersion 17.6.1.113 -RuntimeCompatibility`.
A execução padrão em `17.11.0.004` permanece disponível para regressão, mas não
substitui a lane compatível com produção. Não iniciar teste manual sem auditoria.

Antes do harness, rode `npm test`, `npm run build` e `git diff --check`.
O teste de segredo do bundle utiliza esse build. Não existe script de lint
frontend no projeto; db lint e Deno check pertencem ao harness.

`powershell -NoProfile -File supabase/testing/run-workout-local.ps1` cria um projeto
descartável `gymio-workout-push-local` (API 55441, DB 55442, shadow 55440), recusa
recursos B já existentes e remove exclusivamente seu projeto e diretório temporário.
Exige Docker e Supabase CLI; não aceita destino remoto. Nenhum comando de deploy,
repair, db push ou CONTRACT faz parte do harness.

O bootstrap usa a fixture histórica explicitamente reconstruída, EXPAND, Memory e
Push Foundation intactos. Não executa Auth histórico. Instala as extensões sem
modificar ACLs, roda o gate aprovado, comprova três ticks reais de dez segundos,
aplica B integralmente e executa as matrizes A/B. O gate é repetido ao final.

A outbox representa o descanso físico `(sessão,item,próxima série,rest_finished)`.
Revision/deadline são snapshots atualizáveis. Destinatários são congelados uma
única vez. A remoção de subscription elimina suas deliveries por FK/cascade;
subscribers posteriores só entram no próximo descanso. Pausa ou extensão adiam
tentativas ainda não iniciadas; pulo, avanço, cancelamento e finalização as invalidam.

`attempted_at` é gravado e a transação encerrada antes do transporte. Claims duram
60 segundos. Somente claims sem tentativa podem ser recuperados. Queda depois do
marcador pode perder o alerta, inclusive antes do HTTP: essa perda é intencional
para evitar duplicação. `accepted` significa somente resposta 2xx do provider.
Nenhum estado/timestamp promete recebimento ou visualização.

O sender reclama até dez deliveries, com quatro transportes simultâneos por
invocação. Revalida sessão e subscription atuais no begin; não usa credenciais do
claim. Locks seguem sessão → evento → subscription → delivery e terminam antes
do HTTP. Um begin espera apenas pelo lock curto da sessão, permitindo vários
devices da mesma sessão sem descartar claims por contenção transitória.

O job global fica inativo na migration. Configuração server-side local:

- runtime: `GYMIO_WORKOUT_WORKER_TOKEN` aleatório, VAPID público/privado/subject;
- Vault: `gymio_workout_push_worker_token` e `gymio_workout_push_url`;
- header exclusivo `X-Gymio-Workout-Worker-Token`, body estritamente `{}`;
- URL local do Vault: `http://kong:8000/functions/v1/workout-push`;
- `push-test` mantém JWT; `workout-push` usa apenas autenticação de máquina.

Token/credentials nunca entram em URL, body, browser, source, migration ou logs.
O handler não configura CORS e rejeita Origin/Sec-Fetch antes da inicialização
administrativa. O Kong local acrescenta seus headers CORS de plataforma; essa
característica é registrada separadamente e não autoriza chamadas de browser.
Nenhuma configuração CORS da A/plataforma foi ampliada.

Nos testes, a geração/encriptação web-push 3.6.7 é real; o transporte é injetado
somente pelo harness. Um entrypoint temporário usa a factory/repository reais e
fetch falso para validar cron → pg_net → Edge sem acessar provider. Não existe
opção HTTP de mock, identidade, endpoint ou conteúdo. A fonte de produção não é
substituída. A compatibilidade da biblioteca também é testada no runtime real.

O SW aceita V1 de teste e V2 estrito. Projeções locais são silenciosas. Somente
rest_finished pede renotify/vibration. IndexedDB guarda recibos, tombstones e
ordenação mínima; Session V2 permanece a única fonte de verdade. Receipt precede
o alerta. Sem armazenamento, um card já conhecido pode ser atualizado em silêncio;
uma projeção desconhecida é ignorada. Encerramento/logout fecham e bloqueiam cards.

## Roteiro manual localhost (não substitui a matriz automatizada)

1. Após auditoria externa, para uma rodada manual futura execute o harness com
   `-PostgresVersion 17.6.1.113 -RuntimeCompatibility -KeepForManual`. Ele só
   retém o stack após todos os testes passarem, restaura o entrypoint de produção
   no snapshot e mantém o job inativo. Anote o diretório mostrado.
2. Em um PowerShell novo, leia somente as três variáveis `VITE_*` de
   `<runtime>/frontend.env` para o ambiente do processo e rode `npm run dev:push`.
   Não copie secrets para `.env`, `.env.push.local`, `src/` ou `public/`.
   Abra `http://localhost:5173`; strictPort recusa uma porta já ocupada.
3. Crie uma conta sintética local ou use o usuário local do runtime. Faça login,
   abra Perfil → Notificações e ative por clique explícito. Envie o teste V1,
   confira texto e clique em `/dashboard`. Aceitação do provider não prova que
   o navegador exibiu a notificação.
4. Crie um treino local e inicie a sessão. Confira um único card, atualização
   silenciosa em descanso/pausa/resume e rota `/treinar/<id>` no clique. Para
   conferir Push de fim de descanso, ative exclusivamente o job local do projeto
   B após configurar o browser: `cron.alter_job(...,active:=true)`. Essa rodada
   manual pode enviar ao provider real; o harness automatizado nunca envia.
5. Com frontend aberto, deixe a RPC não forçada confirmar o prazo: somente um
   alerta entre sinal local e Push. Reinicie o worker/navegador e confira recibo
   persistente. Pulo/finalização/cancelamento devem fechar ou invalidar o card.
6. Desative neste navegador e teste logout. Cards conhecidos fecham; mensagens
   atrasadas não reabrem. Erros de limpeza devem dar feedback sem bloquear Auth.
7. Termine somente o PID registrado em `<runtime>/serve.pid`, pare exclusivamente
   `gymio-workout-push-local` com `supabase stop --project-id ... --no-backup` e
   remova apenas o diretório anotado após validar prefixo, localização temp e
   `.owner`. Preserve o stack manual A e seus arquivos.

Vibração, recebimento real e apresentação visual dependem do browser/OS e pertencem
ao roteiro manual. Não são substituídos por provider acceptance. A configuração
local não é uma autorização para ativar secrets, job ou funções em produção.

## Evidência da rodada completa — 2026-10-10

- Bootstrap novo integral aprovado; nenhum teste obrigatório pendente.
- Scheduler pg_cron 1.6.4: inícios UTC 19:35:42.809091, 19:35:52.938137,
  19:36:02.970736; intervalos 10,129 / 10,032 s; sem overlap; fixture removida.
- SQL B: 18 cenários, incluindo lease real de 60 s e pausa além do prazo antigo.
- Edge B: 16 cenários no runtime real; batch com 12 devices / máximo 4 simultâneos;
  404/410, timeout, refresh, falha parcial, quedas e logout real; nenhum provider real.
- API B: 33 rejeições de clientes e 9 fixtures negativas revertidas.
- Gate final: 22 rejeições HTTP, 41 corpos/owners/ACLs e 6 fixtures negativas;
  snapshots das ACLs oficiais intactos. Gate anterior a B também passou.
- A: SQL/assertions com 7 fixtures negativas, Data API e 8 grupos Edge passaram.
- Cron → pg_net → Edge: execução real em 19:43:34 UTC, status succeeded;
  um attempted/accepted no fetch falso. Tick vazio não disparou HTTP.
- Tick ocioso: média 10,0086 ms (4,880–17,999 ms). Materialização de 100 eventos
  / 100 deliveries: 55,698 ms. Dez lotes avançaram por 1.000 sessões/recipients.
  Zero writes na Session V2; zero writes de dados no tick vazio. Fixture revertida.
- Plano vazio: seq scan em tabela pequena. Plano com 1.000 sessões: index scan
  na PK, 100 linhas em 0,295 ms. O planner não foi forçado a usar um índice.
- npm test 60/60; build aprovado; Deno check frozen (produção/harness), db lint
  local e diff --check aprovados. Build mantém o aviso existente de chunk >500 kB.
- IndexedDB: API de testes fake-indexeddb 6.2.5 em container, com transações
  concorrentes, reinício de contexto e tombstones. Browser/OS reais são manuais.
- Node 22.15.1, npm 10.9.2, CLI 2.120.0, Docker 29.8.1; Edge 1.77.4/Deno 2.1.4.
- Uma rodada descartada retornou 500 no spike frio, sem causa conclusiva; o
  spike passou na rodada completa seguinte, sem alterar biblioteca/runtime.
  A carryover de duas subscriptions dos testes A foi corrigida com remoção pelas
  RPCs, sem mudar assertions de negócio; a rodada final integral passou.
- 18 artefatos protegidos/ignorados comparados: zero diferenças. Os cinco IDs de
  containers manuais A permaneceram iguais. Recursos descartáveis B removidos.
- Nenhuma operação remota, CONTRACT, commit, push, PR, merge ou V3.2-C.

Hashes SHA-256 da validação anterior em 17.11, antes do Compatibility Gate:

| Arquivo | SHA-256 |
|---|---|
| Auth | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Memory | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| Push Foundation | `f1212ee8d19d7d8b0a362f1ffc65b403898be433b2d13712b6967b3490e45f04` |
| B — 20261010183821 | `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b` |

Imagens oficiais utilizadas (digests registrados, imagens compartilhadas preservadas):

| Imagem public.ecr.aws/supabase | Digest SHA-256 |
|---|---|
| postgres:17.11.0.004 | `06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108` |
| edge-runtime:v1.77.4 | `ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8` |
| gotrue:v2.197.0 | `1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| postgrest:v16.4 | `d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df` |
| kong:2.8.1 | `1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d` |

## Compatibility Gate final — 2026-10-10 (A–L)

### A. Runtime testado

Lane nova, descartável, sem reutilizar volumes/dados do stack manual A. PostgreSQL
Supabase **17.6.1.113**, servidor **17.6**; pg_cron **1.6.4**; pg_net **0.20.0**;
Vault **0.3.1**; PostgREST **16.4**; Edge Runtime **1.77.4** (reporta compatibilidade
com Deno **2.1.4**, V8 11.6.189.12, TypeScript 5.1.6). O `deno check --frozen`
utilizou Deno standalone **2.1.4**, V8 13.0.245.12-rusty, TypeScript 5.6.2.
supabase-js **2.106.0** e web-push **3.6.7**. Node 22.15.1, npm 10.9.2,
Supabase CLI 2.120.0, Docker 29.8.1.

A imagem exata foi fixada no `.temp/postgres-version` do runtime temporário;
`docker inspect` e o catálogo verificaram a versão antes de qualquer gate.
Não houve substituição por 17.11. A seleção usa o mecanismo do
[CLI 2.120.0](https://github.com/supabase/cli/blob/v2.120.0/apps/cli-go/pkg/config/config.go).
Vault já é instalado pelo bootstrap oficial do CLI; não foi reinstalado nem
teve ACLs ajustadas. Auth histórico e CONTRACT não foram executados.

| Imagem | Digest SHA-256 |
|---|---|
| postgres:17.6.1.113 | `4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e` |
| postgres:17.11.0.004 — referência | `06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108` |
| edge-runtime:v1.77.4 | `ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8` |
| postgrest:v16.4 | `d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df` |
| denoland/deno:2.1.4 | `3bf75873714baa410dcf7fabaf76d806d20f0ac8a7579df11577b4ed97416e34` |

### B. pg_net 0.20.0 × 0.20.4

Dois catálogos reais, capturados em transações READ ONLY nas imagens oficiais.
Snapshots guardados apenas temporariamente, sem dados de filas, respostas ou
secrets. ACLs foram comparadas por grantee/grantor/privilégio/grant option;
owners e identidades por nome, sem depender de OIDs de ambientes diferentes.

Para reproduzir a comparação antes da matriz alvo, executar sequencialmente
na raiz do projeto (cada comando remove sua própria lane):

```powershell
powershell -NoProfile -File supabase/testing/run-workout-local.ps1 -PostgresVersion 17.11.0.004 -CatalogOnly -CatalogOutput "$env:TEMP/gymio-runtime-compat-pg-net-0.20.4.json"
powershell -NoProfile -File supabase/testing/run-workout-local.ps1 -PostgresVersion 17.6.1.113 -CatalogOnly -CatalogOutput "$env:TEMP/gymio-runtime-compat-pg-net-0.20.0.json"
node supabase/testing/runtime-compare.mjs
```

| Superfície | 0.20.0 × 0.20.4 | Classificação |
|---|---|---|
| `extversion` | 0.20.0 × 0.20.4 | Representação |
| Extension owner/schema | `supabase_admin` / `public`, iguais | Sem diferença |
| Schema de objetos | `net`, owner/ACL iguais | Sem diferença |
| Relações | 2 tabelas + 3 índices, iguais | Sem diferença |
| Sequence | `net.http_request_queue_id_seq`, owner/ACL iguais | Sem diferença |
| 12 funções, incluindo http_post/http_get | Assinaturas, defaults, retornos, owners, modos de segurança, search_path, ACLs, fontes/símbolos C e caminhos binários iguais | Sem diferença |
| Relation/column ACLs e PUBLIC grants | Iguais | Sem diferença |
| RLS/policies | Iguais; zero policies de net | Sem diferença |
| Default ACLs | Nenhuma nos snapshots comparados | Sem diferença |

Igualdade de catálogo não demonstra igualdade dos binários; a integração HTTP
real de 0.20.0 foi executada separadamente. A comparação falha diante de qualquer
outra diferença de pg_net, sem aceitar versões futuras.

Foram encontradas também três diferenças de **pg_cron** entre as imagens:

| Objeto | 17.6 × 17.11 | Classificação |
|---|---|---|
| `cron.jobid_seq` | Sem SELECT público × PUBLIC SELECT | Segurança: baseline alvo mais restritivo |
| `cron.runid_seq` | Sem SELECT público × PUBLIC SELECT | Segurança: baseline alvo mais restritivo |
| `cron.job_run_details` | Grant TRIGGER adicional a postgres, com grant option | Irrelevante para clientes: role administrativa já privilegiada |

Nenhuma outra diferença de cron/Vault foi encontrada no catálogo comparado.
A consulta remota READ ONLY confirmou que ambas as sequences de cron não têm
SELECT de PUBLIC no ambiente-alvo. O ACL remoto é NULL; o local contém USAGE
explícito ao owner. Essa representação não altera direitos públicos nem os
direitos implícitos do owner. Nenhum grant oficial foi reparado.

### C. Push Foundation

A alteração está restrita à assertion: pg_net aceita exatamente `0.20.0` e
`0.20.4`, sem wildcard/range. Para as duas sequences exatas de cron, PostgreSQL
17.6 exige ACL público vazio; o baseline anterior mantém PUBLIC SELECT.
Owners, membership de extensão, tipo de objeto, grantor, grant option, grants
diretos do executor e demais propriedades continuam fail-closed. Não foi
criada allowlist genérica de schema nem alterado privilégio persistente.

SHA-256 anterior: `f1212ee8d19d7d8b0a362f1ffc65b403898be433b2d13712b6967b3490e45f04`.
SHA-256 novo: **`225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823`**.
Os hashes esperados no harness foram atualizados; B passou a ser conferida
também em cada contexto/etapa. Nenhum corpo de RPC ou grant da Foundation mudou.

### D. Extension Gate

Antes de B: **22 rejeições HTTP, 32 corpos/owners/ACLs, seis fixtures negativas**.
Depois de B: **22 rejeições HTTP, 41 corpos/owners/ACLs, seis fixtures negativas**.
Somente `public` e `graphql_public` expostos. Cron, net, Vault e schemas privados
fora da Data API; nenhum wrapper administrativo novo executável por clientes;
nenhum grant direto inesperado ao executor. Snapshot oficial de ACLs, owners,
policies e defaults idêntico antes/depois de cada gate.

As fixtures negativas existentes rodam em transações revertidas. Nenhuma
alteração persistente de ACL oficial foi feita. A lane preserva o stub oficial
GraphQL desabilitado já aprovado; não pretende reproduzir um resolver habilitado.

### E. Scheduler

Três execuções reais de `10 seconds`, pg_cron 1.6.4 em PostgreSQL 17.6.1.113:

| Início UTC — 2026-10-10 | Fim UTC |
|---|---|
| 20:34:11.971872 | 20:34:12.076028 |
| 20:34:22.009271 | 20:34:22.113589 |
| 20:34:32.087250 | 20:34:32.191063 |

Intervalos **10.038 s / 10.078 s**, todos succeeded, sem overlap. Job de spike
removido. Job global de B ficou inativo após o teste e foi eliminado junto da lane.

### F. pg_net dispatch

Fluxo real **cron → tick → pg_net 0.20.0 → workout-push → handler autenticado →
transporte falso**, sem request a provider externo. Job iniciou
`2026-10-10T17:42:28.045828-03:00` e terminou `17:42:28.078720-03:00`, succeeded.
Resposta em `net._http_response`: HTTP **200**, claimed=1, attempted=1,
accepted=1, expired=failed=skipped=0. Observação completa em 15.273 s.

Um probe transacional revertido confirmou body `{}`, headers JSONB corretos,
token no header dedicado, `timeout_milliseconds=10000`, URL igual ao secret
local e token ausente da URL. O fluxo real validou o mesmo contrato HTTP.
Tick ocioso não enfileirou HTTP. Treze streams/arquivos de log foram comparados
com seis valores secretos locais: **zero ocorrências**. Nenhum valor/header
sensível foi impresso. O resumo de credenciais do `supabase start` é descartado,
mantendo apenas stderr de diagnóstico. Secrets/runtime temporários foram removidos.
`accepted` indica somente aceitação simulada pelo provider.

### G. External libs

| Dependência | Resultado |
|---|---|
| supabase-js 2.106.0 | RPCs reais de registro/consulta/remoção, abortSignal de Data API, Functions.invoke e admin wrapper passaram no Edge; testes modern secret/legacy service role passaram |
| web-push 3.6.7 | Import/generateRequestDetails reais; V1 219 bytes e V2 670–671 bytes criptografados; TTL 60; aes128gcm; VAPID ES256/audience/subject/exp/chave pública verificados no transporte fake do sender; zero transmissão externa |
| Edge/Deno | Runtime 1.77.4 executado; check frozen de push-test, workout-push e todos os módulos compartilhados de produção, mais harnesses, passou com Deno 2.1.4 |
| Vault 0.3.1 | create_secret no harness; dois secrets locais (token/URL); decrypted_secrets somente server-side; acesso de clientes bloqueado |
| pg_cron 1.6.4 | Cadência de segundos e dispatch global real aprovados |

Allowlist de produção revisada, sem alteração: `fcm.googleapis.com`,
`updates.push.services.mozilla.com`, `web.push.apple.com`; HTTPS, porta padrão,
sem credentials/fragmento, redirects `error`, timeout 10 s. Nenhuma requisição
real de Push foi enviada.

### H. V3.2-B regression

Rodada final fresca passou integralmente: A SQL/assertions e sete fixtures
negativas; A Data API; oito grupos Edge A; B aplicada integralmente com assertions;
18 cenários SQL B (mais métrica de tempo); 33 rejeições Data API e nove fixtures
negativas B; 16 cenários Edge B; lifecycle/logout/cascade; concorrência/leases
reais; IndexedDB; performance com 1.000 eventos/deliveries em rollback;
gate final; Deno frozen e db lint local. Sem enfraquecer testes.

`npm test`: **60/60**, zero skips. Build aprovado (19.52 s), com o aviso já
existente de chunk >500 kB. `git diff --check` passou. Não existe lint frontend.
Nenhuma mudança em frontend, player, card, vibração, Session V2, Memory,
entrypoints/shared modules de produção, config, package manifest ou lockfiles.

Tentativas descartadas: uma consulta de metadados teve cast ambíguo (corrigido
no harness); a primeira assertion no alvo rejeitou o ACL de cron mais restritivo
(baseline corrigido após prova local/remota, sem conceder direitos); outra rodada
foi invalidada por 500 do daemon Docker e reinicialização do PostgreSQL.
A causa desse restart não foi determinada. A rodada fresca final passou sem
alterar limites de Docker, bibliotecas ou assertions de negócio.

### I. Hashes atuais

| Migration | SHA-256 final |
|---|---|
| Auth | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Memory | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| Push Foundation nova | `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823` |
| B | `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b` |

Quatro migrations imutáveis preservadas antes/depois; somente a assertion
autorizada da Foundation mudou. Inventário de 20 arquivos protegidos/ignorados:
zero diferenças, incluindo `.gitignore`, `.env`, `.env.push.local`, fixture,
config, recovered e artefatos do runtime manual A.

### J. Estado remoto / limpeza

**ZERO ALTERAÇÕES REMOTAS**. Um SELECT de catálogos em transação READ ONLY e
leituras de metadados do conector confirmaram projeto `mmtywgacruuxpzviriuh`
ACTIVE_HEALTHY, PostgreSQL 17.6.1.113, pg_cron 1.6.4 e Vault 0.3.1 instalados,
pg_net ausente/máximo disponível 0.20.0, somente três migrations históricas,
Foundation/B ausentes e zero Edge Functions. Nenhuma RPC de negócio foi chamada.
Sem deploy, db push, repair, secrets remotos, DDL/DML remoto, commit, push, PR,
merge ou V3.2-C. HEAD permaneceu `a71339d` na branch `gym.io-v3.2`.

Containers, volumes, network, processos auxiliares e runtime temporário da lane
removidos. Os cinco containers manuais A mantiveram os mesmos IDs; o daemon
reiniciou alguns deles durante a rodada descartada, sem ação de restart desta
tarefa. A imagem oficial baixada permanece no cache Docker. As evidências
sanitizadas foram incorporadas neste documento; snapshots temporários removidos.

### K. Hardening futuro

Somente **IndexedDB notification receipt/tombstone GC**, não implementado.

### L. Veredito

**V3.2-B RUNTIME COMPATIBILITY APROVADA**.

Teste manual não iniciado. Aguardar auditoria externa antes da próxima ação.

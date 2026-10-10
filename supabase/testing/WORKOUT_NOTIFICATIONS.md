# Gym.io V3.2-B — execução local e auditoria

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

1. Para uma rodada manual futura, execute o harness com `-KeepForManual`. Ele só
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

Hashes SHA-256 conferidos antes/depois:

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

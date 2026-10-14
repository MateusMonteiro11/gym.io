# Gym.io V3.2 — Workout Session Mini-Player

Relatório local A–Q — 14/10/2026. Branch `gym.io-v3.2`, HEAD preservado em `ba9b2c2d68ed3c199d337be21abaf1a6e18406f8`.

## A. Modelo Single Session Card

Implementado no processor existente, na sua fila serializada. Todas as projeções de treino usam exclusivamente `gymio-workout-${id_sessao}` e o formatter visual `sessionCardPresentation`. O título é **Gym.io · Treino**; o corpo representa exercício, série e fase, com limite de 160 caracteres. Os campos `title`/`body` dos envelopes e seus validadores permanecem intactos. V1 conserva a apresentação e a tag de teste já existentes.

Não há outro estado autoritativo de treino. Adapter, bridge, emissão C, Session V2 e Quick Controls continuam responsáveis pelos mesmos contratos. Nenhuma atualização periódica ou countdown em background foi acrescentado. `requireInteraction` é omitido: lifetime padrão.

## B. Política de alertas

Updates normais usam `silent=true`, `renotify=false` e omitem `vibrate`. O pedido de alerta é normalizado **antes** de reservar o receipt: `alert=true` sem um envelope válido de descanso concluído não autoriza atenção nem consome receipt. Um V3 elegível como `rest_finished` também precisa passar pelo caminho que solicita esse sinal.

O receipt mantém a identidade física sessão + item + próxima série + `rest_finished`. A reserva transacional original do IndexedDB deduplica os canais local/Push e sobrevive ao reinício. Somente um sinal confirmado pode solicitar atenção; `renotify` e `[200,100,200]` são pedidos apenas quando suas propriedades estão expostas na API. Ausência de vibração não impede a atualização.

## C. Execução

Início, recuperação, série, skip e avanço atualizam o mesmo card silenciosamente. O corpo mostra exercício e série. Total ausente ou incompatível é omitido pelo caminho validado existente, sem inventar carga ou memória. Pausa em execução conserva esse contexto e acesso ao Player, sem emitir capability nova.

## D. Descanso

O corpo apresenta a próxima série e `Descanso até HH:mm`, usando o fuso local e o deadline confirmado. Ajustes e retomada refletem a nova projeção sem atualizar a notificação a cada segundo. O formatter não muda o protocolo nem modifica o objeto recebido. O teste de +15 segundos usa um deadline sintético que cruza a fronteira do minuto para conferir a mudança de apresentação.

## E. Pausa/retomada

O card indica `Descanso pausado` ou `Treino pausado`, exercício e série; todas essas publicações são silenciosas. As prioridades C continuam `Retomar → Pular` durante pausa de descanso.

Quick Controls e seus handlers foram preservados. Pular pausado continua retomar → aguardar projeção/render confirmado → pular o mesmo descanso, com contenção de concorrência e feedback de falha parcial. A verificação visual executou essa sequência no Player real com uma Session sintética injetada; não chamou RPC nem alterou Session V2.

## F. Rest finished

O título permanece estável; o corpo passa a `Descanso concluído` com exercício/série. O alerta substitui a apresentação do mesmo identificador lógico. Duplicatas, corrida local/Push e reinício não reservam outro alerta para aquele descanso.

As distinções do adapter estão documentadas: `project` atualiza o card; `restFinished` atualiza com atenção somente após o encerramento não forçado confirmado pelo servidor. A emissão C, `unchanged`, epoch e descarte de respostas atrasadas não foram alterados.

## G. Android actions

Detecção estrita de `Notification.maxActions`: somente inteiro positivo comprova suporte. A propriedade `actions` é omitida sem suporte ou sem controles. Prioridades preservadas: ativo `+15s → Pular → Pausar`; pausado `Retomar → Pular`; vencido `Continuar`.

Action inline mantém a chamada C com somente o bearer textual, sem navegação, retry automático ou parâmetros de treino adicionais. Sucesso exige projeção válida e revisão maior; atualiza o mesmo card silenciosamente. Rede ambígua não é apresentada como sucesso.

`stale`, `expired`, `already_used`, `unavailable` e expiração no clique invalidam a generation, removem tokens/actions e mantêm um card readonly com **Abra o treino para atualizar**. Esse refresh não avança o marker de projeção nem cria tombstone da sessão. Se APIs falharem, a contenção é best-effort. Uma generation nova continua permitida na mesma sessão.

## H. iOS fallback e Player

Sem suporte comprovado a actions, o clique no corpo constrói internamente `/treinar/<id>?from=push`, depois da validação da rota e do ID canônico. O payload não fornece query arbitrária. V1 continua `/dashboard`. A navegação/foco continua restrita à mesma origem e nenhum bearer, JWT, usuário, subscription ou revisão entra no URL.

No fluxo vindo de Push, os dois slots keyed do Player colocam o bloco de timer antes do exercício na ordem mobile/DOM. Há uma única instância do timer e do exercício. O grid posiciona o exercício à esquerda e o timer à direita no desktop, preservando a organização existente. A entrada normal conserva sua ordem. Não foram introduzidos modal, autofocus ou scroll automático.

## I. Replacement, ordering e dedup

Antes de publicar, o processor enumera `getNotifications({tag})` e os cards de treino da registration. Validação, revisões `bigint`, observed time, sessão, generation e markers antecedem qualquer alteração visual. Card com ordering desconhecido ou mais novo é preservado; um marker do banco sozinho não é usado como prova da revisão de um card antigo.

`unchanged` busca um card existente com a mesma sessão, generation, revisão e validade. Copia os tokens autorizados antes de qualquer preclose; ausência do card resulta em fallback sem actions. Não há reconstrução por IndexedDB ou Cache Storage.

O primeiro update deixa o replacement nativo atuar. Coexistência observada ou duplicatas existentes ativam um flag **somente em memória**: nas próximas publicações aceitas, cards daquela sessão são fechados antes da publicação. Não existe sniffing de browser ou userAgent. Após `showNotification`, a enumeração universal preserva o publication ID recém-publicado e fecha redundâncias da mesma sessão e sessões anteriores, com uma conferência final. Metadados efêmeros em `Notification.data` contêm ID, revisão, observed time e início da sessão; não entram no protocolo nem em nova persistência.

Se surgir um card mais novo ou indeterminado durante a publicação, o processor preserva esse card e descarta sua própria publicação. Falhas de enumeração/show retornam `verified=false`, sem loops. O sucesso de `showNotification` sozinho não comprova cardinalidade.

## J. Finalização/logout

Finalização, cancelamento e remoção conservam o fechamento terminal pelo adapter. Logout e desativação fecham cards conhecidos e gravam os markers existentes de bloqueio; desativação também bloqueia aquela sessão contra reabertura após reativar Push. Os testes incluem zero cards visíveis e mensagens atrasadas após reinício.

Dispensa manual não cria tombstone: outra projeção válida pode recriar o card silenciosamente. Generation inválida é separada de sessão encerrada. As falhas de notificação permanecem best-effort e não alteram a autenticação nem os guards V2.

## K. Testes executados e evidências

| Gate local | Resultado |
|---|---|
| `npm test` | **132/132**, zero falhas/skips; inclui os testes anteriores e 17 casos novos do session card |
| Sequência no Node | Mesmas 20 projeções em cada mock: native replacement e acúmulo apesar da tag; antes/depois de cada publicação e revisão mais recente |
| Browser com IndexedDB real | **19 cenários aprovados**, incluindo outras 40 projeções nos dois mocks; corrida pelos handlers local/Push, receipts, tombstones, reinício, `unchanged`, generations e ausência de bearers persistidos |
| Actions e navegação | `maxActions` ausente/0/1/2/3+, inválidos, prioridades, V1/V2/V3, rota/origem/IDs inválidos, janela existente/nova, inline sem abrir app, respostas C e rede |
| Contenção do processor | Duplicatas preexistentes, fallback após falha de coalescing, duas sessões, stale incapaz de fechar card mais novo, ordering indeterminado, card concorrente após show, enumeração ausente/falha e show com erro |
| Verificação visual | **10 casos**, 390 e 1440 px: descanso ativo, pausado, vencido, execução e entrada normal; uma instância de timer, ordem/layout, ausência de overflow, foco de teclado e alvos Quick Controls ≥44 px |
| Requests nos browsers | **Zero requests externos**, zero page errors; Auth, carregamento de treino e Session são sintéticos/injetados, componentes e Quick Controls reais |
| `npm run build` | Aprovado; aviso de chunks >500 kB já existente, sem correção fora de escopo |
| Impeccable detector | `[]` no arquivo UI alterado |
| `git diff --check` | Aprovado |
| Hashes e inventário | Seis canônicos preservados; nenhuma modificação fora dos arquivos listados em M |

Versões: Node 22.15.1, npm 10.9.2, Chrome headless 154.0.8037.98. Testes browser usam Playwright já disponível no ambiente de ferramentas; nenhuma dependência foi adicionada ao projeto.

Evidências e runners descartáveis preservados em `C:\Users\mateu\AppData\Local\Temp\gymio-mini-player-8aefbf2c6981448d88b14b526cce8770`: `npm-test.log`, `build.log`, `browser-result.json`, `visual-result.json`, inventários before/after/diff, runners e dez capturas `visual-*.png`. Os testes browser reutilizáveis estão em `src/services/push/sessionCard.browser.js`; usam o store real com IndexedDB real e registrations/transportes sintéticos. Os runners temporários encerraram seus próprios servidores e browsers no `finally`.

Não foram executados: matriz Docker/SQL/Edge, RPC real, Push provider, dispositivo físico ou deploy. Isso respeita o escopo autorizado desta etapa. Logs iniciais de ajuste dos mocks/fixture são evidência intermediária; o veredito usa os resultados finais acima.

## L. Hashes históricos

Conferidos antes e depois, inclusive arquivos ignorados pelo Git. Todos iguais aos canônicos:

| Migration | SHA-256 preservado |
|---|---|
| `20260725194232_auth_email_security.sql` | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| `20260821190134_workout_session_persistence_expand.sql` | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| `20260823003337_exercise_memory_read.sql` | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| `20261007215944_push_foundation.sql` | `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823` |
| `20261010183821_workout_notifications.sql` | `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b` |
| `20261011021351_workout_notification_actions.sql` | `b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca` |

## M. Arquivos alterados e inventário

Seis arquivos existentes modificados:

- `public/push-sw.js`: formatter, conferência de cards, metadados, atenção normalizada, generations readonly e contenção de desativação.
- `src/pages/TreinoPlayer.jsx`: dois slots keyed com ordem mobile Push e posição desktop preservada.
- `src/services/push/workoutProjection.js`: comentários que explicitam update normal versus alerta confirmado; comportamento preservado.
- `src/services/push/workout.test.js`: registration mock com enumeração/replacement e declaração de opções suportadas.
- `src/services/push/workoutControls.test.js`: suporte exposto no mock; expectations do novo card readonly, preservando guards C.
- `src/services/push/crossPlatformWorker.test.js`: mock com enumeração de cards vivos e metadados.

Quatro adições:

- `src/services/push/sessionCard.testHarness.js`: projeções e registrations sintéticas compartilhadas.
- `src/services/push/sessionCard.test.js`: 17 casos Node, incluindo as duas sequências de 20 updates.
- `src/services/push/sessionCard.browser.js`: verificações locais com IndexedDB real.
- `WORKOUT_SESSION_CARD.md`: este relatório.

Baseline: 365 arquivos relevantes inventariados; final: 369. Seis modificações autorizadas, quatro adições e zero remoções. O inventário inclui assets, fontes e artefatos relevantes ignorados; exclui `.git`, `node_modules`, `dist`, diretórios internos de ferramentas e `docs`. `dist` foi regenerado pelo build como saída padrão.

`useTreinoAtivo`, seus guards, serviços Session V2/Memory, Quick Controls, bridge, frontend de perfil, manifest, worker config, todos os arquivos Supabase existentes, fixture manual, `.env`, `.env.push.local`, `.gitignore`, package/lockfile e dependências preservados byte a byte dentro do inventário. Artefatos/runtimes anteriores não foram utilizados para executar operações nem removidos.

## N. Backend remoto

Nenhuma conexão, leitura/escrita ou operação de deploy no Supabase foi feita nesta tarefa. Nenhuma migration, Edge Function, ACL, cron, Vault, secret ou history foi alterado. O scheduler não foi iniciado e nenhuma requisição foi enviada a Push provider. O estado remoto não foi reauditado: as evidências desta etapa são exclusivamente locais. Sem CONTRACT, Git write, commit, push ou deploy.

## O. Limitações Web e roteiro posterior

`silent` expressa preferência por ausência de som/vibração; não garante ausência de animação visual do sistema. Lifetime, apresentação e replacement continuam sujeitos ao browser/OS. A especificação descreve replacement por tag e enumeração, mas esta implementação verifica o resultado porque o suporte exposto não basta para garantir coalescing. [Notifications API Standard](https://notifications.spec.whatwg.org/)

Na primeira observação de um browser sem coalescing, cards podem coexistir brevemente entre show e a conferência posterior. Depois, o flag em memória permite preclose; após reinício, a observação precisa ser refeita, mas a conferência posterior permanece universal. Se enumeração/publicação estiver indisponível, não há garantia verificada de um card. Um card antigo sem metadados de ordering é preservado até ser dispensado ou fechado por um evento terminal. Nenhuma dessas falhas cria retry, bypass ou mutação de treino.

**Roteiro de homologação física após outro deploy autorizado — não executado aqui:**

1. Em iOS com PWA instalada e em Android/Chromium, ativar notificações explicitamente e iniciar/recuperar um treino sintético. Conferir título estável e um card.
2. Percorrer execução → descanso → +15s → pausa → retomada → skip → próximo exercício. Conferir card atual, deadline local, silêncio solicitado e ausência de pilha persistente.
3. Aguardar um encerramento confirmado de descanso pelos caminhos já autorizados. Conferir um único sinal de atenção e deduplicação, inclusive após suspensão/reinício. Não habilitar cron como parte desta verificação sem autorização própria.
4. Em Chromium, conferir quantidade/prioridade das actions efetivamente suportadas e respostas C sem abrir PWA. Em iOS/sem actions, tocar no corpo e conferir Player autenticado com timer/Quick Controls antes do exercício.
5. Dispensar o card e produzir outra projeção válida: recriação silenciosa. Conferir generation expirada/stale com card readonly, sem actions antigas.
6. Finalizar/cancelar; repetir em logout/desativação. Conferir fechamento e bloqueio de mensagens atrasadas. Registrar versão do OS/browser, cardinalidade observada, screenshots e comportamento real de animação/lifetime.

Esse roteiro não autoriza deploy, scheduler, novo envio remoto nem limpeza final. A homologação real de dispositivos permanece pendente do próximo deploy autorizado.

## P. Futuro nativo

Clientes nativos poderão reutilizar Session V2 e as fronteiras A/B/C para ongoing notifications no Android e Live Activities/Dynamic Island no iOS. Isso exigirá implementação, autorização e testes próprios. Nenhuma integração nativa, Media Session, áudio de background ou mecanismo adicional foi implementado.

## Q. Veredito

**V3.2 WORKOUT MINI-PLAYER PRONTO PARA PREVIEW**

Os gates locais autorizados passaram. O veredito se limita à implementação e verificações locais; não declara homologação física nem inicia deploy, scheduler ou limpeza final.

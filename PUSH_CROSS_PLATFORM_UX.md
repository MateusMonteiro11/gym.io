# Gym.io V3.2 — Cross-platform Push UX

## A. Feature detection

`supportedMaxActions()` aceita somente um inteiro positivo em `Notification.maxActions`. API/propriedade ausente, zero, número negativo, fração, string, `NaN` e infinito retornam zero. Não há userAgent ou lista de browsers. `actions` é omitida completamente quando não há suporte ou controles disponíveis.

## B. Service Worker

O processor mantém os envelopes V1/V2/V3, validação, tokens em Notification.data, receipts, tombstones, ordering, dedup, generation handling, `unchanged`, tags, silêncio e vibração. Somente a seleção de actions e o destino do clique no corpo mudaram.

O destino original continua validado como `/dashboard` ou `/treinar/<bigint canônico>` com sessionId válido. O worker acrescenta `?from=push` internamente somente ao treino e quando maxActions é zero. Query strings/fragmentos e URLs externas recebidas no payload não são aceitos. A janela escolhida continua sendo da mesma origem.

## C. Fallback sem actions

Push normal → clique no corpo → `/treinar/:id?from=push` → autenticação/recuperação existentes → Quick Controls derivados da Session V2 confirmada. Isso se aplica a qualquer plataforma sem suporte comprovado, incluindo o cenário iOS/Safari relatado na Preview.

`from=push` é somente UX. Digitá-lo manualmente não cria sessão, não autentica o usuário e não concede acesso ao treino. Sem sessão ativa em descanso elegível, não há Quick Controls. Login e ownership permanecem nos caminhos existentes.

## D. Quick Controls

`WorkoutQuickControls` ocupa um slot opcional no WorkoutTimer, reutilizando timer e contexto da próxima série. Fora da entrada Push, os botões anteriores permanecem. Não há cronômetro duplicado ou alteração de CSS/tokens.

- Ativo: +15s, Pular, Pausar.
- Pausado: Retomar, Pular.
- Vencido: Continuar, somente enquanto o estado confirmado ainda estiver em descanso.
- Carregando, conflitante, ausente, finalizado ou em execução: sem painel.

O hook de apresentação sincroniza callbacks após o commit React. Busy bloqueia os controles do Player durante uma operação; feedback existente V2 continua visível. Botões têm 48px de altura mínima e foco por teclado. Não há atualização otimista de sessão ou timer.

## E. Session V2

`useTreinoAtivo`, serviços V2, cálculo de tempo e guards foram preservados byte a byte. Os comandos reutilizam:

| Quick Control | Handler existente |
|---|---|
| +15s | descansoTimer.adicionarTempo |
| Pausar / Retomar | workoutTimer.toggle |
| Pular | pularDescanso |
| Continuar | continuarSerie |

Pular pausado segue a decisão expressamente confirmada: retomar, aguardar a mesma sessão/item/série com revisão avançada e callback atualizado, então pular. A confirmação reutiliza `classificarReconciliacaoMutacao`, sem novo guard de revisão ou timer math. A espera do render é limitada a dez segundos; não é timeout/cancelamento da RPC V2.

São **duas chamadas confirmadas, sem atomicidade entre elas**. Se a segunda falhar, o descanso pode permanecer retomado, com feedback explícito. Não há rollback ou retry automático. Falta de confirmação não é apresentada como retomada bem-sucedida. Troca de sessão/item/série, navegação, logout e unmount interrompem a continuação. O encerramento automático V2 não foi alterado.

## F. Plataformas com actions

O limite da plataforma preserva a prioridade C: ativo +15s → Pular → Pausar; pausado Retomar → Pular; vencido Continuar. Action inline mantém `workout-action`/capability e não abre o app. Body click abre o treino normalmente. Tokens continuam opaque, one-time, revision/subscription/generation-bound; nenhuma definição backend foi alterada.

## G. Perfil

Removidos o botão público Enviar teste, a descrição de homologação e o import/feedback exclusivo dessa apresentação. Preservados os estados unsupported/default/granted/denied/subscribed/unsubscribed/error, ativação, desativação e avisos reais de limpeza parcial.

`push-test`, sender, serviços diagnósticos, contratos A e testes permanecem. Não houve refactor do lifecycle: permission continua em gesto explícito; logout/desativação continuam best-effort.

## H. Segurança

Quick Controls não importam cliente Supabase, não fazem fetch/RPC diretamente, não consomem capabilities e não persistem dados. Não acrescentam JWT/capability/identidade/subscription/revisão em URL, storage ou Router state. O adapter de notificações C existente permanece intacto.

Não há novo endpoint, máquina de estados de treino, registro automático de worker/subscription ou bypass de Auth/RLS. O parâmetro de origem não controla autorização. Configs, envs e dependências foram preservados.

## I. Testes e verificações

- Suíte direcionada: **44/44** aprovados, incluindo regressões C existentes.
- `npm test` final: **115/115**, zero falhas, skips ou cancelamentos; 30 testes adicionais ao baseline.
- `npm run build`: PASS; build inicial 25,55s, confirmação final 9,24s. Avisos de chunk acima de 500kB e timing de plugins; sem otimização fora do escopo.
- `git diff --check`: PASS; avisos LF/CRLF preexistentes.
- Detector de design: zero achados.
- Browser local sintético: estados ativo/pausado/vencido em 1440px e 390px; sem overflow, foco e touch targets verificados, UI de teste ausente. Cinco comandos exercitados com projeções sintéticas; zero requests externos e zero exceções de página.

Cobertura adicional: suporte ausente/0/1/2/3+, valores inválidos, prioridades, navegação de janela existente/nova, rota externa/não canônica, V1, action C sem abrir app, elegibilidade/ownership/contexto do Player, resposta stale/rede, busy/duplicação, confirmação após render, falha parcial, timeout de confirmação e interrupções durante Pular pausado.

O harness visual importa os componentes reais e injeta somente handlers/estado sintéticos, em porta local 5187. Ele não executa o hook V2 contra um banco. A primeira preparação do harness precisou usar o Chrome instalado e corrigir resolução React/Vite; a execução e confirmação finais passaram. Servidor e browser foram encerrados no finally. Não foi executada matriz Docker nem teste real em dispositivo/provider.

## J. Hashes

Os seis hashes foram conferidos antes/depois e permanecem canônicos:

| Migration | SHA-256 |
|---|---|
| Auth | cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6 |
| EXPAND | 6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db |
| Memory | 7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02 |
| A | 225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823 |
| B | c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b |
| C | b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca |

## K. Backend

ZERO alterações ou operações remotas. Nenhuma migration, RPC, Edge Function, ACL/RLS, cron, Vault ou secret modificado. Scheduler não consultado/ativado. CONTRACT não executado. Sem commit, push, merge ou deploy; sem limpeza final.

## L. Inventário

Branch `gym.io-v3.2`; HEAD inicial `cb9cea7ccb6ac64f7a6b8cc64367eae8d6b3f2ea`; status inicial limpo.

Alterados:

- public/push-sw.js
- src/components/PushNotificationSettings.jsx
- src/components/WorkoutTimer.jsx
- src/pages/TreinoPlayer.jsx
- src/services/push/workoutControls.test.js — mock de suporte explícito, assertions preservadas.

Adicionados:

- src/components/WorkoutQuickControls.js
- src/hooks/useQuickWorkoutControls.js
- src/services/push/quickWorkoutControls.js
- src/services/push/quickWorkoutControls.test.js
- src/services/push/crossPlatformWorker.test.js
- PUSH_CROSS_PLATFORM_UX.md — este relatório.

Nenhum arquivo removido. Evidências locais: `C:\Users\mateu\AppData\Local\Temp\gymio-push-ux-83da4fdccb8a4cc180ebdeaf3f203730` contém inventários/hash proof, logs, harness sintético e screenshots. Os envs e todos os arquivos de backend/Session V2 permanecem byte-idênticos ao baseline.

## M. Veredito e roteiro posterior

**V3.2 CROSS-PLATFORM PUSH UX PRONTA PARA PREVIEW**

Este veredito cobre implementação e verificações locais. Homologação real iOS/Android fica pendente do próximo deploy autorizado.

Roteiro manual posterior, sem executar nesta tarefa:

1. Após deploy autorizado, atualizar/reabrir a PWA e autenticar. Ativar notificações somente pelo gesto explícito, caso necessário.
2. Receber uma notificação pelo procedimento de homologação autorizado existente; não ativar scheduler como parte desta correção.
3. Em plataforma sem actions, tocar no corpo: conferir treino correto, marcador from=push e estado V2 atual. Conferir +15s/Pausar/Retomar/Pular, inclusive Pular pausado. Se a sessão já encerrou, não deve haver Quick Controls.
4. Em Chromium com actions, conferir o limite exposto e sua prioridade; action inline não deve abrir o app. Tocar no corpo deve abrir o treino correto.
5. Conferir Continuar enquanto o descanso vencido ainda estiver confirmado, respeitando a finalização automática existente. Erro/stale/rede não deve fingir sucesso.
6. Conferir perfil sem Enviar teste, desativação/logout e ausência de reativação automática. Abrir from=push manualmente não deve superar ownership/Auth nem criar sessão.

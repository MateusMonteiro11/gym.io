# Gym.io V3.2 — Final Push Presentation Policy

Relatório A–U — 14/10/2026. Branch `gym.io-v3.2`; HEAD inicial preservado: `e046ddc999967d31ee7e5d0744c55712a4835d26`.

Esta política substitui a apresentação intermediária do relatório `WORKOUT_SESSION_CARD.md` nas plataformas sem actions. A implementação é exclusivamente local; não representa deploy nem homologação física desta revisão.

## A. Presentation modes

Implementados dois modos usando a mesma infraestrutura existente:

| Superfície comprovada | Início confirmado | Durante o treino | Finalização confirmada |
|---|---|---|---|
| `maxActions > 0` | Uma notificação inicial | Mini-player existente, updates silenciosos e capabilities C | Fecha card e publica conclusão |
| `maxActions = 0` | Uma notificação inicial | Nenhuma notificação intermediária | Fecha início conhecido e publica conclusão |

O timer, as mutações, Quick Controls, memória e histórico da aplicação aberta continuam funcionando. A diferença é de apresentação; não estabelece autorização.

## B. Feature detection

`supportedMaxActions()` continua aceitando somente inteiro positivo. Ausência, zero, negativo, string, fração, NaN ou infinito significam modo mínimo. Não há userAgent, identificação de iOS/Safari ou lista de browsers. O issuer frontend também evita consultar subscription ou emitir controles destinados a uma superfície sem actions; a API C e suas autorizações permanecem inalteradas.

## C. Start notification

Apresentação: **Gym.io · Treino iniciado** / **Seu treino começou. Bom treino!**. Usa a identidade de sessão `gymio-workout-${id_sessao}`, sem capabilities/actions. O clique mantém a rota segura do Player; sem actions, preserva o marcador interno `?from=push`.

O ponto de estado aceito recebe `started: true` somente no sucesso de `iniciarTreinoSessao` ou na confirmação por leitura após erro de transporte dessa operação. Recuperação comum e render não anunciam início. O SW reserva `start:<session_id>` no object store já existente antes de publicar. Reload, respostas repetidas e restart não publicam outro início.

Essa instrumentação não acrescenta RPC, altera guards, estado otimista ou decisões V2. `controller-preservation.json` comprova que, retiradas apenas as linhas/argumentos de apresentação acrescentados, o conteúdo normalizado do hook corresponde ao baseline.

## D. Minimal/iOS lifecycle

O processor retorna sem `showNotification()` e sem reservar receipt de descanso para V2 execução/descanso/pausa/retomada/ajustes/avanço, rest finished local, Push B e V3 `workout_control`. Cliques antigos de action e generation refresh também não produzem apresentação intermediária nesse modo.

O início pode permanecer como notificação convencional até ser dispensado ou fechado. Não é atualizado para representar o estado atual. Nenhum mecanismo tenta mantê-lo como mini-player persistente. A deduplicação de início não é apagada pela dispensa.

## E. Android mini-player

O modo enhanced preserva formatter, revisão, observed time, publication metadata, fila, ordering, coalescing fallback, dedup, `unchanged`, generations, capabilities e tombstones. Mantém a tag canônica `gymio-workout-${id_sessao}`.

Depois da apresentação inicial, projeções aceitas atualizam esse mesmo card com **Gym.io · Treino**. Updates normais são silenciosos, sem vibração. Actions respeitam capacidade e prioridade: ativo `+15s → Pular → Pausar`; pausado `Retomar → Pular`; vencido `Continuar`. A action C continua sem abrir a PWA e depende de projeção confirmada para atualizar o card.

## F. Rest finished

Enhanced mantém a política anterior: somente sinal válido/confirmado pode reservar o receipt físico do descanso e solicitar atenção uma vez. A corrida local/Push e o restart continuam deduplicados.

Minimal ignora visualmente tanto o sinal local quanto os envelopes remotos B/C. Não há alteração no sender, no payload remoto, em outbox ou scheduler.

## G. Completion notification

Apresentação comum: **Treino concluído** / **Veja seu progresso no Gym.io.**. A tag terminal é `gymio-workout-complete-${id_sessao}`; não contém controles ou bearer.

A detecção está centralizada no adapter chamado pelo ponto de aceitação do estado. Manual, última série, avanço do último exercício e reconciliação confirmada chegam ao mesmo lifecycle. Não existe lógica de notificação duplicada nos botões.

Após confirmar `status='finalizada'`, o adapter tenta resolver o histórico, o SW reserva `complete:<session_id>` e o bloqueio terminal, fecha os cards de sessão/início conhecidos e publica a conclusão. Repetições não publicam novamente. A contenção terminal é persistida mesmo quando a enumeração/publicação visual falha.

## H. History deep-link

Destino com resultado resolvido: `/historico?period=all&workout=<id_historico>`. Sem resultado confiável: `/historico?period=all`.

O SW valida estritamente a rota, a representação decimal canônica e os metadados de conclusão; rejeita origem externa, ID inválido, fragmento e parâmetros extras. O clique foca/navega somente uma janela da mesma origem ou abre uma nova. `HistoryView`, `historyNavigation`, `WorkoutDetail`, PrivateRoute e suas rotas foram preservados. O browser local confirmou abertura direta do detalhe exato e o `HistoryNotFound` existente para registro ausente ou omitido pelos dados do outro usuário sintético.

## I. id_sessao → id_historico

Novo helper `buscarHistoricoPorSessao`, usando o cliente autenticado existente. A consulta lê somente `id_historico,id_sessao` de `historico_treinos`, filtra por `id_sessao`, usa `.maybeSingle()`, `.retry(false)` e AbortSignal com limite de três segundos. Não há polling, escrita, nova materialização, RPC administrativa ou mudança de RLS.

A linha retornada precisa corresponder à sessão solicitada; o ID deve ser positivo/canônico e seguro quando recebido como número JavaScript. Ausência, erro, múltiplas linhas, timeout, vínculo divergente ou número sem precisão confiável não inventam ID. O adapter usa o overview como fallback. A semântica zero/ou uma linha foi conferida na [documentação de maybeSingle](https://supabase.com/docs/reference/javascript/maybesingle).

## J. Cancel/logout

Cancelar ou remover fecha a sessão conhecida sem criar conclusão. Logout e desativação preservam a limpeza Push existente, fecham também conclusões conhecidas e bloqueiam mensagens atrasadas. Um epoch capturado na bridge impede que uma leitura lenta de histórico atravesse logout/desativação e posterior reativação para publicar na nova conta/superfície.

Os testes incluem limpeza com zero cards visíveis, restart e mensagens tardias. Nenhum desses caminhos cria conclusão artificial ou impede o fluxo Auth.

## K. Notification Settings

Adicionadas as duas observações neutras solicitadas: instalação pela Tela de Início e limitações de controles no iPhone/iPad. São textos comuns, sem diagnóstico por browser, wizard ou instruções técnicas internas.

Preservados `Este navegador está vinculado à sua conta.`, ativação/desativação, estados e feedback de limpeza parcial. **Enviar teste** permanece ausente. Os serviços diagnósticos e o backend `push-test` não foram modificados.

## L. Segurança

As mensagens novas são locais e validadas; Push remoto não pode anunciar início ou conclusão por esse envelope. A bridge usa somente o worker dedicado já registrado e as regras existentes de permission/opt-out. Não solicita permissão, registra worker ou ativa subscription automaticamente.

Nenhum URL novo contém JWT, capability, user ID, subscription ID, revisão ou worker token. O ID de histórico é navegação, não autorização. Ownership continua na RLS e no fluxo autenticado existentes. Não há cliente administrativo, credential cache ou novos privilégios.

## M. SW lifecycle/dedup

Os receipts `start:<session_id>` e `complete:<session_id>` são reservas atômicas no object store `markers` já existente, versão 1 do mesmo IndexedDB. Não foi criado outro banco ou persistência de estado de treino. Somente recibos, ordering e tombstones são persistidos; nenhum bearer, ID de histórico ou URL é gravado ali.

A reserva antecede `showNotification()`. A política é **at-most-once**: publicação ambígua/falha pode ser perdida, sem retry automático. A dispensa não refaz início/conclusão. O SW conserva ordering e bloqueio terminal contra projeções antigas. Generation e sessão continuam conceitos separados.

## N. Tests

| Gate local | Resultado final |
|---|---|
| `npm test` | **153/153**, sem falhas, skips ou cancelamentos; inclui os 132 anteriores e 21 novos casos |
| IndexedDB real em Chrome | **32 cenários aprovados**; regressões do mini-player e novo lifecycle; restart, corrida entre workers, maxActions 0/1/2/3 e mocks com/sem coalescing |
| Projeções enhanced | Sequências de 20 updates em ambos os mocks preservadas no Node e no browser |
| Hook real com RPCs sintéticas | **8 fluxos aprovados**: início, início reconciliado, finalização manual, última série, último exercício, finalização reconciliada, erro não confirmado e cancelamento |
| Perfil/History reais | **14 casos aprovados**, 390/1440 px; textos, ações, estados, limpeza parcial, ausência de overflow, detalhe exato e not-found |
| Browser requests | **Zero requests externos**, zero erros de página nos resultados finais |
| Lookup e URLs | Campos/filtro, RLS sem bypass, ausência, timeout/abort, erro, no retry, IDs inseguros e URLs inválidas cobertos com dependências sintéticas |
| Guards C | Assertions anteriores preservadas; mocks passaram a declarar suporte enhanced explicitamente |
| `npm run build` | Aprovado; aviso de chunks >500 kB já existente |
| `git diff --check` | Aprovado |
| Impeccable detector | `[]` no componente de Perfil alterado |
| Preservação do controller | Baseline equivalente após retirar somente a instrumentação de apresentação; nenhum guard/mutação V2 alterado |
| Congelamento | Todos os arquivos Supabase e os seis hashes preservados |

Chrome headless observado: 155.0.8059.41. Playwright foi reutilizado do ambiente de ferramentas; nenhuma dependência/lockfile foi alterado.

As verificações de componente/hook usam serviços injetados, sem executar Auth, SQL ou provider reais. O cenário de transporte não confirmado produz o log de erro já existente no hook, esperado na simulação. A ausência de dados de B no History testa o comportamento da UI quando a fonte autorizada omite o registro; não substitui uma nova auditoria da RLS remota.

Evidências em `C:\Users\mateu\AppData\Local\Temp\gymio-final-push-4cace8ac22b44d26ac1f77da85a0a687`: logs npm/build/diff, `browser-result.json`, `visual-result.json`, `controller-preservation.json`, inventários, runners e capturas de Perfil/History. Logs intermediários preservam os ajustes de mocks/fixtures; o veredito usa os resultados finais. Depois da verificação visual aprovada, a correção do tipo da fixture Memory foi executada somente nos testes do hook, sem outra rodada de UI. Servidores e browsers próprios foram encerrados no `finally`.

Não foram executados matriz Docker completa, testes remotos, Push real, deploy ou homologação física.

## O. Hashes

Antes/depois iguais aos seis canônicos, inclusive SQLs ignorados pelo Git:

| Migration | SHA-256 preservado |
|---|---|
| Auth `20260725194232` | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND `20260821190134` | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Memory `20260823003337` | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| A `20261007215944` | `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823` |
| B `20261010183821` | `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b` |
| C `20261011021351` | `b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca` |

## P. Arquivos alterados

Onze existentes:

- `public/push-sw.js`: modos, lifecycle local, receipts, conclusão, rotas e contenção terminal.
- `src/components/PushNotificationSettings.jsx`: duas observações neutras.
- `src/hooks/useTreinoAtivo.js`: injeção do lookup e contexto de apresentação no ponto aceito; sinal explícito nos dois caminhos de início confirmado. Estado, guards, operações e reconciliação V2 preservados.
- `src/services/push/workoutProjection.js`: construção e detecção central de início/conclusão.
- `src/services/push/workoutNotificationBridge.js`: mensagens locais e captura de epoch.
- `src/services/push/workoutControlsClient.js`: nenhuma emissão para superfície mínima.
- `src/services/push/crossPlatformWorker.test.js`: expectativa final minimal/enhanced.
- `src/services/push/workout.test.js` e `workoutControls.test.js`: declaração explícita de suporte enhanced nos mocks existentes.
- `src/services/push/sessionCard.testHarness.js`: lifecycle no store sintético.
- `src/services/push/sessionCard.browser.js`: expectativa minimal atualizada e inicialização somente do DB de teste.

Cinco adições:

- `src/services/push/workoutHistoryLookup.js`: repository testável, read-only e limitado.
- `src/services/push/workoutHistoryService.js`: binding ao cliente autenticado existente.
- `src/services/push/finalPresentation.test.js`: 21 testes novos.
- `src/services/push/finalPresentation.browser.js`: testes de lifecycle com IndexedDB real.
- `PUSH_FINAL_PRESENTATION_POLICY.md`: este relatório A–U.

Inventário: 369 arquivos relevantes antes, 374 depois; onze modificações, cinco adições, nenhuma remoção. Inclui fontes, assets e artefatos ignorados relevantes; exclui `.git`, `node_modules`, `dist`, diretórios internos de ferramentas e `docs`. `dist` foi regenerado pelo build. Os inventários completos e hashes por arquivo estão na evidência temporária.

Env files, `.gitignore`, dependências, fixtures, Quick Controls, Player, History, serviços Session V2/Memory, Edge Functions e SQLs existentes foram preservados. Relatórios e runtimes anteriores não foram removidos.

## Q. Backend remoto

Nenhuma conexão ou operação no projeto Supabase foi realizada. Zero alteração em migrations, Auth, ACLs, RLS, Edge Functions, secrets, Vault, cron, outbox ou history. B/C seguem com fontes congeladas. O estado remoto não foi reauditado nesta tarefa e nenhum request foi enviado a provider.

Sem CONTRACT, scheduler, commit, push, merge, Vercel deploy ou limpeza final.

## R. Limitações

**Bloqueio de compatibilidade identificado:** no Web Push tradicional, WebKit exige uma notificação visível para cada Push recebido e documenta a revogação da subscription se o handler não a mostrar. Portanto, receber B e suprimi-lo visualmente no modo mínimo não é uma política suportada para iOS/WebKit. [Documentação oficial do WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/)

Os testes locais comprovam a ausência de `showNotification()` no código solicitado; não comprovam compatibilidade com essa exigência do browser. Como B e a persistência de subscriptions estão congelados, não foi implementado envio seletivo por capacidade nem alterado o backend. A conclusão é que esse conflito impede aprovar a política completa para homologação com Push B real em iOS. Resolver a seleção dos destinatários antes do envio exige revisão de escopo e nova autorização. Não foi adicionada uma notificação intermediária para contornar a restrição, pois contrariaria o pedido.

Início e conclusão são produzidos pelo frontend/SW após confirmação; não há novo mecanismo de entrega background quando a aplicação não executa. Permission, worker já registrado e opt-in continuam necessários. APIs indisponíveis ou receipt storage com erro podem impedir apresentação; sem garantia de recebimento ou retry.

O browser/OS controla lifetime, sons, vibração e animação visual. `silent` é uma preferência, não uma garantia de ausência de animação. No enhanced, o fallback de coalescing e suas limitações anteriores permanecem. Minimal não tenta reproduzir uma Live Activity ou mini-player persistente.

O fallback de histórico é honesto, mas pode abrir o overview em vez do detalhe quando a leitura não resolve em três segundos. Mudança de sessão/contexto ou logout durante a leitura pode suprimir a conclusão atrasada. Nenhum desses casos altera ou repete a finalização.

## S. Roteiro físico posterior

Roteiro preparado, condicionado à resolução do conflito WebKit descrito em R e a outro deploy autorizado. Não iniciar scheduler ou homologação automaticamente; não usar Push B real em iOS para tentar validar o descarte silencioso incompatível.

**iOS / superfície mínima:**

1. Abrir o app instalado pela Tela de Início e ativar notificações explicitamente.
2. Iniciar treino sintético: conferir um único início. Recuperar/recarregar: sem novo anúncio.
3. Executar séries, descansos, pausa/retomada e ajustes; conferir ausência absoluta de intermediárias, incluindo descanso concluído local/remoto.
4. Finalizar manualmente e repetir em treinos separados com última série/último avanço: conferir conclusão única.
5. Tocar na conclusão: abrir o registro correspondente; se o lookup falhou, overview sem ID inventado.
6. Cancelar/logout/desativar em outros treinos: fechar notificações conhecidas sem conclusão artificial.

**Android/Chromium / superfície enhanced:**

1. Iniciar e conferir anúncio inicial seguido do card da sessão.
2. Conferir um único mini-player, updates silenciosos, prioridades/limites de actions, respostas C e dedup do rest finished.
3. Conferir bloqueio/desbloqueio de tela, dispensa, recuperação e comportamento de coalescing/lifetime.
4. Finalizar: card fecha, conclusão única aparece e abre o histórico exato. Conferir também cancelamento, logout e desativação.

Registrar fabricante, OS/browser/versão, instalação pela Tela de Início, `Notification.maxActions`, aparência na tela bloqueada, timing, cardinalidade e eventuais limitações do sistema.

## T. Futuro nativo

A arquitetura Session V2 → projeção → lifecycle → capabilities poderá alimentar ongoing notification/foreground service Android, ActivityKit/Live Activities/Dynamic Island e Apple Watch no ecossistema Apple. Esses clientes exigem projeto, autorização e testes próprios. Nenhum deles foi implementado.

## U. Veredito

**V3.2 FINAL PUSH UX INCOMPLETA**

Implementação local e gates automatizados aprovados, com backend preservado. A exigência de ignorar Push B recebido no WebKit conflita com a obrigação de apresentação visível desse browser. É necessária uma decisão de escopo para evitar o envio intermediário às subscriptions mínimas antes de aprovar a política completa. Não houve deploy, ativação de scheduler ou limpeza final.

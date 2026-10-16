# V3.2-D — Delivery Capability Segmentation

Atualizado em **15/10/2026 — Matrix Execution Closure**. Arquitetura, runner, SQLs e frontend não foram modificados nesta rodada. Docker estava saudável e o runner criou uma stack D nova. Fixture, EXPAND, Memory, A, B, gate de extensões e C executaram; a aplicação D falhou na assertion de baseline do executor. Não houve retry, repair ou alteração para fazer a matriz passar. Cleanup confirmado.

**A. Root cause WebKit**

No Web Push tradicional, receber e suprimir a notificação viola `userVisibleOnly` e pode revogar a subscription. A correção deve impedir o envio B para subscriptions minimal; não depende de ignorar o evento no worker. [Fonte oficial WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/). O teste crítico não foi alcançado: D abortou antes de disponibilizar o modo e as funções novas. O blocker WebKit permanece sem aceite comportamental.

**B. Schema D**

Migration D `20261014215648_push_delivery_capabilities.sql`, originalmente criada pela CLI 2.120.0, revisada somente em D: coluna `workout_notification_mode text NOT NULL DEFAULT 'minimal'`, CHECK minimal/enhanced, RPC atômica, helper comum A/D, um trigger de invalidação e três substituições efetivas B. Nenhum índice adicional; EXPLAIN real permanece pendente.

Nesta closure, o arquivo ficou byte-idêntico. Sua aplicação foi abortada no preflight antes da criação das funções D; os contratos descritos abaixo são a implementação congelada, sem aprovação comportamental no banco.

**C. Capability lifecycle**

`registrar_push_subscription_com_modo(endpoint,p256dh,auth,mode)` registra chaves, ownership e modo em um único upsert/transação e retorna somente UUID. A permanece com sua assinatura pública intacta; sua implementação privada é redefinida somente em D para delegar ao mesmo helper com minimal fixo. Re-registro D mantém UUID/ownership e aplica o modo solicitado, sem downgrade intermediário; re-registro A força minimal. Validação de endpoint/chaves usa as constraints A intactas e a mesma lógica RLS/upsert/erros. Não há classificação por endpoint nem backfill.

**D. Frontend detection**

`supportedMaxActions(browser)` aceita somente inteiro positivo, com o mesmo predicado estrito do worker. Ausente, zero, negativo, fracionário, string, NaN e infinito são minimal. Não usa userAgent, plataforma ou provider. `inspect()` continua somente leitura, sem permission, registro ou sincronização.

**E. Recipient filtering**

Somente em D, `capture_events()` passa a exigir usuário proprietário + modo enhanced. O lock passa de KEY SHARE para SHARE, que conflita com UPDATE do modo e permite reavaliação após esperar um downgrade. `claim_batch()` e `begin_attempt()` também conferem o modo sob lock. [Locks PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).

**F. Freeze semantics**

A identidade física e unicidade do evento permanecem B. Upgrade posterior ao freeze não cria deliveries retroativas. Um evento observado com zero recipients permanece sem recipients. O próximo descanso físico pode capturar subscriptions recém-classificadas.

**G. Downgrade race**

Trigger AFTER UPDATE terminaliza imediatamente pending/claimed sem attempted_at quando o modo passa de enhanced para minimal, limpando claim/lease. Um upgrade posterior não revive essas linhas. O antigo trigger BEFORE de reset foi removido da D ainda não aplicada: ambos os caminhos registram diretamente o modo final. Re-registro enhanced → enhanced não invalida deliveries pendentes. A ordem deste caminho é subscription já bloqueada → delivery; não adquire sessão/evento. Os processadores continuam sessão → evento → subscription → delivery. Tentativas registradas permanecem irreversíveis. [Semântica dos triggers](https://www.postgresql.org/docs/17/sql-createtrigger.html).

**H. Security/RLS**

RPC atômica pública SECURITY DEFINER e helper privado SECURITY INVOKER, owned por gymio_push_executor, search_path vazio. Somente authenticated executa a RPC. Nenhum parâmetro de UUID, usuário ou ownership é aceito. Colisão de endpoint alheio é rejeitada como em A, sem transferência ou retorno de chaves. Usa `gymio_push_private.request_uid()`: nenhum acesso a auth ou auth.uid() pelo executor. JWT pertence à fronteira HTTP da Data API.

**Setter removido:** não existe consumidor legítimo separado. Reclassificação é novo vínculo explícito e atômico usando a subscription disponível no navegador. `definir_modo_notificacao_push` não é criado pela D revisada.

Nenhum grant permanente adicional em tabelas/schemas históricos. A configuração temporária necessária para atribuir ownership é revertida dentro da transação. O trigger de invalidação é um novo SECURITY DEFINER restrito, owned por postgres, sem EXECUTE das roles clientes/executor; permite invalidar apenas deliveries da subscription atual sem conceder ao executor acesso às tabelas B. RLS/policies históricos não mudam.

As assertions D comparam o catálogo anterior: ACLs, owners, memberships, roles, policies, índices, constraints, triggers, extensões e contratos de funções. Somente três corpos B e o helper privado register_impl A podem mudar; o wrapper público A permanece intacto. Também verificam cron.job, coluna, funções, isolamento de auth, DML bloqueado, filtros B, delegação legada minimal e ausência de setter. Preparadas, **não executadas**.

**I. C preservation**

Nenhum arquivo C ou Edge foi alterado nesta tarefa. **C foi aplicada e suas assertions iniciais passaram antes da tentativa D**. A suíte SQL C comportamental completa não foi alcançada. O vínculo da capability à subscription e o wrapper C permanecem intactos na fonte; o bloqueio de modo pretendido em begin_attempt D ainda não foi validado. Não se declara regressão C aprovada apenas pela aplicação da migration.

**J. Minimal mode**

O cenário crítico duas minimal → descanso vencido → tick/capture → zero delivery/claim/attempt/dispatch/transporte **não foi executado**, pois D falhou antes dele. A fila HTTP estava vazia ao fim do gate de extensões, mas essa contagem anterior a D não constitui prova do cenário minimal. Start/completion locais e destino do histórico permaneceram byte-idênticos nesta closure.

**K. Enhanced mode**

Feature detection → uma RPC com modo explícito. `.retry(false)` impede retry automático do SDK. Não há setter nem compensação minimal. Resposta perdida pode ocultar a conclusão do vínculo, mas a única mutação enviada contém o modo detectado. O cliente faz apenas lookup read-only e não usa esse UUID para alegar confirmação do modo/chaves, pois o registro pode ser anterior. Retorna operação não confirmada, modo null e feedback sanitizado; mantém a subscription nativa para reconciliação/cleanup explícito. Rejeição confirmada do banco preserva o rollback local da A para subscription recém-criada. Falhas não bloqueiam signOut.

**L. Tests SQL**

Preparados em `delivery-local-tests.mjs`: cenários anteriores de capture/downgrade/concorrência/cascade/at-most-once, mais registro atômico minimal/enhanced, UUID estável, owner preservado, enhanced → enhanced preservando pending, rejeição de modo/ownership com rollback integral. Mudanças de modo nos testes usam a RPC atômica. Setup pré-D verifica default minimal e retirement de pending/claimed sem alterar attempted. EXPLAIN continua preparado.

Resultado desta execução: setup SQL fixture → EXPAND → Memory → A → B passou; o gate histórico de extensões passou; C foi aplicada com suas assertions, e o setup pré-D gerou os registros sintéticos necessários. A tentativa D chegou ao bloco `$preflight$` e falhou com:

```text
ERROR: D requires unchanged executor membership/schema baseline
CONTEXT: PL/pgSQL function inline_code_block line 5 at RAISE
```

O bloco rejeita membership envolvendo `gymio_push_executor` ou CREATE efetivo em public/gymio_push_private. A mensagem agrupa essas condições e não identifica qual delas foi verdadeira. O runner não capturou uma consulta discriminante antes do cleanup; não se declara causa específica comprovada. Por leitura da fonte, A permite membership de postgres no executor, enquanto esse preflight D exige ausência total; essa diferença precisa de investigação autorizada, sem presumir que foi o ramo disparado.

O SQL D contém BEGIN e falhou antes do COMMIT; a conexão psql encerrou com erro, abortando a transação. O runtime foi removido depois. Não houve post-check independente do catálogo abortado antes da remoção, nem repair/history/retry. Os cenários `delivery-local-tests.mjs` **não foram alcançados**. Nenhum resultado unitário os substitui.

**M. Data API**

Dois usuários sintéticos @local.invalid foram efetivamente criados no Auth local e perfis locais, usados pelo setup/gate e descartados no cleanup do runtime. O gate de extensões executou **22 rejeições HTTP** reais na Data API. Os **12 grupos específicos D** (registro atômico, ownership, colisões, modos, JWT/anon, isolamento, rotação, resposta descartada e ausência de setter) **não foram alcançados** após a falha da migration. Não confundir o gate anterior com aprovação da RPC D.

**N. Frontend**

Confirmação final desta closure: `npm test` **171/171**, zero failures/skips; `npm run build` aprovado em 25,27 s; `git diff --check` aprovado. Nenhum refactor ou ajuste em testes/expectativas foi feito nesta rodada. A suíte inclui perda de resposta minimal/enhanced, chamada única, ausência de compensação/retry, inspect read-only, timeout, cleanup/logout e porta SDK. Os 35 testes direcionados da rodada anterior não foram contados como uma segunda execução independente aqui. Warnings de build: bundle acima de 500 kB e diagnóstico de timing de plugins; classificados como desempenho/empacotamento, sem correção fora do escopo. Logs completos desta closure estão na evidência própria.

**O. Scheduler/dispatch local**

Projeto reservado `gymio-push-delivery-local`, API 55461, DB 55462, shadow 55460; Postgres fixo 17.6.1.113. O harness recusa runtime fora de TEMP, .owner/project/port divergentes, Docker remoto e URLs remotas. Ordem: fixture legada → EXPAND → Memory → A → B → gate histórico intacto → C → D. Auth histórico não é reaplicado. Nenhum cron é ativado, inclusive local; tick é chamado explicitamente. Fake sender usa handler B real e RPC C real com transporte injetado em processo Node, sem HTTP para providers. Não representa execução da Edge em runtime real.

Executado exatamente `node supabase/testing/delivery-matrix.mjs --run-isolated`, com saída registrada, sem modificar o runner. Docker já estava operacional; não foi necessário iniciar/reiniciar serviços ou mudar configuração global. Contexto **desktop-linux**, endpoint local npipe, Docker Desktop **4.93.0**, cliente/servidor **29.8.1**, WSL2 com distro docker-desktop Running, kernel **6.18.54.1-microsoft-standard-WSL2**. O aviso de indisponibilidade WSL1 não impediu WSL2. Node **v22.15.1**, npm **10.9.2**, CLI **2.120.0**. Nenhum update foi feito.

Runtime exclusivo criado: `C:/Users/mateu/AppData/Local/Temp/gymio-push-delivery-346fbc96fd8245d2a2235dd000652430/`; context.json emitido nesse diretório e copiado para a evidência antes do cleanup. Nenhum runtime anterior foi reutilizado. API 55461, DB 55462, shadow reservada 55460.

| Componente executado | Imagem | Digest sha256 |
|---|---|---|
| Postgres | public.ecr.aws/supabase/postgres:17.6.1.113 | `4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e` |
| PostgREST | public.ecr.aws/supabase/postgrest:v16.4 | `d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df` |
| Auth | public.ecr.aws/supabase/gotrue:v2.197.0 | `1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| Kong | public.ecr.aws/supabase/kong:2.8.1 | `1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d` |
| Edge Runtime | public.ecr.aws/supabase/edge-runtime:v1.77.4 | `ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8` |

Gate executado e aprovado: **22 HTTP rejections, 41 corpos/owners/ACLs, seis fixtures negativas**; snapshot oficial de extensões preservado. Extensões reais: pg_cron 1.6.4, pg_net 0.20.0, supabase_vault 0.3.1. Ao fim do gate: jobs=1 (B inativo), secrets=0, requests=0, responses=0; nenhuma configuração de secrets/sender nem provider real.

EXPLAIN e db lint local **não foram alcançados** depois da falha D. ERROR/WARN/INFO do lint: **não medidos**, não zero. Não houve índice novo nem correção automática de warning.

Evidência do runner: `C:/Users/mateu/AppData/Local/Temp/gymio-delivery-result-1hNxCG/`. Resultado: contextCreated=true, matrixPassed=false, cleanupPassed=true. O cleanup checou project, .owner, raiz TEMP, labels, caminhos e IDs dos cinco containers criados; executou stop --no-backup somente para esse projeto e confirmou zero containers/volumes/redes D. Diretório do runtime removido. Verificação posterior independente: nenhum container, somente o volume preexistente `buildx_buildkit_default_state`, mesmas redes bridge/host/none e runtime inexistente. Nenhum prune/reset, imagem ou recurso alheio removido. Evidências sanitizadas preservadas; credenciais locais não foram copiadas.

**P. Regression**

Os **171 testes** incluem regressões frontend. Aplicações A/B/C e suas assertions iniciais executaram antes da tentativa D; isso não equivale às suítes comportamentais B/C. B SQL completo selecionado (timing, lease, concorrência, freeze, exclusão, at-most-once, stale) e C SQL completo (identidade transaction-local, hash textual, actions, siblings, replay, rollback e sender binding) **não foram alcançados**. Nenhum body/assertion histórico, fixture ou timeout foi alterado para contornar a falha. A suíte C Data API histórica não está selecionada pelo runner aprovado, conforme o relatório anterior. Não houve dispatch falso pós-D nem provider real.

**Q. Hashes**

Os seis históricos coincidem antes/depois; sem restauração automática:

| Migration | SHA-256 |
|---|---|
| Auth | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Memory | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| A | `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823` |
| B | `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b` |
| C | `b045d4c7d4f303093e2d3cb7ec2c6949c32fdc47af0061c3a53d46b61e99dbca` |
| D revisada | `1baecc21cc9b61bbb7344d31863acab32403d0181149d70009f57217edaf0b69` |

O contexto D exige também seu hash antes de preparar/aplicar/testar. Hash não implica validação comportamental.

**R. Files changed**

Delta desta closure em relação ao workspace recebido:

- Modificado somente este relatório A–U.
- Evidências novas exclusivamente em TEMP: inventário, hashes, logs, resultados do runner/gate/cleanup e consolidação da closure.
- Nenhuma alteração em arquitetura, migrations, runner, frontend, fixtures, dependências, envs, config ou testes.

Todas as outras alterações pendentes recebidas foram preservadas, incluindo worker, adapters, Session V2, histórico, Push Foundation e relatório da apresentação anterior. Inventário por bytes inclui envs/artefatos ignorados relevantes, além de git status. Dependências, config, envs e seis SQLs anteriores intactos.

Histórico da rodada atômica anterior: a revisão automática bloqueou uma proposta de reescrita que truncaria parte do teste D. A edição não ocorreu; patches pontuais preservaram os cenários, atualizando as expectativas do fluxo substituído. Nenhuma ação desse tipo foi tentada nesta closure, nem ficou aprovação pendente.

Evidências anteriores `gymio-push-capabilities-93e4c9710784440db4c9060c5c3aa987/` e `gymio-delivery-result-00cdW0/` foram preservadas. Evidências novas do runner em `C:/Users/mateu/AppData/Local/Temp/gymio-delivery-result-1hNxCG/`: context.json, created-resources.json, extension-result.json, d-matrix-result.json e d-cleanup-result.json. Consolidação desta closure em `C:/Users/mateu/AppData/Local/Temp/gymio-d-matrix-closure-08ebad0afdfb4e40a63e5a879d131f8f/`: runner.log, npm-test.log, build.log, inventários, hashes e closure-result.json. Não contém PAT, senha, JWT ou chaves privadas de produção.

**S. Backend remote**

Zero operações remotas de projeto nesta tarefa. Não foi consultado/aplicado Supabase remoto, Edge, secret, Vault ou cron. O estado remoto não foi revalidado; não afirmar inatividade atual a partir de inspeção local. Nenhum provider foi contatado. Sem deploy, commit, push, merge ou CONTRACT. As consultas externas realizadas foram exclusivamente documentação pública.

**T. Remaining limitations**

1. **Docker não é mais o blocker.** D foi rejeitada pelo seu preflight de baseline do executor. A fonte e o runner ficaram congelados; nenhuma tentativa de reparar ACL/membership ou repetir a migration foi feita. A condição específica precisa de diagnóstico posterior autorizado, pois o runtime já foi corretamente removido.
2. SQL D/Data API, prova WebKit minimal, enhanced control, freeze/downgrade/concurrency, regressões B/C, EXPLAIN e lint não foram alcançados. A atomicidade real da RPC continua sem aceite no banco. Frontend read-only/retry/compensação passou na suíte atual, mas não substitui esses gates.
3. Não há homologação física nem rollout D remoto. Até aplicar D separadamente, o backend existente não ganha esse filtro. Não considerar o blocker WebKit encerrado nesta entrega.

Comando usado nesta execução, sem etapas manuais substitutas:

```powershell
node supabase/testing/delivery-matrix.mjs --run-isolated
```

Não executar novamente nem alterar D/runner sob esta closure. O pedido determina STOP na falha. Uma próxima tarefa precisa autorizar o diagnóstico/correção pertinente e definir o hash esperado, preservando os seis históricos. O cleanup desta execução passou; não existe runtime parcial D a reaproveitar.

**U. Verdict**

**V3.2-D DELIVERY CAPABILITY SEGMENTATION INCOMPLETA**

Docker/WSL saudável, stack nova executada até C e gate de extensões aprovado, frontend 171/171, build/diff/hashes aprovados e cleanup comprovado. **Migration D falhou na assertion de baseline do executor**; gates posteriores não passaram. Sem aprovação da matriz, rollout ou qualquer operação remota.

# Gym.io V3.2-C — correção e segunda matriz local

Data: 2026-10-11. Branch: `gym.io-v3.2`.

**V3.2-C TEST MATRIX REPROVADA.** A segunda execução encontrou outro defeito
funcional real no primeiro início de sender B→C. A matriz foi interrompida
conforme o item 19, sem correção adicional. O cleanup foi concluído;
grupos dependentes marcados `NÃO EXECUTADOS` não recebem aprovação.
Este documento não autoriza rollout.

A primeira matriz e seu diagnóstico permanecem em
[WORKOUT_ACTIONS_TEST_MATRIX_RESULT.md](./WORKOUT_ACTIONS_TEST_MATRIX_RESULT.md).
Esta segunda execução usa outro banco e outro root, desde o início.

## A. Correção SQL aplicada

A única alteração de implementação foi a correção localizada do bloco
`DO $assert$` na migration C. A comparação histórica passou a calcular a
expressão `CASE p.kind` em uma variável explícita `v_current jsonb` e então
comparar `p.value IS DISTINCT FROM v_current`. As queries, seus tipos e a
finalidade da assertion histórica foram preservados.

Session V2, Exercise Memory, Foundation A, Notifications B, frontend, Service
Worker e Edge de produção não foram modificados nesta correção. As demais
alterações autorizadas pertencem ao guard, harnesses, cobertura de testes e
relatórios C. Nenhuma assertion ou ACL histórica foi relaxada.

O smoke descartável passou usando a imagem exata `17.6.1.113` e sua configuração
oficial. Aplicação completa C aceita, duas tabelas privadas presentes, sem
usuários e sem rede. A preparação inicial precisou ser refeita com os hooks
Supautils oficiais; isso foi um ajuste de setup do smoke, sem correção adicional
da migration ou das ACLs. O container, tmpfs e diretório próprios do smoke foram
removidos. Evidência: [actions-correction-smoke-result.json](./actions-correction-smoke-result.json).

O smoke prova parser/DDL/assertions nesse suporte mínimo; a aplicação e matriz
do stack completo constituem evidências separadas.

## B. Novo hash C

| Candidato | SHA-256 |
| --- | --- |
| C pre-fix, rastreabilidade | `8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42` |
| C corrigida, candidato canônico | `a643da0340c8b2a84c5a2a715184cedf45b6b403e789fd91858dd08f18925820` |

`actionsContext` agora confere as **seis** migrations, incluindo C corrigida,
antes de aceitar o runtime e executar operações. Drift bloqueia o runner antes
da aplicação; não há restauração automática.

## C. Aplicação C e runtime novo

Projeto: `gymio-workout-actions-local`. API `55451`, DB `55452`, shadow `55450`.
Root novo:
`%TEMP%/gymio-workout-actions-eb1b61bfdb014264944be55321bb5b34`, com `.owner`
exato e context próprio. O runtime da primeira matriz foi removido e não foi
reutilizado.

Bootstrap executado desde o início: legacy fixture → EXPAND → Memory →
Foundation A → Notifications B → Extension Security Gate → C corrigida.
Auth histórico e CONTRACT não foram executados.

C corrigida foi aplicada no stack completo. O Extension Security Gate antes
de C passou. A auditoria suplementar após C passou com 48 rejeições HTTP e
assertions A/B/C originais, sem ampliar a allowlist dos executores. As ACLs,
owners, policies e default privileges oficiais de pg_cron, pg_net e Vault foram
preservados. O único job B estava inativo após instalação/auditoria.

| Componente confirmado neste stack | Versão/imagem |
| --- | --- |
| PostgreSQL | `public.ecr.aws/supabase/postgres:17.6.1.113` |
| PostgREST | `16.4` |
| Auth/GoTrue | `2.197.0` |
| Edge Runtime | `1.77.4` |
| Kong | `2.8.1` |

Digest PostgreSQL: `sha256:4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e`.
Os cinco containers C e seus digests estão em
[actions-test-matrix-reexecution.json](C:/Users/mateu/OneDrive/Documentos/gym.io/supabase/testing/actions-test-matrix-reexecution.json).
O CLI substituiu somente o container Edge C ao iniciar o helper local; ambos
os inventários, inicial e de encerramento, estão registrados.

Versões: Docker 29.8.1; Node 22.15.1; npm 10.9.2; Supabase CLI 2.120.0;
Deno 2.1.4; PostgreSQL servidor 17.6; pg_cron 1.6.4; pg_net 0.20.0;
Vault 0.3.1. Imagens utilizadas, além do PostgreSQL:

| Imagem | Digest SHA-256 |
| --- | --- |
| Edge Runtime 1.77.4 | `ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8` |
| PostgREST 16.4 | `d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df` |
| GoTrue 2.197.0 | `1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| Kong 2.8.1 | `1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d` |
| Deno 2.1.4 | `3bf75873714baa410dcf7fabaf76d806d20f0ac8a7579df11577b4ed97416e34` |

## D. Issuance e unchanged

Resultado parcial SQL: aprovados emissão de três controles ativos, hashes
únicos de 32 bytes, cálculo SHA-256 do token textual UTF-8 no backend e bindings
de usuário/subscription/sessão/revisão. O bearer não é persistido em plaintext.

O teste agora captura e compara integralmente sessão, gerações e capabilities
antes/depois de `unchanged`, incluindo contagens, hashes, snapshots e
`invalidated_at`. A reemissão retorna a mesma generation e nenhum token; não
cria nem invalida registros nesse caso. Os snapshots de hashes permanecem
somente em memória do teste e não são impressos.

Expiração e reemissão também passaram na suíte SQL. A conclusão integral do
grupo foi impedida pelo defeito de sender descrito em N. **NÃO EXECUTADO:**
confirmação equivalente pela suíte Data API C.

## E. Canonical bearer

Resultado parcial SQL: bearer original consumido, hash persistido em hex e
Base64URL rejeitados; negativos de padding, comprimento 42/44, charset, último
caractere não canônico, whitespace prefix/suffix e alterações de caixa
rejeitados sem mutação. NULL e string vazia são rejeitados.

**NÃO EXECUTADO:** confirmação JSON non-string e demais negativos no
handler/gateway reais. As RPCs administrativas C continuam destinadas somente a service_role;
clientes não recebem o hash como capability.

## F. Ownership

Resultado parcial SQL: A→subscription B e B→sessão A rejeitados; teste explícito
A→sessão realmente pertencente a B→subscription A retorna stale com zero
generation, capability ou mutação da sessão B. A fixture usa apenas os usuários
A/B do runtime novo e IDs obtidos por RETURNING.

**NÃO EXECUTADO:** matriz equivalente da suíte C de anon e JWTs reais A/B pela
Data API. A auditoria de fronteira/gate separada foi executada, conforme L.

## G. Cinco actions

Resultado parcial SQL:

| Action | Prova comportamental parcial |
| --- | --- |
| `rest_add_15` | deadline exato +15 segundos, revisão +1 |
| `rest_pause` | pausa confirmada, revisão +1 |
| `rest_resume` | retomada, revisão +1; pausa real além do deadline antigo desloca ambos os timestamps e preserva restante |
| `rest_skip` ativo | encerramento forçado, revisão +1 |
| `rest_skip` pausado | retomar + encerrar forçadamente, revisão +2 |
| `rest_continue` | encerramento normal após vencimento real PostgreSQL; antes do prazo, V2 rejeita sem mutação; capability antiga após extensão legítima é stale |

As mudanças de treino passaram pelos wrappers V2. Esses casos SQL foram
aprovados; **NÃO EXECUTADO:** integração correspondente pelos endpoints Edge.

## H. Atomicidade do skip pausado

**APROVADO EM SQL.** O teste corrigido injetou falha depois do resume e antes do forced skip, comparou
revision e `pausada_em` exatos e o snapshot integral C: contagens, hashes,
`consumed_at`, siblings `invalidated_at` e ausência de nova geração persistida.

Todos os oito casos de exceção/commit/rollback do grupo UID passaram. A falha
depois do resume não persistiu qualquer mudança V2 ou C.

## I. UID transaction-local bridge

O harness corrigido usa uma única conexão física psql por caso e comprova o
mesmo `pg_backend_pid()` nas transações seguintes. Somente a fixture do teste
configura USER_X session-local com `set_config(..., false)`; a implementação C
continua usando exclusivamente `set_config(..., true)`.

Triggers/sequence temporárias observam UID A dentro das operações V2 sem
persistir mudanças de schema. A sequence permite comprovar resume e skip mesmo
quando a subtransação falha. Após retorno, commit/rollback e próxima transação,
o baseline USER_X ou claims original deve continuar intacto. Ao encerrar, o
harness limpa explicitamente seus GUCs.

**APROVADO EM SQL: 16 cenários completos**, com UID presente, ausente, fallback
claims, claims transaction-local, commit, rollback e exceção V2. USER_X
session-local permaneceu como baseline na próxima transação da mesma conexão;
nenhum UID A temporário de C vazou para ela.

## J. Concorrência, replay e expiry

Resultado parcial SQL: duas conexões consumindo o mesmo bearer produziram um
único efeito; emissão concorrente produziu exatamente uma geração vigente e
três capabilities, com resultados ok/unchanged.

Replay e siblings do primeiro caso foram rejeitados como already_used/stale.
Mudança legítima de revisão e mudança de elegibilidade pelo tempo produzem
renovação ou stale conforme contrato. Expiração, invalid identity, revisão
obsoleta e cancelamento/cascade de sessão também passaram antes do sender.
Essas evidências SQL não são apresentadas como aprovação de Edge ou da matriz
integral.

## K. Lifecycle e retention

Resultado parcial SQL: cleanup oportunista removeu exatamente 100 de 110
gerações antigas terminais, mantendo a geração válida.

Cascade de sessão após cancelamento passou. **NÃO EXECUTADO:** cascade completo
de subscription/usuário, remoção antes/depois do
claim, logout e zero emissão/envio após remoção confirmada. O teste C de exclusão
do usuário principal ocorre dentro de transação rollback-only e exige retorno
exato do baseline Auth/profile e de todos os dados C.

## L. Data API e segurança

Auditoria após C: 48 rejeições HTTP das superfícies administrativas/privadas;
assertions A/B/C originais mantidas. Schemas privados não foram expostos.

**NÃO EXECUTADO após a interrupção:** suíte C Data API com anon/A/B, bloqueio de DML direto,
ownership, unchanged e execução das assertions reais sob os probes negativos
rollback-only de schema/table/column/RPC C. Nenhuma ACL histórica será alterada
para fazer testes passar.

## M. Edge e CORS handler/gateway

Critério obrigatório corrigido: **PLATFORM GATEWAY CORS BASELINE**.
O wildcard/preflight global do gateway Supabase/Kong será registrado como
baseline da plataforma, sem modificar Kong ou adicionar plugin. Não é
classificado isoladamente como falha de autorização C.

Handler level e gateway level são testados separadamente. O handler mantém
origins exatas. POST de origin diferente/ausente/null deve rejeitar antes de
`initialize()`, com zero RPC administrativa e zero mutação SQL. OPTIONS
interceptado pelo gateway não autoriza mutação.

Threat model: Origin pode ser falsificado fora de um browser; sua validação é
defense-in-depth. A autorização é a capability bearer, vinculada server-side a
action, ownership, subscription, sessão, revisão, expiry e consumo único.

**NÃO EXECUTADO após a interrupção:** Edge real C, sanitização, body limit,
canonical JSON, timeout efetivo, ausência de retries e ambas as camadas CORS.

## N. Sender B→C e regressão B

**REPROVADO — defeito funcional de produção C.** O primeiro caso SQL
`sender binds two deliveries to their exact subscription, same user is insufficient`
falhou em `public.workout_push_begin_controls(uuid,uuid)`, linha 17 do corpo da
função; origem na migration C, linha 255:

```text
ERROR: operator is not unique: unknown - unknown
QUERY: ... (v_controls->'projection'-'title'-'body') ...
CONTEXT: PL/pgSQL function public.workout_push_begin_controls(uuid,uuid)
         line 17 at assignment
```

A expressão combina acesso JSONB e remoção de campos sem delimitação que
resolva inequivocamente os operadores. A função foi criada/aplicada, mas essa
instrução falhou quando executada com emissão real de controles. Não se trata
da assertion sintática corrigida em A.

O grupo parou nesse primeiro begin; não foram feitas correções adicionais ou
tentativas de alterar o SQL para fazer a matriz passar. Binding completo,
outcomes, timeout, cleanup concorrente, fallback unchanged e integração Edge
B→C permanecem **NÃO APROVADOS**. O `finally` da fixture SQL foi executado.
A leitura final comprovou dois registros em auth.users e dois profiles;
treinos, exercícios, seções, itens, sessões, subscriptions, outbox, deliveries,
generations e capabilities ficaram todos com zero linhas. O job ficou inativo.
Não foi repetida a action para coletar novos resultados após a interrupção.

Regressões históricas A/B foram preparadas para execução integral após C com adapters
temporários somente de entrada/contexto; seus corpos e assertions são
comparados byte a byte. O adapter B reutiliza os wrappers B preservados, e a
integração B→C é testada separadamente.

Fixtures auxiliares rollback-only A/B são classificadas como
**TRANSIENT ROLLBACK-ONLY TEST FIXTURE**, incluindo o benchmark de mil usuários.
Além disso, houve autorização humana explícita: **“Autorizar o auxiliar local
com cleanup comprovado”**. Essa exceção cobre os auxiliares históricos locais
que utilizam signup/cleanup ou insert/delete; os testes permanecem intactos e
devem retornar exatamente aos IDs/emails A/B e dois profiles após cada etapa.
Qualquer persistência auxiliar exige parar e reportar, sem cleanup corretivo
silencioso.

Somente o runtime C pode receber a cópia do sender harness com transporte falso.
O dispatch cron/pg_net somente poderia usar esse transporte confirmado.
**NÃO EXECUTADO após a falha:** regressões SQL/Data API/Edge A/B completas,
benchmark B, três ticks reais do spike e dispatch. Nenhum provider real recebeu
HTTP. A autorização do auxiliar não foi usada para iniciar uma regressão
dependente após a interrupção.

## O. SW e IndexedDB

Confirmado nas verificações rápidas: harnesses C e B de IndexedDB passaram em
container separado com fake-indexeddb 6.2.5 e workspace read-only. O suplemento
C inclui dois processors concorrentes, geração terminal após restart,
Notification.maxActions 1/2/≥3 e falha de storage com projeção silenciosa, sem
reconstruir tokens ou alertar em duplicidade.

Capabilities continuam somente em memória transitória e Notification.data;
stores não recebem bearer/JWT. V1/V2 e controle V3 preservados. Os dois
containers de teste foram removidos automaticamente ao terminar.
Não houve browser manual nem alteração de SW de produção.

## P. Quality, performance, hashes e cleanup

| Verificação nesta segunda rodada | Resultado final |
| --- | --- |
| npm test | aprovado: 80/80 |
| Build | aprovado; warning conhecido de chunk >500 kB |
| Deno check frozen | quatro entradas/targets aprovados, sem atualizar lock |
| IndexedDB C/B | aprovado |
| db lint completo após C | NÃO EXECUTADO: interrupção obrigatória pelo novo defeito |
| git diff --check final | aprovado |
| Tempos C issuance/unchanged/+15/pause/resume/cleanup/concurrency | operações SQL aprovadas, mas resumo de tempos não foi emitido antes da falha; métricas não disponíveis, sem nova execução |
| Benchmark B completo | NÃO EXECUTADO após a falha |
| Inventário final e comparação dos arquivos protegidos | aprovado; evidência de fontes e inventários antes/depois |
| Teardown do novo runtime C | concluído: cinco containers, volumes, rede, helper e diretório/secrets próprios removidos |
| A/B manual preservados por IDs/paths/resources | dez IDs de containers preservados, sem executar SQL ou comandos de serviço nesses stacks |

Não existe lint frontend configurado. A leitura do código não introduz cron C,
polling ou writes de countdown; a prova comportamental/performance integral
não foi concluída. Nenhuma medição pendente é tratada como aprovada.

A auditoria de fontes examinou 307 arquivos tracked: 298 preservados em
relação a HEAD, incluindo 164 diferenças apenas de representação CRLF/LF;
as nove mudanças tracked estão restritas à migration C e aos harnesses C.
O inventário também inclui artefatos ignorados. `.env`, `.env.push.local`,
`.gitignore`, lockfile Deno, baseline e fixture manual ficaram byte-exatos.
As dez queries e o snapshot histórico CTAS original foram comparados
integralmente. A prova negativa de drift C, somente em memória do processo,
bloqueou a entrada real actionsContext antes de ler context ou tentar Docker.
Evidência:
[actions-reexecution-source-audit.json](C:/Users/mateu/OneDrive/Documentos/gym.io/supabase/testing/actions-reexecution-source-audit.json).

Hashes conferidos antes da aplicação e novamente após o cleanup:

| Migration | SHA-256 canônico |
| --- | --- |
| Auth | `cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6` |
| EXPAND | `6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db` |
| Memory | `7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02` |
| Foundation A | `225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823` |
| Notifications B | `c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b` |
| Actions C corrigida | `a643da0340c8b2a84c5a2a715184cedf45b6b403e789fd91858dd08f18925820` |

Os cinco históricos continuam congelados e C mantém o novo hash definido em B.
Owner, projeto, caminho absoluto e IDs foram verificados antes da remoção.
Não restaram containers, volumes ou rede do projeto C; o root temporário foi
removido. Dez IDs A/B foram conferidos iguais ao inventário anterior ao start.
Sem prune, remoção de imagens ou ação em recursos A/B. O banco da segunda
execução não foi preservado para continuidade parcial.

## Q. Estado remoto

ZERO operações em Supabase remoto, Vercel ou Push provider. Nenhuma consulta ou escrita Supabase remoto,
deploy Edge, secret remoto, extensão remota, alteração Vercel, repair, db push,
CONTRACT, commit, push, PR ou merge foi executado. Nenhum dado de produção foi
consultado ou copiado. Os containers Deno baixaram somente pacotes npm com
versões fixadas para os checks; nenhuma dependência foi instalada no projeto.

O runtime manual A/B, sua fixture manual e arquivos de ambiente preexistentes
não foram alvos desta matriz. O inventário protegido e os dez IDs dos recursos
A/B foram confirmados após o teardown C.

## R. Veredito

**V3.2-C TEST MATRIX REPROVADA**

Motivos: defeito funcional real no sender C, com ambiguidade de operadores na
composição JSONB do payload; cobertura obrigatória dependente incompleta após
a interrupção. O smoke e a aplicação passaram, e 31 casos SQL passaram,
incluindo os 16 cenários UID e o rollback integral do skip pausado. Isso não
compensa o sender falho nem autoriza aprovação da matriz integral.

Nenhuma correção adicional foi aplicada ao descobrir o defeito. Nenhum teste
manual, rollout, Vercel Preview ou V3.2-D foi iniciado. A entrega será
encaminhada à auditoria externa, com o teardown C concluído e A/B preservados.

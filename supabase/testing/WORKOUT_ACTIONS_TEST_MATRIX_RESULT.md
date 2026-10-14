# Gym.io V3.2-C — resultado da matriz local

Data: 2026-10-11. Branch: `gym.io-v3.2`.
HEAD preservado: `cf953d2bb234f4050ad50f6ef19b5b94a5df975e`.

**A migration C falhou ao aplicar no PostgreSQL real.** O runner parou sem
reparo, e as provas comportamentais C ficaram bloqueadas. Houve também uma
divergência de CORS no gateway local e um desvio de escopo na regressão SQL A,
descritos abaixo. Testes unitários e verificações independentes aprovados não
substituem as provas bloqueadas.

Evidência sanitizada e inventário: [actions-test-matrix-result.json](./actions-test-matrix-result.json).
Esse arquivo contém versões, digests, resultados, hashes dos arquivos,
diagnóstico sanitizado da falha e confirmação de limpeza. Não contém JWTs,
passwords, chaves administrativas, worker token, VAPID privado ou capabilities.

## A. Runtime e versões

Projeto novo: `gymio-workout-actions-local`; API `55451`, DB `55452`, shadow
`55450`. Root próprio `%TEMP%/gymio-workout-actions-4d6148815afb465d9f16e8d5f695136d`,
com `.owner` exato. O root foi removido após a coleta de evidências.

| Componente | Versão executada |
| --- | --- |
| Docker Server | 29.8.1 |
| Supabase CLI | 2.120.0 |
| PostgreSQL | imagem 17.6.1.113; servidor 17.6 |
| PostgREST | 16.4 |
| GoTrue/Auth | 2.197.0 |
| Edge Runtime | 1.77.4, compatível com Deno 2.1.4 |
| V8 / TypeScript do Edge | 11.6.189.12 / 5.1.6 |
| Kong | 2.8.1 |
| Realtime, criado pelo CLI e sem uso nos testes | 2.140.10 |
| Compilador Deno separado | 2.1.4 |
| Node / npm | 22.15.1 / 10.9.2 |
| supabase-js | 2.106.0 |
| web-push | 3.6.7 |
| fake-indexeddb, somente teste | 6.2.5 |
| pg_cron / pg_net / Vault | 1.6.4 / 0.20.0 / 0.3.1 |

PostgreSQL foi usado sem troca de versão:
`public.ecr.aws/supabase/postgres@sha256:4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e`.
Os seis digests do stack constam no JSON. Compilador:
`denoland/deno@sha256:3bf75873714baa410dcf7fabaf76d806d20f0ac8a7579df11577b4ed97416e34`.

## B. Bootstrap executado

Ordem real: legacy fixture → EXPAND → Exercise Memory → Push Foundation A →
Workout Notifications B → Extension Security Gate → tentativa de C.
Todos os SQLs foram enviados sem edição de bytes. Auth histórico e CONTRACT
não foram executados.

Foram criados por signup local os usuários A/B, com JWTs reais, passwords
sintéticos, emails `@local.invalid` e profiles. Somente dados locais novos;
nenhum dado de produção foi consultado ou copiado. O job global
`gymio-workout-push` permaneceu inativo, com schedule `10 seconds`.

O gate passou antes de secrets/C. Apenas depois foram provisionados dois
secrets Vault e `edge.env` locais. As Functions foram servidas nesse root,
com `actions-integration` separado e `verify_jwt=true`; a configuração de
`push-test` e dos endpoints de produção foi preservada.

Os harnesses A/B/gate anteriores tinham guards de entrada exclusivos de A/B.
Adapters temporários declarados ajustaram apenas projeto, porta e root para C;
o gate também reconheceu C para incluir o inventário B já existente. Corpos
dos testes e assertions permaneceram intactos. Os arquivos do repositório não
foram modificados por esses adapters.

## C. Migration C e assertions

O runner original foi invocado com `-ContextFile`, `-RunPreparedMatrix` e
`-ApplyC`. A tentativa única falhou com:

```text
ERROR: syntax error at end of input
LINE 45: when 'function' then (select jsonb_build_array(pg_get_...
```

Classificação: **BLOCKER de aplicação SQL**, SQLSTATE `42601`.
Localização: bloco `do $assert$` iniciado na linha 271; expressão
`if p.value is distinct from case p.kind` nas linhas 314–315 da migration
`20261011021351_workout_notification_actions.sql`.

A transação foi revertida. Observação posterior: schema C ausente e zero
funções públicas C. Portanto tabelas, índices, grants e assertions C não estão
aprovados. Nenhuma correção, adaptação do SQL ou reaplicação foi feita.

Guards existentes foram exercitados com entradas/respostas alteradas apenas
em memória: projeto, porta, owner, root, manual B, imagem e hash histórico
incorretos foram rejeitados. Lacuna: `actionsContext` verifica somente cinco
hashes e não detecta drift da própria migration C. A conferência externa dos
seis hashes foi executada antes do startup, antes de aplicar C e ao encerrar,
sem alterar o guard existente.

## D. Emissão de capabilities

**Bloqueada pela falha de aplicação.** Emissão, actions exatas, hashes únicos
de 32 bytes, ausência de plaintext, bindings, unchanged sem novos registros,
renovação, ownership e canonical bearer não receberam prova SQL/Data API C.

A leitura do harness identificou cobertura incompleta de estrutura/zero writes
em unchanged, A→Session B e formatos malformados de bearer. Nenhum suplemento
comportamental foi executado após a falha de C.

## E. Actions

| Operação C | Resultado da matriz |
| --- | --- |
| rest_add_15, deadline exato +15 e revisão +1 | bloqueada |
| rest_pause | bloqueada |
| rest_resume com pausa real e deslocamento dos dois clocks | bloqueada |
| rest_continue antes/depois do prazo real | bloqueada |
| rest_skip ativo | bloqueada |
| rest_skip pausado, resume + forced skip, revisão +2 | bloqueada |

Não foi iniciada sessão para testar C nem simulada mutação C por DML.

## F. Atomicidade do pulo pausado

**BLOCKER pendente:** a injeção de falha após resume e antes do skip não pôde
rodar. Não há prova de rollback da revisão/pausa/consumo/siblings/geração.
O teste preparado também não compara explicitamente a contagem de gerações.

## G. UID transaction-local

**BLOCKER pendente:** nenhum consumo C ocorreu na mesma conexão para comprovar
restauração de UID, fallback claims, exceção, commit, rollback ou próxima
transação.

A auditoria do harness encontrou uma lacuna adicional: seus testes configuram
o UID anterior com `set_config(..., true)` e esperam ausência na transação
seguinte. Isso não comprova o Caso 1 obrigatório de um `USER_X` anterior da
conexão persistir após commit. O suplemento separado foi considerado, mas
ficou bloqueado pela aplicação C; não foi substituído por evidência estática.

## H. Concorrência, replay e expiração

Consumo concorrente, emissão concorrente, uso único, siblings, revisão antiga,
replay e expiração C: **bloqueados**. Nenhuma conclusão sobre esses efeitos é
derivada dos testes unitários.

## I. Lifecycle e retenção

Cascade de subscription/sessão/usuário, revogação de bearer e retenção C
limitada a 100 gerações terminais/expiradas com mais de sete dias:
**bloqueados**.

O grupo preparado `sender_user_cascade` criaria um terceiro usuário Auth e
foi explicitamente impedido pela guarda externa de execução. Ele não foi
atingido pelo runner, que parou na aplicação. A suíte B SQL completa e seu
benchmark de mil usuários também não foram executados.

**Desvio de escopo ocorrido:** a regressão A `push-security.sql`, executada
sem alterações, inseriu duas linhas adicionais de usuários SQL sintéticos em
`auth.users` dentro de sua transação rollback-only. Nenhuma persistiu, e a
contagem final foi exatamente dois usuários e dois profiles. Ainda assim,
essas inserções transitórias contrariaram a restrição de criar exclusivamente
A/B durante esta rodada. Não se declara conformidade integral com esse limite.

## J. Data API e segurança

PostgREST e Auth reais foram usados nas regressões independentes:

- A: JWTs A/B, múltiplos devices, idempotência, registro concorrente, ownership
  e bloqueio de DML direto aprovados.
- Assertions A aprovadas no baseline real e sete fixtures negativas de ACL,
  todas revertidas. Nenhum grant novo persistiu.
- B: 33 rejeições clientes de RPC/DML/schema privado e nove fixtures negativas
  de assertions, todas revertidas, aprovadas.
- Gate: 22 rejeições HTTP, 41 corpos/owners/ACLs e seis fixtures negativas
  aprovados antes de C e novamente após sua falha. Snapshot de ACLs oficiais
  permaneceu igual durante cada execução.
- Schemas efetivos restaurados e confirmados: `public,graphql_public`.

Nenhuma ACL, owner ou default privilege oficial de pg_cron/pg_net/Vault foi
reparado. Nenhuma assertion histórica foi relaxada. Autorização e acesso
administrativo C: **não testados**, pois suas interfaces não existem no banco.

## K. Edge e CORS

O Edge Runtime real iniciou. O spike `web-push@3.6.7` importou a biblioteca e
gerou POST com corpo criptografado de 219 bytes, `aes128gcm`, TTL do transporte
existente e autorização VAPID; `transmitted=false`. A integração supabase-js
com RPC, AbortSignal, Functions invoke e admin wrapper local também passou.

O suplemento negativo de `workout-action` parou no primeiro GET permitido:
HTTP 405 e `{result:"unavailable"}`, mas `Access-Control-Allow-Origin: *`.
Não foi removida a assertion para prosseguir.

Cinco leituras diagnósticas posteriores, sem assertions de aprovação:

| Pedido | HTTP | Allow-Origin | Resultado |
| --- | --- | --- | --- |
| GET, origin permitido | 405 | * | unavailable |
| POST canônico desconhecido, origin permitido | 503 | * | unavailable; SQL C ausente |
| POST, origin diferente | 403 | * | unavailable |
| OPTIONS, origin permitido | 200 | * | interceptado pelo gateway |
| OPTIONS, origin diferente | 200 | * | interceptado pelo gateway |

Kong local possui plugin CORS com configuração padrão. A evidência atribui o
wildcard/preflight à fronteira do gateway. O handler rejeita o POST de outra
origem, porém a fronteira HTTP não satisfaz origins exatas/preflight restrito.
Classificação: **divergência de integração CORS**, sem ajuste do gateway.

Bearer válido, replay/expired/stale/already_used C, matriz negativa completa,
timeout SQL real de dez segundos, sanitização sob erro SQL e ausência de retry
do consumo real C: **bloqueados/não concluídos**. Timeout curto injetado nos
unitários não é apresentado como execução dessa prova.

## L. Sender B→C

**BLOCKER pendente:** duas deliveries do mesmo usuário vinculadas às suas
subscriptions exatas, emissão V3, atomic begin/issuance, fallback unchanged,
attempted antes do HTTP, outcomes accepted/expired/failed, limpeza concorrente
e remoção após claim com zero envios não puderam ser executados com C.

O harness preparado também carece de assertions explícitas de todos os
contadores/estados finais de outcomes e de timeout do transporte do sender;
seu `finally` apaga linhas por cascade. Não se presume cobertura pelo nome
dos grupos. Nenhuma requisição real a Push provider foi feita.

## M. Service Worker e IndexedDB

Containers separados, workspace read-only e fake-indexeddb 6.2.5:

- C `actions-indexeddb.mjs`: reinício com reutilização somente do card atual,
  card ausente sem reconstrução, logout persistente e varredura sem tokens:
  aprovado.
- B `worker-indexeddb.mjs`: recibo atômico entre workers, reinício, tombstones
  de logout/encerramento e ordering: aprovado.
- Unitários preservados cobrem compatibilidade V1/V2, V3, eligible states,
  unchanged com divergência/expiração, serialização, replay visual, offline e
  logout. Todos passaram.

Auditoria estática: IDB contém apenas recibos, flags, tombstones, marcadores de
geração e ordering; não há API Cache Storage no SW. Tokens ficam em memória
transitória/Notification.data. Ausência de JWT/service/worker token em stores
é evidência de fonte, não inspeção de um browser manual.

Lacunas de cobertura: C com dois processors e geração terminal após restart
em IDB real, variantes de Notification.maxActions e falha de IDB não foram
comprovadas integralmente pelo harness dedicado. Nenhum teste manual ocorreu.

## N. Regressão, qualidade e performance

| Verificação | Resultado |
| --- | --- |
| npm test | 80/80, zero falhas/skips/cancelamentos |
| Build Vite | aprovado; único warning relevante de chunk >500 kB |
| Deno check --frozen | push-test, workout-push, workout-action e harness C aprovados |
| Lockfiles/dependências | nenhuma atualização |
| db lint A/B local | zero erros e zero warnings |
| db lint após aplicação C | bloqueado |
| Assertions/gate A/B | aprovados conforme J |
| SQL/Edge B completos | não executados; interfaces C faltantes e fixtures com usuários adicionais |
| git diff --check | aprovado |
| Lint frontend | não há script atual |
| Timings emissão/consumo/concorrência/cleanup C | bloqueados |

O build usou API local e `envDir`/output temporários, preservando `dist` e sem
carregar `.env` de produção. CLI usou home temporário e telemetry desativada
somente no processo; nenhuma configuração global foi alterada.

Leitura da implementação não encontra cron novo, polling ou countdown writes
em C. O banco terminou com o único job B inativo. Isso não substitui medição
comportamental C. Benchmark B que cria mil usuários foi recusado, sem adaptação.

307 arquivos existentes inventariados no início foram conferidos antes da
limpeza: zero diferenças. Artefatos ignorados `.env`/`.env.push.local` têm
snapshot final de hash, sem leitura de conteúdo para configuração; não houve
snapshot inicial desses dois, portanto não se afirma comparação byte a byte
antes/depois deles. Nenhuma operação de escrita foi dirigida a esses arquivos.
As únicas adições ao repositório são este relatório e o JSON de evidências.

## O. Hashes, estado remoto e limpeza

Os seis hashes conferiram no início, antes de aplicar C e ao encerrar:

| Migration | SHA-256 final, igual ao aprovado |
| --- | --- |
| Auth | cef2b977994e6632caab79bb82b759efc1dcd95b372f26b37141f7aa12eba9d6 |
| EXPAND | 6388adf59a96219035e262bb1c08765cc599a5f821c30bf7034fc1258ab1a2db |
| Exercise Memory | 7fc9c40a8b2b64fe0b9c24bb979d3393033d31a311b0f91ed5cf51ae917c6e02 |
| Push Foundation A | 225b65c65fdfbb81dc631882f71a0fde34a90676fe97473bfdb4b2e3fcbd3823 |
| Workout Notifications B | c9196d2e6ea7606543197c1cfdb673f21a5c94c910c0f6d94a33b4f3d61c755b |
| Workout Notification Actions C | 8bc29435076d232efeaea35837ab84e575fc561cfb597fafeefd3cc300ff5b42 |

Zero consultas ou alterações remotas Supabase/Vercel. Sem deploy, secrets
remotos, repair, db push, CONTRACT, commit, push, PR, merge ou V3.2-D.
Zero requisições a providers; filas/respostas pg_net terminaram vazias.

A/B não foram alvos de SQL, Functions serve, restart ou cleanup. Os dez
containers protegidos mantiveram IDs/names. A fixture manual foi preservada.

Cleanup C confirmado após checar owner, paths e IDs: seis containers, volumes,
network e helper exclusivos removidos; root e secrets removidos. Nenhum recurso
C restante. Sem prune, remoção de imagens ou ação nos volumes/networks/roots A/B.
O staging inicial sem stack/credenciais ficou em sandbox temporário descartado.

## P. Veredito

**V3.2-C TEST MATRIX REPROVADA**

Motivos: falha material de aplicação C; provas BLOCKER de atomicidade, UID e
subscription binding não executadas; CORS HTTP divergente; cobertura preparada
insuficiente em pontos obrigatórios e desvio dos usuários SQL transitórios na
regressão A. Nenhuma correção automática, teste manual ou rollout foi iniciado.
O trabalho encerra com evidências para auditoria externa.

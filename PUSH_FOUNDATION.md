# Gym.io — manutenção de Push

Session V2 é a autoridade do treino. As migrations A/B/C/D, os handlers Edge e o
Service Worker têm responsabilidades distintas; a apresentação nunca autoriza
uma mutação.

## Fronteiras e configuração

- Ativação depende de clique, permission e registro autenticado. Não há inscrição
  ou reativação automática. Logout tenta limpeza remota/local com limite de tempo
  e feedback parcial, sem impedir `signOut()`.
- A bloqueia acesso cliente direto às subscriptions. O executor usa somente JWT
  request GUCs, sem acesso a `auth`. A exceção de auditoria das duas views oficiais
  de `pg_stat_statements` não concede privilégios novos.
- B usa um job global, outbox e deliveries vinculadas à subscription por cascade.
  A tentativa é irreversível antes do HTTP: política at-most-once, sem retry de
  resultado ambíguo. `accepted` significa aceitação pelo provider, não recebimento.
- C valida capability textual, calcula seu hash no backend e executa Session V2
  atomicamente. A identidade temporária é transaction-local e restaurada. Tokens
  não vão para URL, logs, IndexedDB ou Cache Storage. `unchanged` só reutiliza
  controles de um card correspondente à mesma sessão, geração e revisão.
- D registra subscription e modo atomicamente. `minimal` é o default fail-closed;
  somente `enhanced` participa da entrega de descanso. Não inferir modo pelo
  endpoint ou userAgent.

O cliente recebe apenas `VITE_SUPABASE_URL`, a chave pública Supabase e
`VITE_VAPID_PUBLIC_KEY`. Nunca expor credencial administrativa em variável `VITE_`.
O build gera a configuração pública da action a partir da URL Supabase.

Secrets server-side: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`PUSH_ALLOWED_ORIGINS`, `GYMIO_WORKOUT_WORKER_TOKEN` e
`GYMIO_WORKOUT_ACTION_ORIGINS`. Origins são exatas, sem wildcard. O runtime fornece
as credenciais Supabase administrativas. O token de B trafega somente em header
dedicado server-to-server; seu body é `{}`, sem CORS. Secrets locais ficam em
runtime ignorado, nunca em `src/`, `public/`, migrations ou Git.

`push-test` mantém `verify_jwt=true`; `workout-push` e `workout-action` usam suas
próprias fronteiras de autenticação com `verify_jwt=false`. Os senders validam
HTTPS e hosts exatos permitidos, recusam redirects e usam TTL de 60 s e timeout de
10 s. Não ativar cron, alterar secrets ou deployar por executar checks frontend.

## Apresentação e lifecycle

`Notification.maxActions` inteiro positivo comprova suporte a actions. Minimal
mostra início e conclusão, sem cards intermediários. Enhanced mantém mini-player
e controles de descanso. Ambos usam início `Treino iniciado`, sem body e com
atenção solicitada; conclusão `Treino concluído` / `Veja seu progresso`.

Updates normais do mini-player são silenciosos. Apenas descanso concluído
confirmado pode solicitar atenção uma vez por descanso. Receipts deduplicam
canais/reinícios; tombstones impedem reabertura após encerramento/logout. A tag
`gymio-workout-${id_sessao}` identifica a sessão, mas não garante coalescing: o
processor serializa, valida ordering e confere cards redundantes por enumeração.
Dispensa manual não encerra a sessão.

Actions usam C sem abrir a PWA. Clique no corpo abre somente rota segura da mesma
origem; sem actions, o Player recebe `from=push` e usa Quick Controls autenticados.
A conclusão aponta ao histórico resolvido, com fallback para a visão geral.
Som/haptic, vibração, replacement e lifetime dependem do browser/OS. `silent` é
preferência e não garante ausência de animação do sistema.

## Verificações locais

```powershell
npm test
npm run build
git diff --check
```

Os testes `.test.js` incluem lifecycle, segurança, actions, apresentação e Quick
Controls. Os harnesses `.browser.js` exercitam IndexedDB/Service Worker em browser
local; não confundir mocks com homologação física.

As matrizes SQL/Data API/Edge exigem execução explícita e Docker isolado. Seus
contratos e comandos estão em `supabase/testing/PUSH_DELIVERY_CAPABILITIES.md`,
`WORKOUT_NOTIFICATIONS.md` e `WORKOUT_NOTIFICATION_ACTIONS.md` no mesmo diretório.
Preservar fixtures e baselines consumidos pelos runners. Evidências históricas
descrevem seu commit original e não certificam uma execução nova.

Nunca reaplicar Auth histórico ou CONTRACT para montar uma fixture. Os arquivos
em `supabase/recovered/` são referência de recuperação, não migrations executáveis.
Conferir os sete hashes antes/depois de manutenção. Limpar somente recursos do
runtime explicitamente identificado, verificando owner e paths; não usar prune
global. Recebimento, clique, logout e limitações físicas iOS/Android têm validação
manual separada dos testes automatizados.

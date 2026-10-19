> Aplicativo de gestão e acompanhamento de treinos para todos os ambientes — academia, casa ou calistenia.

## 📖 Sobre o Projeto

O **Gym.io** é um aplicativo web voltado para pessoas que treinam e desejam organizar, acompanhar e evoluir nos seus treinos. Independente do ambiente — academia, casa ou calistenia — o usuário pode criar rotinas personalizadas, registrar cargas, repetições e séries, e visualizar seu progresso ao longo do tempo.

O diferencial do projeto está na sua abordagem **generalizada e flexível**, combinando o melhor de apps como Hevy (musculação), Nike Training Club (treinos guiados) e Freeletics (calistenia), sem as limitações de cada um.

---

## 🚀 Funcionalidades Principais

- ✅ Criação e gerenciamento de rotinas de treino
- ✅ Adição de exercícios com parâmetros (séries, repetições, carga, tempo)
- ✅ Histórico de treinos realizados
- ✅ Dashboard de progresso e evolução
- ✅ Sugestões de treinos prontos do sistema
- ✅ Suporte para musculação, cardio e calistenia

---

## 🛠️ Tecnologias Utilizadas

- **React** — Interface de usuário
- **Vite** — Bundler e ambiente de desenvolvimento
- **Tailwind CSS** — Estilização
- **React Router** — Roteamento entre páginas
- **Context API** — Gerenciamento de estado (autenticação e dados)
- **SupaBase** — Banco de dados

---

## 📁 Estrutura de Pastas

```
gym.io/
├── public/
├── src/
│   ├── assets/images/     # Imagens e recursos estáticos
│   ├── components/        # Componentes reutilizáveis
│   │   └── ui/            # Primitivos genéricos de interface
│   ├── contexts/          # Contextos globais (AuthContext, etc.)
│   ├── features/
│   │   ├── auth/          # Shell, apresentação, campos e hooks de login/cadastro
│   │   ├── landing/       # Experiência, seções e animação 3D da landing
│   │   └── publicSite/    # Cabeçalho, rodapé, navegação e documentos jurídicos compartilhados
│   ├── hooks/             # Custom hooks
│   ├── layouts/           # Layouts de página
│   ├── lib/               # Utilitários e integrações (CRUD de treinos)
│   ├── pages/             # Páginas da aplicação
│   ├── routes/            # Definição de rotas
│   ├── services/          # Comunicação com APIs/backend
│   ├── styles/            # Estilos globais
│   ├── utils/             # Funções auxiliares
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

As páginas de rota continuam em `src/pages`, incluindo `Login.jsx` e `Cadastro.jsx`.
Os serviços de autenticação permanecem em `src/services/auth`.

A área autenticada usa os tokens semânticos de `src/styles/appTheme.css`, registrados
com `@theme inline`. O marcador `.app-shell` ativa a paleta no documento, incluindo
diálogos e notificações globais; a variante `app:` adapta componentes compartilhados
sem alterar as páginas públicas. `ContentEntrance` e `appMotion` centralizam as entradas
de 220 ms, com atraso máximo de 165 ms e suporte a movimento reduzido. O layout registra
os blocos já apresentados para evitar repetir entradas após filtros ou recarregamentos.

O Tailwind cobre os layouts simples. `src/styles/index.css` contém os estilos globais;
`features/publicSite/publicSite.css` reúne o tema e os estilos públicos compartilhados;
`features/landing/landing.css` contém apenas a apresentação específica da landing.
`features/auth/auth.css` preserva a cascata de tema, os seletores de estado, os ajustes
responsivos e as animações que precisam de CSS. Os módulos de entrada importam os
estilos públicos antes de seus estilos específicos.

---

## ▶️ Como Rodar o Projeto

### Pré-requisitos

- Node.js >= 18
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/gym.io.git

# Acesse a pasta do projeto
cd gym.io

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse em: `http://localhost:5173`

---

## 🎯 Personas do Projeto

**Paulo Motta** — *"Clareza e eficiência"*
> 26 anos, trabalha e estuda. Quer planejar treinos de forma rápida e acompanhar sua evolução com clareza.

**Mariana Alves** — *"Incentivo e apoio visual"*
> 24 anos, estudante. Precisa de motivação, metas simples e suporte visual para manter a constância.

**Ricardo Souza** — *"Rápido e pontual"*
> 29 anos, engenheiro. Treina quando sobra tempo e busca treinos rápidos e sem planejamento complexo.

## 📄 Licença

Projeto acadêmico desenvolvido para fins educacionais.

## Notificações

Ativadas explicitamente em Perfil → Notificações, lembram os treinos agendados.
No modal, escolha um horário de São Paulo e, opcionalmente, lembretes no horário,
um dia ou dois dias antes. As opções começam desmarcadas. O backend cria tudo
em uma transação e informa as opções descartadas por já estarem no passado.
Cada lembrete tem seu próprio evento. Os destinatários são congelados no
vencimento; subscriptions criadas após esse horário não recebem retroativamente.
O único job global executa a cada minuto e é criado inativo. Sua ativação exige
um rollout separado. Reminders de dias anteriores não geram envios atrasados.

Após salvar, uma confirmação local substitui o feedback visual de sucesso
quando a notificação puder ser exibida. Sem notificações ativas, o agendamento
funciona normalmente e mantém o feedback visual. Agendar nunca pede permissão
ou ativa Push automaticamente.

O Player usa somente Session V2. A única notificação local de treino é
“Treino concluído · Veja seu progresso”, após confirmação do servidor, com
acesso ao histórico correspondente. Cancelar ou executar um treino não produz
notificações intermediárias. Som e apresentação dependem do navegador e do SO.

`npm test` e `npm run build` validam o código. A matriz Supabase descartável é
explícita: `node supabase/testing/appointment-matrix.mjs --run-isolated`.
Ela recusa destinos remotos, usa transporte Push falso e remove a própria stack.
O bootstrap legado é uma fixture reconstruída, fora de migrations; o histórico
Auth não é reaplicado. Os sete SQLs históricos ficam preservados byte a byte.

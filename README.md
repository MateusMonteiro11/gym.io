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
│   ├── contexts/          # Contextos globais (AuthContext, etc.)
│   ├── hooks/             # Custom hooks
│   ├── layouts/           # Layouts de página
│   ├── lib/               # Utilitários e integrações (CRUD de treinos)
│   ├── pages/             # Páginas da aplicação
│   ├── routes/            # Definição de rotas
│   ├── services/          # Comunicação com APIs/backend
│   ├── styles/            # Estilos globais
│   ├── utils/             # Funções auxiliares
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

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
npm install
npm install @supabase/supabase-js
npm install framer-motion
npm run dev

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

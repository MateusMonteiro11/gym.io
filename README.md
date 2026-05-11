# GYM.IO

Frontend preparado para:

- React + Vite
- TailwindCSS
- Supabase
- PostgreSQL
- Arquitetura modular escalável

---

# Estrutura do Projeto

src/
├── assets/        # imagens, ícones e arquivos estáticos
├── components/    # componentes reutilizáveis de UI
├── contexts/      # estados globais (Auth, sessão, tema)
├── hooks/         # lógica React e gerenciamento de estado ->
├── layouts/       # estruturas reutilizáveis de páginas
├── lib/           # configuração de clients e SDKs
├── pages/         # páginas principais do sistema
├── routes/        # gerenciamento e proteção de rotas
├── services/      # CRUD e comunicação com Supabase/API
├── styles/        # estilos globais
├── utils/         # helpers, constantes e validações
└── main.jsx


---

# Fluxo da Arquitetura


Pages / Components
        ↓
Hooks
        ↓
Services
        ↓
Supabase
        ↓
Database


---

# Responsabilidade de Cada Camada

## Pages
Responsáveis pelas telas e composição visual.

## Components
Componentes reutilizáveis da interface.

## Hooks
Controlam:
- estados
- loading
- efeitos
- lógica React

## Services
Responsáveis por:
- CRUD
- queries
- autenticação
- integração com Supabase

## Contexts
Estados globais da aplicação:
- usuário
- sessão
- autenticação

## Lib
Configuração de SDKs globais:
- Supabase
- clients externos

---

# Estrutura dos Services


services/
├── auth/
├── treinos/
├── exercicios/
├── historico/
└── agendamentos/


---

# Exemplo de Fluxo Correto

## Service

listarTreinos()


## Hook

useTreinos()


## Página

const { treinos } = useTreinos()

---

# Variáveis de Ambiente

Criar:

.env

Exemplo:

VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE

---

# Executar Projeto

npm install
npm install @supabase/supabase-js
npm run dev

---

# Observações

- Não acessar Supabase diretamente nas páginas.
- Centralizar queries nos services.
- Usar hooks para controlar estado e lógica.
- Nunca expor service_role_key no frontend.
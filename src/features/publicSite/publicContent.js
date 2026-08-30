export const CONTACT_EMAIL = 'contato@mateusmonteiro.dev'

export const FAQ_ITEMS = [
  {
    id: 'gratuito',
    question: 'O Gym.io é gratuito?',
    paragraphs: [
      'Sim. Atualmente, o Gym.io é totalmente gratuito para uso, desde que o usuário esteja de acordo com os Termos de Uso e a Política de Privacidade da aplicação. Não existem planos pagos, assinaturas ou recursos premium.',
    ],
  },
  {
    id: 'para-quem',
    question: 'Para quem é o Gym.io?',
    paragraphs: [
      'O Gym.io é voltado para quem deseja organizar, executar e acompanhar seus treinos de forma simples e intuitiva.',
      'Se você está cansado de ferramentas genéricas ou procura uma maneira mais prática de registrar exercícios, cargas, repetições e evolução, o Gym.io pode ser uma ótima opção.',
    ],
  },
  {
    id: 'armazenamento',
    question: 'Onde meus dados ficam armazenados?',
    paragraphs: [
      'Os dados necessários para o funcionamento do Gym.io são armazenados na infraestrutura utilizada pelo projeto, incluindo os serviços de banco de dados e autenticação do Supabase. Eles permitem manter sua conta, registrar seus treinos e sustentar o funcionamento da aplicação.',
      'O Gym.io recebeu controles de segurança voltados à operação em produção, como autenticação especializada, comunicação por HTTPS, uso de chave publicável no cliente e políticas de Row Level Security (RLS) vinculadas à identidade autenticada. Assim, as informações pessoais associadas à conta ficam submetidas às regras de acesso do respectivo usuário.',
      'Essas medidas reforçam a proteção das informações, embora nenhum sistema conectado à internet possa eliminar integralmente todos os riscos.',
    ],
    relatedLink: { label: 'Consulte a Política de Privacidade', to: '/privacidade' },
  },
  {
    id: 'instalacao',
    question: 'Preciso instalar algum aplicativo?',
    paragraphs: [
      'Não. Atualmente, o Gym.io funciona diretamente pela web e pode ser acessado pelo navegador do celular ou computador.',
      'Em dispositivos e navegadores compatíveis, também é possível adicioná-lo à tela inicial e utilizá-lo de maneira semelhante a um aplicativo instalado, com ícone próprio e acesso rápido. Essa opção é facultativa e não altera as principais funcionalidades da aplicação.',
    ],
  },
  {
    id: 'saas',
    question: 'O Gym.io é um SaaS?',
    paragraphs: [
      'Atualmente, não. O Gym.io foi concebido como uma aplicação gratuita de gestão e organização de treinos, sem planos, assinaturas ou recursos comercializados.',
      'Seu objetivo atual está ligado à experiência de treino, ao aprendizado e à experimentação dentro do ambiente fitness. Mesmo sem se posicionar como um SaaS, o Gym.io foi desenvolvido para solucionar um problema real de organização e acompanhamento durante os treinos.',
      'O projeto permanece em evolução e, por isso, sua disponibilidade, proposta e funcionalidades podem mudar ao longo do tempo.',
    ],
  },
  {
    id: 'orientacao-profissional',
    question: 'O Gym.io substitui o acompanhamento de um profissional?',
    paragraphs: [
      'Não. O Gym.io é uma ferramenta de gestão, organização e acompanhamento de treinos e não substitui a orientação de profissionais qualificados.',
      'A aplicação não realiza diagnósticos nem deve ser considerada uma prescrição profissional de exercícios. O usuário continua responsável pelas decisões relacionadas à execução e à progressão dos próprios treinos.',
    ],
  },
]

export const FOOTER_PRODUCT_LINKS = [
  { label: 'Início', to: '/#top' },
  { label: 'Recursos', to: '/#capabilities' },
  { label: 'Experiência', to: '/#flow' },
  { label: 'FAQ', to: '/#faq' },
]

export const FOOTER_SUPPORT_LINKS = [
  {
    label: 'Reportar problema',
    href: `mailto:${CONTACT_EMAIL}?subject=Gym.io%20-%20Reportar%20problema`,
  },
  {
    label: 'Contato',
    href: `mailto:${CONTACT_EMAIL}?subject=Gym.io%20-%20Contato`,
  },
]

export const FOOTER_LEGAL_LINKS = [
  { label: 'Termos de Uso', to: '/termos' },
  { label: 'Política de Privacidade', to: '/privacidade' },
]

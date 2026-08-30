import { CONTACT_EMAIL } from './publicContent.js'

export const LEGAL_LAST_UPDATED = '29 de agosto de 2026'

const contactHref = `mailto:${CONTACT_EMAIL}?subject=Gym.io%20-%20Contato%20jurídico`
const privacyRequestHref = `mailto:${CONTACT_EMAIL}?subject=Gym.io%20-%20Solicitação%20sobre%20dados%20pessoais`

export const LEGAL_DOCUMENTS = {
  terms: {
    id: 'terms',
    path: '/termos',
    title: 'Termos de Uso',
    shortTitle: 'Termos',
    intro: 'Estes Termos estabelecem as condições para acessar e utilizar o Gym.io. Leia o documento com atenção antes de criar uma conta ou usar a aplicação.',
    sections: [
      {
        id: 'finalidade',
        title: '1. Finalidade do Gym.io',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io é uma aplicação web destinada à organização, execução e ao acompanhamento de treinos. O projeto permite estruturar rotinas, registrar exercícios, cargas, repetições, intervalos, agendamentos e históricos para facilitar a continuidade do treino.' },
          { type: 'paragraph', text: 'O projeto está em desenvolvimento contínuo e também possui finalidade de aprendizado e experimentação em produto, experiência do usuário, desenvolvimento de software e tecnologias web.' },
        ],
      },
      {
        id: 'aceitacao',
        title: '2. Aceitação dos Termos',
        blocks: [
          { type: 'paragraph', text: 'Ao criar uma conta ou utilizar o Gym.io, você declara que leu e concorda com estes Termos. Caso não concorde com alguma condição, não deverá criar uma conta nem continuar utilizando a aplicação.' },
          { type: 'paragraph', text: 'A Política de Privacidade é um documento independente e explica como as informações pessoais são tratadas.' },
          { type: 'link', label: 'Ler a Política de Privacidade', href: '/privacidade' },
        ],
      },
      {
        id: 'conta',
        title: '3. Conta e credenciais',
        blocks: [
          { type: 'paragraph', text: 'Você deve fornecer informações verdadeiras e manter os dados da conta atualizados. Também é responsável por preservar a confidencialidade de sua senha e por não compartilhar o acesso com terceiros.' },
          { type: 'paragraph', text: 'Ao perceber uso não autorizado, perda de acesso ou qualquer atividade suspeita relacionada à conta, entre em contato pelos canais indicados ao final destes Termos.' },
        ],
      },
      {
        id: 'uso-permitido',
        title: '4. Uso permitido',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io deve ser utilizado de forma lícita, pessoal e compatível com sua finalidade de organização de treinos. Você pode cadastrar, consultar, editar e acompanhar informações relacionadas à própria rotina, respeitando estes Termos e os direitos de terceiros.' },
        ],
      },
      {
        id: 'condutas-proibidas',
        title: '5. Condutas proibidas',
        blocks: [
          { type: 'paragraph', text: 'Não é permitido:' },
          { type: 'list', items: [
            'tentar acessar contas, dados ou áreas que não lhe pertencem;',
            'contornar controles de autenticação, autorização ou segurança;',
            'explorar vulnerabilidades, interferir na disponibilidade ou prejudicar a integridade da aplicação;',
            'utilizar o Gym.io para atividades ilícitas, fraudulentas ou que violem direitos de terceiros;',
            'automatizar acessos abusivos ou sobrecarregar deliberadamente a infraestrutura.',
          ] },
        ],
      },
      {
        id: 'gratuidade',
        title: '6. Gratuidade atual',
        blocks: [
          { type: 'paragraph', text: 'Atualmente, o Gym.io é gratuito e não oferece planos pagos, assinaturas ou recursos premium. Essa condição descreve o estágio atual do projeto e poderá ser revista no futuro. Qualquer mudança relevante deverá ser apresentada de forma clara antes de produzir efeitos para o usuário.' },
        ],
      },
      {
        id: 'disponibilidade',
        title: '7. Disponibilidade e evolução',
        blocks: [
          { type: 'paragraph', text: 'Por ser um projeto em evolução, o Gym.io pode receber alterações de interface, funcionalidades, integrações e requisitos técnicos. Também pode passar por manutenção, apresentar indisponibilidades temporárias ou ter recursos modificados ou descontinuados.' },
          { type: 'paragraph', text: 'Não é garantido que a aplicação permanecerá disponível sem interrupções ou que todos os recursos serão mantidos de forma permanente.' },
        ],
      },
      {
        id: 'orientacao-profissional',
        title: '8. Orientação profissional e saúde',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io é uma ferramenta de organização e registro. Ele não substitui avaliação médica, fisioterapêutica, nutricional ou o acompanhamento de profissional de educação física.' },
          { type: 'paragraph', text: 'A aplicação não realiza diagnósticos, não prescreve tratamentos e não valida se determinado exercício, carga, volume ou progressão é adequado para sua condição individual.' },
        ],
      },
      {
        id: 'responsabilidade-treino',
        title: '9. Responsabilidade pelas decisões de treino',
        blocks: [
          { type: 'paragraph', text: 'Você é responsável pelas informações cadastradas e pelas decisões relacionadas à execução, intensidade, progressão e interrupção dos próprios treinos. Em caso de dor, limitação, lesão, condição clínica ou dúvida, procure orientação profissional qualificada antes de continuar.' },
        ],
      },
      {
        id: 'suspensao',
        title: '10. Suspensão ou encerramento',
        blocks: [
          { type: 'paragraph', text: 'O acesso poderá ser limitado, suspenso ou encerrado quando houver violação destes Termos, uso abusivo, tentativa de comprometer a aplicação, necessidade de proteção da infraestrutura ou obrigação legal aplicável.' },
          { type: 'paragraph', text: 'Sempre que razoavelmente possível, a medida será proporcional à situação identificada e poderá ser revista após contato do usuário.' },
        ],
      },
      {
        id: 'alteracoes',
        title: '11. Alterações destes Termos',
        blocks: [
          { type: 'paragraph', text: 'Estes Termos podem ser atualizados para acompanhar a evolução do Gym.io, mudanças operacionais ou requisitos aplicáveis. A data da versão vigente será indicada no início do documento. Alterações relevantes poderão ser comunicadas pelos meios disponíveis na aplicação.' },
        ],
      },
      {
        id: 'contato',
        title: '12. Contato',
        blocks: [
          { type: 'paragraph', text: 'Dúvidas sobre estes Termos, relatos de uso indevido ou outras solicitações podem ser encaminhadas para:' },
          { type: 'link', label: CONTACT_EMAIL, href: contactHref },
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    path: '/privacidade',
    title: 'Política de Privacidade',
    shortTitle: 'Privacidade',
    intro: 'Esta Política explica quais informações o Gym.io utiliza, por que elas são necessárias e como você pode solicitar acesso, correção ou exclusão de dados relacionados à sua conta.',
    sections: [
      {
        id: 'escopo',
        title: '1. Escopo desta Política',
        blocks: [
          { type: 'paragraph', text: 'Esta Política se aplica às informações tratadas durante o acesso, cadastro e uso das funcionalidades do Gym.io. Ela deve ser lida em conjunto com os Termos de Uso, que disciplinam as condições gerais de utilização da aplicação.' },
          { type: 'link', label: 'Ler os Termos de Uso', href: '/termos' },
        ],
      },
      {
        id: 'informacoes-coletadas',
        title: '2. Informações tratadas',
        blocks: [
          { type: 'paragraph', text: 'Conforme as funcionalidades utilizadas, o Gym.io pode tratar as seguintes categorias de informação:' },
          { type: 'list', items: [
            'dados de conta e perfil, como identificador, nome, e-mail, status, foto de perfil e data de criação;',
            'dados necessários à autenticação e à manutenção da sessão;',
            'treinos, descrições, seções, exercícios, séries, repetições, cargas e tempos de descanso;',
            'agendamentos e respectivas datas e estados;',
            'sessões de treino em andamento, pausas, progresso e séries concluídas;',
            'histórico de execução, duração, volume e resultados registrados pelo usuário;',
            'preferências locais necessárias à experiência, como tema, opção de lembrar acesso e último e-mail utilizado.',
          ] },
        ],
      },
      {
        id: 'finalidades',
        title: '3. Finalidades',
        blocks: [
          { type: 'paragraph', text: 'As informações são utilizadas para:' },
          { type: 'list', items: [
            'criar e autenticar a conta;',
            'manter a sessão e as preferências escolhidas pelo usuário;',
            'salvar, recuperar e organizar treinos e agendamentos;',
            'registrar sessões, séries, progresso e histórico;',
            'permitir a edição do perfil e o funcionamento das interfaces da aplicação;',
            'preservar a integridade, a disponibilidade e a segurança operacional do serviço;',
            'diagnosticar falhas e evoluir as funcionalidades do projeto.',
          ] },
        ],
      },
      {
        id: 'autenticacao',
        title: '4. Conta e autenticação',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io utiliza o Supabase Auth para cadastro, login, recuperação de senha e gerenciamento de sessão. O acesso pode ocorrer por e-mail e senha ou, quando escolhido pelo usuário, por autenticação com Google.' },
          { type: 'paragraph', text: 'No login com Google, o provedor participa do processo de autenticação e trata informações conforme as próprias políticas. O Gym.io recebe apenas os dados necessários para identificar a conta e concluir o acesso.' },
        ],
      },
      {
        id: 'dados-de-treino',
        title: '5. Treinos, sessões e histórico',
        blocks: [
          { type: 'paragraph', text: 'Os dados de treino são fornecidos ou produzidos durante o uso da aplicação. Eles permitem reconstruir rotinas, retomar sessões, acompanhar cargas e repetições, consultar agendamentos e visualizar o histórico de execução.' },
          { type: 'paragraph', text: 'Essas informações não são utilizadas para realizar diagnóstico, prescrição clínica ou avaliação automatizada da saúde do usuário.' },
        ],
      },
      {
        id: 'armazenamento-local',
        title: '6. Armazenamento local e tecnologias do navegador',
        blocks: [
          { type: 'paragraph', text: 'A aplicação utiliza localStorage e sessionStorage para guardar preferências de tema, opção de lembrar acesso, último e-mail utilizado, estado temporário de tentativas de login e dados de sessão gerenciados pelo Supabase.' },
          { type: 'paragraph', text: 'O código atual não utiliza cookies próprios para publicidade ou rastreamento comportamental. Serviços externos envolvidos na autenticação ou entrega de recursos podem aplicar tecnologias próprias, de acordo com suas políticas.' },
        ],
      },
      {
        id: 'infraestrutura',
        title: '7. Infraestrutura e serviços de terceiros',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io utiliza serviços de terceiros necessários à operação, incluindo Supabase para banco de dados e autenticação, Vercel para hospedagem e Google para autenticação opcional e carregamento de fontes. Recursos estáticos também podem ser entregues por redes de distribuição de conteúdo.' },
          { type: 'paragraph', text: 'Esses provedores podem receber dados técnicos necessários à comunicação, como endereço IP, informações do navegador, data e horário da requisição. O tratamento realizado diretamente por cada provedor também está sujeito às respectivas políticas.' },
        ],
      },
      {
        id: 'seguranca',
        title: '8. Segurança das informações',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io recebeu controles de segurança voltados à operação em produção. Entre as medidas verificáveis estão comunicação por HTTPS, autenticação pelo Supabase Auth, uso de chave publicável no frontend e Row Level Security (RLS) nas tabelas públicas da aplicação.' },
          { type: 'paragraph', text: 'As políticas de acesso relacionam informações de perfil, treinos, agendamentos, históricos e sessões à identidade autenticada, limitando o acesso aos dados associados ao respectivo usuário, além dos catálogos e conteúdos de sistema destinados ao uso comum.' },
          { type: 'paragraph', text: 'Apesar dos controles adotados, nenhum sistema conectado à internet é imune a falhas, indisponibilidades ou acessos indevidos. Por isso, o Gym.io não promete segurança absoluta nem uma certificação que não tenha sido formalmente obtida.' },
        ],
      },
      {
        id: 'compartilhamento',
        title: '9. Compartilhamento de informações',
        blocks: [
          { type: 'paragraph', text: 'O Gym.io não comercializa dados pessoais. As informações podem ser processadas pelos provedores necessários ao funcionamento da aplicação, nos limites das finalidades descritas nesta Política, ou quando houver obrigação legal aplicável.' },
        ],
      },
      {
        id: 'direitos',
        title: '10. Acesso, correção e exclusão',
        blocks: [
          { type: 'paragraph', text: 'Você pode solicitar confirmação do tratamento, acesso, correção de informações incompletas ou desatualizadas e, quando aplicável, exclusão de dados pessoais. A solicitação poderá exigir confirmação de identidade para proteger a conta e será analisada conforme as circunstâncias técnicas e legais pertinentes.' },
          { type: 'paragraph', text: 'O canal atual para solicitações relacionadas a dados pessoais é:' },
          { type: 'link', label: CONTACT_EMAIL, href: privacyRequestHref },
          { type: 'external-links', links: [
            { label: 'Direitos dos titulares — ANPD', href: 'https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares' },
            { label: 'Lei Geral de Proteção de Dados Pessoais', href: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm' },
          ] },
        ],
      },
      {
        id: 'retencao',
        title: '11. Retenção',
        blocks: [
          { type: 'paragraph', text: 'A implementação atual não estabelece um prazo único e automático de retenção para todas as categorias de dados. As informações permanecem associadas à conta enquanto forem necessárias às funcionalidades e finalidades descritas ou até que uma solicitação aplicável seja processada.' },
          { type: 'paragraph', text: 'O prazo de exclusão pode variar conforme a natureza da informação, limitações técnicas, cópias de segurança e eventuais necessidades legais. O Gym.io não promete um período específico que não esteja implementado ou comprovado.' },
        ],
      },
      {
        id: 'alteracoes-contato',
        title: '12. Alterações e contato',
        blocks: [
          { type: 'paragraph', text: 'Esta Política pode ser atualizada para refletir mudanças no Gym.io, em seus provedores ou nas práticas de tratamento. A data da versão vigente será mantida no início do documento.' },
          { type: 'paragraph', text: 'Dúvidas gerais sobre privacidade podem ser encaminhadas para:' },
          { type: 'link', label: CONTACT_EMAIL, href: privacyRequestHref },
        ],
      },
    ],
  },
}

export function getLegalDocument(documentId) {
  return LEGAL_DOCUMENTS[documentId] || LEGAL_DOCUMENTS.terms
}

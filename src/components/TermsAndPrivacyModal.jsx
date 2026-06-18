import { motion } from 'framer-motion'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'

export default function TermsAndPrivacyModal({ open, onClose }) {
  const sections = [
    {
      title: '1. Sobre o Projeto',
      content: `O gym.io é um projeto acadêmico desenvolvido para fins educacionais, estudo de desenvolvimento de software, banco de dados, experiência do usuário e tecnologias web. Embora o sistema possa ser utilizado no dia a dia para organização de treinos, ele não constitui serviço profissional de treinamento físico, acompanhamento médico ou consultoria de saúde.`,
    },
    {
      title: '2. Aceitação dos Termos',
      content: `Ao criar uma conta e utilizar a plataforma, o usuário declara que leu e concorda com esta Política de Privacidade e Termos de Uso.`,
    },
    {
      title: '3. Dados Coletados',
      content: `O sistema poderá armazenar:
      • Nome de usuário
      • Endereço de e-mail
      • Identificador único da conta
      • Treinos cadastrados
      • Exercícios associados aos treinos
      • Histórico de execução dos treinos
      • Informações necessárias para autenticação`,
    },
    {
      title: '4. Finalidade da Coleta',
      content: `Os dados são utilizados exclusivamente para:
      • Permitir autenticação e acesso à conta
      • Armazenar e recuperar treinos
      • Registrar progresso e histórico de utilização
      • Melhorar funcionalidades da plataforma
      • Realizar análises estatísticas de forma anonimizada`,
    },
    {
      title: '5. Segurança',
      content: `O projeto adota medidas técnicas razoáveis para proteção das informações armazenadas, incluindo:
      • Comunicação segura via HTTPS
      • Controle de acesso aos dados
      • Políticas de segurança no banco de dados
      • Serviços de autenticação especializados
      
Apesar dos esforços empregados, nenhum sistema pode garantir segurança absoluta contra falhas, ataques ou eventos imprevistos.`,
    },
    {
      title: '6. Compartilhamento de Dados',
      content: `Os dados cadastrados não são vendidos nem compartilhados com terceiros para fins comerciais. Informações poderão ser utilizadas de forma anonimizada para fins acadêmicos, estatísticos ou de melhoria da plataforma.`,
    },
    {
      title: '7. Responsabilidades do Usuário',
      content: `O usuário compromete-se a:
      • Fornecer informações verdadeiras
      • Manter suas credenciais em sigilo
      • Não tentar acessar contas de terceiros
      • Não explorar vulnerabilidades ou comprometer a integridade do sistema`,
    },
    {
      title: '8. Limitação de Responsabilidade',
      content: `As informações registradas na plataforma possuem caráter organizacional e informativo. O gym.io não substitui orientação de profissionais da saúde, médicos, fisioterapeutas ou educadores físicos. O uso das informações cadastradas é de responsabilidade exclusiva do usuário.`,
    },
    {
      title: '9. Disponibilidade do Serviço',
      content: `Por se tratar de um projeto acadêmico, o sistema poderá sofrer alterações, interrupções, manutenção ou até mesmo descontinuação sem aviso prévio.`,
    },
    {
      title: '10. Alterações desta Política',
      content: `Esta política poderá ser atualizada a qualquer momento para refletir melhorias, novas funcionalidades ou mudanças na estrutura do projeto. O uso continuado da plataforma após alterações implicará concordância com os novos termos.`,
    },
  ]

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader
        title="Política de Privacidade e Termos de Uso"
        subtitle="gym.io - Última atualização: Junho de 2026"
        onClose={onClose}
      />

      <div className="h-[600px] overflow-y-auto px-6 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Header Info */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-slate-700 leading-6"
          >
            Esta política descreve como protegemos seus dados e define seus direitos e responsabilidades ao usar nossa plataforma.
          </motion.p>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 + index * 0.03 }}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200"
              >
                <h3 className="font-semibold text-slate-900 text-sm mb-2">
                  {section.title}
                </h3>
                <p className="text-sm leading-6 text-slate-600 whitespace-pre-line">
                  {section.content}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rounded-lg bg-slate-50 border border-slate-200 p-4 mt-6"
          >
            <p className="text-xs text-slate-700 leading-6">
              <span className="font-semibold text-slate-900">Aviso importante:</span>
              {' '}Ao criar uma conta, você está concordando automaticamente com todos os termos e condições descritos acima. Leia cuidadosamente antes de prosseguir.
            </p>
          </motion.div>
        </motion.div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="px-6 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200"
        >
          Fechar
        </motion.button>
      </div>
    </Modal>
  )
}

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Dumbbell,
  History,
  Layers3,
  LineChart,
  Menu,
  MonitorSmartphone,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Zap,
} from 'lucide-react'
import logoBlueImg from '../assets/images/logo_blue.png'
import mateusProfileImg from '../assets/images/mateus_profile.jpeg'

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const metrics = [
  { value: '6', label: 'fluxos principais', icon: Layers3 },
  { value: '100%', label: 'foco em rotina', icon: CheckCircle2 },
  { value: '24/7', label: 'histórico acessível', icon: Clock3 },
  { value: 'UI', label: 'limpa por padrão', icon: Sparkles },
]

const features = [
  {
    title: 'Treinos personalizados',
    description: 'Crie rotinas com seções, exercicios e organização clara para cada objetivo.',
    icon: Target,
    accent: 'from-blue-100 via-cyan-50 to-white',
  },
  {
    title: 'Organização de workouts',
    description: 'Centralize treinos, dias e próximos passos em uma interface rápida de escanear.',
    icon: CalendarClock,
    accent: 'from-cyan-100 via-blue-50 to-white',
  },
  {
    title: 'Visualização de exercicios',
    description: 'Veja series, cargas e detalhes do treino sem perder contexto durante a sessão.',
    icon: Dumbbell,
    accent: 'from-sky-100 via-white to-blue-50',
  },
  {
    title: 'Acompanhamento de progresso',
    description: 'Indicadores limpos ajudam a entender consistência, volume e evolução.',
    icon: LineChart,
    accent: 'from-blue-50 via-emerald-50 to-white',
  },
  {
    title: 'Historico inteligente',
    description: 'Recupere treinos concluídos e mantenha uma linha do tempo confiável da prática.',
    icon: History,
    accent: 'from-slate-50 via-blue-50 to-white',
  },
  {
    title: 'Gestão de sessão',
    description: 'Controle execução, descanso e continuidade com uma experiência sem atrito.',
    icon: Timer,
    accent: 'from-cyan-50 via-white to-blue-100',
  },
]

const philosophy = [
  'Organizar antes de treinar, sem criar camadas desnecessárias.',
  'Mostrar informação densa quando importa e uma interface leve quando não importa.',
  'Ajudar o usuário a planejar, executar e revisar com o mínimo de atrito.',
]

const creatorPillars = [
  'UX/UI limpo e funcional',
  'Arquitetura Modular',
  'Dados de autenticação seguros',
  'Frameworks para consistência visual',
]

function SectionHeader({ eyebrow, title, description, align = 'center' }) {
  return (
    <motion.div
      className={`mx-auto max-w-3xl ${align === 'center' ? 'text-center' : 'text-left'}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={fadeUp}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{description}</p>}
    </motion.div>
  )
}

function Glow({ className }) {
  return <span className={`pointer-events-none absolute rounded-full blur-3xl ${className}`} aria-hidden />
}

function DashboardPreview({ compact = false }) {
  const rows = ['Push strength', 'Lower body', 'Mobility reset']

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-r from-blue-200/70 via-cyan-100/70 to-white blur-2xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-2xl shadow-blue-900/10">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-300" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 sm:block">
            gym.io/dashboard
          </div>
        </div>

        <div className={`grid gap-0 ${compact ? 'grid-cols-1' : 'lg:grid-cols-[220px_1fr]'}`}>
          {!compact && (
            <aside className="hidden border-r border-slate-200/80 bg-slate-50/70 p-5 lg:block">
              <div className="mb-8 flex items-center gap-3">
                <img src={logoBlueImg} alt="" className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-slate-200/80" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">Gym.io</p>
                  <p className="text-xs text-slate-500">Training workspace</p>
                </div>
              </div>
              {['Painel', 'Treinos', 'Treinar', 'Historico'].map((item, index) => (
                <div
                  key={item}
                  className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    index === 0 ? 'bg-primary-muted text-primary' : 'text-slate-500'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-primary' : 'bg-slate-300'}`} />
                  {item}
                </div>
              ))}
            </aside>
          )}

          <div className="bg-white p-4 sm:p-6 lg:p-8">
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Painel</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Treino de hoje</h3>
              </div>
              <button className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20">
                <Play size={16} fill="currentColor" />
                Iniciar sessão
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Total de treinos', '48', BarChart3],
                ['Esta semana', '4', Activity],
                ['Duração média', '52m', Clock3],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                  <Icon className="mb-4 text-primary" size={20} />
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Push strength</p>
                    <p className="text-xs text-slate-500">Peito, ombros e triceps</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    ativo
                  </span>
                </div>
                {['Supino reto', 'Desenvolvimento', 'Triceps corda'].map((item, index) => (
                  <div key={item} className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 last:mb-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-muted text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium text-slate-700">{item}</p>
                    </div>
                    <p className="text-xs text-slate-400">4 series</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-950">Agenda</p>
                  <CalendarClock size={18} className="text-primary" />
                </div>
                {rows.map((row, index) => (
                  <div key={row} className="mb-4 last:mb-0">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">{row}</span>
                      <span className="text-slate-400">{index + 2}d</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${78 - index * 18}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-6 sm:px-6 lg:px-8">
      <Glow className="left-1/2 top-0 h-80 w-80 -translate-x-1/2 bg-blue-200/80" />
      <Glow className="right-0 top-36 h-72 w-72 bg-cyan-200/70" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between py-4" aria-label="Principal">
        <Link to="/" className="flex items-center gap-3" aria-label="Gym.io inicio">
          <img src={logoBlueImg} alt="" className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-slate-200/80" />
          <span className="text-base font-semibold tracking-tight text-slate-950">Gym.io</span>
        </Link>
        <div className="hidden items-center gap-12 text-sm font-medium text-slate-600 md:flex md:flex-1 md:justify-center md:translate-x-10">
          <a href="#features" className="transition hover:text-primary">Recursos</a>
          <a href="#showcase" className="transition hover:text-primary">Produto</a>
          <a href="#experience" className="transition hover:text-primary">Experiência</a>
          <a href="#creator" className="transition hover:text-primary">Criador</a>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-primary sm:inline-flex">
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-primary-hover"
          >
            Comecar
            <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      <motion.div
        className="relative z-10 mx-auto max-w-7xl pt-20 text-center sm:pt-24 lg:pt-28"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div
          variants={fadeUp}
          className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm shadow-blue-900/5 backdrop-blur"
        >
          Organização de treinos com experiência de produto premium
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="mx-auto max-w-5xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl"
        >
          Treinos organizados com a clareza de um produto moderno.
        </motion.h1>
        <motion.p variants={fadeUp} className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
          Gym.io transforma planejamento, execução e histórico de workouts em uma experiência limpa, rapida e profissional.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/cadastro"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-500/20 transition hover:bg-primary-hover sm:w-auto"
          >
            Criar conta
            <ArrowRight size={17} />
          </Link>
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200 hover:text-primary hover:shadow-md sm:w-auto"
          >
            Ver plataforma
            <ChevronRight size={17} />
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className="relative z-10 mx-auto mt-16 max-w-7xl"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.75, ease: 'easeOut' }}
      >
        <DashboardPreview />
      </motion.div>
    </section>
  )
}

function TrustSection() {
  return (
    <section className="px-5 py-12 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={stagger}
      >
        {metrics.map(({ value, label, icon: Icon }) => (
          <motion.div
            key={label}
            variants={fadeUp}
            className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm shadow-blue-900/5 backdrop-blur transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/10"
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <Icon size={19} />
            </div>
            <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="px-5 py-24 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Recursos"
        title="Tudo que um treino precisa, sem transformar a rotina em planilha."
        description="As ferramentas principais ficam próximas, visuais e prontas para o proximo movimento."
      />
      <motion.div
        className="mx-auto mt-14 grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
      >
        {features.map(({ title, description, icon: Icon, accent }) => (
          <motion.article
            key={title}
            variants={fadeUp}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.25 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-blue-900/5"
          >
            <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${accent}`} aria-hidden />
            <div className="relative">
              <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white text-primary shadow-lg shadow-blue-900/10">
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}

function ShowcaseSection() {
  return (
    <section id="showcase" className="relative overflow-hidden px-5 py-24 sm:px-6 lg:px-8">
      <Glow className="left-10 top-1/2 h-80 w-80 -translate-y-1/2 bg-cyan-100/80" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <SectionHeader
          align="left"
          eyebrow="Dashboard"
          title="Uma visao operacional para treinos reais."
          description="A plataforma prioriza leitura rapida, ações claras e progresso visivel. O resultado é uma interface leve, mesmo quando o treino tem detalhes."
        />
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="relative"
        >
          <DashboardPreview compact />
          <motion.div
            className="absolute -left-4 top-10 hidden rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-2xl shadow-blue-900/10 backdrop-blur md:block"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <p className="text-xs text-slate-500">Consistência</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">+18%</p>
          </motion.div>
          <motion.div
            className="absolute -right-3 bottom-12 hidden rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-2xl shadow-blue-900/10 backdrop-blur md:block"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <p className="text-xs text-slate-500">Sessão atual</p>
            <p className="mt-1 text-sm font-semibold text-primary">12 series concluidas</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function ExperienceSection() {
  return (
    <section id="experience" className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr]">
        <SectionHeader
          align="left"
          eyebrow="Experiência"
          title="Produtividade aplicada ao treino."
          description="Gym.io trata o treino como um fluxo de trabalho pessoal: preparar, executar, registrar e aprender com o que aconteceu."
        />
        <motion.div
          className="space-y-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
        >
          {philosophy.map((item, index) => (
            <motion.div
              key={item}
              variants={fadeUp}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-blue-900/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-sm font-semibold text-primary">
                0{index + 1}
              </span>
              <p className="pt-1 text-base leading-7 text-slate-700">{item}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function ResponsiveSection() {
  return (
    <section className="px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          className="relative order-2 mx-auto h-[620px] w-full max-w-sm lg:order-1"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-b from-blue-200/80 to-cyan-100/80 blur-3xl" aria-hidden />
          <div className="relative h-full overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-blue-900/15">
            <div className="h-full overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <img src={logoBlueImg} alt="" className="h-8 w-8 rounded-lg" />
                  <span className="text-sm font-semibold text-slate-950">Gym.io</span>
                </div>
                <Menu size={19} className="text-slate-500" />
              </div>
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500">Treinar agora</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Upper focus</h3>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Supino reto</span>
                    <span className="rounded-full bg-primary-muted px-2 py-1 text-xs font-semibold text-primary">4/5</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-primary to-cyan-400" />
                  </div>
                </div>
                {['Desenvolvimento', 'Elevação lateral', 'Triceps testa'].map((item) => (
                  <div key={item} className="mt-3 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
        <div className="order-1 lg:order-2">
          <SectionHeader
            align="left"
            eyebrow="Responsivo"
            title="Do planejamento no desktop a execução no celular."
            description="A experiência mantém o mesmo padrão visual em telas grandes e pequenas, com controles previsiveis e foco no que precisa acontecer agora."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [MonitorSmartphone, 'Layout adaptável'],
              [ShieldCheck, 'Fluxos protegidos'],
              [Activity, 'Leitura rapida'],
              [Zap, 'Interações suaves'],
            ].map(([Icon, label]) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm shadow-blue-900/5">
                <Icon size={18} className="text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CreatorSection() {
  return (
    <section id="creator" className="relative overflow-hidden px-5 py-24 sm:px-6 lg:px-8">
      <Glow className="right-20 top-10 h-72 w-72 bg-blue-100/90" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.article
          className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-blue-900/10 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-blue-100 via-cyan-50 to-white" aria-hidden />
          <div className="relative">
            <div className="mb-12 flex items-center gap-4">
              <img
                src={mateusProfileImg}
                alt="Foto de Mateus Monteiro"
                className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-blue-500/20"
              />
              <div>
                <p className="text-lg font-semibold text-slate-950">Mateus Monteiro</p>
                <p className="text-sm text-slate-500">Desenvolvedor e universitário</p>
              </div>
            </div>
            <p className="text-base leading-8 text-slate-700">
              Gym.io nasceu como um projeto para unir treino, organização e tecnologia em uma experiência simples de usar. A ideia foi construir uma plataforma com cara de produto real: fluxos claros, visual consistente e uma base pronta para evoluir.
            </p>
            <div className="mt-8 grid gap-3">
              {creatorPillars.map((pillar) => (
                <div key={pillar} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200/80">
                  <CheckCircle2 size={17} className="text-primary" />
                  {pillar}
                </div>
              ))}
            </div>
          </div>
        </motion.article>

        <div>
          <SectionHeader
            align="left"
            eyebrow="Sobre o projeto"
            title="Um projeto pensado como produto, nao apenas como tela."
            description="A construção prioriza UX, composição visual, componentização e consistência técnica. Cada área existe para reduzir fricção e tornar a gestão de treinos mais clara."
          />
          <motion.div
            className="mt-8 grid gap-4 sm:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={stagger}
          >
            {[
              ['React + Vite', 'Interface rapida e modular.'],
              ['TailwindCSS', 'Sistema visual leve e consistente.'],
              ['Supabase', 'Autenticação e dados integrados.'],
              ['Framer Motion', 'Movimento sútil e premium.'],
            ].map(([title, description]) => (
              <motion.div key={title} variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-blue-900/5">
                <p className="font-semibold text-slate-950">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img src={logoBlueImg} alt="" className="h-9 w-9 rounded-xl shadow-sm ring-1 ring-slate-200/80" />
          <div>
            <p className="font-semibold text-slate-950">Gym.io</p>
            <p className="text-sm text-slate-500">Mateus Monteiro - All rights reserved.</p>
          </div>
        </div>
        <a
          href="https://github.com/MateusMonteiro11"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-primary hover:shadow-md"
        >
          <Code2 size={17} />
          GitHub
        </a>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(20,87,247,0.12),transparent_32%),linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96)_30%,rgba(241,245,249,0.7))]" aria-hidden />
      <div className="relative">
        <Hero />
        <TrustSection />
        <FeaturesSection />
        <ShowcaseSection />
        <ExperienceSection />
        <ResponsiveSection />
        <CreatorSection />
        <Footer />
      </div>
    </main>
  )
}

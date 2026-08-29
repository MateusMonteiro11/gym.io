import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from 'framer-motion'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  History,
  ListChecks,
  Pause,
  Play,
} from 'lucide-react'
import profileImg from '../../../assets/images/mateus_profile.jpeg'

const revealTransition = { duration: .72, ease: [.16, 1, .3, 1] }

const flowStates = [
  {
    label: 'Série 04 de 05',
    title: 'Ação sem ruído.',
    lines: ['Carga e repetição no campo de visão.', 'O exercício continua sendo o centro.', 'O resto sai do caminho.'],
  },
  {
    label: 'Descanso',
    title: 'A pausa também é treino.',
    lines: ['O cronômetro assume a prioridade.', 'O exercício permanece reconhecível.', 'A próxima decisão já está preparada.'],
  },
  {
    label: 'Retorno',
    title: 'Volte sem reconstruir.',
    lines: ['A carga anterior reaparece.', 'A meta continua no mesmo lugar.', 'Você retoma exatamente de onde parou.'],
  },
]

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 34, scale: .988 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: .2 }}
      transition={{ ...revealTransition, delay }}
    >
      {children}
    </motion.div>
  )
}

function SectionEyebrow({ index, children }) {
  return <p className="section-eyebrow"><span>{index}</span>{children}</p>
}

function DescriptionLines({ lines, className = '' }) {
  return (
    <p className={`description-lines ${className}`}>
      {lines.map((line, index) => <span className={`tone-${index + 1}`} key={line}>{line}</span>)}
    </p>
  )
}

function SeriesDots({ active = 4 }) {
  return (
    <div className="series-dots" aria-label={`Série ${active} de 5`}>
      {[1, 2, 3, 4, 5].map((item) => <i className={item <= active ? 'is-complete' : ''} key={item} />)}
      <span>{active} / 5</span>
    </div>
  )
}

function ActiveWorkoutCard({ returning = false }) {
  return (
    <article className={`product-card workout-card${returning ? ' is-returning' : ''}`} aria-label={returning ? 'Retorno ao exercício' : 'Exercício em curso'}>
      <div className="product-card-top">
        <span className="product-status"><i />{returning ? 'RETORNO' : 'EM CURSO'}</span>
        <span>68%</span>
      </div>
      <div className="product-progress" aria-hidden><i /></div>
      <div className="workout-card-heading">
        <div>
          <span>{returning ? 'Exercício retomado' : 'Exercício atual'}</span>
          <h3>Supino reto</h3>
        </div>
        <SeriesDots active={returning ? 5 : 4} />
      </div>
      <div className="workout-metrics">
        <div><span>Carga</span><strong>30 <small>kg</small></strong></div>
        <div><span>Repetições</span><strong>8</strong></div>
        <div><span>Descanso</span><strong>60 <small>s</small></strong></div>
      </div>
      {returning && <div className="previous-load"><History size={16} /><span>Última série</span><strong>30 kg · 8 reps</strong></div>}
      <div className="product-primary-action"><Check size={18} />{returning ? 'Concluir exercício' : 'Concluir série 4'}</div>
      <div className="product-next-row">
        <div><span>Próximo exercício</span><strong>Crucifixo inclinado</strong></div>
        <span>3 × 10 · 24 kg</span>
      </div>
    </article>
  )
}

function RestWorkoutCard() {
  return (
    <article className="product-card rest-card" aria-label="Descanso entre séries">
      <div className="product-card-top">
        <span className="product-status"><i />DESCANSO</span>
        <span>SÉRIE 05</span>
      </div>
      <div className="rest-card-body">
        <Clock3 size={21} />
        <span>Recupere-se para a próxima série</span>
        <strong>00:42</strong>
        <p>Próxima: <b>Supino reto · série 5 de 5</b></p>
      </div>
      <div className="rest-progress" aria-hidden><i /></div>
      <div className="rest-actions">
        <div>+15s</div><div><Pause size={16} /> Pausar treino</div>
      </div>
      <div className="rest-skip"><Play size={14} /> Pular descanso</div>
    </article>
  )
}

function FlowProductCard({ stage }) {
  return stage === 1 ? <RestWorkoutCard /> : <ActiveWorkoutCard returning={stage === 2} />
}

function FlowStory({ stage }) {
  const current = flowStates[stage]
  return (
    <motion.div
      key={current.label}
      className="flow-story"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: .42, ease: [.16, 1, .3, 1] }}
    >
      <span>{current.label}</span>
      <h2>{current.title}</h2>
      <DescriptionLines lines={current.lines} />
    </motion.div>
  )
}

export function HeroSection() {
  return (
    <section className="hero" data-ribbon-chapter="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12, ...revealTransition }} className="hero-eyebrow">
          Treinar é contínuo.
        </motion.p>
        <h1 id="hero-title">
          <span className="hero-line-mask"><motion.span initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ delay: .12, duration: .92, ease: [.16, 1, .3, 1] }}>Seu treino</motion.span></span>
          <span className="hero-line-mask"><motion.span initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ delay: .22, duration: .96, ease: [.16, 1, .3, 1] }}>deixa um <em>rastro.</em></motion.span></span>
        </h1>
        <motion.div className="hero-description" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .58, ...revealTransition }}>
          <DescriptionLines lines={['Planeje sem ruído.', 'Execute sem perder o ritmo.', 'Volte sempre com contexto.']} />
        </motion.div>
        <motion.div className="hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .7, ...revealTransition }}>
          <Link to="/cadastro" className="primary-link">Começar agora <ArrowUpRight size={18} /></Link>
          <a href="#flow" className="secondary-link">Siga o rastro <ArrowDown size={17} /></a>
        </motion.div>
      </div>
      <motion.div
        className="hero-session-data"
        aria-label="Sessão em curso: Supino reto, série 4 de 5, 30 quilos, 10 repetições, descanso de 42 segundos, carga anterior de 10 quilos."
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: .32, duration: .88, ease: [.16, 1, .3, 1] }}
      >
        <div className="hero-data-node hero-data-exercise" data-ribbon-data-anchor="exercise" aria-hidden>
          <span><i />SESSÃO EM CURSO</span>
          <strong>Supino reto</strong>
          <small>10 REP</small>
        </div>
        <div className="hero-data-node hero-data-series" data-ribbon-data-anchor="series" aria-hidden>
          <span>SÉRIE ATUAL</span>
          <strong>04 <small>/ 05</small></strong>
        </div>
        <div className="hero-data-node hero-data-previous" data-ribbon-data-anchor="previous" aria-hidden>
          <span>ANTERIOR</span>
          <strong>30 kg</strong>
        </div>
      </motion.div>
    </section>
  )
}

export function TrainingFlowSection() {
  const sectionRef = useRef(null)
  const [stage, setStage] = useState(0)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = value < .34 ? 0 : value < .67 ? 1 : 2
    setStage((current) => current === next ? current : next)
  })

  return (
    <section className="training-flow" id="flow" ref={sectionRef} data-ribbon-chapter="flow" aria-labelledby="flow-title">
      <div className="flow-sticky section-shell">
        <div className="flow-copy-column">
          <SectionEyebrow index="01">Durante o treino</SectionEyebrow>
          <div className="desktop-flow-story" aria-live="polite">
            <AnimatePresence mode="wait"><FlowStory stage={stage} /></AnimatePresence>
          </div>
          <div className="flow-steps" aria-hidden>
            {flowStates.map((state, index) => <i className={stage === index ? 'is-active' : ''} key={state.label} />)}
          </div>
        </div>
        <div className="flow-product-column">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 28, scale: .975 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: .985 }}
              transition={{ duration: .42, ease: [.16, 1, .3, 1] }}
            >
              <FlowProductCard stage={stage} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="flow-mobile section-shell">
        <SectionEyebrow index="01">Durante o treino</SectionEyebrow>
        {flowStates.map((state, index) => (
          <Reveal className="flow-mobile-step" key={state.label}>
            <FlowStory stage={index} />
            <FlowProductCard stage={index} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function MemoryCard() {
  return (
    <article className="product-card memory-card" aria-label="Memória do exercício">
      <div className="product-card-top"><span>SUPINO RETO</span><History size={17} /></div>
      <div className="memory-row">
        <div><span>Última sessão</span><strong>10 <small>kg</small></strong><p>5 × 8 · concluído</p></div>
        <ChevronRight size={20} aria-hidden />
        <div className="is-current"><span>Hoje</span><strong>30 <small>kg</small></strong><p>4 de 5 séries</p></div>
      </div>
      <div className="memory-context"><i /><span>O próximo treino começa com a referência certa.</span></div>
    </article>
  )
}

export function ProgressionSection() {
  return (
    <section className="progress-section section-shell" id="progress" data-ribbon-chapter="progress" aria-labelledby="progress-title">
      <Reveal className="progress-copy">
        <SectionEyebrow index="02">Depois do treino</SectionEyebrow>
        <h2 id="progress-title">
          O esforço passa.
          <em><span>O contexto</span>{' '}<span>fica.</span></em>
        </h2>
        <DescriptionLines lines={['Cada sessão preserva uma referência.', 'Você enxerga de onde está partindo.', 'E sabe exatamente como continuar.']} />
      </Reveal>
      <Reveal className="progress-product" delay={.08}><MemoryCard /></Reveal>
    </section>
  )
}

function PlanPreview() {
  return (
    <article className="product-card capability-preview plan-preview">
      <div className="product-card-top"><span>ROTINA DE TREINO</span><ListChecks size={18} /></div>
      <div className="plan-section-title"><span>Seção 01</span><strong>Peito</strong><small>2 exercícios</small></div>
      <div className="exercise-row"><div><strong>Supino reto</strong><span>4 séries · 8 reps</span></div><b>01</b></div>
      <div className="exercise-row"><div><strong>Crucifixo inclinado</strong><span>3 séries · 10 reps</span></div><b>02</b></div>
      <div className="preview-action">Organização pronta</div>
    </article>
  )
}

function ExecutePreview() {
  return (
    <article className="product-card capability-preview execute-preview">
      <div className="product-card-top"><span>EXERCÍCIO ATUAL</span><span>04 / 05</span></div>
      <div className="mini-progress"><i /><i /><i /><i /><i /></div>
      <h3>Supino reto</h3>
      <div className="execute-numbers"><div><strong>30</strong><span>kg</span></div><div><strong>8</strong><span>reps</span></div></div>
      <div className="preview-action is-blue"><Check size={17} />Concluir série</div>
    </article>
  )
}

function RememberPreview() {
  return (
    <article className="product-card capability-preview remember-preview">
      <div className="product-card-top"><span>HISTÓRICO</span><History size={18} /></div>
      <div className="history-entry"><span>Supino reto</span><strong>10 kg</strong><small>5 × 8 · concluído</small></div>
      <div className="history-entry is-current"><span>Supino reto</span><strong>30 kg</strong><small>Referência atual</small></div>
      <div className="memory-note"><i />Contexto preservado</div>
    </article>
  )
}

const capabilities = [
  { index: '01', title: 'Planejar.', lines: ['Monte a rotina antes do treino.', 'Organize seções e exercícios.', 'Chegue sabendo o próximo passo.'], Preview: PlanPreview },
  { index: '02', title: 'Executar.', lines: ['Veja apenas o que importa agora.', 'Registre sem abandonar a sessão.', 'Descanse sem perder o exercício.'], Preview: ExecutePreview },
  { index: '03', title: 'Lembrar.', lines: ['Guarde o que realmente aconteceu.', 'Recupere carga, séries e contexto.', 'Continue sem começar do zero.'], Preview: RememberPreview },
]

export function CapabilitiesSection() {
  return (
    <section className="capabilities-section section-shell" id="capabilities" data-ribbon-chapter="capabilities" aria-labelledby="capabilities-title">
      <Reveal className="capabilities-heading">
        <SectionEyebrow index="03">O produto</SectionEyebrow>
        <h2 id="capabilities-title">Uma ferramenta.<br />Três movimentos.</h2>
      </Reveal>
      <div className="capability-blocks">
        {capabilities.map(({ index, title, lines, Preview }, itemIndex) => (
          <Reveal className={`capability-block${itemIndex % 2 ? ' is-reversed' : ''}`} key={title}>
            <div className="capability-copy"><span>{index}</span><h3>{title}</h3><DescriptionLines lines={lines} /></div>
            <Preview />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export function CreatorStory() {
  return (
    <section className="creator-section section-shell" id="creator" data-ribbon-chapter="creator" aria-labelledby="creator-title">
      <Reveal className="creator-photo"><img src={profileImg} alt="Mateus Monteiro, criador do Gym.io" /></Reveal>
      <Reveal className="creator-copy" delay={.08}>
        <SectionEyebrow index="04">Criador</SectionEyebrow>
        <h2 id="creator-title">Mateus<br />Monteiro.</h2>
        <DescriptionLines lines={['Produto, interface e arquitetura.', 'Decisões construídas como um sistema.', 'Uma ferramenta que respeita quem treina.']} />
        <a href="https://mateusmonteiro.dev/" target="_blank" rel="noreferrer">Conhecer o trabalho <ArrowUpRight size={17} /></a>
      </Reveal>
    </section>
  )
}

export function FinalCall() {
  return (
    <section className="final-call section-shell" id="cta" data-ribbon-chapter="cta" aria-labelledby="final-title">
      <Reveal>
        <span>Seu próximo treino</span>
        <h2 id="final-title">Começa daqui.<br />Continua de onde parou.</h2>
        <Link to="/cadastro">Criar minha conta <ArrowUpRight size={20} /></Link>
      </Reveal>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <a href="#top" className="footer-brand">Gym.io <span>↑</span></a>
      <p>Planeje, execute e lembre. </p>
      <div><Link to="/login">Entrar</Link><Link to="/cadastro">Começar</Link><span>Gym.io © 2026</span></div>
    </footer>
  )
}

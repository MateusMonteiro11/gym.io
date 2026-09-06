import { Link } from 'react-router-dom'
import logoBlueImg from '../../assets/images/logo_blue.png'
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  FOOTER_SUPPORT_LINKS,
} from './publicContent'
import PublicHashLink from './PublicHashLink'

function FooterRouteLinks({ links }) {
  return links.map((link) => (
    <li key={link.to}>
      {link.to.startsWith('/#')
        ? <PublicHashLink to={link.to}>{link.label}</PublicHashLink>
        : <Link to={link.to}>{link.label}</Link>}
    </li>
  ))
}

export default function InstitutionalFooter({ authState } = {}) {
  return (
    <footer className="institutional-footer" aria-labelledby="institutional-footer-title">
      <div className="institutional-footer-main section-shell">
        <div className="institutional-footer-brand">
          <PublicHashLink to="/#top" className="institutional-footer-logo" aria-label="Gym.io — voltar ao início">
            <img src={logoBlueImg} alt="" />
            <span id="institutional-footer-title">Gym.io</span>
          </PublicHashLink>
          <p>Uma experiência simples e intuitiva para organizar, executar e acompanhar seus treinos.</p>
        </div>

        <nav className="institutional-footer-nav" aria-label="Navegação do rodapé">
          <div>
            <h2>Produto</h2>
            <ul><FooterRouteLinks links={FOOTER_PRODUCT_LINKS} /></ul>
          </div>
          <div>
            <h2>Suporte</h2>
            <ul>
              {FOOTER_SUPPORT_LINKS.map((link) => (
                <li key={link.href}><a href={link.href}>{link.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Legal</h2>
            <ul><FooterRouteLinks links={FOOTER_LEGAL_LINKS} /></ul>
          </div>
        </nav>

        <nav className="institutional-footer-actions" aria-label="Acessar o Gym.io">
          <Link to="/login" state={authState} className="institutional-footer-secondary">Entrar</Link>
          <Link to="/cadastro" state={authState} className="institutional-footer-primary">Começar</Link>
        </nav>
      </div>

      <div className="institutional-footer-bottom section-shell">
        <p>© 2026 Gym.io. Todos os direitos reservados.</p>
        <p>Projeto em desenvolvimento. Funcionalidades e disponibilidade podem mudar ao longo do tempo.</p>
      </div>
    </footer>
  )
}

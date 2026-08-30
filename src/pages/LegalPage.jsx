import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import LandingHeader from '../features/landing/sections/LandingHeader'
import '../features/landing/landing.css'
import InstitutionalFooter from '../features/publicSite/InstitutionalFooter'
import LegalDocumentContent from '../features/publicSite/LegalDocumentContent'
import { getLegalDocument, LEGAL_LAST_UPDATED } from '../features/publicSite/legalDocuments'

export default function LegalPage({ documentId }) {
  const legalDocument = getLegalDocument(documentId)

  useEffect(() => {
    window.scrollTo(0, 0)
    globalThis.document.title = `${legalDocument.title} | Gym.io`
  }, [legalDocument.title])

  return (
    <div className="landing legal-page" id="top">
      <LandingHeader />
      <main className="legal-page-main">
        <article className="legal-article">
          <nav className="legal-back-nav" aria-label="Voltar ao Gym.io">
            <Link to="/"><ArrowLeft size={16} aria-hidden /> Voltar ao Gym.io</Link>
          </nav>
          <header className="legal-article-header">
            <p>Gym.io · Documento institucional</p>
            <h1>{legalDocument.title}</h1>
            <div>
              <span>Última atualização</span>
              <time dateTime="2026-08-29">{LEGAL_LAST_UPDATED}</time>
            </div>
            <p>{legalDocument.intro}</p>
          </header>
          <LegalDocumentContent document={legalDocument} />
        </article>
      </main>
      <InstitutionalFooter />
    </div>
  )
}

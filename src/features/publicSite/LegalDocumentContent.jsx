import { Link } from 'react-router-dom'

function LegalLink({ href, children }) {
  if (href.startsWith('/')) {
    return <Link to={href}>{children}</Link>
  }

  const external = href.startsWith('http')
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {children}
    </a>
  )
}

function LegalBlock({ block }) {
  if (block.type === 'list') {
    return (
      <ul>
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    )
  }

  if (block.type === 'link') {
    return <p className="legal-document-link"><LegalLink href={block.href}>{block.label}</LegalLink></p>
  }

  if (block.type === 'external-links') {
    return (
      <nav className="legal-reference-links" aria-label="Referências sobre proteção de dados">
        {block.links.map((link) => (
          <LegalLink href={link.href} key={link.href}>{link.label}</LegalLink>
        ))}
      </nav>
    )
  }

  return <p>{block.text}</p>
}

export default function LegalDocumentContent({ document, compact = false }) {
  return (
    <div className={`legal-document-content${compact ? ' is-compact' : ''}`}>
      {document.sections.map((section) => (
        <section id={compact ? undefined : section.id} key={section.id}>
          <h2>{section.title}</h2>
          {section.blocks.map((block, index) => (
            <LegalBlock block={block} key={`${section.id}-${block.type}-${index}`} />
          ))}
        </section>
      ))}
    </div>
  )
}

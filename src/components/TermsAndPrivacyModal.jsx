import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Modal from './ui/Modal'
import ModalHeader from './ui/ModalHeader'
import LegalDocumentContent from '../features/publicSite/LegalDocumentContent'
import {
  getLegalDocument,
  LEGAL_DOCUMENTS,
  LEGAL_LAST_UPDATED,
} from '../features/publicSite/legalDocuments'

const documentTabs = [LEGAL_DOCUMENTS.terms, LEGAL_DOCUMENTS.privacy]

export default function TermsAndPrivacyModal({ open, onClose, initialDocument = 'terms' }) {
  const [activeDocument, setActiveDocument] = useState(initialDocument)
  const scrollRef = useRef(null)
  const legalDocument = getLegalDocument(activeDocument)

  useEffect(() => {
    if (open) setActiveDocument(initialDocument)
  }, [initialDocument, open])

  function selectDocument(documentId) {
    setActiveDocument(documentId)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  function handleTabKeyDown(event, currentIndex) {
    const lastIndex = documentTabs.length - 1
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight') nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1
    else if (event.key === 'ArrowLeft') nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = lastIndex
    else return

    event.preventDefault()
    const nextDocument = documentTabs[nextIndex]
    selectDocument(nextDocument.id)
    document.getElementById(`legal-tab-${nextDocument.id}`)?.focus()
  }

  return (
    <Modal ariaLabel="Documentos jurídicos" open={open} onClose={onClose} size="xl" className="flex max-h-[90vh] flex-col overflow-hidden">
      <ModalHeader
        title="Documentos jurídicos"
        subtitle={`Gym.io · Última atualização: ${LEGAL_LAST_UPDATED}`}
        onClose={onClose}
      />

      <div className="border-b border-slate-200 bg-slate-50 px-6 pt-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex gap-1" role="tablist" aria-label="Documentos jurídicos">
          {documentTabs.map((document, index) => {
            const selected = activeDocument === document.id
            return (
              <button
                key={document.id}
                type="button"
                role="tab"
                id={`legal-tab-${document.id}`}
                aria-selected={selected}
                aria-controls={`legal-panel-${document.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectDocument(document.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`relative min-h-11 rounded-t-lg px-4 text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-white text-primary dark:bg-slate-800 dark:text-blue-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {document.title}
                {selected && <motion.i layoutId="legal-active-tab" className="absolute inset-x-3 bottom-0 h-0.5 bg-primary" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-6 dark:bg-slate-800" ref={scrollRef}>
        <motion.article
          role="tabpanel"
          id={`legal-panel-${legalDocument.id}`}
          aria-labelledby={`legal-tab-${legalDocument.id}`}
          key={legalDocument.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="legal-modal-document"
        >
          <header>
            <h2>{legalDocument.title}</h2>
            <p>{legalDocument.intro}</p>
          </header>
          <LegalDocumentContent document={legalDocument} compact />
        </motion.article>
      </div>

      <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Fechar
        </button>
      </div>
    </Modal>
  )
}

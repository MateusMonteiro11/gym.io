import assert from 'node:assert/strict'
import test from 'node:test'
import { LEGAL_DOCUMENTS, LEGAL_LAST_UPDATED } from './legalDocuments.js'
import {
  FAQ_ITEMS,
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  FOOTER_SUPPORT_LINKS,
} from './publicContent.js'

test('keeps Terms and Privacy as independent public documents', () => {
  assert.equal(LEGAL_DOCUMENTS.terms.path, '/termos')
  assert.equal(LEGAL_DOCUMENTS.privacy.path, '/privacidade')
  assert.notEqual(LEGAL_DOCUMENTS.terms.sections, LEGAL_DOCUMENTS.privacy.sections)
  assert.equal(LEGAL_LAST_UPDATED, '29 de agosto de 2026')
})

test('keeps use rules in Terms and personal-data subjects in Privacy', () => {
  const termsSections = new Set(LEGAL_DOCUMENTS.terms.sections.map((section) => section.id))
  const privacySections = new Set(LEGAL_DOCUMENTS.privacy.sections.map((section) => section.id))

  for (const section of ['uso-permitido', 'condutas-proibidas', 'gratuidade', 'suspensao']) {
    assert.equal(termsSections.has(section), true)
    assert.equal(privacySections.has(section), false)
  }

  for (const section of ['informacoes-coletadas', 'armazenamento-local', 'direitos', 'retencao']) {
    assert.equal(privacySections.has(section), true)
    assert.equal(termsSections.has(section), false)
  }
})

test('publishes the six approved FAQ entries with stable anchors', () => {
  assert.equal(FAQ_ITEMS.length, 6)
  assert.equal(new Set(FAQ_ITEMS.map((item) => item.id)).size, 6)
  assert.ok(FAQ_ITEMS.every((item) => item.question && item.paragraphs.length > 0))
})

test('footer destinations are real routes, anchors or contact actions', () => {
  assert.deepEqual(
    FOOTER_PRODUCT_LINKS.map((link) => link.to),
    ['/#top', '/#capabilities', '/#flow', '/#faq'],
  )
  assert.deepEqual(
    FOOTER_LEGAL_LINKS.map((link) => link.to),
    ['/termos', '/privacidade'],
  )
  assert.equal(FOOTER_SUPPORT_LINKS.length, 2)
  assert.ok(FOOTER_SUPPORT_LINKS.every((link) => link.href.startsWith('mailto:contato@mateusmonteiro.dev?subject=')))
})

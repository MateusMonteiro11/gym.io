export function getStaticOffsetTop(element) {
  let top = 0
  let current = element

  while (current) {
    top += current.offsetTop ?? 0
    current = current.offsetParent
  }

  return top
}

export function getStaticPageTop(element, rootTop, scrollY = window.scrollY) {
  const owningChapter = element.closest?.('[data-ribbon-chapter]')
  if (!owningChapter) {
    return element.getBoundingClientRect().top + scrollY - rootTop
  }

  const chapterTop = owningChapter.getBoundingClientRect().top + scrollY - rootTop
  const localTop = getStaticOffsetTop(element) - getStaticOffsetTop(owningChapter)
  return chapterTop + localTop
}

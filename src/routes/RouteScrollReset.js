import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { shouldResetRouteScroll } from './routeScroll'

export default function RouteScrollReset() {
  const { pathname, hash } = useLocation()
  const previousPathnameRef = useRef(null)

  useLayoutEffect(() => {
    const shouldReset = shouldResetRouteScroll({
      pathname,
      hash,
      previousPathname: previousPathnameRef.current,
    })

    previousPathnameRef.current = pathname

    if (!shouldReset) return

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }, [pathname, hash])

  return null
}

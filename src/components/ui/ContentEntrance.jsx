import { motion, useReducedMotion } from 'framer-motion'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { appEntrance } from './appMotion'

const PageMotionContext = createContext(null)

export function PageMotionProvider({ pageKey, children }) {
  const visited = useMemo(() => new Set(), [pageKey])
  return <PageMotionContext.Provider value={visited}>{children}</PageMotionContext.Provider>
}

export default function ContentEntrance({ as = 'div', index = 0, replay = false, children, ...props }) {
  const reducedMotion = useReducedMotion()
  const visited = useContext(PageMotionContext)
  const [firstVisit] = useState(() => replay || !visited?.has(index))
  useEffect(() => { visited?.add(index) }, [visited, index])
  const Component = motion[as]
  return <Component {...appEntrance(reducedMotion || !firstVisit, index)} {...props}>{children}</Component>
}

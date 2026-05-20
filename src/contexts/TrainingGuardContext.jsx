import { createContext, useContext, useState, useCallback } from 'react'

const TrainingGuardContext = createContext(null)

export function TrainingGuardProvider({ children }) {
  const [hasActiveTraining, setHasActiveTraining] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)

  const startTraining = useCallback(() => {
    setHasActiveTraining(true)
  }, [])

  const stopTraining = useCallback(() => {
    setHasActiveTraining(false)
    setPendingNavigation(null)
  }, [])

  const setPending = useCallback((nav) => {
    setPendingNavigation(nav)
  }, [])

  return (
    <TrainingGuardContext.Provider
      value={{
        hasActiveTraining,
        startTraining,
        stopTraining,
        pendingNavigation,
        setPending,
      }}
    >
      {children}
    </TrainingGuardContext.Provider>
  )
}

export function useTrainingGuard() {
  const ctx = useContext(TrainingGuardContext)
  if (!ctx) {
    throw new Error('useTrainingGuard must be used within TrainingGuardProvider')
  }
  return ctx
}

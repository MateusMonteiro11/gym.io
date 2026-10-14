import { useEffect, useLayoutEffect, useState } from 'react'
import { createQuickWorkoutController, quickControlState } from '../services/push/quickWorkoutControls.js'

export function useQuickWorkoutControls(snapshot) {
  const [operation, setOperation] = useState({ busy: false, feedback: '' })
  const [controller] = useState(() => createQuickWorkoutController((next) =>
    setOperation((previous) => ({ ...previous, ...next }))))
  useLayoutEffect(() => { controller.update(snapshot) })
  useEffect(() => {
    controller.mount()
    return () => controller.unmount()
  }, [controller])
  return { ...operation, state: quickControlState(snapshot),
    execute: controller.execute, clearFeedback: () => setOperation((previous) => ({ ...previous, feedback: '' })) }
}

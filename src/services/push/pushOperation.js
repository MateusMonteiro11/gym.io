export async function runPushOperation({ action, setState, isCurrent }) {
  setState((value) => ({ ...value, busy: true, error: null }))

  try {
    const result = await action()
    if (isCurrent()) setState((value) => ({ ...value, ...result }))
    return result
  } catch (error) {
    if (isCurrent()) {
      setState((value) => ({
        ...value,
        status: 'error',
        error:
          error?.message === 'push_not_configured'
            ? 'push_not_configured'
            : 'push_operation_failed',
      }))
    }
    return null
  } finally {
    if (isCurrent()) setState((value) => ({ ...value, busy: false }))
  }
}

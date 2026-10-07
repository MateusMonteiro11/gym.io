import { bounded } from '../push/pushUtils.js'

export async function logoutWithPushCleanup({ cleanup, signOut, onSignedOut, timeoutMs = 10000 }) {
  let warnings = []
  try { warnings = (await bounded(cleanup, timeoutMs))?.warnings ?? [] }
  catch { warnings = ['push_cleanup_failed'] }
  // Push failures must never prevent the existing Auth logout.
  const { error } = await signOut()
  if (error) throw error
  onSignedOut?.()
  return { warnings }
}

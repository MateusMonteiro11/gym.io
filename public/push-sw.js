const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value)
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const canonicalId = (value) => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01') return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function validReminder(value) {
  return exact(value, ['version', 'type', 'reminder_id', 'date', 'reminder_type', 'workout_name', 'data']) &&
    value.version === 2 && value.type === 'scheduled_workout_reminder' && UUID.test(value.reminder_id ?? '') && validDate(value.date) &&
    ['no_horario', 'um_dia_antes', 'dois_dias_antes'].includes(value.reminder_type) &&
    typeof value.workout_name === 'string' && Boolean(value.workout_name.trim()) &&
    Array.from(value.workout_name).length <= 80 && !/[\u0000-\u001f\u007f]/.test(value.workout_name) &&
    exact(value.data, ['url']) && value.data.url === `/treinar?date=${value.date}`
}
function validCompletion(value) {
  return exact(value, ['version', 'type', 'id_sessao', 'id_historico']) && value.version === 1 &&
    value.type === 'workout_session_completed' && UUID.test(value.id_sessao ?? '') &&
    (value.id_historico === null || canonicalId(value.id_historico))
}
function validRestFinished(value) {
  return exact(value, ['version', 'type', 'session_id', 'workout_id']) && value.version === 1 &&
    value.type === 'rest_finished' && UUID.test(value.session_id ?? '') && canonicalId(value.workout_id)
}
function reminderPresentation(value) {
  return {
    title: value.reminder_type === 'no_horario' ? 'Hora de treinar' : 'Treino agendado',
    body: `${value.reminder_type === 'um_dia_antes' ? 'Amanhã · ' : value.reminder_type === 'dois_dias_antes' ? 'Em 2 dias · ' : ''}${value.workout_name}`,
  }
}
function validConfirmation(value) {
  return exact(value, ['version', 'type', 'appointment_id', 'date', 'time']) && value.version === 1 &&
    value.type === 'appointment_scheduled' && canonicalId(value.appointment_id) && validDate(value.date) &&
    (value.time === null || typeof value.time === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value.time))
}
function notificationRoute(notification) {
  const data = notification.data
  if (data?.kind === 'rest' && UUID.test(data.sessionId ?? '') && canonicalId(data.workoutId) &&
      notification.tag === `gymio-rest-${data.sessionId}` && data.url === `/treinar/${data.workoutId}`) return data.url
  if (data?.kind === 'schedule' && UUID.test(data.reminderId ?? '') && validDate(data.date) && notification.tag === `gymio-reminder-${data.reminderId}` &&
      data.url === `/treinar?date=${data.date}`) return `/treinar?date=${data.date}`
  if (data?.kind === 'schedule_confirmation' && canonicalId(data.appointmentId) && validDate(data.date) &&
      notification.tag === `gymio-schedule-confirmation-${data.appointmentId}` && data.url === `/treinar?date=${data.date}`) return data.url
  if (data?.kind === 'complete' && UUID.test(data.sessionId ?? '') &&
      notification.tag === `gymio-workout-complete-${data.sessionId}`) {
    if (data.url === '/historico?period=all') return data.url
    const match = /^\/historico\?period=all&workout=([1-9][0-9]*)$/.exec(data.url ?? '')
    if (match && canonicalId(match[1])) return data.url
  }
  if (notification.tag === 'gymio-push-test' && data?.url === '/dashboard') return '/dashboard'
  return null
}

function createNotificationStore(factory) {
  let database
  const open = () => database ??= new Promise((resolve, reject) => {
    if (!factory) return reject(Error('storage_unavailable'))
    const request = factory.open('gymio-workout-notification-receipts', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      const store = db.objectStoreNames.contains('markers')
        ? request.transaction.objectStore('markers') : db.createObjectStore('markers')
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const row = cursor.result
        if (!row) return
        if (row.key !== 'enabled' && !String(row.key).startsWith('complete:') && !String(row.key).startsWith('schedule:')) row.delete()
        row.continue()
      }
    }
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
    request.onerror = request.onblocked = () => reject(Error('storage_unavailable'))
  })
  const transaction = async (operation) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('markers', 'readwrite'), store = tx.objectStore('markers')
      let result
      const get = key => new Promise((done, fail) => {
        const request = store.get(key)
        request.onsuccess = () => done(request.result)
        request.onerror = () => fail(Error('storage_unavailable'))
      })
      tx.oncomplete = () => resolve(result)
      tx.onerror = tx.onabort = () => reject(Error('storage_unavailable'))
      Promise.resolve(operation(store, get)).then(value => { result = value }, () => { try { tx.abort() } catch {} })
    })
  }
  return {
    scope: () => transaction(async (store, get) => {
      if (await get('enabled') === false) return null
      let scope = await get('scope')
      if (!scope) { scope = crypto.randomUUID(); store.put(scope, 'scope') }
      return scope
    }),
    enabled: () => transaction(async (_store, get) => await get('enabled') !== false),
    restAllowed: sessionId => transaction(async (_store, get) =>
      await get('enabled') !== false && !await get(`complete:${sessionId}`)),
    reserve: (id, scope, kind = 'complete') => transaction(async (store, get) => {
      if (!['complete', 'schedule'].includes(kind)) return false
      const [enabled, current, seen] = await Promise.all([get('enabled'), get('scope'), get(`${kind}:${id}`)])
      if (enabled === false || !scope || scope !== current || seen) return false
      store.put(true, `${kind}:${id}`)
      return true
    }),
    setEnabled: enabled => transaction(async store => {
      store.put(enabled, 'enabled')
      store.put(crypto.randomUUID(), 'scope')
    }),
  }
}
function createNotificationProcessor({ store, registration }) {
  let queue = Promise.resolve(), disabled = false
  const serialized = operation => {
    const result = queue.then(operation).catch(() => false)
    queue = result.then(() => undefined)
    return result
  }
  const show = (title, options) => registration.showNotification(title, {
    icon: '/push-icon-192.png', badge: '/push-icon-192.png', silent: false, ...options,
  })
  const closeRest = async sessionId => {
    try { for (const card of await registration.getNotifications({ tag: `gymio-rest-${sessionId}` })) {
      if (card.tag === `gymio-rest-${sessionId}`) card.close()
    } } catch { /* Presentation cleanup is best-effort. */ }
  }
  return {
    scope: () => serialized(() => disabled ? null : store.scope()),
    rest: value => serialized(async () => {
      if (!validRestFinished(value) || disabled || !await store.restAllowed(value.session_id) || disabled) return false
      const publicationId = crypto.randomUUID(), tag = `gymio-rest-${value.session_id}`
      const prototype = typeof Notification === 'function' ? Notification.prototype : null
      const attention = {
        ...('renotify' in (prototype ?? {}) ? { renotify: true } : {}),
        ...('vibrate' in (prototype ?? {}) ? { vibrate: [200] } : {}),
      }
      try {
        await show('Descanso concluído', { tag, silent: false, ...attention,
          data: { kind: 'rest', sessionId: value.session_id, workoutId: value.workout_id,
            url: `/treinar/${value.workout_id}`, publicationId } })
      } catch { return false }
      try {
        const cards = (await registration.getNotifications({ tag })).filter(card => card.tag === tag)
        const latest = cards.find(card => card.data?.publicationId === publicationId)
        if (latest) for (const card of cards) if (card !== latest) card.close()
      } catch { /* Cannot verify coalescing when enumeration is unavailable. */ }
      if (disabled || !await store.restAllowed(value.session_id)) { await closeRest(value.session_id); return false }
      return true
    }),
    reminder: value => serialized(async () => {
      if (!validReminder(value) || disabled || !await store.enabled()) return false
      const { title, body } = reminderPresentation(value)
      await show(title, { body, tag: `gymio-reminder-${value.reminder_id}`,
        data: { kind: 'schedule', reminderId: value.reminder_id, date: value.date, url: `/treinar?date=${value.date}` } })
      return true
    }),
    confirm: (value, scope) => serialized(async () => {
      if (!validConfirmation(value) || disabled || !await store.reserve(value.appointment_id, scope, 'schedule') || disabled) return false
      const date = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
        .format(new Date(`${value.date}T12:00:00Z`))
      await show('Treino agendado', { body: `${date}${value.time ? ` · ${value.time}` : ''}`,
        tag: `gymio-schedule-confirmation-${value.appointment_id}`, data: { kind: 'schedule_confirmation',
          appointmentId: value.appointment_id, date: value.date, url: `/treinar?date=${value.date}` } })
      return true
    }),
    complete: (value, scope) => serialized(async () => {
      if (!validCompletion(value) || disabled || !await store.enabled()) return false
      const current = await store.scope()
      if (!scope || scope !== current) return false
      await closeRest(value.id_sessao)
      if (!await store.reserve(value.id_sessao, scope) || disabled) return false
      await show('Treino concluído', { body: 'Veja seu progresso',
        tag: `gymio-workout-complete-${value.id_sessao}`, data: { kind: 'complete', sessionId: value.id_sessao,
          url: `/historico?period=all${value.id_historico ? `&workout=${value.id_historico}` : ''}` } })
      await closeRest(value.id_sessao)
      return true
    }),
    diagnostic: value => serialized(async () => {
      if (disabled || !await store.enabled()) return false
      if (!exact(value, ['version', 'type', 'title', 'body', 'data']) || value.version !== 1 ||
          value.type !== 'test' || value.title !== 'Gym.io' || value.body !== 'Notificações de treino ativadas.' ||
          !exact(value.data, ['url']) || value.data.url !== '/dashboard') return false
      await show(value.title, { body: value.body, tag: 'gymio-push-test', data: { url: '/dashboard' } })
      return true
    }),
    disable: () => {
      disabled = true
      return serialized(async () => {
        try { await store.setEnabled(false) } catch {}
        try { for (const card of await registration.getNotifications()) if (card.tag?.startsWith('gymio-')) card.close() } catch {}
      })
    },
    enable: () => serialized(async () => { await store.setEnabled(true); disabled = false }),
  }
}
const notificationProcessor = createNotificationProcessor({ store: createNotificationStore(self.indexedDB), registration: self.registration })
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      for (const card of await self.registration.getNotifications()) {
        if (card.tag?.startsWith('gymio-workout-') && !card.tag.startsWith('gymio-workout-complete-')) card.close()
      }
    } catch { /* Old presentation cleanup */ }
  })())
})
self.addEventListener('push', event => {
  let payload
  try { payload = event.data?.json() } catch { return }
  event.waitUntil(validRestFinished(payload) ? notificationProcessor.rest(payload)
    : validReminder(payload) ? notificationProcessor.reminder(payload) : notificationProcessor.diagnostic(payload))
})
self.addEventListener('message', event => {
  try { if (new URL(event.source?.url).origin !== self.location.origin) return } catch { return }
  const message = event.data
  if (message?.type === 'gymio_workout_complete') event.waitUntil(notificationProcessor.complete(message.payload, message.scope))
  else if (message?.type === 'gymio_schedule_confirmation') event.waitUntil(notificationProcessor.confirm(message.payload, message.scope)
    .then(shown => event.ports?.[0]?.postMessage({ shown: shown === true })))
  else if (message?.type === 'gymio_notification_scope') event.waitUntil(notificationProcessor.scope().then(scope => event.ports?.[0]?.postMessage({ scope })))
  else if (message?.type === 'gymio_push_disable') event.waitUntil(notificationProcessor.disable())
  else if (message?.type === 'gymio_push_enable') event.waitUntil(notificationProcessor.enable())
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const route = notificationRoute(event.notification)
  if (event.action || !route) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find(client => { try { return new URL(client.url).origin === self.location.origin } catch { return false } })
    if (current) { await current.navigate(new URL(route, self.location.origin).href); await current.focus() }
    else await self.clients.openWindow(new URL(route, self.location.origin).href)
  })())
})

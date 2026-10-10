/* Push + workout projections only. No cache, workout mutations or auth data. */
const TEST_BODY = 'Notificações de treino ativadas.'
function validPayload(value) {
  return value && value.version === 1 && value.type === 'test' && value.title === 'Gym.io' &&
    value.body === TEST_BODY && value.data?.url === '/dashboard' &&
    Object.keys(value).every((key) => ['version', 'type', 'title', 'body', 'data'].includes(key)) &&
    Object.keys(value.data).length === 1
}
const WORKOUT_KEYS = ['version','type','title','body','id_sessao','revisao','id_treino','id_treino_exercicio','proxima_serie','serie_total',
  'iniciada_em','descanso_iniciado_em','descanso_termina_em','agora_servidor','exercicio','fase','pausada','data']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
function decimal(value, allowZero=false, max=9223372036854775807n) {
  return typeof value==='string' && /^(0|[1-9][0-9]*)$/.test(value) && value.length<=19 &&
    BigInt(value)<=max && (allowZero || value!=='0')
}
function stamp(value) { return typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) }
function validWorkout(value, projection=false) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==WORKOUT_KEYS.length ||
    Object.keys(value).some((key)=>!WORKOUT_KEYS.includes(key)) || value.version!==2 ||
    value.type!==(projection?'workout_projection':'workout_rest_finished') || !UUID.test(value.id_sessao ?? '') ||
    !decimal(value.revisao,true) || !decimal(value.id_treino) || !decimal(value.id_treino_exercicio) ||
    !decimal(value.proxima_serie,false,32767n) || (value.serie_total!==null &&
      (!decimal(value.serie_total,false,32767n) || BigInt(value.serie_total)<BigInt(value.proxima_serie))) ||
    !stamp(value.iniciada_em) || !stamp(value.agora_servidor) || Date.parse(value.agora_servidor)<Date.parse(value.iniciada_em) ||
    typeof value.pausada!=='boolean' || !['descanso','execucao'].includes(value.fase) ||
    typeof value.exercicio!=='string' || !value.exercicio.trim() || Array.from(value.exercicio).length>80 || /[\u0000-\u001f\u007f]/.test(value.exercicio) ||
    typeof value.body!=='string' || !value.body || Array.from(value.body).length>160 || /[\u0000-\u001f\u007f]/.test(value.body) ||
    !value.data || Object.keys(value.data).length!==1 || value.data.url!==`/treinar/${value.id_treino}`) return false
  if (value.fase==='descanso') {
    if (!stamp(value.descanso_iniciado_em) || !stamp(value.descanso_termina_em) || Date.parse(value.descanso_termina_em)<Date.parse(value.descanso_iniciado_em)) return false
  } else if (value.descanso_iniciado_em!==null || value.descanso_termina_em!==null) return false
  if (!projection) return value.title==='Gym.io · Descanso concluído' && value.fase==='descanso' && !value.pausada && Date.parse(value.agora_servidor)>=Date.parse(value.descanso_termina_em)
  return value.title===(value.pausada?'Gym.io · Pausado':value.fase==='descanso'?'Gym.io · Descanso':'Gym.io · Treino')
}
function restIdentity(value) { return `${value.id_sessao}:${value.id_treino_exercicio}:${value.proxima_serie}:rest_finished` }

// This store contains only receipts, tombstones and projection ordering markers.
// Session V2 remains authoritative. One readwrite transaction reserves an alert
// durably before showNotification; a worker restart cannot reserve it again.
function createWorkoutStore(factory) {
  let database
  const open = () => database ??= new Promise((resolve,reject)=>{
    if (!factory) return reject(new Error('storage_unavailable'))
    const request=factory.open('gymio-workout-notification-receipts',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('markers')
    request.onsuccess=()=>{ const db=request.result; db.onversionchange=()=>db.close(); resolve(db) }
    request.onerror=()=>reject(new Error('storage_unavailable'))
    request.onblocked=()=>reject(new Error('storage_unavailable'))
  })
  const transaction=async(operation)=>{
    const db=await open(); return new Promise((resolve,reject)=>{
      const tx=db.transaction('markers','readwrite');const store=tx.objectStore('markers');let result
      tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(new Error('storage_unavailable'))
      const get=(key)=>new Promise((done,fail)=>{ const r=store.get(key);r.onsuccess=()=>done(r.result);r.onerror=()=>fail(r.error) })
      Promise.resolve(operation(store,get)).then((value)=>{result=value},()=>{try{tx.abort()}catch{};reject(new Error('storage_unavailable'))})
    })
  }
  return {
    decide: (value,alert)=>transaction(async(store,get)=>{
      const [enabled,closed,current,receipt]=await Promise.all([get('enabled'),get(`closed:${value.id_sessao}`),get('projection'),get(`receipt:${restIdentity(value)}`)])
      if (enabled===false || closed) return {show:false}
      let newerSession=false
      if (current) {
        if (current.session!==value.id_sessao) {
          const previous=[current.started,current.session].join(':');const incoming=[new Date(value.iniciada_em).toISOString(),value.id_sessao].join(':')
          if(incoming<=previous)return {show:false}
          store.put(true,`closed:${current.session}`);newerSession=true
        } else if (BigInt(value.revisao)<BigInt(current.revision) ||
          (value.revisao===current.revision && Date.parse(value.agora_servidor)<current.observed)) return {show:false}
      }
      store.put({session:value.id_sessao,started:new Date(value.iniciada_em).toISOString(),revision:value.revisao,observed:Date.parse(value.agora_servidor)},'projection')
      if(alert&&!receipt)store.put(true,`receipt:${restIdentity(value)}`)
      return {show:true,alert:alert&&!receipt,closeOthers:newerSession}
    }),
    close: (id)=>transaction(async(store)=>{store.put(true,`closed:${id}`)}),
    disable: (logout)=>transaction(async(store,get)=>{store.put(false,'enabled');const current=await get('projection');if(logout&&current)store.put(true,`closed:${current.session}`)}),
    enable: ()=>transaction(async(store)=>{store.put(true,'enabled')}),
  }
}
function createWorkoutProcessor({store,registration}) {
  let queue=Promise.resolve();let disabled=false;let last=null;const closed=new Set()
  const serialized=(fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result}
  const closeCards=async(except)=>{
    const cards=await registration.getNotifications?.() ?? []
    for(const card of cards)if(card.tag?.startsWith('gymio-workout-')&&card.tag!==except)card.close()
  }
  return {
    project: (value,alert=false)=>serialized(async()=>{
      if(disabled||closed.has(value.id_sessao))return
      let decision
      try{decision=await store.decide(value,alert)}catch{
        // Storage failure can only update a known live projection silently.
        if(!last||last.id_sessao!==value.id_sessao||BigInt(value.revisao)<BigInt(last.revisao))return
        decision={show:true,alert:false}
      }
      if(!decision.show)return
      last=value
      const tag=`gymio-workout-${value.id_sessao}`
      if(decision.closeOthers)await closeCards(tag)
      await registration.showNotification(value.title,{body:value.body,icon:'/push-icon-192.png',badge:'/push-icon-192.png',tag,
        data:{url:`/treinar/${value.id_treino}`,sessionId:value.id_sessao},
        silent:!decision.alert,renotify:Boolean(decision.alert),...(decision.alert?{vibrate:[200,100,200]}:{})})
    }),
    close: (id)=>serialized(async()=>{closed.add(id);try{await store.close(id)}catch{};const cards=await registration.getNotifications?.() ?? [];for(const card of cards)if(card.tag===`gymio-workout-${id}`)card.close()}),
    disable: (logout)=>serialized(async()=>{disabled=true;if(logout&&last)closed.add(last.id_sessao);try{await store.disable(logout)}catch{};await closeCards()}),
    enable: ()=>serialized(async()=>{await store.enable();disabled=false}),
  }
}
const workoutProcessor=createWorkoutProcessor({store:createWorkoutStore(self.indexedDB),registration:self.registration})
self.addEventListener('push', (event) => {
  let payload
  try { payload = event.data?.json() } catch { return }
  if(validWorkout(payload)) {event.waitUntil(workoutProcessor.project(payload,true));return}
  if (!validPayload(payload)) return
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: '/push-icon-192.png', badge: '/push-icon-192.png',
    tag: 'gymio-push-test', data: { url: '/dashboard' },
  }))
})
self.addEventListener('message',(event)=>{
  let origin
  try{origin=new URL(event.source?.url).origin}catch{return}
  if(origin!==self.location.origin)return
  const message=event.data
  if(message?.type==='gymio_workout_projection'&&validWorkout(message.payload,true))event.waitUntil(workoutProcessor.project(message.payload))
  else if(message?.type==='gymio_workout_rest_finished'&&validWorkout(message.payload))event.waitUntil(workoutProcessor.project(message.payload,true))
  else if(message?.type==='gymio_workout_close'&&UUID.test(message.sessionId??''))event.waitUntil(workoutProcessor.close(message.sessionId))
  else if(message?.type==='gymio_push_disable')event.waitUntil(workoutProcessor.disable(message.reason==='logout'))
  else if(message?.type==='gymio_push_enable')event.waitUntil(workoutProcessor.enable())
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route=event.notification.data?.url
  const workoutRoute=typeof route==='string'&&/^\/treinar\/[1-9][0-9]*$/.test(route)&&decimal(route.slice(9))&&UUID.test(event.notification.data?.sessionId??'')
  if (event.action || (route!=='/dashboard'&&!workoutRoute)) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find((client) => {
      try { return new URL(client.url).origin === self.location.origin } catch { return false }
    })
    if (current) { await current.navigate(route); await current.focus() }
    else await self.clients.openWindow(route)
  })())
})

/* Fixed rest controls use opaque bearers. No JWT, token cache or workout state machine. */
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

const CONTROL_KEYS=['generation_id','expires_at','eligible_state','controls_status','controls']
const CAPABILITY=/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/
const ACTION_LABELS={rest_add_15:'+15s',rest_skip:'Pular',rest_pause:'Pausar',rest_resume:'Retomar',rest_continue:'Continuar'}
function withoutControls(value) {
  const base={...value,version:2,type:'workout_projection'}
  for(const key of CONTROL_KEYS)delete base[key]
  base.title=base.pausada?'Gym.io · Pausado':base.fase==='descanso'?'Gym.io · Descanso':'Gym.io · Treino'
  return base
}
function validControls(value) {
  if(!value||value.version!==3||value.type!=='workout_control'||Object.keys(value).length!==WORKOUT_KEYS.length+CONTROL_KEYS.length||
    Object.keys(value).some((key)=>!WORKOUT_KEYS.includes(key)&&!CONTROL_KEYS.includes(key))||!validWorkout(withoutControls(value),true)||
    !UUID.test(value.generation_id??'')||!stamp(value.expires_at)||Date.parse(value.expires_at)<=Date.parse(value.agora_servidor)||
    Date.parse(value.expires_at)>Date.parse(value.agora_servidor)+900000||value.fase!=='descanso'||
    !['emitted','unchanged'].includes(value.controls_status)||!Array.isArray(value.controls))return false
  const state=value.pausada?'rest_paused':Date.parse(value.agora_servidor)>=Date.parse(value.descanso_termina_em)?'rest_finished':'rest_active'
  if(value.eligible_state!==state||!(value.title===withoutControls(value).title||state==='rest_finished'&&value.title==='Gym.io · Descanso concluído'))return false
  if(value.controls_status==='unchanged')return value.controls.length===0
  const actions=state==='rest_paused'?['rest_resume','rest_skip']:state==='rest_finished'?['rest_continue']:['rest_add_15','rest_skip','rest_pause']
  const actual=value.controls.map((control)=>control?.action)
  if(actual.join(',')!==actions.join(',')&&!(state==='rest_active'&&actual.join(',')==='rest_skip,rest_pause'))return false
  return value.controls.every((control)=>control&&Object.keys(control).length===2&&CAPABILITY.test(control.capability??'')&&
    Object.keys(control).every((key)=>['action','capability'].includes(key)))&&new Set(value.controls.map((control)=>control.capability)).size===value.controls.length
}

// Trusted configuration is generated by Vite, never taken from a Push payload.
async function sendWorkoutAction(capability) {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000)
  try {
    const configResponse=await fetch('/push-config.json',{cache:'no-store',redirect:'error',signal:controller.signal})
    if(!configResponse.ok)throw new Error('unavailable')
    const config=await configResponse.json();const base=new URL(config.supabaseUrl)
    if(Object.keys(config).length!==1||base.username||base.password||base.search||base.hash||base.pathname!=='/'||
      !(base.protocol==='https:'||base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw new Error('unavailable')
    const response=await fetch(new URL('/functions/v1/workout-action',base),{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({capability}),signal:controller.signal})
    if(!response.ok)throw new Error('unavailable')
    const value=await response.json()
    if(!value||!['ok','stale','expired','already_used','unavailable'].includes(value.result)||
      Object.keys(value).some((key)=>!['result','projection'].includes(key)))throw new Error('unavailable')
    return value
  } finally {clearTimeout(timer)}
}

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
      const [enabled,closed,current,receipt,generationClosed]=await Promise.all([get('enabled'),get(`closed:${value.id_sessao}`),get('projection'),get(`receipt:${restIdentity(value)}`),
        value.generation_id?get(`generation:${value.generation_id}`):false])
      if (enabled===false || closed || generationClosed) return {show:false}
      let newerSession=false
      if (current) {
        if (current.session!==value.id_sessao) {
          const previous=[current.started,current.session].join(':');const incoming=[new Date(value.iniciada_em).toISOString(),value.id_sessao].join(':')
          if(incoming<=previous)return {show:false}
          store.put(true,`closed:${current.session}`);newerSession=true
        } else if (BigInt(value.revisao)<BigInt(current.revision) ||
          (value.revisao===current.revision && Date.parse(value.agora_servidor)<current.observed)) return {show:false}
      }
      store.put({session:value.id_sessao,started:new Date(value.iniciada_em).toISOString(),revision:value.revisao,observed:Date.parse(value.agora_servidor),generation:value.generation_id??null},'projection')
      if(alert&&!receipt)store.put(true,`receipt:${restIdentity(value)}`)
      return {show:true,alert:alert&&!receipt,closeOthers:newerSession}
    }),
    close: (id)=>transaction(async(store)=>{store.put(true,`closed:${id}`)}),
    closeGeneration: (id)=>transaction(async(store)=>{store.put(true,`generation:${id}`)}),
    generationClosed: (id)=>transaction(async(_store,get)=>Boolean(await get(`generation:${id}`))),
    actionAllowed: (value)=>transaction(async(_store,get)=>{
      const [enabled,closed,generation,current]=await Promise.all([get('enabled'),get(`closed:${value.id_sessao}`),get(`generation:${value.generation_id}`),get('projection')])
      return enabled!==false&&!closed&&!generation&&current?.session===value.id_sessao&&current.revision===value.revisao&&current.generation===value.generation_id
    }),
    disable: (logout)=>transaction(async(store,get)=>{store.put(false,'enabled');const current=await get('projection');if(logout&&current)store.put(true,`closed:${current.session}`)}),
    enable: ()=>transaction(async(store)=>{store.put(true,'enabled')}),
  }
}
function createWorkoutProcessor({store,registration,sendAction=sendWorkoutAction,now=()=>Date.now()}) {
  let queue=Promise.resolve();let disabled=false;let last=null;const closed=new Set()
  const closedGenerations=new Set()
  const serialized=(fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result}
  const closeCards=async(except)=>{
    const cards=await registration.getNotifications?.() ?? []
    for(const card of cards)if(card.tag?.startsWith('gymio-workout-')&&card.tag!==except)card.close()
  }
  const project=async(value,alert=false)=>{
      if(disabled||closed.has(value.id_sessao))return
      if(value.generation_id&&closedGenerations.has(value.generation_id))return
      let decision,storageAvailable=true
      try{decision=await store.decide(value,alert)}catch{
        storageAvailable=false
        // Storage failure can only update a known live projection silently.
        if(!last||last.id_sessao!==value.id_sessao||BigInt(value.revisao)<BigInt(last.revisao))return
        decision={show:true,alert:false}
      }
      if(!decision.show)return
      const tag=`gymio-workout-${value.id_sessao}`
      let display=value
      if(value.version===3) {
        // All checks occur inside this processor's queue, before replacement.
        if(!storageAvailable||!validControls(value)||Date.parse(value.expires_at)<=now())display=withoutControls(value)
        else if(value.controls_status==='unchanged') {
          const cards=await registration.getNotifications?.({tag})??[]
          const current=cards.find((card)=>card.tag===tag)?.data?.projection
          if(current&&validControls(current)&&current.controls_status==='emitted'&&current.id_sessao===value.id_sessao&&
            current.generation_id===value.generation_id&&current.revisao===value.revisao&&current.expires_at===value.expires_at&&
            Date.parse(current.expires_at)>now()&&!closedGenerations.has(current.generation_id)) {
            display={...value,controls_status:'emitted',controls:current.controls}
          } else display=withoutControls(value)
        }
      }
      last=display
      if(decision.closeOthers)await closeCards(tag)
      await registration.showNotification(display.title,{body:display.body,icon:'/push-icon-192.png',badge:'/push-icon-192.png',tag,
        data:{url:`/treinar/${display.id_treino}`,sessionId:display.id_sessao,...(display.version===3?{projection:display}:{})},
        ...(display.version===3?{actions:display.controls.slice(0,typeof Notification!=='undefined'?Notification.maxActions??2:2).map((control)=>({action:control.action,title:ACTION_LABELS[control.action]}))}:{}),
        silent:!decision.alert,renotify:Boolean(decision.alert),...(decision.alert?{vibrate:[200,100,200]}:{})})
  }
  const closeGeneration=async(id)=>{
    closedGenerations.add(id);try{await store.closeGeneration?.(id)}catch{}
    const cards=await registration.getNotifications?.()??[]
    for(const card of cards)if(card.data?.projection?.generation_id===id)card.close()
  }
  return {
    project:(value,alert=false)=>serialized(()=>project(value,alert)),
    action:(notification,action)=>serialized(async()=>{
      const value=notification.data?.projection
      if(disabled||!validControls(value)||value.controls_status!=='emitted'||closed.has(value.id_sessao)||closedGenerations.has(value.generation_id))return
      try{
        if(store.actionAllowed ? !await store.actionAllowed(value) : await store.generationClosed?.(value.generation_id))return
      }catch{return}
      if(Date.parse(value.expires_at)<=now()){await closeGeneration(value.generation_id);return}
      const control=value.controls.find((control)=>control.action===action);if(!control)return
      let result
      try{result=await sendAction(control.capability)}catch{return} // ambiguous: no retry or success assumption
      if(disabled||closed.has(value.id_sessao))return
      if(result.result==='ok') {
        const projection=result.projection
        if(!(validWorkout(projection,true)||validControls(projection))||projection.id_sessao!==value.id_sessao||BigInt(projection.revisao)<=BigInt(value.revisao))return
        await closeGeneration(value.generation_id)
        await project(projection,false)
      } else if(['stale','expired','already_used','unavailable'].includes(result.result))await closeGeneration(value.generation_id)
    }),
    close: (id)=>serialized(async()=>{closed.add(id);try{await store.close(id)}catch{};const cards=await registration.getNotifications?.() ?? [];for(const card of cards)if(card.tag===`gymio-workout-${id}`)card.close()}),
    disable: (logout)=>{disabled=true;return serialized(async()=>{if(logout&&last)closed.add(last.id_sessao);try{await store.disable(logout)}catch{};await closeCards()})},
    enable: ()=>serialized(async()=>{await store.enable();disabled=false}),
  }
}
const workoutProcessor=createWorkoutProcessor({store:createWorkoutStore(self.indexedDB),registration:self.registration})
self.addEventListener('push', (event) => {
  let payload
  try { payload = event.data?.json() } catch { return }
  if(validControls(payload)&&payload.eligible_state==='rest_finished') {event.waitUntil(workoutProcessor.project(payload,true));return}
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
  if(message?.type==='gymio_workout_controls'&&validControls(message.payload))event.waitUntil(workoutProcessor.project(message.payload))
  else if(message?.type==='gymio_workout_projection'&&validWorkout(message.payload,true))event.waitUntil(workoutProcessor.project(message.payload))
  else if(message?.type==='gymio_workout_rest_finished'&&validWorkout(message.payload))event.waitUntil(workoutProcessor.project(message.payload,true))
  else if(message?.type==='gymio_workout_close'&&UUID.test(message.sessionId??''))event.waitUntil(workoutProcessor.close(message.sessionId))
  else if(message?.type==='gymio_push_disable')event.waitUntil(workoutProcessor.disable(message.reason==='logout'))
  else if(message?.type==='gymio_push_enable')event.waitUntil(workoutProcessor.enable())
})
self.addEventListener('notificationclick', (event) => {
  if(event.action&&validControls(event.notification.data?.projection)) {
    event.waitUntil(workoutProcessor.action(event.notification,event.action));return
  }
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

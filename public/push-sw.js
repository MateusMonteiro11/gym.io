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
function supportedMaxActions() {
  const value=typeof Notification==='undefined'?undefined:Notification.maxActions
  return Number.isInteger(value)&&value>0?value:0
}
// Local-only lifecycle envelope. Backend V1/V2/V3 payloads stay unchanged.
const LIFECYCLE_KEYS=['version','type','id_sessao','revisao','id_treino','iniciada_em','agora_servidor']
function validLifecycle(value,kind) {
  const keys=kind==='complete'?[...LIFECYCLE_KEYS,'id_historico']:LIFECYCLE_KEYS
  return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&
    Object.keys(value).every(key=>keys.includes(key))&&value.version===1&&
    value.type===(kind==='start'?'workout_session_started':'workout_session_completed')&&UUID.test(value.id_sessao??'')&&
    decimal(value.revisao,true)&&decimal(value.id_treino)&&stamp(value.iniciada_em)&&stamp(value.agora_servidor)&&
    Date.parse(value.agora_servidor)>=Date.parse(value.iniciada_em)&&
    (kind!=='complete'||value.id_historico===null||decimal(value.id_historico))
}
function validHistoryRoute(route) {
  if(route==='/historico?period=all')return true
  const match=typeof route==='string'&&/^\/historico\?period=all&workout=([1-9][0-9]*)$/.exec(route)
  return Boolean(match&&decimal(match[1]))
}
function exposedNotificationOption(name) {
  return typeof Notification!=='undefined'&&Boolean(Notification.prototype)&&name in Notification.prototype
}
// One visual surface for every validated wire projection. No countdown/state inference.
function sessionCardPresentation(value,needsRefresh=false) {
  const series=`${value.proxima_serie}${value.serie_total?`/${value.serie_total}`:''}`
  let body
  if(needsRefresh)body='Abra o treino para atualizar'
  else if(value.pausada)body=`${value.fase==='descanso'?'Descanso':'Treino'} pausado · ${value.exercicio}\nSérie ${series}`
  else if(value.type==='workout_rest_finished'||value.eligible_state==='rest_finished'||
    value.fase==='descanso'&&Date.parse(value.agora_servidor)>=Date.parse(value.descanso_termina_em))
    body=`Descanso concluído\n${value.exercicio} · Série ${series}`
  else if(value.fase==='descanso') {
    const deadline=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value.descanso_termina_em))
    body=`${value.exercicio} · Próxima série ${series}\nDescanso até ${deadline}`
  } else body=`${value.exercicio} · Série ${series}`
  return {title:'Gym.io · Treino',body:Array.from(body).slice(0,160).join('')}
}
function projectionOrder(value) {
  return {session:value.id_sessao,revision:value.revisao,observed:value.agora_servidor,started:value.iniciada_em}
}
function validCardOrder(value) {
  return value&&UUID.test(value.session??'')&&decimal(value.revision,true)&&stamp(value.observed)&&stamp(value.started)
}
function precedesCard(value,existing) {
  if(value.id_sessao!==existing.session)
    return `${new Date(value.iniciada_em).toISOString()}:${value.id_sessao}`<=`${new Date(existing.started).toISOString()}:${existing.session}`
  return BigInt(value.revisao)<BigInt(existing.revision)||
    value.revisao===existing.revision&&Date.parse(value.agora_servidor)<Date.parse(existing.observed)
}
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
    current: ()=>transaction(async(_store,get)=>get('projection')),
    lifecycle: (kind,value)=>transaction(async(store,get)=>{
      const [enabled,closed,seen,current]=await Promise.all([get('enabled'),get(`closed:${value.id_sessao}`),get(`${kind}:${value.id_sessao}`),get('projection')])
      if(enabled===false||closed||seen)return {show:false}
      if(current) {
        const order={...current,observed:new Date(current.observed).toISOString()}
        if(precedesCard(value,order))return {show:false}
        if(current.session!==value.id_sessao)store.put(true,`closed:${current.session}`)
      }
      store.put({...projectionOrder(value),started:new Date(value.iniciada_em).toISOString(),observed:Date.parse(value.agora_servidor),generation:null},'projection')
      store.put(true,`${kind}:${value.id_sessao}`)
      if(kind==='complete')store.put(true,`closed:${value.id_sessao}`)
      return {show:true}
    }),
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
    disable: (_logout)=>transaction(async(store,get)=>{store.put(false,'enabled');const current=await get('projection');if(current)store.put(true,`closed:${current.session}`)}),
    enable: ()=>transaction(async(store)=>{store.put(true,'enabled')}),
  }
}
function createWorkoutProcessor({store,registration,sendAction=sendWorkoutAction,now=()=>Date.now()}) {
  let queue=Promise.resolve(),disabled=false,last=null,coalescingFailed=false,publicationSequence=0
  const closed=new Set(),closedGenerations=new Set()
  const serialized=(fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result}
  const isCard=(card)=>typeof card.tag==='string'&&card.tag.startsWith('gymio-workout-')&&UUID.test(card.tag.slice(14))
  const isKnown=(card)=>isCard(card)||typeof card.tag==='string'&&card.tag.startsWith('gymio-workout-complete-')&&UUID.test(card.tag.slice(23))
  const enumerate=async(tag)=>{
    if(typeof registration.getNotifications!=='function')throw new Error('notification_enumeration_unavailable')
    return registration.getNotifications(tag?{tag}:{})
  }
  const cardOrder=(card)=>{
    if(validCardOrder(card.data?.publication))return card.data.publication
    const projection=card.data?.projection
    if(validControls(projection)||validWorkout(projection,true)||validWorkout(projection))return projectionOrder(projection)
    return null
  }
  const context=async(value)=>{
    const tag=`gymio-workout-${value.id_sessao}`
    const tagged=await enumerate(tag),cards=await enumerate()
    for(const card of [...tagged,...cards].filter(isCard)) {
      const order=cardOrder(card)
      if(!validCardOrder(order)||precedesCard(value,order))return null
    }
    return {cards,tag}
  }
  const closeCards=async()=>{
    try{for(const card of (await enumerate()).filter(isKnown))card.close();return true}catch{return false}
  }
  // Native coalescing is observed, never inferred from UA or the exposed tag API.
  const publish=async(value,display,before,alert=false,needsRefresh=false,lifecycle=null)=>{
    const {cards,tag}=before,matching=cards.filter(card=>card.tag===tag)
    const id=`${now()}-${++publicationSequence}-${Math.random().toString(36).slice(2)}`
    const publication={...projectionOrder(value),id}
    const actions=!needsRefresh&&display.version===3?display.controls.slice(0,supportedMaxActions()).map(control=>({action:control.action,title:ACTION_LABELS[control.action]})):[]
    const visual=lifecycle==='start'?{title:'Gym.io · Treino iniciado',body:'Seu treino começou. Bom treino!'}:
      lifecycle==='complete'?{title:'Treino concluído',body:'Veja seu progresso no Gym.io.'}:sessionCardPresentation(display,needsRefresh)
    const url=lifecycle==='complete'?`/historico?period=all${value.id_historico?'&workout='+value.id_historico:''}`:`/treinar/${value.id_treino}`
    try {
      // unchanged has already copied authorized tokens from the current card.
      if(matching.length>1)coalescingFailed=true
      if(coalescingFailed)for(const card of matching)card.close()
      for(const card of cards.filter(card=>isCard(card)&&card.tag!==tag))card.close()
      await registration.showNotification(visual.title,{body:visual.body,icon:'/push-icon-192.png',badge:'/push-icon-192.png',tag,
        data:{url,sessionId:value.id_sessao,publication,...(lifecycle?{kind:lifecycle}:{}),
          ...(!needsRefresh&&display.version===3?{projection:display}:{})},
        ...(actions.length?{actions}:{}),silent:!alert,renotify:Boolean(alert&&exposedNotificationOption('renotify')),
        ...(alert&&exposedNotificationOption('vibrate')?{vibrate:[200,100,200]}:{})})
    }catch{return {published:false,verified:false}}
    try {
      const tagged=await enumerate(tag),after=await enumerate(),fresh=after.find(card=>card.tag===tag&&card.data?.publication?.id===id)
      if(!fresh)return {published:true,verified:false}
      // Another actor's newer card must survive; never close it to keep our own.
      if([...tagged,...after].some(card=>{
        if(!isCard(card)||card.data?.publication?.id===id)return false
        const order=cardOrder(card)
        return !validCardOrder(order)||precedesCard(value,order)
      })) {
        fresh.close();return {published:false,verified:false}
      }
      if(after.some(card=>card.tag===tag&&card!==fresh))coalescingFailed=true
      for(const card of after)if((isCard(card)||card.tag===tag)&&card!==fresh)card.close()
      const remaining=(await enumerate()).filter(card=>isCard(card)||card.tag===tag)
      return {published:true,verified:remaining.length===1&&remaining[0].data?.publication?.id===id}
    }catch{return {published:true,verified:false}}
  }
  const project=async(value,requestAlert=false)=>{
    if(!(validWorkout(value,true)||validWorkout(value)||validControls(value)))return {published:false,verified:false}
    // Presentation only: minimal platforms never display intermediate updates,
    // including remote B and C responses, and reserve no rest receipts for them.
    if(supportedMaxActions()===0)return {published:false,verified:false}
    if(disabled||closed.has(value.id_sessao)||value.generation_id&&closedGenerations.has(value.generation_id))return {published:false,verified:false}
    let before
    try{before=await context(value)}catch{return {published:false,verified:false}}
    if(!before)return {published:false,verified:false}
    const confirmedEnd=validWorkout(value)||validControls(value)&&value.eligible_state==='rest_finished'
    const alert=Boolean(requestAlert&&confirmedEnd)
    let decision,storageAvailable=true
    try{decision=await store.decide(value,alert)}catch{
      storageAvailable=false
      if(!last||last.id_sessao!==value.id_sessao||precedesCard(value,projectionOrder(last)))return {published:false,verified:false}
      decision={show:true,alert:false}
    }
    if(!decision.show)return {published:false,verified:false}
    let display=value
    if(value.version===3) {
      if(!storageAvailable||Date.parse(value.expires_at)<=now())display=withoutControls(value)
      else if(value.controls_status==='unchanged') {
        const current=before.cards.find(card=>card.tag===before.tag&&validControls(card.data?.projection)&&
          card.data.projection.controls_status==='emitted'&&card.data.projection.id_sessao===value.id_sessao&&
          card.data.projection.generation_id===value.generation_id&&card.data.projection.revisao===value.revisao&&
          card.data.projection.expires_at===value.expires_at&&Date.parse(card.data.projection.expires_at)>now()&&
          !closedGenerations.has(card.data.projection.generation_id))?.data.projection
        display=current?{...value,controls_status:'emitted',controls:current.controls}:withoutControls(value)
      }
    }
    const result=await publish(value,display,before,Boolean(decision.alert))
    if(result.published)last=display
    return result
  }
  // Generation invalidation removes bearers, not the logical session card.
  const invalidateGeneration=async(value,refresh)=>{
    const id=value.generation_id;closedGenerations.add(id)
    try{await store.closeGeneration?.(id)}catch{}
    if(last?.generation_id===id)last=withoutControls(last)
    if(!refresh)return
    let cards=[]
    try{
      cards=await enumerate()
      const affected=cards.filter(card=>card.data?.projection?.generation_id===id)
      if(!affected.length)return
      const before=await context(value)
      if(before&&!disabled&&!closed.has(value.id_sessao)) {
        const result=await publish(value,withoutControls(value),before,false,true)
        if(result.published)return
      }
      // No newer/indeterminate card is replaced; remove only invalid-generation cards.
      for(const card of affected)card.close()
    }catch{/* no retry and no assumption that the system UI was updated */}
  }
  return {
    lifecycle:(kind,value)=>serialized(async()=>{
      if(!['start','complete'].includes(kind)||!validLifecycle(value,kind)||disabled||closed.has(value.id_sessao))return {published:false,verified:false}
      let before,decision
      try{
        // Confirmed terminal containment must survive unavailable visual APIs.
        // Reservation is at-most-once: a failed/ambiguous show is never retried.
        if(kind==='complete') {
          decision=await store.lifecycle(kind,value)
          if(!decision.show)return {published:false,verified:false}
          closed.add(value.id_sessao)
        }
        before=await context(value)
        if(!before)return {published:false,verified:false}
        if(kind==='start')decision=await store.lifecycle(kind,value)
      }catch{return {published:false,verified:false}}
      if(!decision.show||disabled)return {published:false,verified:false}
      const tag=kind==='complete'?`gymio-workout-complete-${value.id_sessao}`:before.tag
      const result=await publish(value,value,{...before,tag},kind==='complete',false,kind)
      return result
    }),
    project:(value,alert=false)=>serialized(()=>project(value,alert)),
    action:(notification,action)=>serialized(async()=>{
      if(supportedMaxActions()===0)return
      const value=notification.data?.projection
      if(disabled||!validControls(value)||value.controls_status!=='emitted'||closed.has(value.id_sessao)||closedGenerations.has(value.generation_id))return
      try{if(store.actionAllowed?!await store.actionAllowed(value):await store.generationClosed?.(value.generation_id))return}catch{return}
      if(Date.parse(value.expires_at)<=now()){await invalidateGeneration(value,true);return}
      const control=value.controls.find(control=>control.action===action);if(!control)return
      let result
      try{result=await sendAction(control.capability)}catch{return}
      if(disabled||closed.has(value.id_sessao))return
      if(result.result==='ok') {
        const projection=result.projection
        if(!(validWorkout(projection,true)||validControls(projection))||projection.id_sessao!==value.id_sessao||BigInt(projection.revisao)<=BigInt(value.revisao))return
        await invalidateGeneration(value,false)
        await project(projection,false)
      }else if(['stale','expired','already_used','unavailable'].includes(result.result))await invalidateGeneration(value,true)
    }),
    close:(id)=>serialized(async()=>{
      closed.add(id);try{await store.close(id)}catch{}
      try{for(const card of await enumerate())if(card.tag===`gymio-workout-${id}`||card.tag===`gymio-workout-complete-${id}`)card.close()}catch{}
    }),
    disable:(logout)=>{disabled=true;return serialized(async()=>{
      const ids=new Set(last?[last.id_sessao]:[])
      try{for(const card of (await enumerate()).filter(isKnown)){if(UUID.test(card.data?.sessionId??''))ids.add(card.data.sessionId);card.close()}}catch{}
      for(const id of ids){closed.add(id);try{await store.close(id)}catch{}}
      try{await store.disable(logout)}catch{}
      last=null;await closeCards()
    })},
    enable:()=>serialized(async()=>{await store.enable();disabled=false}),
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
  if(message?.type==='gymio_workout_start'&&validLifecycle(message.payload,'start'))event.waitUntil(workoutProcessor.lifecycle('start',message.payload))
  else if(message?.type==='gymio_workout_complete'&&validLifecycle(message.payload,'complete'))event.waitUntil(workoutProcessor.lifecycle('complete',message.payload))
  else if(message?.type==='gymio_workout_controls'&&validControls(message.payload))event.waitUntil(workoutProcessor.project(message.payload))
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
  const completionRoute=event.notification.data?.kind==='complete'&&UUID.test(event.notification.data?.sessionId??'')&&
    event.notification.tag===`gymio-workout-complete-${event.notification.data.sessionId}`&&validHistoryRoute(route)
  if (event.action || (route!=='/dashboard'&&!workoutRoute&&!completionRoute)) return
  const destination=workoutRoute&&supportedMaxActions()===0?`${route}?from=push`:route
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find((client) => {
      try { return new URL(client.url).origin === self.location.origin } catch { return false }
    })
    if (current) { await current.navigate(destination); await current.focus() }
    else await self.clients.openWindow(destination)
  })())
})

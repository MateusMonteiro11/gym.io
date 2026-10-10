const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
function decimal(value,zero=false,max=9223372036854775807n) {
  if(typeof value==='number'&&!Number.isSafeInteger(value))return null
  const text=String(value??'')
  return /^(0|[1-9][0-9]*)$/.test(text)&&text.length<=19&&BigInt(text)<=max&&(zero||text!=='0')?text:null
}
const trim=(value,length)=>Array.from(String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,length).join('')
const timestamp=(value)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null
function fields(session,items) {
  if(!session||!UUID.test(session.id_sessao??''))return null
  const ids={id_sessao:session.id_sessao,revisao:decimal(session.revisao,true),id_treino:decimal(session.id_treino),
    id_treino_exercicio:decimal(session.id_treino_exercicio_atual),proxima_serie:decimal(session.serie_atual,false,32767n)}
  if(Object.values(ids).some((v)=>v===null))return null
  const item=(Array.isArray(items)?items:[]).find((item)=>decimal(item.id_treino_exercicio)===ids.id_treino_exercicio)
  let total=decimal(item?.series,false,32767n)
  if(total&&BigInt(total)<BigInt(ids.proxima_serie))total=null
  const started=timestamp(session.iniciada_em),now=timestamp(session.agora_servidor)
  if(!started||!now||Date.parse(now)<Date.parse(started))return null
  return {...ids,serie_total:total,iniciada_em:started,agora_servidor:now,exercicio:trim(item?.nome,80)||'Exercício',data:{url:`/treinar/${ids.id_treino}`}}
}
export function buildWorkoutProjection(session,items=[]) {
  if(session?.status!=='ativa'||!['descanso','execucao'].includes(session.fase))return null
  const value=fields(session,items);if(!value)return null
  const rest=session.fase==='descanso'
  const restStart=rest?timestamp(session.descanso_iniciado_em):null,deadline=rest?timestamp(session.descanso_termina_em):null
  if(rest&&(!restStart||!deadline||Date.parse(deadline)<Date.parse(restStart)))return null
  const paused=Boolean(session.pausada_em)
  return {...value,version:2,type:'workout_projection',title:paused?'Gym.io · Pausado':rest?'Gym.io · Descanso':'Gym.io · Treino',
    body:trim(`${value.exercicio} · ${rest?'Próxima série':'Série'} ${value.proxima_serie}${value.serie_total?'/'+value.serie_total:''}`,160),
    fase:session.fase,pausada:paused,descanso_iniciado_em:restStart,descanso_termina_em:deadline}
}
export function buildConfirmedRestSignal(before,after,items=[]) {
  if(before?.status!=='ativa'||before.fase!=='descanso'||before.pausada_em||after?.status!=='ativa'||after.fase!=='execucao'||after.pausada_em||
    before.id_sessao!==after.id_sessao||String(before.id_treino_exercicio_atual)!==String(after.id_treino_exercicio_atual)||
    String(before.serie_atual)!==String(after.serie_atual))return null
  const value=fields(before,items),revision=decimal(after.revisao,true),now=timestamp(after.agora_servidor)
  if(!value||!revision||BigInt(revision)<=BigInt(value.revisao)||!now||Date.parse(now)<Date.parse(before.descanso_termina_em)||
    !timestamp(before.descanso_iniciado_em)||!timestamp(before.descanso_termina_em))return null
  return {...value,revisao:revision,agora_servidor:now,version:2,type:'workout_rest_finished',title:'Gym.io · Descanso concluído',
    body:trim(`${value.exercicio} · Série ${value.proxima_serie}${value.serie_total?'/'+value.serie_total:''}`,160),fase:'descanso',pausada:false,
    descanso_iniciado_em:before.descanso_iniciado_em,descanso_termina_em:before.descanso_termina_em}
}
export function createWorkoutNotificationAdapter(bridge) {
  const safe=(operation)=>{try{Promise.resolve(operation()).catch(()=>{})}catch{/* notification failure never affects the workout */}}
  return {
    accept: (previous,confirmed,items)=>{
      try {
      if(previous?.id_sessao&&(!confirmed||confirmed.status!=='ativa'||confirmed.id_sessao!==previous.id_sessao))safe(()=>bridge.close(previous.id_sessao))
      const payload=buildWorkoutProjection(confirmed,items);if(payload)safe(()=>bridge.project(payload))
      } catch { /* best-effort projection */ }
    },
    restFinished: (before,after,items)=>{try{const payload=buildConfirmedRestSignal(before,after,items);if(payload)safe(()=>bridge.restFinished(payload))}catch{}},
  }
}

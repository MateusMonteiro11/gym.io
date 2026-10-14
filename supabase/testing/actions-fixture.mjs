import {createECDH,randomBytes,randomUUID} from 'node:crypto'
// Setup for a new isolated matrix only, never the manual workout or its data.
export function actionsFixture(context,{owner=context.users[0]}={}) {
  const {sql,value,users,literal:q}=context,a=owner,b=users.find((user)=>user.id!==owner.id),nonce=randomUUID()
  if(!users.some((user)=>user.id===owner.id)||!b)throw Error('fixture owner must be one of the two isolated matrix users')
  const key=createECDH('prime256v1');key.generateKeys()
  const workout=sql(`insert into public.treinos(nome,id_usuario)values(${q('V3.2-C matrix '+nonce)},${q(a.id)})returning id_treino;`)
  const exercise=sql(`insert into public.exercicios(nome)values(${q('V3.2-C synthetic '+nonce)})returning id_exercicio;`)
  const section=sql(`insert into public.secoes_treino(id_treino,nome)values(${workout},'V3.2-C matrix')returning id_secao;`)
  const item=sql(`insert into public.treinos_exercicios(id_treino,id_secao,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem)values(${workout},${section},${exercise},4,10,20,120,'1')returning id_treino_exercicio;`)
  const subscriptions=[]
  const rpc=(name,args,user=a)=>value(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(user.id)},true);select public.${name}(${args.join(',')});commit;`)
  const subscribe=(user=a)=>{
    const id=sql(`insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth)values(${q(user.id)},${q('https://fcm.googleapis.com/fcm/send/c-matrix-'+nonce+'-'+randomUUID())},${q(key.getPublicKey().toString('base64url'))},${q(randomBytes(16).toString('base64url'))})returning id;`)
    subscriptions.push(id);return id
  }
  let session
  const reset=()=>{
    sql(`delete from public.treino_sessoes where id_treino=${workout};delete from gymio_workout_push_private.outbox where id_usuario=${q(a.id)} and id_treino_exercicio=${item};`)
    session=null
  }
  const start=(seconds=120)=>{
    reset();sql(`update public.treinos_exercicios set descanso_segundos=${seconds} where id_treino_exercicio=${item};`)
    session=rpc('iniciar_treino_sessao',[workout,seconds]);session=rpc('concluir_treino_serie',[q(session.id_sessao),session.revisao,'20','10']);return session
  }
  const mutate=(name,...args)=>session=rpc(name,[q(session.id_sessao),session.revisao,...args])
  const issueFor=(sessionId,sub,revision,user=a)=>rpc('emitir_controles_notificacao_treino',[q(sessionId),q(sub),revision],user)
  const issue=(sub,revision=session.revisao,user=a)=>issueFor(session.id_sessao,sub,revision,user)
  const consume=(token)=>value(`select public.workout_notification_action(${q(token)});`)
  const clean=()=>{
    reset();for(const id of subscriptions)sql(`delete from public.push_subscriptions where id=${q(id)} and endpoint like ${q('https://fcm.googleapis.com/fcm/send/c-matrix-'+nonce+'-%')};`)
    sql(`delete from public.treinos_exercicios where id_treino=${workout};delete from public.secoes_treino where id_treino=${workout};delete from public.treinos where id_treino=${workout};delete from public.exercicios where id_exercicio=${exercise};`)
  }
  return {a,b,workout,item,rpc,subscribe,start,mutate,issue,issueFor,consume,reset,clean,get session(){return session}}
}

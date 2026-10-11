import { bounded, PUSH_WORKER_URL, PUSH_SCOPE, PUSH_OPT_OUT_KEY } from './pushUtils.js'
export function createWorkoutNotificationBridge(browser) {
  let blocked=false,epoch=0
  const registration=async()=>{
    if(!browser?.isSecureContext||!browser.navigator?.serviceWorker)return null
    const value=await browser.navigator.serviceWorker.getRegistration(PUSH_SCOPE)
    return value?.active?.scriptURL===new URL(PUSH_WORKER_URL,browser.location.origin).href?value:null
  }
  const send=async(message,force=false)=>{
    const version=epoch
    try{
      if(!force&&(blocked||browser?.Notification?.permission!=='granted'||browser.localStorage?.getItem(PUSH_OPT_OUT_KEY)==='1'))return false
      return await bounded(async()=>{
        const own=await registration();if(!own||(!force&&(blocked||version!==epoch)))return false
        own.active.postMessage?.(message);return true
      },500)
    }catch{return false}
  }
  return {
    controls:(payload)=>send({type:'gymio_workout_controls',payload}),
    project:(payload)=>send({type:'gymio_workout_projection',payload}),
    restFinished:(payload)=>send({type:'gymio_workout_rest_finished',payload}),
    close:(sessionId)=>send({type:'gymio_workout_close',sessionId},true),
    disable:async(reason)=>{blocked=true;epoch++;await send({type:'gymio_push_disable',reason},true)},
    enable:async()=>{blocked=false;epoch++;await send({type:'gymio_push_enable'},true)},
  }
}
export const workoutNotificationBridge=createWorkoutNotificationBridge(typeof window==='undefined'?null:window)

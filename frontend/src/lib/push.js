import { supabase } from './supabase'
export function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window }
function bytes(key) { const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c => c.charCodeAt(0)) }
export async function enablePush() {
  if (!supported()) throw new Error('Push wird hier nicht unterstützt. Auf iPhone/iPad die App zuerst zum Home-Bildschirm hinzufügen.')
  if (await Notification.requestPermission()!=='granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.')
  const {data,error}=await supabase.functions.invoke('family-api',{body:{action:'push-config'}})
  if (error || !data?.publicKey) throw new Error('Push-Konfiguration konnte nicht geladen werden.')
  await navigator.serviceWorker.register('/knowledge-vault/sw.js',{scope:'/knowledge-vault/'})
  const reg=await navigator.serviceWorker.ready
  const sub=await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(data.publicKey)})
  const {data:{user}}=await supabase.auth.getUser();if (!user) throw new Error('Bitte anmelden.')
  const raw=sub.toJSON()
  // Rebind only after removing this account's prior row. RLS prevents device theft.
  const {error:removeError}=await supabase.from('fh_push_subscriptions').delete().eq('endpoint',raw.endpoint)
  if (removeError) throw removeError
  const {error:saveError}=await supabase.from('fh_push_subscriptions').insert({user_id:user.id,endpoint:raw.endpoint,...raw.keys,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})
  if (saveError) {await sub.unsubscribe();throw saveError}
}
export async function disablePush() {
  if (!supported()) return
  const reg=await navigator.serviceWorker.getRegistration('/knowledge-vault/');const sub=await reg?.pushManager.getSubscription()
  if (!sub) return
  const {error}=await supabase.from('fh_push_subscriptions').delete().eq('endpoint',sub.endpoint)
  if (error) throw error
  await sub.unsubscribe()
}

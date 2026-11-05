import { API_BASE } from './api';
import { authenticatedFetch } from './firebaseService';
const supported = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
async function registration() {
  let timer;
  try { return await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => { timer=setTimeout(()=>reject(new Error('unavailable')),10000); })]); }
  finally { clearTimeout(timer); }
}
async function request(path, body, {allowMissing=false}={}) {
  const response=await authenticatedFetch(`${API_BASE}/push/${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){if(allowMissing&&response.status===404)return {absent:true};throw new Error('unavailable');}
  return response.json();
}
export async function backgroundAlertStatus() {
  if(!supported())return {supported:false,enabled:false};
  const worker=await navigator.serviceWorker.getRegistration();
  return {supported:true,permission:Notification.permission,enabled:Boolean(await worker?.pushManager.getSubscription())};
}
export async function enableBackgroundAlerts(position) {
  if (!supported() || !position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) throw new Error('unavailable');
  if (Notification.permission!=='granted' && await Notification.requestPermission()!=='granted') throw new Error('denied');
  const response=await fetch(`${API_BASE}/push/config`);
  if(!response.ok)throw new Error('unavailable');
  const config=await response.json();
  if(!config.configured)throw new Error('unavailable');
  const worker=await registration();
  const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const existing=await worker.pushManager.getSubscription();
  const subscription=existing || await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  try { await request('subscribe',{subscription,position}); }
  catch(error) { if(!existing)await subscription.unsubscribe();throw error; }
  return subscription;
}
export async function disableBackgroundAlerts() {
  const worker=await registration(),subscription=await worker.pushManager.getSubscription();
  if(!subscription)return;
  // A previous account may own the server record. This device must still be able to stop delivery.
  await request('unsubscribe',{endpoint:subscription.endpoint},{allowMissing:true});
  if(!await subscription.unsubscribe())throw new Error('unavailable');
}
export async function testBackgroundAlert() {
  const worker=await registration(),subscription=await worker.pushManager.getSubscription();
  if(!subscription)throw new Error('unavailable');
  return request('test',{endpoint:subscription.endpoint});
}

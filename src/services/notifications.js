import { API_BASE } from './api';
import { authenticatedFetch } from './firebaseService';
export async function enableBackgroundAlerts(position) {
  if (!position || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push unavailable');
  const config = await (await fetch(`${API_BASE}/push/config`)).json();
  if (!config.configured) throw new Error('Push not configured');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Notification permission denied');
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker unavailable')), 10000))]);
  const key = Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const subscription = await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const response = await authenticatedFetch(`${API_BASE}/push/subscribe`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription,position})});
  if (!response.ok) throw new Error('Could not save subscription');
  return subscription;
}

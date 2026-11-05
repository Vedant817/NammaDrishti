import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;
let authentication;
let signIn;

export async function authenticatedFetch(url, options = {}) {
  if (!projectId || !options.method || options.method.toUpperCase() === 'GET') {
    return fetch(url, options);
  }
  if (!authentication) {
    authentication = getAuth(initializeApp({
      projectId,
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      appId: process.env.REACT_APP_FIREBASE_APP_ID,
    }));
  }
  await authentication.authStateReady();
  if (!authentication.currentUser) {
    if (!signIn) signIn = signInAnonymously(authentication).finally(() => { signIn = null; });
    await signIn;
  }
  const token = await authentication.currentUser.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

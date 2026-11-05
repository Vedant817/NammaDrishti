import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, sendEmailVerification, signOut } from 'firebase/auth';
const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;
let authentication, signIn;
export function citizenAuth() {
  if (!projectId) throw new Error('Firebase authentication is not configured.');
  if (!authentication) authentication = getAuth(initializeApp({projectId,apiKey:process.env.REACT_APP_FIREBASE_API_KEY,authDomain:process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,appId:process.env.REACT_APP_FIREBASE_APP_ID}));
  return authentication;
}
export async function signInCitizen(email,password,register=false) {
  const auth=citizenAuth();await auth.authStateReady();
  let result;
  if(register)result=auth.currentUser?.isAnonymous ? await linkWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password)) : await createUserWithEmailAndPassword(auth,email,password);
  else result=await signInWithEmailAndPassword(auth,email,password);
  if(!result.user.emailVerified)await sendEmailVerification(result.user);
  await result.user.getIdToken(true);
  return result.user;
}
export async function citizenRole() {
  const auth=citizenAuth();await auth.authStateReady();
  if(!auth.currentUser)return null;
  await auth.currentUser.reload();const token=await auth.currentUser.getIdTokenResult(true);
  return {email:auth.currentUser.email,verified:auth.currentUser.emailVerified,moderator:token.claims.moderator===true};
}
export async function signOutCitizen() {return signOut(citizenAuth());}
export async function authenticatedFetch(url,options={}) {
  const mutation = options.method && !["GET","HEAD","OPTIONS"].includes(options.method.toUpperCase());
  const privateRead = /\/(moderation|operations|sos\/status)(\/|$)/.test(String(url));
  if(!projectId || (!mutation && !privateRead))return fetch(url,options);
  const auth=citizenAuth();await auth.authStateReady();
  if(!auth.currentUser){if(!signIn)signIn=signInAnonymously(auth).finally(()=>{signIn=null;});await signIn;}
  const token=await auth.currentUser.getIdToken();const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${token}`);
  return fetch(url,{...options,headers});
}

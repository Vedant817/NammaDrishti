import {createIdentityTracker,createPinnedRequester} from './identityRequest';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, sendEmailVerification, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;
let authentication, signIn;
const identityTracker=createIdentityTracker();
let localPrincipal;
function localIdentity() {
  let uid;
  try {
    uid=localStorage.getItem('nammadrishti_device_id_v1')||localStorage.getItem('nammapulse_device_id_v1');
    if(!uid){uid='dev_'+crypto.randomUUID();localStorage.setItem('nammadrishti_device_id_v1',uid);}
    if(typeof uid!=='string'||!uid||uid.length>120)throw new Error();
  }catch {return null;}
  if(localPrincipal?.uid!==uid)localPrincipal={uid};
  return localPrincipal;
}
export function actionIdentitySnapshot() {
  return identityTracker.observe(projectId?citizenAuth().currentUser:localIdentity());
}
export function isActionIdentityCurrent(identity) {
  const user=projectId?citizenAuth().currentUser:localIdentity();
  return identityTracker.isCurrent(identity,user);
}
export function subscribeActionIdentity(listener) {
  if(!projectId){
    const update=()=>listener(identityTracker.observe(localIdentity()));
    update();window.addEventListener('storage',update);
    return()=>window.removeEventListener('storage',update);
  }
  const auth=citizenAuth();
  const stop=onAuthStateChanged(auth,user=>listener(identityTracker.observe(user)));
  ensureCitizen().catch(()=>listener(identityTracker.observe(auth.currentUser)));
  return stop;
}
const pinnedRequest=createPinnedRequester({getSession:async()=>{
  if(!projectId){const user=localIdentity(),identity=identityTracker.observe(user);return {identity,isCurrent:()=>identityTracker.isCurrent(identity,localIdentity())};}
  const auth=await ensureCitizen(),user=auth.currentUser,identity=identityTracker.observe(user);
  return {identity,isCurrent:()=>identityTracker.isCurrent(identity,auth.currentUser),getToken:()=>user.getIdToken()};
}});

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
export async function resendCitizenVerification() {
  const auth = citizenAuth(); await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Sign in required.');
  return sendEmailVerification(auth.currentUser);
}
async function ensureCitizen() {
  const auth=citizenAuth();await auth.authStateReady();
  if(!auth.currentUser){if(!signIn)signIn=signInAnonymously(auth).finally(()=>{signIn=null;});await signIn;}
  return auth;
}
export function subscribePublicIncidents(onData,onError) {
  let stopped=false,unsubscribe,stopAuth;
  ensureCitizen().then(auth=>{
    if(stopped)return;
    stopAuth=onAuthStateChanged(auth,user=>{
      if(unsubscribe)unsubscribe();
      if(!user){ensureCitizen().catch(onError);return;}
      const feed=query(collection(getFirestore(auth.app),'publicIncidents'),orderBy('createdAt','desc'),limit(1000));
      unsubscribe=onSnapshot(feed,{includeMetadataChanges:true},snap=>onData(snap.docs.map(doc=>doc.data()),!snap.metadata.fromCache),onError);
    });
  }).catch(onError);
  return ()=>{stopped=true;if(unsubscribe)unsubscribe();if(stopAuth)stopAuth();};
}
export async function authenticatedFetch(url,options={}) {
  const mutation=options.method&&!['GET','HEAD','OPTIONS'].includes(options.method.toUpperCase());
  const privateRead=/\/(moderation|operations|sos\/status)(\/|$)/.test(String(url));
  if(!mutation&&!privateRead&&!options.expectedIdentity)return fetch(url,options);
  return pinnedRequest(url,options);
}

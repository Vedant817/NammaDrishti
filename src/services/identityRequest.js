export function identityChanged() {
  return Object.assign(new Error('Your account changed. Retry from the current account.'),{code:'identity-changed'});
}
export function createIdentityTracker() {
  let principal,revision=0,current=null;
  return {
    observe(user) {
      if(user!==principal){principal=user;revision++;}
      current=user?{uid:user.uid,sessionKey:revision,isAnonymous:!!user.isAnonymous,emailVerified:!!user.emailVerified}:null;
      return current;
    },
    isCurrent(identity,user) {
      return !!identity && user===principal && identity.uid===current?.uid && identity.sessionKey===current?.sessionKey;
    },
  };
}
export function createPinnedRequester({getSession,getEntryIdentity,fetcher=(...args)=>fetch(...args)}) {
  return async function request(url,options={}) {
    const {expectedIdentity:explicitIdentity,...nativeOptions}=options;
    const expectedIdentity=explicitIdentity||getEntryIdentity?.();
    if(getEntryIdentity&&!expectedIdentity)throw identityChanged();
    const session=await getSession();
    const guard=()=>{
      if(!session?.identity || !session.isCurrent() || (expectedIdentity && (expectedIdentity.uid!==session.identity.uid || expectedIdentity.sessionKey!==session.identity.sessionKey)))throw identityChanged();
    };
    guard();
    const token=session.getToken?await session.getToken():null;
    guard();
    const headers=new Headers(nativeOptions.headers);
    if(session.getToken){if(!token)throw Object.assign(new Error('Sign in again.'),{code:'auth-required'});headers.set('Authorization',`Bearer ${token}`);}
    const response=await fetcher(url,{...nativeOptions,headers});
    guard();
    return response;
  };
}

import {identityChanged} from './identityRequest';

const retryError=()=>Object.assign(new Error('Uncertain acknowledgement'),{code:'uncertain'});
const count=value=>Number.isFinite(value)&&value>=0;
export function validAcknowledgement(action,body) {
  if(!body||typeof body!=='object')return false;
  if(action.kind==='report')return typeof body.id==='string'&&body.id.length>0&&typeof body.title==='string'&&['Traffic','Waterlogging','Accident','Infrastructure'].includes(body.type)&&Number.isFinite(body.position?.lat)&&Number.isFinite(body.position?.lng)&&!body._isLocalPending;
  if(body.id!==action.payload.incidentId)return false;
  if(action.kind==='verify')return count(body.verificationCount)&&count(body.verificationScore)&&typeof body.isVerified==='boolean';
  return typeof body.cleared==='boolean'&&(body.cleared||count(body.clearanceVotes));
}
function delay(response,attempt,now) {
  const raw=response?.headers?.get('Retry-After');
  const seconds=raw===null||raw===undefined?NaN:Number(raw);
  const header=Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-now;
  return Math.max(2000,Number.isFinite(header)?Math.min(8640000000000000-now,header):Math.min(300000,2000*2**Math.min(attempt-1,8)));
}

// Each boundary is fenced by the originating principal/session and durable claim.
// Already transmitted requests may commit; uncertain replies retain the action.
export function createActionRunner({store,request,isCurrent,apiBase,now=Date.now,onConfirmed=()=>{}}) {
  const guard=identity=>{if(!isCurrent(identity))throw identityChanged();};
  async function run(identity,id) {
    guard(identity);
    let action=await store.claim(identity.uid,id);
    if(!action)return {status:'waiting'};
    let response;
    try {
      guard(identity);
      const send=(path,body,timeout=15000)=>{
        guard(identity);
        return request(`${apiBase}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout),expectedIdentity:identity});
      };
      async function read(res) {
        guard(identity);
        let body;try{body=await res.json();}catch{if(res.ok)throw retryError();body={};}
        guard(identity);return body;
      }
      async function reject(res,body) {
        const blocked=res.status===401||(res.status===403&&body?.code==='EMAIL_VERIFICATION_REQUIRED');
        const transient=res.status===408||res.status===425||res.status===429||res.status>=500;
        throw Object.assign(new Error('Request rejected'),{code:blocked?'account-required':transient?'retryable':'rejected',status:res.status,response:res});
      }
      if(action.kind==='report'&&action.payload.mediaUrl?.startsWith('data:')) {
        response=await send('/media/upload',{imageBase64:action.payload.mediaUrl});
        const body=await read(response);
        if(!response.ok)await reject(response,body);
        let url;try{url=new URL(body.mediaUrl,apiBase);}catch{throw retryError();}
        if(typeof body.mediaUrl!=='string'||!body.mediaUrl.trim()||!['http:','https:'].includes(url.protocol))throw retryError();
        const checkpoint=await store.update(identity.uid,id,action.revision,{payload:{...action.payload,mediaUrl:url.href}},{token:action.leaseToken});
        if(!checkpoint)return {status:'superseded'};
        action=checkpoint;
      }
      guard(identity);
      const path=action.kind==='report'?'/incidents':`/incidents/${encodeURIComponent(action.payload.incidentId)}/${action.kind==='verify'?'verify':'resolve'}`;
      // Caller-supplied identity/internal fields never escape through a draft.
      const p=action.payload;
      const payload=action.kind==='report'?Object.fromEntries(['id','title','type','urgency','description','ward','position','mediaUrl','waterDepth','vehiclePassability'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]])):{...(action.kind==='verify'?{voterPosition:p.voterPosition}:{}),voterId:identity.uid};
      if(action.kind==='report')payload.voterId=identity.uid;
      response=await send(path,payload);
      const body=await read(response);
      const duplicate=response.status===409&&body?.alreadyVoted===true&&action.kind!=='report';
      if(!response.ok&&!duplicate)await reject(response,body);
      if(!validAcknowledgement(action,body))throw retryError();
      guard(identity);
      const completed=await store.complete(identity.uid,id,action.revision,action.leaseToken);
      guard(identity);
      if(!completed)return {status:'superseded'};
      onConfirmed(action,body);
      return {status:'sent',body};
    }catch(err) {
      // Never apply a previous account's response or failure to the new session.
      if(err.code==='identity-changed'||!isCurrent(identity))return {status:'identity-changed'};
      const attempts=action.attempts+1;
      const account=err.code==='account-required',permanent=err.code==='rejected';
      const state=account?'blocked':permanent?'failed':attempts>=5?'blocked':'pending';
      const reason=account?'account':permanent?'rejected':attempts>=5?'retry-limit':'network';
      const nextAt=state==='pending'?now()+delay(err.response||response,attempts,now()):0;
      // Failure and owner gate commit atomically. Stale workers cannot re-block
      // an action that another tab has explicitly retried or edited.
      const updated=await store.update(identity.uid,id,action.revision,{state,reason,nextAt,attempts,httpStatus:err.status||null},{token:action.leaseToken,manual:true,gate:account?{blocked:true,until:0,reason}:state==='pending'?{blocked:false,until:nextAt,reason}:null});
      return {status:updated?state:'superseded',stop:account||state==='pending',reason};
    }
  }
  async function drain(identity) {
    guard(identity);
    const snapshot=await store.list(identity.uid);
    for(const item of snapshot.actions) {
      if(!isCurrent(identity))break;
      if(item.state!=='pending'||item.nextAt>now()||item.leaseUntil>now())continue;
      const result=await run(identity,item.id);
      if(result.stop||result.status==='identity-changed')break;
    }
  }
  return {run,drain};
}

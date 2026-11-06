const KINDS=new Set(['report','verify','clear']);
const STATES=new Set(['pending','blocked','failed']);
const idMatches=(item)=>item.kind==='report'?item.id===item.payload?.id:item.id===`${item.kind}:${item.payload?.incidentId}`;
const MAX_ACTIONS=100,MAX_BYTES=10*1024*1024,LEASE_MS=45000;
const error=code=>Object.assign(new Error(code),{code});
const ownerOK=owner=>typeof owner==='string'&&owner.length>0&&owner.length<=128;
const idOK=id=>typeof id==='string'&&id.length>0&&id.length<=300;
function payloadOK(kind,payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return false;
  if(kind==='report')return idOK(payload.id)&&typeof payload.title==='string'&&typeof payload.description==='string'&&Number.isFinite(payload.position?.lat)&&Number.isFinite(payload.position?.lng)&&payload.position.lat>=12.7&&payload.position.lat<=13.28&&payload.position.lng>=77.3&&payload.position.lng<=77.88;
  return idOK(payload.incidentId);
}
export function validAction(item,owner) {
  return !!item&&item.owner===owner&&ownerOK(owner)&&idOK(item.id)&&KINDS.has(item.kind)&&STATES.has(item.state)&&payloadOK(item.kind,item.payload)&&idMatches(item)&&Number.isInteger(item.revision)&&item.revision>0&&Number.isFinite(item.createdAt)&&item.createdAt>=0&&Number.isFinite(item.updatedAt)&&item.updatedAt>=item.createdAt&&Number.isFinite(item.nextAt)&&item.nextAt>=0&&Number.isFinite(item.leaseUntil)&&item.leaseUntil>=0&&(item.leaseToken===null||typeof item.leaseToken==='string')&&Number.isInteger(item.attempts)&&item.attempts>=0;
}
export function legacyActionsPresent(storage=globalThis.localStorage) {
  try {
    for(const key of ['nammadrishti_offline_queue_v1','nammadrishti_offline_votes_v1','nammadrishti_user_votes_v1','nammapulse_user_votes_v1']) {
      const raw=storage.getItem(key);if(!raw)continue;
      try {const value=JSON.parse(raw);if(Array.isArray(value)?value.length>0:value&&typeof value==='object'&&Object.keys(value).length>0)return true;}catch{return true;}
    }
    const cached=JSON.parse(storage.getItem('nammadrishti_events_v2')||'[]');
    return Array.isArray(cached)&&cached.some(item=>item?._isLocalPending);
  }catch{return false;}
}
export function createOfflineStore({getIndexedDB=()=>globalThis.indexedDB,name='nammadrishti-actions-v1',now=Date.now,newId=()=>crypto.randomUUID(),openTimeoutMs=4000}={}) {
  let connection;
  const listeners=new Set();let channel;
  function changed(owner) {
    for(const listener of listeners){try{listener(owner);}catch{}}
    try {channel?.postMessage({owner});}catch{}
  }
  function open() {
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      let done=false,request;
      const fail=()=>{if(done)return;done=true;clearTimeout(timer);reject(error('storage-unavailable'));};
      const timer=setTimeout(fail,openTimeoutMs);
      try {request=getIndexedDB()?.open(name,1);if(!request){fail();return;}}catch{fail();return;}
      request.onupgradeneeded=()=>{
        const db=request.result;
        for(const store of ['actions','markers']){const table=db.createObjectStore(store,{keyPath:['owner','id']});table.createIndex('owner','owner');}
      };
      request.onerror=fail;request.onblocked=fail;
      request.onsuccess=()=>{
        if(done){request.result.close();return;}
        done=true;clearTimeout(timer);
        request.result.onversionchange=()=>{request.result.close();connection=null;};
        resolve(request.result);
      };
    }).catch(err=>{connection=null;throw err;});
    return connection;
  }
  async function transaction(tables,mode,task) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      let result,tx;
      try {tx=db.transaction(tables,mode,{durability:mode==='readwrite'?'strict':'default'});tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error(tx.error?.name==='QuotaExceededError'?'storage-full':'storage-unavailable'));tx.onerror=()=>{};task(Object.fromEntries(tables.map(table=>[table,tx.objectStore(table)])),value=>{result=value;},tx);}
      catch {try{tx?.abort();}catch{}reject(error('storage-unavailable'));}
    });
  }
  function owned(owner){if(!ownerOK(owner))throw error('identity-unavailable');}
  async function list(owner) {
    owned(owner);
    return transaction(['actions','markers'],'readonly',({actions,markers},set)=>{
      const a=actions.index('owner').getAll(owner),m=markers.index('owner').getAll(owner);let values,seen;
      const finish=()=>{if(!values||!seen)return;set({actions:values.filter(item=>validAction(item,owner)).sort((x,y)=>x.createdAt-y.createdAt),markers:seen.filter(item=>item.owner===owner&&idOK(item.id)&&Number.isFinite(item.at)&&now()-item.at<7*86400000),invalidCount:values.filter(item=>!validAction(item,owner)).length});};
      a.onsuccess=()=>{values=a.result;finish();};m.onsuccess=()=>{seen=m.result;finish();};
    });
  }
  async function enqueue(owner,input) {
    owned(owner);
    try {input={id:input.id,kind:input.kind,payload:structuredClone(input.payload)};JSON.stringify(input.payload);}catch{throw error('invalid-action');}
    if(!KINDS.has(input.kind)||!idOK(input.id)||!payloadOK(input.kind,input.payload)||!idMatches(input))throw error('invalid-action');
    const result=await transaction(['actions','markers'],'readwrite',({actions,markers},set,tx)=>{
      const marker=input.kind==='report'?null:markers.get([owner,input.id]);
      const proceed=()=>{
        if(marker?.result&&now()-marker.result.at<7*86400000){set({duplicate:true});return;}
        const get=actions.get([owner,input.id]);get.onsuccess=()=>{
          if(get.result){if(!validAction(get.result,owner)){set({error:'invalid-action'});return;}set({action:get.result,existing:true});return;}
          const all=actions.index('owner').getAll(owner);all.onsuccess=()=>{
            const bytes=JSON.stringify(input.payload).length*2+all.result.reduce((sum,item)=>sum+JSON.stringify(item).length*2,0);
            if(all.result.length>=MAX_ACTIONS||bytes>MAX_BYTES){set({error:'storage-full'});return;}
            const time=now(),action={owner,id:input.id,kind:input.kind,payload:structuredClone(input.payload),state:'pending',reason:null,attempts:0,nextAt:0,revision:1,leaseToken:null,leaseUntil:0,createdAt:time,updatedAt:time};
            actions.add(action);set({action});
          };
        };
      };
      if(marker)marker.onsuccess=proceed;else proceed();
    });
    if(result?.error)throw error(result.error);changed(owner);return result;
  }
  async function claim(owner,id) {
    owned(owner);if(!idOK(id))throw error('invalid-action');
    const result=await transaction(['actions'],'readwrite',({actions},set)=>{
      const get=actions.get([owner,id]);get.onsuccess=()=>{
        const current=get.result,time=now();
        if(!validAction(current,owner)||current.state!=='pending'||current.nextAt>time||current.leaseUntil>time){set(null);return;}
        const next={...current,leaseToken:newId(),leaseUntil:time+LEASE_MS,revision:current.revision+1,updatedAt:time};actions.put(next);set(next);
      };
    });
    if(result)changed(owner);return result;
  }
  async function update(owner,id,revision,patch,{token=null,manual=false}={}) {
    owned(owner);
    try{patch=structuredClone(patch);}catch{throw error('invalid-action');}if(!idOK(id))throw error('invalid-action');
    const result=await transaction(['actions'],'readwrite',({actions},set)=>{
      const get=actions.get([owner,id]);get.onsuccess=()=>{
        const current=get.result;
        if(!validAction(current,owner)||current.revision!==revision||(token?current.leaseToken!==token||current.leaseUntil<=now():current.leaseUntil>now())){set(null);return;}
        const safe=Object.fromEntries(['state','reason','nextAt','attempts','httpStatus','payload'].filter(key=>Object.hasOwn(patch,key)).map(key=>[key,patch[key]]));
        const next={...current,...safe,revision:current.revision+1,updatedAt:now(),...(manual?{leaseToken:null,leaseUntil:0}:{})};
        if(!validAction(next,owner)){set(null);return;}
        const all=actions.index('owner').getAll(owner);all.onsuccess=()=>{const bytes=all.result.filter(item=>item.id!==id).reduce((sum,item)=>sum+JSON.stringify(item).length*2,JSON.stringify(next).length*2);if(bytes>MAX_BYTES){set(null);return;}actions.put(next);set(next);};
      };
    });
    if(result)changed(owner);return result;
  }
  async function complete(owner,id,revision,token) {
    owned(owner);
    const result=await transaction(['actions','markers'],'readwrite',({actions,markers},set)=>{
      const get=actions.get([owner,id]);get.onsuccess=()=>{
        const current=get.result;
        if(!validAction(current,owner)||current.revision!==revision||current.leaseToken!==token||current.leaseUntil<=now()){set(false);return;}
        actions.delete([owner,id]);
        if(current.kind!=='report'){
          markers.put({owner,id,at:now()});
          const all=markers.index('owner').getAll(owner);all.onsuccess=()=>{const rows=all.result.sort((a,b)=>b.at-a.at);for(const item of rows.filter((item,index)=>index>=2000||now()-item.at>=7*86400000))markers.delete([owner,item.id]);};
        }
        set(true);
      };
    });
    if(result)changed(owner);return result;
  }
  async function discard(owner,id,revision) {
    owned(owner);if(!idOK(id))throw error('invalid-action');
    const result=await transaction(['actions'],'readwrite',({actions},set)=>{
      const get=actions.get([owner,id]);get.onsuccess=()=>{const current=get.result;if(!validAction(current,owner)||current.revision!==revision||current.leaseUntil>now()){set(false);return;}actions.delete([owner,id]);set(true);};
    });
    if(result)changed(owner);return result;
  }
  return {list,enqueue,claim,update,complete,discard,subscribe(listener){
    listeners.add(listener);
    if(!channel&&typeof BroadcastChannel!=='undefined'){try{channel=new BroadcastChannel(name);channel.onmessage=event=>{if(ownerOK(event.data?.owner))for(const cb of listeners){try{cb(event.data.owner);}catch{}}};}catch{}}
    return()=>{listeners.delete(listener);if(!listeners.size){channel?.close();channel=null;}};
  },async close(){if(connection){const db=await connection;db.close();connection=null;}channel?.close();channel=null;listeners.clear();}};
}
export const offlineStore=createOfflineStore();

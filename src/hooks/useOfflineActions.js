import {useCallback,useEffect,useRef,useState} from 'react';
import {API_BASE} from '../services/api';
import {authenticatedFetch,subscribeActionIdentity,isActionIdentityCurrent} from '../services/firebaseService';
import {offlineStore,legacyActionsPresent} from '../services/offlineStore';
import {MAX_ACTION_AGE_MS,createActionRunner} from '../services/actionRunner';

export function useOfflineActions(onConfirmed) {
  const [identity,setIdentity]=useState(null),[snapshot,setSnapshot]=useState({actions:[],markers:[],gate:{}}),[storageError,setStorageError]=useState(null);
  const identityRef=useRef(null),generation=useRef(0),mounted=useRef(false),workers=useRef(new Set()),callback=useRef(onConfirmed);
  callback.current=onConfirmed;
  const [legacy]=useState(()=>legacyActionsPresent());
  const current=useCallback(i=>mounted.current&&identityRef.current?.sessionKey===i?.sessionKey&&identityRef.current?.uid===i?.uid&&isActionIdentityCurrent(i),[]);
  const refresh=useCallback(async(i=identityRef.current)=>{
    if(!i||!current(i))return;
    const revision=++generation.current;
    try{const value=await offlineStore.list(i.uid);if(current(i)&&generation.current===revision){setSnapshot(value);setStorageError(null);}}
    catch(err){if(current(i)&&generation.current===revision)setStorageError(err.code||'storage-unavailable');}
  },[current]);
  const syncOfflineQueue=useCallback(async()=>{
    const i=identityRef.current;if(!i||!current(i)||navigator.onLine===false)return;
    const key=i.uid+':'+i.sessionKey;if(workers.current.has(key))return;
    workers.current.add(key);
    try{
      const runner=createActionRunner({store:offlineStore,request:authenticatedFetch,isCurrent:current,apiBase:API_BASE,onConfirmed:(action,body)=>{if(current(i))callback.current?.(action,body);}});
      await runner.drain(i);
    }catch(err){if(current(i)&&err.code!=='identity-changed')setStorageError(err.code||'storage-unavailable');}
    finally{workers.current.delete(key);await refresh(i);}
  },[current,refresh]);
  useEffect(()=>{
    mounted.current=true;
    const stopIdentity=subscribeActionIdentity(i=>{
      identityRef.current=i;generation.current++;setIdentity(i);setSnapshot({actions:[],markers:[],gate:{}});setStorageError(null);
      if(i){refresh(i);syncOfflineQueue();}
    });
    const stopStorage=offlineStore.subscribe(owner=>{if(identityRef.current?.uid===owner){refresh();syncOfflineQueue();}});
    const tick=()=>{refresh();syncOfflineQueue();};
    window.addEventListener('online',tick);const timer=setInterval(tick,5000);
    return()=>{mounted.current=false;identityRef.current=null;generation.current++;stopIdentity();stopStorage();clearInterval(timer);window.removeEventListener('online',tick);};
  },[refresh,syncOfflineQueue]);
  const persist=useCallback(async(input,expectedIdentity=identityRef.current)=>{
    const i=expectedIdentity;
    if(!i||!current(i))return {errorCode:'identity-changed'};
    try{
      const result=await offlineStore.enqueue(i.uid,input);
      if(!current(i))return {errorCode:'identity-changed'};
      await refresh(i);void syncOfflineQueue();
      return result.duplicate?{alreadyVoted:true}:{saved:true};
    }catch(err){if(current(i))setStorageError(err.code||'storage-unavailable');return {errorCode:err.code||'storage-unavailable'};}
  },[current,refresh,syncOfflineQueue]);
  const addEvent=useCallback((payload,i)=>persist({id:payload.id,kind:'report',payload},i),[persist]);
  const vote=useCallback((kind,id,voterPosition,i,summary={})=>persist({id:kind+':'+id,kind,payload:{incidentId:id,voterPosition,title:summary.title,ward:summary.ward}},i),[persist]);
  const changeAction=useCallback(async(action,operation,payload)=>{
    const i=identityRef.current;if(!i||action.owner!==i.uid||!current(i))return {errorCode:'identity-changed'};
    if(operation!=='discard'&&(action.reason==='stale'||Date.now()-(action.observedAt??action.createdAt)>MAX_ACTION_AGE_MS)&&(!payload||!payload.confirmedFreshObservation))return {errorCode:'action-stale'};
    try{
      let result;
      if(operation==='discard')result=await offlineStore.discard(i.uid,action.id,action.revision);
      else result=await offlineStore.update(i.uid,action.id,action.revision,{state:'pending',reason:null,nextAt:0,attempts:0,httpStatus:null,...(payload?{payload:action.kind==='report'?{...payload,id:action.id}:{...action.payload,confirmedFreshObservation:true}}:{})},{manual:true,gate:{until:0,blocked:false},resetGate:true});
      if(!current(i))return {errorCode:'identity-changed'};
      if(!result){await refresh(i);return {errorCode:'action-changed'};}
      await refresh(i);if(operation!=='discard')void syncOfflineQueue();return {saved:true};
    }catch(err){if(current(i))setStorageError(err.code||'storage-unavailable');return {errorCode:err.code||'storage-unavailable'};}
  },[current,refresh,syncOfflineQueue]);
  // Never render the previous principal's records, even between an auth event
  // and React committing its identity subscription update.
  const visible=identity&&current(identity)?snapshot:{actions:[],markers:[],gate:{}};
  return {actionIdentity:identity,savedActions:visible.actions,actionGate:visible.gate,storageError,legacyActions:legacy,invalidActionCount:visible.invalidCount||0,
    offlineQueueCount:visible.actions.filter(a=>a.state==='pending').length,syncOfflineQueue,addEvent,
    verifyEvent:(id,position,i,summary)=>vote('verify',id,position,i,summary),resolveEvent:(id,i,summary)=>vote('clear',id,null,i,summary),changeAction,
    hasUserVoted:(id,kind)=>visible.markers.some(m=>m.id===kind+':'+id)||visible.actions.some(a=>a.id===kind+':'+id&&a.state!=='failed')};
}

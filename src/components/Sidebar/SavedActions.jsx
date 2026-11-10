import React,{useState} from 'react';
import {useOfflineCopy} from '../../data/offlineCopy';
import {MAX_ACTION_AGE_MS} from '../../services/actionRunner';
import './SavedActions.css';
export default function SavedActions({actions=[],gate={},storageError,legacy=false,invalidCount=0,onChange,onEdit}) {
 const copy=useOfflineCopy(),[error,setError]=useState(null),[busy,setBusy]=useState(null);
 async function change(action,operation,payload){setBusy(action.id);setError(null);try{const result=await onChange(action,operation,payload);if(result?.errorCode)setError(copy[result.errorCode]||copy['storage-unavailable']);}catch{setError(copy['storage-unavailable']);}finally{setBusy(null);}}
 return <section className="saved-actions" aria-labelledby="saved-actions-title">
  <h3 id="saved-actions-title">{copy.title} <span>{actions.length}</span></h3><p>{copy.intro}</p>
  {legacy&&<p role="note">{copy.legacy}</p>}{invalidCount>0&&<p role="alert">{copy.invalid}</p>}
  {(error||storageError)&&<p role="alert">{error||copy[storageError]||copy['storage-unavailable']}</p>}
  {gate.blocked&&<p role="status">{copy.gate}</p>}
  {!actions.length&&!storageError&&<p>{copy.empty}</p>}
  <ul>{actions.map(action=>{
   const sending=action.leaseUntil>Date.now(),state=sending?'sending':action.state==='pending'&&gate.blocked?'blocked':action.state;
   const until=Math.max(action.nextAt,gate.until||0);
   const ageExpired=Date.now()-(action.observedAt??action.createdAt)>MAX_ACTION_AGE_MS;
   const needsReverify=action.reason==='stale'||ageExpired;
   return <li key={action.id}><div className="saved-actions__heading"><strong>{action.payload.title||action.payload.incidentId}</strong><span>{copy[state]}</span></div>
    <p>{copy[action.kind]}{action.payload.mediaUrl?' - '+copy.photo:''}</p>
    {action.reason&&<p>{action.reason==='retry-limit'?copy.limit:copy[action.reason]||copy.rejected}{action.httpStatus?` (${action.httpStatus})`:''}</p>}
    {state==='pending'&&until>Date.now()&&<p>{copy.waitUntil}: <time dateTime={new Date(until).toISOString()}>{new Date(until).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></p>}
    {action.uncertain&&<p>{copy.uncertain}</p>}
    {action.kind==='report'&&<details><summary>{copy.report}</summary><p>{action.payload.description}</p><p>{action.payload.ward}</p>{action.payload.mediaUrl&&<img src={action.payload.mediaUrl} alt={copy.photo}/>}</details>}
    <div className="saved-actions__buttons">{action.reason!=='stale'&&!ageExpired&&<button type="button" disabled={sending||busy!==null} onClick={()=>change(action,'retry')}>{copy.retry}</button>}
    {action.kind==='report'&&(action.state==='failed'||ageExpired)&&(!action.uncertain||needsReverify)&&<button type="button" disabled={sending||busy!==null} onClick={()=>onEdit(action)}>{needsReverify?copy.review:copy.edit}</button>}
     {action.kind!=='report'&&needsReverify&&<button type="button" disabled={sending||busy!==null} onClick={()=>change(action,'retry',{confirmedFreshObservation:true})}>{copy.reverify}</button>}
    <button type="button" disabled={sending||busy!==null} onClick={()=>change(action,'discard')}>{copy.discard}</button></div>
   </li>;
  })}</ul>
 </section>;
}

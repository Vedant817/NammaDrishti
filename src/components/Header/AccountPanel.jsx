import React, { useState } from 'react';
import { citizenRole, signInCitizen, signOutCitizen, authenticatedFetch } from '../../services/firebaseService';
import { API_BASE } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useDialog } from '../../hooks/useDialog';
export default function AccountPanel({onClose}) {
  const {t}=useLanguage();const dialog=useDialog(onClose);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[register,setRegister]=useState(false),[status,setStatus]=useState(''),[role,setRole]=useState(null),[items,setItems]=useState([]),[audit,setAudit]=useState([]),[operations,setOperations]=useState(null);
  async function refresh(){const current=await citizenRole();setRole(current);setStatus(current?.verified?t.account.verified:t.account.verify);if(current?.moderator){const r=await authenticatedFetch(`${API_BASE}/moderation`);if(!r.ok)throw new Error();const data=await r.json();setItems(data.incidents);setAudit(data.audit);const ops=await authenticatedFetch(`${API_BASE}/operations`);if(ops.ok)setOperations(await ops.json());}}
  async function submit(e){e.preventDefault();try{await signInCitizen(email,password,register);setPassword('');await refresh();}catch{setStatus(t.account.failed);}}
  async function moderate(id,action){const reason=window.prompt(t.account.reason);if(!reason)return;try{const r=await authenticatedFetch(`${API_BASE}/moderation/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reason})});if(!r.ok)throw new Error();await refresh();}catch{setStatus(t.account.failed);}}
  return <div className="modal-overlay" onClick={onClose}><section ref={dialog} className="report-modal-content" role="dialog" aria-modal="true" aria-label={t.account.title} tabIndex={-1} onClick={e=>e.stopPropagation()} style={{padding:24,overflow:'auto',maxHeight:'85dvh'}}>
    <button type="button" onClick={onClose}>{t.ui['Close dialog']}</button><h3>{t.account.title}</h3><p>{t.account.explain}</p>
    <form onSubmit={submit}><label>{t.account.email}<input type="email" required value={email} autoComplete="email" onChange={e=>setEmail(e.target.value)}/></label><label>{t.account.password}<input type="password" required minLength={8} value={password} autoComplete={register?'new-password':'current-password'} onChange={e=>setPassword(e.target.value)}/></label><label><input type="checkbox" checked={register} onChange={e=>setRegister(e.target.checked)}/>{t.account.create}</label><button type="submit">{t.account.signIn}</button></form>
    <button onClick={()=>refresh().catch(()=>setStatus(t.account.failed))}>{t.account.refresh}</button><button onClick={()=>signOutCitizen().then(()=>{setRole(null);setItems([]);setStatus('');})}>{t.live.signOut}</button><p role="status">{status}</p>
    {role?.moderator&&<><h4>{t.live.moderation}</h4>{items.map(i=><article key={i.id}><strong>{i.title}</strong><p>{i.description}</p><button onClick={()=>moderate(i.id,i.moderationHidden?'restore':'hide')}>{i.moderationHidden?t.account.restore:t.account.hide}</button></article>)}<details><summary>{t.account.audit}</summary>{audit.map(a=><p key={a.id}>{a.at} · {a.action} · {a.reason}</p>)}</details><pre>{JSON.stringify(operations,null,2)}</pre></>}
  </section></div>;
}

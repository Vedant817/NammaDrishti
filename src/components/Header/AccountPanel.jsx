import BackupStatus from './BackupStatus';
import React, { useEffect, useState, useRef } from 'react';
import { UserRound, X, CheckCircle2 } from 'lucide-react';
import { subscribeActionIdentity, actionIdentitySnapshot, isActionIdentityCurrent, citizenRole, signInCitizen, signOutCitizen, resendCitizenVerification, authenticatedFetch } from '../../services/firebaseService';
import { API_BASE } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useDialog } from '../../hooks/useDialog';
import './AccountPanel.css';

export default function AccountPanel({ onClose }) {
  const { t } = useLanguage();
  const dialog = useDialog(onClose);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState(null);
  const [items, setItems] = useState([]);
  const [audit, setAudit] = useState([]);
  const [operations, setOperations] = useState(null);
  const [reason, setReason] = useState('');
  const session=useRef(null),epoch=useRef(0),operation=useRef(0),active=useRef(false),locked=useRef(false);
  const current=(identity,version)=>active.current&&epoch.current===version&&session.current?.uid===identity?.uid&&session.current?.sessionKey===identity?.sessionKey&&(!identity||isActionIdentityCurrent(identity));
  useEffect(()=>{
    active.current=true;
    const stop=subscribeActionIdentity(identity=>startRefresh(identity));
    return()=>{active.current=false;epoch.current++;operation.current++;stop();};
  },[]);
  async function refresh(identity=session.current,version=epoch.current) {
    if(!identity||!current(identity,version))return;
    setOperations(null);
    const value=await citizenRole(identity);
    if(!current(identity,version))return;
    setRole(value);setError(false);
    setStatus(value?.email?value.verified?t.account.verified:t.account.verify:'');
    if(value?.moderator){
      const response=await authenticatedFetch(`${API_BASE}/moderation`,{expectedIdentity:identity});
      if(!response.ok)throw new Error();const data=await response.json();
      if(!current(identity,version))return;
      setItems(data.incidents);setAudit(data.audit);
      const responseOps=await authenticatedFetch(`${API_BASE}/operations`,{expectedIdentity:identity});
      if(!responseOps.ok)throw new Error();const dataOps=await responseOps.json();
      if(current(identity,version))setOperations(dataOps);
    }
  }
  async function startRefresh(identity){
    session.current=identity;const version=++epoch.current,job=++operation.current;
    locked.current=true;setBusy(true);setRole(null);setItems([]);setAudit([]);setOperations(null);setReason('');setPassword('');setEmail('');setStatus('');setError(false);
    try{await refresh(identity,version);}catch{if(current(identity,version)){setError(true);setStatus(t.account.failed);}}
    finally{if(active.current&&operation.current===job){locked.current=false;setBusy(false);}}
  }
  async function perform(task){
    if(locked.current)return;
    const identity=session.current,version=epoch.current,job=++operation.current;
    locked.current=true;setBusy(true);setStatus('');setError(false);
    try{await task(identity,version);}
    catch{if(current(identity,version)){setError(true);setStatus(t.account.failed);}}
    finally{if(active.current&&operation.current===job){locked.current=false;setBusy(false);}}
  }
  function submit(event){
    event.preventDefault();
    perform(async()=>{await signInCitizen(email.trim(),password,register);if(active.current)await startRefresh(actionIdentitySnapshot());});
  }
  function moderate(id,action){
    perform(async(identity,version)=>{
      const response=await authenticatedFetch(`${API_BASE}/moderation/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reason}),expectedIdentity:identity});
      if(!response.ok)throw new Error();
      if(current(identity,version)){setReason('');await refresh(identity,version);}
    });
  }
  const visibleRole=current(session.current,epoch.current)?role:null;
  const signedIn = Boolean(visibleRole?.email);
  return <div className="modal-overlay account-overlay" onClick={onClose}>
    <section ref={dialog} className={`account-panel ${visibleRole?.moderator ? 'account-panel--moderator' : ''}`} role="dialog" aria-modal="true" aria-labelledby="account-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className="account-panel__header">
        <span className="account-panel__icon" aria-hidden="true"><UserRound size={22} strokeWidth={1.7}/></span>
        <h2 id="account-title">{t.account.title}</h2>
        <button className="account-panel__close" type="button" onClick={onClose} aria-label={t.ui['Close dialog']}><X size={20}/></button>
      </header>
      <div className="account-panel__body">
        <p className="account-panel__intro">{t.account.explain}</p>
        {!signedIn ? <>
          <div className="account-panel__modes" aria-label={t.account.title}>
            <button type="button" aria-pressed={!register} onClick={() => {setRegister(false);setStatus('');}}>{t.account.signIn}</button>
            <button type="button" aria-pressed={register} onClick={() => {setRegister(true);setStatus('');}}>{t.account.create}</button>
          </div>
          <form className="account-panel__form" onSubmit={submit}>
            <div className="account-panel__field"><label htmlFor="account-email">{t.account.email}</label><input id="account-email" type="email" name="email" required maxLength={254} value={email} autoComplete="email" onChange={event => setEmail(event.target.value)}/></div>
            <div className="account-panel__field"><label htmlFor="account-password">{t.account.password}</label><input id="account-password" type="password" name="password" required minLength={register ? 8 : 6} maxLength={128} value={password} autoComplete={register ? 'new-password' : 'current-password'} onChange={event => setPassword(event.target.value)}/>{register && <small>{t.account.passwordHint}</small>}</div>
            <button className="account-panel__primary" type="submit" disabled={busy}>{busy ? t.account.working : register ? t.account.create : t.account.signIn}</button>
          </form>
        </> : <div className="account-panel__identity"><span className="account-panel__email">{visibleRole.email}</span><span className={`account-panel__verification ${visibleRole.verified ? 'is-verified' : ''}`}>{visibleRole.verified && <CheckCircle2 size={16}/>} {visibleRole.verified ? t.account.verified : t.account.verify}</span></div>}
        {status && <p className={`account-panel__status ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{status}</p>}
        {signedIn && <div className="account-panel__actions">
          <button type="button" disabled={busy} onClick={() => perform((identity,version)=>refresh(identity,version))}>{t.account.refresh}</button>
          {!visibleRole.verified && <button type="button" disabled={busy} onClick={() => perform(async (identity,version) => { await resendCitizenVerification(identity); if(current(identity,version))setStatus(t.account.verify); })}>{t.account.resend}</button>}
          <button type="button" disabled={busy} onClick={() => perform(async (identity) => { await signOutCitizen(identity);if(active.current)await startRefresh(actionIdentitySnapshot()); })}>{t.live.signOut}</button>
        </div>}
        {visibleRole?.moderator && <section className="account-panel__moderation">
          <h3>{t.live.moderation}</h3>
          <label htmlFor="moderation-reason">{t.account.reason}</label><textarea id="moderation-reason" value={reason} maxLength={500} onChange={event => setReason(event.target.value)}/>
          {items.length === 0 && <p>{t.sidebar.emptyState}</p>}
          {items.map(item => <article className="account-panel__report" key={item.id}><div><strong>{item.title}</strong><p>{item.description}</p></div><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => moderate(item.id, item.moderationHidden ? 'restore' : 'hide')}>{item.moderationHidden ? t.account.restore : t.account.hide}</button></article>)}
          <details><summary>{t.account.audit}</summary>{audit.map(entry => <p key={entry.id}>{new Date(entry.at).toLocaleString()} · {entry.action} · {entry.reason} · {entry.status}</p>)}</details>
          {operations?.backup && <BackupStatus backup={operations.backup}/>}
          {operations && <dl className="account-panel__metrics">{Object.entries(operations.sources || {}).map(([source,value]) => <div key={source}><dt>{source}</dt><dd>{value}</dd></div>)}</dl>}
        </section>}
      </div>
    </section>
  </div>;
}

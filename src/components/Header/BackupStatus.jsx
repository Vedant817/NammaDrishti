import React,{useState,useEffect} from 'react';
import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import {cityTime} from '../../utils/sourceTime';
export default function BackupStatus({backup}) {
  const copy=useInterfaceCopy();
  const [clock,setClock]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  if(!backup)return null;
  const time=value=>Number.isFinite(value)&&value>0?cityTime(value):copy.backupUnknown;
  let health=backup.health || (backup.configured?'unknown':'unconfigured');
  if(health==='healthy'){
    if(!Number.isFinite(backup.completedAt)||backup.completedAt<=0||backup.completedAt>clock+300000)health='unknown';
    else if(clock-backup.completedAt>26*3600000)health='stale';
  }
  const state=value=>copy['backup_'+value] || copy.backupUnknown;
  const warning=['failed','stale','never-completed','unconfigured','unknown'].includes(health)||backup.retentionStatus==='failed'||backup.cleanupStatus==='failed';
  return <section className="account-panel__backup" aria-label={copy.backupTitle}>
    <h3>{copy.backupTitle}</h3>
    <p role={warning?'alert':'status'}>{state(health)}</p>
    <dl className="account-panel__metrics">
      <div><dt>{copy.backupCompleted}</dt><dd>{time(backup.completedAt)}</dd></div>
      <div><dt>{copy.backupTrigger}</dt><dd>{state(backup.lastCompletedTrigger)}</dd></div>
      <div><dt>{copy.backupAttempt}</dt><dd>{time(backup.lastAttemptAt)}</dd></div>
      <div><dt>{copy.backupMaintenance}</dt><dd>{time(backup.lastMaintenanceAt)}</dd></div>
      <div><dt>{copy.backupRetention}</dt><dd>{state(backup.retentionStatus)}</dd></div>
      <div><dt>{copy.backupCleanup}</dt><dd>{state(backup.cleanupStatus)}</dd></div>
      {backup.nextAttemptAt>0&&<div><dt>{copy.backupRetry}</dt><dd>{time(backup.nextAttemptAt)}</dd></div>}
    </dl>
    <p>{copy.backupScheduleLimit}</p>
  </section>;
}

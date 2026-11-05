async function runMaintenanceAndBackup(maintenance, backup) {
  const outcomes={};
  for(const [name,task] of [['maintenance',maintenance],['backup',backup]]) {
    try { const result=await task();outcomes[name]=result || {status:'complete'}; }
    catch { outcomes[name]={status:'failed'}; }
  }
  const success=outcomes.maintenance.status!=='failed' && ['complete','skipped'].includes(outcomes.backup.status);
  return {success,...outcomes};
}
module.exports={runMaintenanceAndBackup};

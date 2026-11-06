async function runMaintenanceAndBackup(maintenance, backup) {
  const tasks=[maintenance,backup].map(task=>Promise.resolve().then(task));
  const values=await Promise.allSettled(tasks);
  const result=index=>values[index].status==='fulfilled'?(values[index].value||{status:'complete'}):{status:'failed'};
  const outcomes={maintenance:result(0),backup:result(1)};
  const success=outcomes.maintenance.status!=='failed'&&['complete','skipped'].includes(outcomes.backup.status);
  return {success,...outcomes};
}
module.exports={runMaintenanceAndBackup};

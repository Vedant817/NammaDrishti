export function incidentTime(item,lang='en') {
  const date=new Date(item?.createdAt||item?.timestamp||'');
  if(!Number.isFinite(date.getTime()))return item?.timestamp||'';
  return new Intl.DateTimeFormat(({en:'en-IN',kn:'kn-IN',hi:'hi-IN'})[lang]||'en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(date)+' IST';
}

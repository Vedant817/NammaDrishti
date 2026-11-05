export const CITY_TIMEZONE = 'Asia/Kolkata';
export const cityDate = (time = Date.now()) => new Intl.DateTimeFormat('en-CA',{timeZone:CITY_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
export const cityTime = time => new Intl.DateTimeFormat('en-IN',{timeZone:CITY_TIMEZONE,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(time)) + ' IST';
export const freshSource = (source, now=Date.now()) => ['available','partial'].includes(source?.status) && Number.isFinite(Date.parse(source.fetchedAt)) && now-Date.parse(source.fetchedAt)<180000 && Date.parse(source.fetchedAt)<=now+300000;
export const activeAlerts = (source, now=Date.now()) => freshSource(source,now) ? (source.alerts||[]).filter(a=>Date.parse(a.effectiveAt)<=now&&Date.parse(a.expiresAt)>now) : [];
export const activeTrafficIncidents = (source, now=Date.now()) => freshSource(source,now) ? (source.incidents||[]).filter(a=>(!a.startTime||Date.parse(a.startTime)<=now)&&(!a.endTime||Date.parse(a.endTime)>now)) : [];

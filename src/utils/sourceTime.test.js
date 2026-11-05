import {cityDate,activeAlerts,activeTrafficIncidents} from './sourceTime';
test('Bengaluru date uses IST across UTC midnight boundaries',()=>{
  expect(cityDate(Date.parse('2026-11-05T18:29:59Z'))).toBe('2026-11-05');
  expect(cityDate(Date.parse('2026-11-05T18:30:00Z'))).toBe('2026-11-06');
});
test('alerts and road incidents expire without waiting for another successful network request',()=>{
  const now=Date.parse('2026-11-05T14:00:00Z'),source={status:'available',fetchedAt:new Date(now).toISOString(),alerts:[{effectiveAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+1000).toISOString()}],incidents:[{endTime:new Date(now+1000).toISOString()}]};
  expect(activeAlerts(source,now)).toHaveLength(1);expect(activeTrafficIncidents(source,now)).toHaveLength(1);
  expect(activeAlerts(source,now+1000)).toHaveLength(0);expect(activeTrafficIncidents(source,now+1000)).toHaveLength(0);
  expect(activeAlerts({...source,fetchedAt:new Date(now-180001).toISOString()},now)).toHaveLength(0);
  expect(activeAlerts({...source,status:'unavailable'},now)).toHaveLength(0);
});

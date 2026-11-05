// Read-only hosted acceptance. Empty successful feeds are valid; failed feeds
// must never be counted as zero warnings. No provider keys are needed here.
const assert=require('node:assert/strict');
const {cityDate}=require('../server/services/sourceTime');
const base=process.env.ACCEPTANCE_API_URL||'http://127.0.0.1:5001/api';
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,path);return r.json();}
async function main(){
  const now=Date.now(),today=cityDate(now);
  const [health,weather,traffic,river,official,incidents,push]=await Promise.all(['/health','/weather','/traffic','/flood-context','/official-alerts','/traffic-incidents','/push/config'].map(read));
  assert.equal(health.status,'online');assert.equal(weather.isOffline,false);assert.ok(now-Date.parse(weather.observedAt)<1800000);assert.ok(Number.isFinite(weather.precipitationAmountMm));
  assert.equal(traffic.status,'available');assert.ok(traffic.segments.some(s=>!s.unavailable&&Number.isFinite(s.currentSpeed)));
  assert.equal(river.status,'available');assert.equal(river.date,today);assert.ok(river.forecast.some(f=>f.date===today));
  assert.ok(['available','partial'].includes(official.status));assert.equal(official.date,today);
  for(const alert of official.alerts){assert.ok(Date.parse(alert.effectiveAt)<=now&&Date.parse(alert.expiresAt)>now);assert.ok(/^https:\/\/sachet\.ndma\.gov\.in\//.test(alert.sourceUrl));}
  assert.equal(incidents.status,'available','Traffic incidents API must be authorized, not silently empty');assert.equal(incidents.date,today);
  for(const item of incidents.incidents){assert.ok(!item.endTime||Date.parse(item.endTime)>now);assert.ok(item.position.lat>=12.7&&item.position.lat<=13.28);}
  assert.equal(push.configured,true);
  const places=await read('/geocode?q=Majestic%20Bengaluru');assert.ok(places.results.length>0,'Live geocoder returned no results');
  const tile=await fetch(base+'/traffic/tiles/12/2930/1899.png',{signal:AbortSignal.timeout(15000)});assert.equal(tile.status,200);assert.match(tile.headers.get('content-type'),/image\/png/);
  const denied=await fetch(base+'/moderation',{signal:AbortSignal.timeout(10000)});assert.equal(denied.status,401);
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),bengaluruDate:today,health:true,weatherObservedAt:weather.observedAt,trafficSamples:traffic.segments.filter(s=>!s.unavailable).length,officialAlerts:official.alerts.length,providerIncidents:incidents.incidents.length,riverDates:river.forecast.map(f=>f.date),geocoderResults:places.results.length,trafficTile:true,pushConfigured:true,unauthenticatedModerationDenied:true},null,2));
}
main().catch(error=>{console.error('Live source acceptance failed:',error.message);process.exitCode=1;});

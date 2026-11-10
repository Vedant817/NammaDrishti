const test=require('node:test'),assert=require('node:assert/strict');
const {parseCap,createOfficialAlerts}=require('../services/officialAlerts');
const {normalizeIncidents}=require('../services/trafficIncidents');
const {cityDate}=require('../services/sourceTime');
const {createLiveData}=require('../services/liveData');
const now=Date.parse('2026-11-05T14:00:00Z');
const cap=(overrides={})=>{
  const p={status:'Actual',scope:'Public',msgType:'Alert',city:'Bengaluru Urban',effective:'2026-11-05T19:00:00+05:30',expires:'2026-11-05T22:00:00+05:30',...overrides};
  return `<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><cap:identifier>fixture-only</cap:identifier><cap:sender>Fixture sender</cap:sender><cap:sent>2026-11-05T19:00:00+05:30</cap:sent><cap:status>${p.status}</cap:status><cap:scope>${p.scope}</cap:scope><cap:msgType>${p.msgType}</cap:msgType><cap:info><cap:language>en-IN</cap:language><cap:event>Fixture warning</cap:event><cap:effective>${p.effective}</cap:effective><cap:expires>${p.expires}</cap:expires><cap:headline>Fixture for ${p.city}</cap:headline><cap:area><cap:areaDesc>${p.city}</cap:areaDesc></cap:area></cap:info></cap:alert>`;
};
test('CAP warnings require Actual/Public, Bengaluru relevance and current explicit validity',()=>{
  const good=parseCap(cap(),now);assert.equal(good.event,'Fixture warning');assert.equal(good.languages.en.headline,'Fixture for Bengaluru Urban');
  for(const p of [{status:'Test'},{status:'Exercise'},{scope:'Private'},{msgType:'Cancel'},{city:'Chennai'},{expires:'2026-11-05T19:00:00+05:30'},{effective:'2026-11-05T23:00:00+05:30'},{effective:'yesterday'},{expires:'2026-11-05T22:00:00'}]) assert.equal(parseCap(cap(p),now),null,JSON.stringify(p));
});
test('CAP parser rejects hostile, oversized, malformed and non-CAP XML',()=>{
  for(const xml of ['<!DOCTYPE alert [<!ENTITY x SYSTEM "file:///private">]>'+cap(),cap().replace('urn:oasis:names:tc:emergency:cap:1.2','urn:wrong'),cap().slice(0,-15),'x'.repeat(262145)])assert.throws(()=>parseCap(xml,now));
});
test('official feed coalesces calls, reports partial failures and expires warnings inside cache lifetime',async()=>{
  let clock=now,calls=0;
  const feed=createOfficialAlerts({now:()=>clock,fetchJson:async()=>{calls++;return [{identifier:'1793887083506019',warning_message:'Bengaluru Urban'},{identifier:'1793887083506020',warning_message:'ಬೆಂಗಳೂರು'}];},fetchText:async url=>{if(url.endsWith('20'))throw new Error('offline');return cap({expires:'2026-11-05T19:30:20+05:30'});}});
  const [a,b]=await Promise.all([feed(),feed()]);assert.equal(calls,1);assert.equal(a.status,'partial');assert.equal(b.alerts.length,1);
  clock+=21000;assert.equal((await feed()).alerts.length,0);
});
test('CAP cancellations and updates excluding Bengaluru retire referenced warnings',async()=>{
  for(const change of [{msgType:'Cancel'},{msgType:'Update',city:'Chennai'}]){
    const warning=cap(),replacement=cap(change).replace('<cap:identifier>fixture-only</cap:identifier>','<cap:identifier>replacement</cap:identifier><cap:references>fixture-sender,fixture-only,2026-11-05T13:30:00Z</cap:references>');
    const feed=createOfficialAlerts({now:()=>now,fetchJson:async()=>[{identifier:'1793887083506019',warning_message:'Bengaluru'},{identifier:'1793887083506020',alert_source:'IMD Bengaluru'}],fetchText:async url=>url.endsWith('20')?replacement:warning});
    assert.equal((await feed()).alerts.length,0);
  }
});
test('India date advances at 18:30 UTC and river cache cannot serve yesterday as today',async()=>{
  let clock=Date.parse('2026-11-05T18:29:59Z'),calls=0;
  assert.equal(cityDate(clock),'2026-11-05');assert.equal(cityDate(clock+1000),'2026-11-06');
  const service=createLiveData({now:()=>clock,fetchJson:async()=>{calls++;return {latitude:12.975,longitude:77.575,daily_units:{river_discharge:'m³/s'},daily:{time:[cityDate(clock)],river_discharge:[1]}};}});
  assert.equal((await service.floodContext()).date,'2026-11-05');clock+=1000;assert.equal((await service.floodContext()).date,'2026-11-06');assert.equal(calls,2);
  await assert.rejects(createLiveData({now:()=>clock,fetchJson:async()=>({latitude:12.975,longitude:77.575,daily_units:{river_discharge:'m³/s'},daily:{time:['2026-11-05'],river_discharge:[1]}})}).floodContext(),/today/);
});
test('provider traffic accepts present Bengaluru records only and deduplicates ids',()=>{
  const incident={geometry:{type:'Point',coordinates:[77.59,12.97]},properties:{id:'one',iconCategory:8,timeValidity:'present',events:[{description:'Fixture closure'}],startTime:'2026-11-05T13:00:00Z',endTime:'2026-11-05T15:00:00Z'}};
  const result=normalizeIncidents({incidents:[incident,incident,{...incident,properties:{...incident.properties,timeValidity:'future'}},{...incident,properties:{...incident.properties,endTime:'2026-11-05T13:00:00Z'}},{...incident,geometry:{type:'Point',coordinates:[1,2]}},{...incident,properties:{...incident.properties,startTime:'2026-11-06T13:00:00Z'}}]},now);
  assert.equal(result.incidents.length,1);assert.equal(result.incidents[0].position.lat,12.97);assert.equal(result.incidents[0].category,'Road closed');assert.equal(result.incidents[0].delaySeconds,null);
});
test('provider denies access distinctly from an empty working incident feed',async()=>{
  const previous=process.env.TOMTOM_API_KEY;process.env.TOMTOM_API_KEY='fixture';
  try{assert.equal((await createLiveData({fetchJson:async()=>{throw Object.assign(new Error('denied'),{status:403});}}).trafficIncidents()).status,'access-denied');}
  finally{if(previous===undefined)delete process.env.TOMTOM_API_KEY;else process.env.TOMTOM_API_KEY=previous;}
});

test('a provider road crossing the city box retains its entire geometry',()=>{
 const geometry={type:'LineString',coordinates:[[77.1,13],[78,13]]};
 const result=normalizeIncidents({incidents:[{geometry,properties:{id:'crossing',iconCategory:8,timeValidity:'present'}}]},now);
 assert.equal(result.incidents.length,1);assert.deepEqual(result.incidents[0].geometry,geometry);assert.ok(result.incidents[0].position.lng>=77.25);
});

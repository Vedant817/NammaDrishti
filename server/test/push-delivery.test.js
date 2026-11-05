const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const webpush=require('web-push'),{createPushService}=require('../services/pushService'),{createRecords}=require('../services/records');
test('push outbox survives retry, suppresses hidden hazards, protects payload privacy and tests only owned subscriptions',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nd-push-')),keys=webpush.generateVAPIDKeys();
 const old=Object.fromEntries(['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'mailto:fixture@example.invalid'});
 try{
  const records=createRecords({directory}),sent=[];let fail=true;
  const service=createPushService(records,{send:async(sub,body)=>{if(fail)throw new Error('outage');sent.push(JSON.parse(body));}});
  const sub={endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:keys.publicKey,auth:'a'.repeat(22)}};
  const id=await service.subscribe('owner',sub,{lat:12.97,lng:77.59});
  const incident={id:'report_fixture',urgency:'High',title:'private user text',position:{lat:12.9701,lng:77.5901}};
  await service.enqueue({...incident,id:'far',position:{lat:13.2,lng:77.8}});assert.equal((await records.list('pushOutbox')).length,0);
  await service.enqueue(incident);await service.enqueue(incident);assert.equal((await records.list('pushOutbox')).length,1);
  await service.process([incident]);let job=(await records.list('pushOutbox'))[0];assert.equal(job.attempts,1);assert.equal(job.status,'queued');
  fail=false;await records.put('pushOutbox',job.id,{...job,nextAt:0});
  await createPushService(createRecords({directory}),{send:async(s,b)=>sent.push(JSON.parse(b))}).process([incident]);
  assert.equal((await records.get('pushOutbox',job.id)).status,'sent');assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes('private user text'));assert.ok(!JSON.stringify(sent).includes('12.97'));
  await assert.rejects(service.test('other',sub.endpoint));await service.test('owner',sub.endpoint);await assert.rejects(service.test('owner',sub.endpoint),/minute/);
  assert.equal(sent.length,2);
  await service.enqueue({...incident,id:'hidden'});await service.process([{...incident,id:'hidden',moderationHidden:true}]);assert.equal((await records.list('pushOutbox')).some(j=>j.incidentId==='hidden'),false);
  await records.remove('pushSubscriptions',id);
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;fs.rmSync(directory,{recursive:true,force:true});}
});

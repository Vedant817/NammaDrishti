const test=require('node:test'),assert=require('node:assert/strict');
const {Readable}=require('stream');
const {createBackupService}=require('../services/backupService');
const {backupDue,backupHealth,readBounded}=require('../services/backupPolicy');
const {runMaintenanceAndBackup}=require('../services/maintenanceService');
function harness() {
 let state={},now=Date.parse('2026-11-05T17:00:00Z'),queue=Promise.resolve(),counter=0;
 const files=new Map(),deleted=[];
 const ref={get:async()=>({data:()=>structuredClone(state)})};
 const db={collection:name=>({doc:()=>ref,limit:()=>({group:name})}),runTransaction(task){const run=queue.then(()=>task({get:async query=>query===ref?{data:()=>structuredClone(state)}:{size:0,docs:[]},set:(target,value)=>{state=structuredClone(value);}}));queue=run.catch(()=>{});return run;}};
 const blob={
  list:async options=>({blobs:[...files.values()].filter(f=>f.pathname.startsWith(options.prefix)),hasMore:false}),
  put:async(path,bytes,options)=>{assert.equal(options.access,'private');const url='https://backup.private.blob.vercel-storage.com/'+(++counter);files.set(url,{url,pathname:path,bytes,uploadedAt:new Date(now).toISOString()});return {url};},
  get:async url=>({statusCode:200,stream:Readable.from([files.get(url).bytes])}),
  del:async urls=>{for(const url of [].concat(urls)){deleted.push(url);files.delete(url);}},
 };
 const service=createBackupService({db,blob,token:'fixture',mediaToken:'fixture',mediaHost:'owned.public.blob.vercel-storage.com',clock:()=>now});
 return {service,db,blob,files,deleted,get state(){return state;},set state(v){state=v;},get now(){return now;},set now(v){now=v;}};
}
test('daily due policy handles IST rollover, future timestamps and stale completion',()=>{
 const now=Date.parse('2026-11-05T19:00Z'),recent=Date.parse('2026-11-05T18:00Z');
 assert.equal(backupDue({completedAt:recent},now),true);
 assert.equal(backupDue({completedAt:now},now),false);
 assert.equal(backupHealth({status:'complete',completedAt:now+1},now),'never-completed');
 assert.equal(backupHealth({status:'complete',completedAt:now-27*3600000},now),'stale');
 assert.equal(backupHealth({status:'running',leaseUntil:now-1},now),'failed');
});
test('snapshot readback failure cleans uploads and persists backoff without losing last success',async()=>{
 const h=harness();await h.service.run();const previous=h.state.url;
 h.blob.get=async()=>{throw new Error('read outage');};
 await assert.rejects(h.service.run({force:true}),/outage/);
 assert.equal(h.state.url,previous);assert.equal(h.files.size,1);assert.equal(h.state.pendingUploads.length,0);
 assert.equal((await h.service.status()).health,'failed');assert.equal((await h.service.run()).reason,'retry-delayed');
});
test('maintenance failure does not suppress backup and unconfigured backup cannot report success',async()=>{
 let calls=0;const result=await runMaintenanceAndBackup(async()=>{throw new Error('writer busy');},async()=>{calls++;return {status:'complete'};});
 assert.equal(calls,1);assert.equal(result.success,false);assert.equal(result.backup.status,'complete');
 assert.equal((await runMaintenanceAndBackup(async()=>{},async()=>({status:'unconfigured'}))).success,false);
});
test('retention failure preserves the verified recovery point and is retried without a new upload',async()=>{
 const h=harness(),old='https://backup.private.blob.vercel-storage.com/expired';
 h.files.set(old,{url:old,pathname:'backups/v2/old.json.gz',uploadedAt:new Date(h.now-8*86400000).toISOString()});
 const remove=h.blob.del;h.blob.del=async()=>{throw new Error('delete outage');};
 const result=await h.service.run({trigger:'maintenance'});assert.equal(result.status,'complete');assert.equal(result.retentionStatus,'failed');assert.equal(h.state.status,'complete');
 h.blob.del=remove;h.now+=900001;const latest=h.state.url;assert.equal((await h.service.run({trigger:'maintenance'})).reason,'fresh');
 assert.equal(h.state.url,latest);assert.equal(h.files.size,1);assert.equal(h.state.retentionStatus,'complete');assert.equal(h.state.lastMaintenanceOutcome,'fresh');
});
test('lease loss during readback prevents publication and cannot overwrite a newer owner',async()=>{
 const h=harness(),get=h.blob.get;
 h.blob.get=async url=>{const result=await get(url);h.state={...h.state,owner:'newer-owner',status:'complete',url:'newer-verified',completedAt:h.now};return result;};
 await assert.rejects(h.service.run(),/lease lost/);assert.equal(h.state.url,'newer-verified');assert.equal(h.state.status,'complete');assert.equal(h.files.size,1);
});
test('failed upload cleanup is tracked and reconciled on a later due attempt',async()=>{
 const h=harness(),remove=h.blob.del,get=h.blob.get;
 h.blob.get=async()=>{throw new Error('read outage');};h.blob.del=async()=>{throw new Error('delete outage');};
 await assert.rejects(h.service.run());assert.equal(h.state.pendingUploads.length,1);assert.equal(h.state.cleanupStatus,'failed');
 h.now+=900001;h.blob.del=remove;h.blob.get=get;
 await h.service.run();assert.equal(h.state.pendingUploads.length,0);assert.equal(h.files.size,1);
});
test('bounded readback cancels an oversized stream',async()=>{
 let closed=false;
 async function* stream(){try{yield Buffer.alloc(8);yield Buffer.alloc(8);}finally{closed=true;}}
 await assert.rejects(readBounded(stream(),10),/budget/);assert.equal(closed,true);
});

test('lost publication acknowledgement never deletes a committed verified archive',async()=>{
 const h=harness(),transaction=h.db.runTransaction;let lose=true;
 h.db.runTransaction=async task=>{const result=await transaction(task);if(lose&&h.state.status==='complete'){lose=false;throw new Error('commit acknowledgement lost');}return result;};
 const result=await h.service.run();assert.equal(result.status,'complete');assert.equal(h.state.status,'complete');assert.ok(h.files.has(h.state.url));assert.equal(h.deleted.length,0);
});
test('a failed same-day forced snapshot retries after durable backoff expires',async()=>{
 const h=harness(),get=h.blob.get;await h.service.run();const before=h.state.url;
 h.blob.get=async()=>{throw new Error('outage');};await assert.rejects(h.service.run({force:true}));
 h.blob.get=get;h.now+=900001;assert.equal((await h.service.run()).status,'complete');assert.notEqual(h.state.url,before);assert.equal((await h.service.status()).health,'healthy');
});
test('fresh snapshots coordinate retention retry scans across concurrent callers',async()=>{
 const h=harness();await h.service.run();h.state={...h.state,retentionStatus:'failed',nextRetentionAt:0,retentionLeaseUntil:0};
 let scans=0;const list=h.blob.list;h.blob.list=async options=>{if(options.prefix==='backups/v2/')scans++;return list(options);};
 await Promise.all([h.service.run(),h.service.run(),h.service.run()]);assert.equal(scans,1);
 await h.service.run();assert.equal(scans,1);
});
test('backup starts while maintenance is still pending',async()=>{
 let release,calls=0;const pending=new Promise(resolve=>{release=resolve;});
 const run=runMaintenanceAndBackup(()=>pending,async()=>{calls++;return {status:'complete'};});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);release();assert.equal((await run).success,true);
});

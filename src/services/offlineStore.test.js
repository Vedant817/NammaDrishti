import {test,expect,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createOfflineStore,legacyActionsPresent} from './offlineStore';
const report=id=>({kind:'report',id,payload:{id,title:'Fixture',description:'Synthetic draft',position:{lat:12.97,lng:77.59}}});
const vote=(id,kind='verify')=>({id:kind+':'+id,kind,payload:{incidentId:id,title:'Fixture road'}});
function harness(){const indexedDB=new IDBFactory();let clock=1000,sequence=0;const options={getIndexedDB:()=>indexedDB,name:'test-actions',now:()=>clock,newId:()=>String(++sequence)};return {a:createOfflineStore(options),b:createOfflineStore(options),get clock(){return clock;},set clock(v){clock=v;}};}
test('owners never inherit another account drafts or vote markers after reopening',async()=>{
 const h=harness();try{
  await h.a.enqueue('A',report('same'));await h.b.enqueue('B',report('same'));await h.a.enqueue('A',vote('road'));
  const action=await h.a.claim('A','verify:road');expect(await h.a.complete('A',action.id,action.revision,action.leaseToken)).toBe(true);
  expect((await h.b.list('B')).actions).toHaveLength(1);expect((await h.b.list('B')).markers).toHaveLength(0);
  await h.a.close();expect((await h.a.list('A')).actions[0].payload.description).toBe('Synthetic draft');expect((await h.a.list('A')).markers).toHaveLength(1);
 }finally{await h.a.close();await h.b.close();}
});
test('concurrent clients preserve new inserts while acknowledging only one immutable action',async()=>{
 const h=harness();try{
  await Promise.all([h.a.enqueue('A',vote('one')),h.b.enqueue('A',vote('two'))]);
  const action=await h.a.claim('A','verify:one');
  await Promise.all([h.a.complete('A',action.id,action.revision,action.leaseToken),h.b.enqueue('A',report('new'))]);
  expect((await h.b.list('A')).actions.map(a=>a.id).sort()).toEqual(['new','verify:two']);
 }finally{await h.a.close();await h.b.close();}
});
test('lease replacement fences stale completions and updates',async()=>{
 const h=harness();try{
  await h.a.enqueue('A',vote('road'));const old=await h.a.claim('A','verify:road');h.clock+=45001;const current=await h.b.claim('A',old.id);
  expect(await h.a.complete('A',old.id,old.revision,old.leaseToken)).toBe(false);
  expect(await h.a.update('A',old.id,old.revision,{state:'failed'},{token:old.leaseToken,manual:true})).toBeNull();
  expect(await h.b.complete('A',current.id,current.revision,current.leaseToken)).toBe(true);
  expect((await h.a.enqueue('A',vote('road'))).duplicate).toBe(true);
 }finally{await h.a.close();await h.b.close();}
});
test('duplicate logical votes are atomic but confirmation and clearance remain distinct',async()=>{
 const h=harness();try{
  await Promise.all([h.a.enqueue('A',vote('road')),h.b.enqueue('A',vote('road')),h.a.enqueue('A',vote('road','clear'))]);
  expect((await h.a.list('A')).actions.map(a=>a.id).sort()).toEqual(['clear:road','verify:road']);
 }finally{await h.a.close();await h.b.close();}
});
test('durable backoff and photo checkpoint survive reopening without resurrecting discarded data',async()=>{
 const h=harness();try{
  await h.a.enqueue('A',report('photo'));const action=await h.a.claim('A','photo');
  const checkpoint=await h.a.update('A',action.id,action.revision,{payload:{...action.payload,mediaUrl:'https://fixture.example/photo.webp'}},{token:action.leaseToken});
  const pending=await h.a.update('A',checkpoint.id,checkpoint.revision,{nextAt:h.clock+10000,attempts:1,reason:'network'},{token:checkpoint.leaseToken,manual:true});
  await h.a.close();expect((await h.b.list('A')).actions[0].payload.mediaUrl).toBe('https://fixture.example/photo.webp');expect(await h.b.claim('A','photo')).toBeNull();
  expect(await h.b.discard('A','photo',pending.revision)).toBe(true);expect(await h.a.update('A','photo',pending.revision,{state:'pending'},{manual:true})).toBeNull();
 }finally{await h.a.close();await h.b.close();}
});
test('a successful add request followed by transaction abort never reports a saved action',async()=>{
 const h=harness(),add=IDBObjectStore.prototype.add;
 const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(...args){const request=add.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request;});
 try{await expect(h.a.enqueue('A',report('abort'))).rejects.toMatchObject({code:'storage-unavailable'});expect((await h.b.list('A')).actions).toHaveLength(0);}
 finally{spy.mockRestore();await h.a.close();await h.b.close();}
});
test('unsupported storage fails explicitly, and legacy unowned keys remain untouched',async()=>{
 const h=createOfflineStore({getIndexedDB:()=>undefined});await expect(h.enqueue('A',report('none'))).rejects.toMatchObject({code:'storage-unavailable'});
 const storage={getItem:vi.fn(key=>key==='nammadrishti_offline_queue_v1'?'[{"id":"old","description":"private"}]':null),setItem:vi.fn(),removeItem:vi.fn()};
 expect(legacyActionsPresent(storage)).toBe(true);expect(storage.setItem).not.toHaveBeenCalled();expect(storage.removeItem).not.toHaveBeenCalled();
});

test('caller mutation cannot change a committed action owner, ID or captured payload',async()=>{
 const h=harness();try{
  const input={...report('stable'),owner:'B',state:'failed'};const pending=h.a.enqueue('A',input);input.id='changed';input.payload.description='changed';
  const result=await pending;expect(result.action.owner).toBe('A');expect(result.action.id).toBe('stable');expect(result.action.state).toBe('pending');expect(result.action.payload.description).toBe('Synthetic draft');
 }finally{await h.a.close();await h.b.close();}
});
test('a blocked upgrade rejects promptly and can be retried without inventing a saved action',async()=>{
 const request={};const h=createOfflineStore({getIndexedDB:()=>({open:()=>{queueMicrotask(()=>request.onblocked());return request;}})});
 await expect(h.enqueue('A',report('blocked'))).rejects.toMatchObject({code:'storage-unavailable'});
});
test('an oversized draft is rejected without erasing earlier committed work',async()=>{
 const h=harness();try{
  await h.a.enqueue('A',report('kept'));const big=report('large');big.payload.mediaUrl='x'.repeat(6*1024*1024);
  await expect(h.a.enqueue('A',big)).rejects.toMatchObject({code:'storage-full'});expect((await h.a.list('A')).actions.map(a=>a.id)).toEqual(['kept']);
 }finally{await h.a.close();await h.b.close();}
});
test('clock rollback cannot turn a valid saved record into an unreadable draft',async()=>{
 const h=harness();try{await h.a.enqueue('A',report('clock'));h.clock=900;const row=await h.a.claim('A','clock');expect(row.updatedAt).toBe(1000);expect((await h.a.list('A')).invalidCount).toBe(0);const updated=await h.a.update('A',row.id,row.revision,{state:'failed'},{token:row.leaseToken,manual:true});expect(updated.updatedAt).toBe(1000);expect(await h.a.discard('A',updated.id,updated.revision)).toBe(true);}finally{await h.a.close();await h.b.close();}
});
test('legacy detection tolerates a browser SecurityError while acquiring storage',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new DOMException('Denied','SecurityError');}});
 try{expect(()=>legacyActionsPresent()).not.toThrow();}finally{Object.defineProperty(globalThis,'localStorage',descriptor);}
});

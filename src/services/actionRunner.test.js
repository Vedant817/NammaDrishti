import {test,expect,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createOfflineStore} from './offlineStore';
import {createActionRunner} from './actionRunner';
const identity={uid:'A',sessionKey:1};
const report={id:'r',kind:'report',payload:{id:'r',title:'Fixture',description:'Synthetic',type:'Traffic',position:{lat:12.97,lng:77.59},mediaUrl:'data:image/png;base64,fixture'}};
const vote=id=>({id:'verify:'+id,kind:'verify',payload:{incidentId:id}});
const ack=id=>({id,verificationCount:2,verificationScore:2,isVerified:false});
const reply=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture(request) {
 let clock=1000,current=identity;const indexedDB=new IDBFactory();
 const store=createOfflineStore({getIndexedDB:()=>indexedDB,now:()=>clock}),confirmed=vi.fn();
 const runner=createActionRunner({store,request,isCurrent:i=>i===current,apiBase:'https://fixture.test/api',now:()=>clock,onConfirmed:confirmed});
 return {store,runner,confirmed,set current(v){current=v;},set clock(v){clock=v;}};
}
test('different same-timestamp votes acknowledge independently; transient failure survives reopening and online retries',async()=>{
 const request=vi.fn().mockResolvedValueOnce(reply(ack('one'))).mockResolvedValueOnce(reply({error:'busy'},429,{'Retry-After':'120'}));const f=fixture(request);
 try{await f.store.enqueue('A',vote('one'));await f.store.enqueue('A',vote('two'));await f.runner.drain(identity);
  await f.store.close();const saved=await f.store.list('A');expect(saved.actions.map(a=>a.id)).toEqual(['verify:two']);expect(saved.actions[0]).toMatchObject({nextAt:121000,state:'pending'});expect(saved.markers.map(m=>m.id)).toEqual(['verify:one']);await f.runner.drain(identity);expect(request).toHaveBeenCalledTimes(2);
 }finally{await f.store.close();}
});
test('lost or malformed successful acknowledgement retains the durable action',async()=>{
 for(const body of [null,{}, {id:'wrong'},'truncated']) {
  const request=vi.fn(async()=>body==='truncated'?new Response('{',{status:201}):reply(body,201)),f=fixture(request);
  try{await f.store.enqueue('A',vote('road'));await f.runner.drain(identity);const saved=await f.store.list('A');expect(saved.actions[0]).toMatchObject({state:'pending',attempts:1,reason:'network'});expect(saved.markers).toHaveLength(0);expect(f.confirmed).not.toHaveBeenCalled();}finally{await f.store.close();}
 }
});
test('photo checkpoint is reused after report failure and strips caller ownership fields',async()=>{
 const request=vi.fn().mockResolvedValueOnce(reply({mediaUrl:'/media/photo.webp'})).mockResolvedValueOnce(reply({},503)).mockResolvedValueOnce(reply({...report.payload,mediaUrl:'https://fixture.test/media/photo.webp'}));const f=fixture(request);
 try{await f.store.enqueue('A',{...report,payload:{...report.payload,voterId:'B',owner:'B',_isLocalPending:true}});await f.runner.drain(identity);await f.store.close();expect((await f.store.list('A')).actions[0].payload.mediaUrl).toBe('https://fixture.test/media/photo.webp');f.clock=4000;await f.runner.drain(identity);expect(request).toHaveBeenCalledTimes(3);const sent=JSON.parse(request.mock.calls[2][1].body);expect(sent.voterId).toBe('A');expect(sent.owner).toBeUndefined();expect(sent._isLocalPending).toBeUndefined();expect((await f.store.list('A')).actions).toHaveLength(0);
 }finally{await f.store.close();}
});
test('a checkpoint transaction abort prevents incident transmission and retains original photo',async()=>{
 const request=vi.fn(async()=>reply({mediaUrl:'/photo.webp'})),f=fixture(request);const put=IDBObjectStore.prototype.put;
 try{await f.store.enqueue('A',report);let aborted=false;const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(value,...args){const req=put.call(this,value,...args);if(!aborted&&value.payload?.mediaUrl?.startsWith('https:')){aborted=true;req.addEventListener('success',()=>this.transaction.abort());}return req;});
  try{await f.runner.drain(identity);}finally{spy.mockRestore();}expect(request).toHaveBeenCalledTimes(1);expect((await f.store.list('A')).actions[0].payload.mediaUrl).toBe(report.payload.mediaUrl);
 }finally{await f.store.close();}
});
test('account switch during upload body parse cannot send report or leak completion',async()=>{
 const parsed=deferred(),entered=deferred(),request=vi.fn(async()=>({ok:true,status:200,json:()=>{entered.resolve();return parsed.promise;}})),f=fixture(request);
 try{await f.store.enqueue('A',report);const running=f.runner.drain(identity);await entered.promise;f.current={uid:'B',sessionKey:2};parsed.resolve({mediaUrl:'/photo.webp'});await running;expect(request).toHaveBeenCalledTimes(1);expect(f.confirmed).not.toHaveBeenCalled();expect((await f.store.list('A')).actions).toHaveLength(1);expect((await f.store.list('B')).actions).toHaveLength(0);
 }finally{await f.store.close();}
});
test('A to B to A during an incident response remains a different session',async()=>{
 const parsed=deferred(),entered=deferred(),f=fixture(async()=>({ok:true,status:200,json:()=>{entered.resolve();return parsed.promise;}}));
 try{await f.store.enqueue('A',vote('road'));const running=f.runner.drain(identity);await entered.promise;f.current={uid:'A',sessionKey:3};parsed.resolve(ack('road'));await running;expect(f.confirmed).not.toHaveBeenCalled();expect((await f.store.list('A')).markers).toHaveLength(0);expect((await f.store.list('A')).actions).toHaveLength(1);
 }finally{await f.store.close();}
});
test('verification blocks the owner until explicit recovery; permanent failures do not block other work',async()=>{
 const request=vi.fn().mockResolvedValueOnce(reply({code:'EMAIL_VERIFICATION_REQUIRED'},403)).mockResolvedValueOnce(reply({},422)).mockResolvedValueOnce(reply(ack('two')));const f=fixture(request);
 try{await f.store.enqueue('A',vote('one'));await f.store.enqueue('A',vote('two'));await f.runner.drain(identity);await f.runner.drain(identity);expect(request).toHaveBeenCalledTimes(1);let saved=await f.store.list('A');expect(saved.actions[0].state).toBe('blocked');const row=saved.actions[0];await f.store.update('A',row.id,row.revision,{state:'pending',attempts:0,nextAt:0},{manual:true,gate:{until:0},resetGate:true});await f.runner.drain(identity);saved=await f.store.list('A');expect(saved.actions).toHaveLength(1);expect(saved.actions[0].state).toBe('failed');expect(saved.markers[0].id).toBe('verify:two');
 }finally{await f.store.close();}
});
test('only typed duplicate verification and clearance acknowledgements are accepted',async()=>{
 const request=vi.fn(async url=>url.includes('/v/')?reply({...ack('v'),alreadyVoted:true},409):url.includes('/c/')?reply({id:'c',alreadyVoted:true,clearanceVotes:1,cleared:false},409):reply({alreadyVoted:true},409));const f=fixture(request);
 try{await f.store.enqueue('A',vote('v'));await f.store.enqueue('A',{id:'clear:c',kind:'clear',payload:{incidentId:'c'}});await f.store.enqueue('A',vote('zbad'));await f.runner.drain(identity);const saved=await f.store.list('A');expect(saved.markers).toHaveLength(2);expect(saved.actions[0].id).toBe('verify:zbad');expect(saved.actions[0].state).toBe('pending');}finally{await f.store.close();}
});
test('stale response cannot remove another tab replacement or reblock its retry',async()=>{
 const response=deferred(),entered=deferred(),f=fixture(()=>{entered.resolve();return response.promise;});
 try{await f.store.enqueue('A',vote('road'));const running=f.runner.drain(identity);await entered.promise;f.clock=47000;let row=(await f.store.list('A')).actions[0];expect(await f.store.discard('A',row.id,row.revision)).toBe(true);await f.store.enqueue('A',vote('road'));response.resolve(reply(ack('road')));await running;expect((await f.store.list('A')).actions).toHaveLength(1);expect(f.confirmed).not.toHaveBeenCalled();}finally{await f.store.close();}
});
test('automatic retry budget ends in recoverable blocked state',async()=>{
 const request=vi.fn(async()=>{throw new TypeError('offline');}),f=fixture(request);
 try{await f.store.enqueue('A',vote('road'));for(let i=0;i<8;i++){f.clock=1000+i*1000000;await f.runner.drain(identity);}expect(request).toHaveBeenCalledTimes(5);expect((await f.store.list('A')).actions[0]).toMatchObject({state:'blocked',reason:'retry-limit',attempts:5});}finally{await f.store.close();}
});

test('HTTP status classification survives non-JSON errors',async()=>{
 for(const [status,state] of [[401,'blocked'],[400,'failed'],[429,'pending']]){
  const f=fixture(async()=>new Response('Proxy error',{status}));try{await f.store.enqueue('A',vote('road'));await f.runner.drain(identity);expect((await f.store.list('A')).actions[0]).toMatchObject({state,httpStatus:status});}finally{await f.store.close();}
 }
});
test('blank photo acknowledgement preserves original photo without sending incident',async()=>{
 const request=vi.fn(async()=>reply({mediaUrl:'  '})),f=fixture(request);
 try{await f.store.enqueue('A',report);await f.runner.drain(identity);expect(request).toHaveBeenCalledTimes(1);expect((await f.store.list('A')).actions[0].payload.mediaUrl).toBe(report.payload.mediaUrl);}finally{await f.store.close();}
});
test('concurrent action failures cannot clear account blocks or shorten owner cooldown',async()=>{
 for(const status of [401,429]){
  const early=deferred(),late=deferred(),started=deferred();let calls=0;
  const f=fixture(()=>{if(++calls===2)started.resolve();return calls===1?early.promise:late.promise;});
  try{await f.store.enqueue('A',vote('one'));await f.store.enqueue('A',vote('two'));await f.store.enqueue('A',vote('three'));
   const first=f.runner.run(identity,'verify:one'),second=f.runner.run(identity,'verify:two');await started.promise;
   early.resolve(reply({},status,{'Retry-After':'120'}));await first;late.resolve(reply({},503));await second;
   const saved=await f.store.list('A');expect(status===401?saved.gate.blocked:saved.gate.until).toBe(status===401?true:121000);f.clock=4000;expect(await f.store.claim('A','verify:three')).toBeNull();
  }finally{await f.store.close();}
 }
});
test('server Retry-After longer than inferred backoff is honored across restart',async()=>{
 for(const header of ['3600',new Date(3601000).toUTCString()]){
  const request=vi.fn(async()=>reply({},429,{'Retry-After':header})),f=fixture(request);
  try{await f.store.enqueue('A',vote('road'));await f.runner.drain(identity);await f.store.close();expect((await f.store.list('A')).gate.until).toBe(3601000);f.clock=901000;await f.runner.drain(identity);expect(request).toHaveBeenCalledTimes(1);f.clock=3601000;await f.runner.drain(identity);expect(request).toHaveBeenCalledTimes(2);}finally{await f.store.close();}
 }
});
test('lost report acknowledgement locks its payload against edits until canonical retry completes',async()=>{
 let accepted;const f=fixture(async(url,options)=>{const body=JSON.parse(options.body);if(!accepted){accepted=body;throw new TypeError('lost ACK');}return reply(accepted);});
 try{const input={...report,payload:{...report.payload,mediaUrl:null}};await f.store.enqueue('A',input);await f.runner.drain(identity);const row=(await f.store.list('A')).actions[0];expect(row.uncertain).toBe(true);
  expect(await f.store.update('A',row.id,row.revision,{payload:{...row.payload,title:'New text that must not be lost'}},{manual:true})).toBeNull();f.clock=4000;await f.runner.drain(identity);expect((await f.store.list('A')).actions).toHaveLength(0);expect(accepted.title).toBe('Fixture');
 }finally{await f.store.close();}
});

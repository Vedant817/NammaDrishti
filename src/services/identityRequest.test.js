import {test,expect,vi} from 'vitest';
import {createIdentityTracker,createPinnedRequester} from './identityRequest';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('a token paused across A to B never dispatches the queued mutation',async()=>{
 const tracker=createIdentityTracker(),a={uid:'A'},b={uid:'B'};let current=a;
 const identity=tracker.observe(a),token=deferred(),fetcher=vi.fn();
 const request=createPinnedRequester({getSession:async()=>({identity,isCurrent:()=>tracker.isCurrent(identity,current),getToken:()=>token.promise}),fetcher});
 const work=request('/incidents',{method:'POST',expectedIdentity:identity});await Promise.resolve();
 current=b;tracker.observe(b);token.resolve('fixture-token');await expect(work).rejects.toMatchObject({code:'identity-changed'});expect(fetcher).not.toHaveBeenCalled();
});
test('returning to the same UID does not revive an older session',async()=>{
 const tracker=createIdentityTracker(),a={uid:'A'},b={uid:'B'};const identity=tracker.observe(a);
 tracker.observe(b);tracker.observe(a);expect(tracker.isCurrent(identity,a)).toBe(false);
 const linked=tracker.observe(a);a.emailVerified=true;tracker.observe(a);expect(tracker.isCurrent(linked,a)).toBe(true);
});
test('a response arriving after signout is not exposed to the new session',async()=>{
 const tracker=createIdentityTracker(),a={uid:'A'},identity=tracker.observe(a),response=deferred();let current=a;
 const fetcher=vi.fn(()=>response.promise),request=createPinnedRequester({getSession:async()=>({identity,isCurrent:()=>tracker.isCurrent(identity,current),getToken:async()=>'fixture-token'}),fetcher});
 const work=request('/operations',{expectedIdentity:identity});await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
 current=null;tracker.observe(null);response.resolve({ok:true});await expect(work).rejects.toMatchObject({code:'identity-changed'});
 expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer fixture-token');expect(fetcher.mock.calls[0][1]).not.toHaveProperty('expectedIdentity');
});
test('a caller cannot dispatch owner A work through owner B session',async()=>{
 const tracker=createIdentityTracker(),a=tracker.observe({uid:'A'}),b={uid:'B'},identity=tracker.observe(b),fetcher=vi.fn();
 const request=createPinnedRequester({getSession:async()=>({identity,isCurrent:()=>true,getToken:async()=>'other'}),fetcher});
 await expect(request('/incidents',{method:'POST',expectedIdentity:a})).rejects.toMatchObject({code:'identity-changed'});expect(fetcher).not.toHaveBeenCalled();
});
test('generic private actions pin their entry identity before asynchronous session readiness',async()=>{
 const tracker=createIdentityTracker(),a={uid:'A'},b={uid:'B'},ready=deferred(),fetcher=vi.fn();let current=a;tracker.observe(a);
 const request=createPinnedRequester({getEntryIdentity:()=>tracker.observe(current),getSession:async()=>{await ready.promise;const user=current,identity=tracker.observe(user);return {identity,isCurrent:()=>tracker.isCurrent(identity,current),getToken:async()=>'B-fixture-token'};},fetcher});
 const pending=request('/sos/dispatch',{method:'POST'});current=b;tracker.observe(b);ready.resolve();await expect(pending).rejects.toMatchObject({code:'identity-changed'});expect(fetcher).not.toHaveBeenCalled();
});

import {renderHook,act,waitFor} from '@testing-library/react';
import {test,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({handlers:{},request:vi.fn(),sync:vi.fn()}));
vi.mock('../services/firebaseService',()=>({authenticatedFetch:(...args)=>fixture.request(...args),subscribePublicIncidents:vi.fn()}));
vi.mock('./useOfflineActions',()=>({useOfflineActions:()=>({syncOfflineQueue:fixture.sync})}));
vi.mock('socket.io-client',()=>({io:()=>({on:(event,handler)=>{fixture.handlers[event]=handler;},disconnect:vi.fn()})}));
import {useEventData} from './useEventData';
test('a late initial REST snapshot cannot revive an incident resolved by the live stream',async()=>{
 let release;fixture.request.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
 const view=renderHook(()=>useEventData());await waitFor(()=>expect(release).toBeTypeOf('function'));
 act(()=>{fixture.handlers['initial:data']([{id:'road',verificationCount:4}]);fixture.handlers['incident:resolved']({id:'road'});});
 await act(async()=>{release({ok:true,json:async()=>[{id:'road',verificationCount:1}]});});
 expect(view.result.current.events).toEqual([]);expect(JSON.parse(localStorage.getItem('nammadrishti_public_events_v3'))).toEqual([]);view.unmount();
});
test('legacy private drafts never hydrate the public cache; only v3 public records survive',async()=>{
 localStorage.setItem('nammadrishti_events_v2',JSON.stringify([{id:'old-private',title:'private',_isLocalPending:true}]));
 localStorage.setItem('nammadrishti_public_events_v3',JSON.stringify([{id:'public'},null,{id:'polluted',_isLocalPending:true}]));
 fixture.request.mockRejectedValue(new TypeError('offline'));const view=renderHook(()=>useEventData());await waitFor(()=>expect(view.result.current.loading).toBe(false));
 expect(view.result.current.events).toEqual([{id:'public'}]);view.unmount();
});

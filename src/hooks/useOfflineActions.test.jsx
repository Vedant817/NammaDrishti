import {renderHook,act,waitFor,cleanup} from '@testing-library/react';
import {test,expect,vi,beforeEach,afterEach} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
const auth=vi.hoisted(()=>({identity:{uid:'A',sessionKey:1},listener:null,request:vi.fn()}));
vi.mock('../services/firebaseService',()=>({subscribeActionIdentity:listener=>{auth.listener=listener;listener(auth.identity);return()=>{auth.listener=null;};},isActionIdentityCurrent:i=>!!i&&i.uid===auth.identity?.uid&&i.sessionKey===auth.identity?.sessionKey,authenticatedFetch:(...args)=>auth.request(...args)}));
import {useOfflineActions} from './useOfflineActions';
import {offlineStore} from '../services/offlineStore';
const report={id:'stable',type:'Traffic',title:'Private A draft',description:'Synthetic owner-only text',position:{lat:12.97,lng:77.59},mediaUrl:'data:fixture'};
beforeEach(()=>{globalThis.indexedDB=new IDBFactory();localStorage.clear();auth.identity={uid:'A',sessionKey:1};vi.spyOn(navigator,'onLine','get').mockReturnValue(false);});
afterEach(async()=>{cleanup();await offlineStore.close();});
test('switching identities isolates saved actions across reload and never inserts them into a public callback',async()=>{
 const confirmed=vi.fn(),view=renderHook(()=>useOfflineActions(confirmed));
 await waitFor(()=>expect(view.result.current.actionIdentity?.uid).toBe('A'));
 await act(async()=>{expect(await view.result.current.addEvent(report,auth.identity)).toEqual({saved:true});});
 expect(view.result.current.savedActions[0].payload.title).toBe('Private A draft');
 act(()=>{auth.identity={uid:'B',sessionKey:2};auth.listener(auth.identity);});
 await waitFor(()=>expect(view.result.current.savedActions).toHaveLength(0));expect(auth.request).not.toHaveBeenCalled();expect(confirmed).not.toHaveBeenCalled();
 view.unmount();const reloaded=renderHook(()=>useOfflineActions(confirmed));await waitFor(()=>expect(reloaded.result.current.actionIdentity?.uid).toBe('B'));expect(reloaded.result.current.savedActions).toHaveLength(0);
 act(()=>{auth.identity={uid:'A',sessionKey:3};auth.listener(auth.identity);});
 await waitFor(()=>expect(reloaded.result.current.savedActions[0]?.payload.title).toBe('Private A draft'));
});
test('old session cannot enqueue after A to B to A, and legacy drafts remain unassigned',async()=>{
 localStorage.setItem('nammadrishti_offline_queue_v1',JSON.stringify([report]));const original=auth.identity,view=renderHook(()=>useOfflineActions());
 await waitFor(()=>expect(view.result.current.actionIdentity?.uid).toBe('A'));
 act(()=>{auth.identity={uid:'A',sessionKey:3};auth.listener(auth.identity);});
 await act(async()=>{expect(await view.result.current.addEvent(report,original)).toEqual({errorCode:'identity-changed'});});
 expect(view.result.current.legacyActions).toBe(true);expect(view.result.current.savedActions).toHaveLength(0);expect(localStorage.getItem('nammadrishti_offline_queue_v1')).toContain('Private A draft');
});
test('storage failure returns a recoverable error without claiming a saved action',async()=>{
 globalThis.indexedDB=undefined;const view=renderHook(()=>useOfflineActions());await waitFor(()=>expect(view.result.current.actionIdentity?.uid).toBe('A'));
 await act(async()=>{expect(await view.result.current.addEvent(report,auth.identity)).toEqual({errorCode:'storage-unavailable'});});expect(view.result.current.savedActions).toHaveLength(0);expect(view.result.current.storageError).toBe('storage-unavailable');
});
test('fresh re-observation of an uncertain report mints a new id instead of reusing the dedup key',async()=>{
 const view=renderHook(()=>useOfflineActions());await waitFor(()=>expect(view.result.current.actionIdentity?.uid).toBe('A'));
 await act(async()=>{await view.result.current.addEvent(report,auth.identity);});
 const stale={...view.result.current.savedActions[0],state:'failed',reason:'stale',uncertain:true};
 await act(async()=>{expect(await view.result.current.changeAction(stale,'retry',{...report,confirmedFreshObservation:true})).toEqual({saved:true});});
 const actions=view.result.current.savedActions;expect(actions).toHaveLength(1);expect(actions[0].id).not.toBe('stable');expect(actions[0].uncertain).toBe(false);expect(auth.request).not.toHaveBeenCalled();
});
test('fresh re-observation keeps the original draft if replacement save fails (no data loss)',async()=>{
 const view=renderHook(()=>useOfflineActions());await waitFor(()=>expect(view.result.current.actionIdentity?.uid).toBe('A'));
 await act(async()=>{await view.result.current.addEvent(report,auth.identity);});
 const stale={...view.result.current.savedActions[0],state:'failed',reason:'stale',uncertain:true};
 const enqueue=vi.spyOn(offlineStore,'enqueue');
 enqueue.mockImplementationOnce(async()=>{throw Object.assign(new Error('storage-unavailable'),{code:'storage-unavailable'});});
 await act(async()=>{expect(await view.result.current.changeAction(stale,'retry',{...report,title:'Edited',confirmedFreshObservation:true})).toEqual({errorCode:'storage-unavailable'});});
 enqueue.mockRestore();
 expect(view.result.current.savedActions).toHaveLength(1);
 expect(view.result.current.savedActions[0].id).toBe('stable');
 expect(view.result.current.savedActions[0].payload.title).toBe('Private A draft');
 expect(auth.request).not.toHaveBeenCalled();
});
test('queued votes retain recognizable road names without claiming public consensus',async()=>{
 const view=renderHook(()=>useOfflineActions());await waitFor(()=>expect(view.result.current.actionIdentity?.uid).toBe('A'));
 await act(async()=>{await view.result.current.verifyEvent('road',null,auth.identity,{title:'Fixture junction',ward:'Fixture ward'});});
 expect(view.result.current.savedActions[0].payload).toMatchObject({incidentId:'road',title:'Fixture junction',ward:'Fixture ward'});expect(view.result.current.hasUserVoted('road','verify')).toBe(true);expect(auth.request).not.toHaveBeenCalled();
});

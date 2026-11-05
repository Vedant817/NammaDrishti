import {test,expect,vi,afterEach} from 'vitest';
vi.mock('./firebaseService',()=>({authenticatedFetch:vi.fn()}));
import {authenticatedFetch} from './firebaseService';
import {enableBackgroundAlerts,disableBackgroundAlerts} from './notifications';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(){
 const subscription={endpoint:'https://fcm.googleapis.com/test',unsubscribe:vi.fn().mockResolvedValue(true)};
 const worker={pushManager:{getSubscription:vi.fn().mockResolvedValue(null),subscribe:vi.fn().mockResolvedValue(subscription)}};
 vi.stubGlobal('Notification',{permission:'granted'});vi.stubGlobal('PushManager',function(){});
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(worker)}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({configured:true,publicKey:'AQID'})}));
 return {subscription,worker};
}
test('failed server registration removes the newly created browser subscription',async()=>{
 const {subscription}=setup();authenticatedFetch.mockResolvedValue({ok:false});
 await expect(enableBackgroundAlerts({lat:12.97,lng:77.59})).rejects.toThrow();
 expect(subscription.unsubscribe).toHaveBeenCalledOnce();
});
test('turning alerts off preserves browser subscription if server removal fails',async()=>{
 const {subscription,worker}=setup();worker.pushManager.getSubscription.mockResolvedValue(subscription);authenticatedFetch.mockResolvedValue({ok:false});
 await expect(disableBackgroundAlerts()).rejects.toThrow();expect(subscription.unsubscribe).not.toHaveBeenCalled();
 authenticatedFetch.mockResolvedValue({ok:true,json:async()=>({success:true})});
 await disableBackgroundAlerts();expect(subscription.unsubscribe).toHaveBeenCalledOnce();
});

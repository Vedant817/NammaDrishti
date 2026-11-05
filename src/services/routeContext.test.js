import {test,expect} from 'vitest';
import {detectRouteHazards} from './routingService';
import {routeContext} from './routeContext';
const now=Date.now(), road={id:'closure',category:'Road closed',position:{lat:12.95,lng:77.5},geometry:{type:'LineString',coordinates:[[77.5,12.95],[77.7,13.05]]}};
test('a closure crossing the middle of a route is found even when its first point is far away',()=>{
 const context=routeContext([],{status:'available',fetchedAt:new Date(now).toISOString(),incidents:[road]},now);
 expect(context.coverage).toBe('current');
 expect(detectRouteHazards([[13,77.55],[13,77.65]],context.hazards)).toHaveLength(1);
 expect(detectRouteHazards([[13.1,77.55],[13.1,77.65]],context.hazards)).toHaveLength(0);
});
test('stale, expired and truncated provider feeds never claim complete route coverage',()=>{
 const feed={status:'available',fetchedAt:new Date(now).toISOString(),incidents:[{...road,endTime:new Date(now-1).toISOString()}]};
 expect(routeContext([],feed,now).hazards).toHaveLength(0);
 expect(routeContext([],{...feed,truncated:true},now).coverage).toBe('incomplete');
 expect(routeContext([],{...feed,fetchedAt:new Date(now-180001).toISOString()},now).coverage).toBe('incomplete');
 expect(routeContext([],{status:'unavailable'},now).coverage).toBe('incomplete');
});

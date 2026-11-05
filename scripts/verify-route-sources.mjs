import { fetchDrivingRoute, detectRouteHazards } from '../src/services/routingService.js';
const base=process.env.ACCEPTANCE_API_URL || 'https://nammadrishti.vercel.app/api';
const response=await fetch(base+'/traffic-incidents',{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error('Traffic API unavailable');
const feed=await response.json();
if(feed.status!=='available'||Date.now()-Date.parse(feed.fetchedAt)>180000||!feed.incidents.every(i=>i.geometry))throw new Error('Current provider geometry required');
const start=performance.now(),route=await fetchDrivingRoute({lat:12.9767,lng:77.5713},{lat:12.9756,lng:77.6067});
const matchStart=performance.now(),matches=detectRouteHazards(route.coordinates,feed.incidents.map(i=>({...i,provider:true})));
console.log(JSON.stringify({checkedAt:new Date().toISOString(),providerIncidents:feed.incidents.length,routeDistanceKm:route.distanceKm,staticDurationMin:route.durationMin,routeVertices:route.coordinates.length,matches:matches.length,matchingMs:Math.round(performance.now()-matchStart),totalMs:Math.round(performance.now()-start)},null,2));

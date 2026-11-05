import { useEffect, useRef } from 'react';
import { fetchDetourRoute, fetchDrivingRoute, detectRouteHazards } from '../services/routingService';
// New hazards mark the route uncertain immediately; older requests cannot win.
export function useReactiveRoute(route, setRoute, hazards, connected) {
  const generation = useRef(0);
  const routeRef = useRef(route); routeRef.current = route;
  const fingerprint = JSON.stringify(hazards.map(h => [h.id,h.position,h.type,h.urgency,h.waterDepth,h.vehiclePassability]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
  const key = route?.startCoords && JSON.stringify([route.startCoords,route.endCoords,route.autoDetour]);
  useEffect(() => {
    const current = routeRef.current;
    if (!current?.startCoords) return undefined;
    const version = ++generation.current;
    let cancelled = false;
    setRoute(prev => prev ? { ...prev, status: connected ? 'checking' : 'offline' } : null);
    if (!connected) return undefined;
    const timer = setTimeout(async () => {
      try {
        const result = current.autoDetour ? await fetchDetourRoute(current.startCoords,current.endCoords,hazards) : await fetchDrivingRoute(current.startCoords,current.endCoords);
        const conflicts = result.conflicts || detectRouteHazards(result.coordinates,hazards);
        if (!cancelled && version === generation.current) setRoute(prev => prev ? {...prev,...result,hasConflicts:conflicts.length>0,status:'ready',checkedAt:Date.now()} : null);
      } catch { if (!cancelled && version === generation.current) setRoute(prev => prev ? {...prev,status:'unavailable'} : null); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
    // Hazard contents are represented by fingerprint; route updates must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint,key,connected,setRoute]);
}

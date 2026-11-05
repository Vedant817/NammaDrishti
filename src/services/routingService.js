// src/services/routingService.js
/**
 * Safe Route Transit & Hazard Avoidance Service for Bengaluru.
 * Calculates turn-by-turn driving paths and checks against active waterlogging & choke points.
 * Endpoints come from live geocoding (src/services/geocodeService.js), not preset hubs.
 */

// Distance calculation using Haversine formula (km) with numerical bounds clamping
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return 0;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const aClamped = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(aClamped), Math.sqrt(1 - aClamped));
  return R * c;
};

// Calculate perpendicular distance from a point to a line segment in kilometers
export const distanceToSegmentKm = (pLat, pLng, aLat, aLng, bLat, bLng) => {
  const npLat = Number(pLat);
  const npLng = Number(pLng);
  const naLat = Number(aLat);
  const naLng = Number(aLng);
  const nbLat = Number(bLat);
  const nbLng = Number(bLng);

  if (
    !Number.isFinite(npLat) || !Number.isFinite(npLng) ||
    !Number.isFinite(naLat) || !Number.isFinite(naLng) ||
    !Number.isFinite(nbLat) || !Number.isFinite(nbLng)
  ) {
    return Infinity;
  }

  const dx = nbLng - naLng;
  const dy = nbLat - naLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return calculateDistance(npLat, npLng, naLat, naLng);
  }

  // Projection parameter t clamped to [0, 1]
  let t = ((npLng - naLng) * dx + (npLat - naLat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = naLat + t * dy;
  const projLng = naLng + t * dx;

  return calculateDistance(npLat, npLng, projLat, projLng);
};

// Bounds reject unrelated roads before checking segment proximity.
const bounds = points => points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
const overlaps = (a,b,pad) => a[0]<=b[2]+pad && a[2]>=b[0]-pad && a[1]<=b[3]+pad && a[3]>=b[1]-pad;
const cross = (a,b,c)=>(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
function segmentDistance(a,b,c,d) {
  if (overlaps(bounds([a,b]),bounds([c,d]),0) && cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0) return 0;
  return Math.min(distanceToSegmentKm(...a,...c,...d),distanceToSegmentKm(...b,...c,...d),distanceToSegmentKm(...c,...a,...b),distanceToSegmentKm(...d,...a,...b));
}
export const detectRouteHazards = (routeCoordinates, activeHazards, hazardBufferKm = 0.45) => {
  const route = (routeCoordinates || []).filter(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite));
  if (!route.length) return [];
  const routeBounds=bounds(route), segments=route.slice(1).map((p,i)=>[route[i],p,bounds([route[i],p])]);
  if (!segments.length) segments.push([route[0],route[0],routeBounds]);
  const conflicts=[];
  for (const hazard of activeHazards || []) {
    const g=hazard.geometry;
    const points=g?.type==='LineString' ? g.coordinates?.map(p=>[p[1],p[0]]) : g?.type==='Point' ? [[g.coordinates[1],g.coordinates[0]]] : [[hazard.position?.lat,hazard.position?.lng]];
    if (!points?.length || !points.every(p=>p.every(Number.isFinite))) continue;
    // Provider roads use a narrow proximity corridor; this is not lane matching.
    const buffer=hazard.provider ? Math.min(hazardBufferKm,0.035) : hazardBufferKm, pad=buffer/100;
    if (!overlaps(routeBounds,bounds(points),pad)) continue;
    let distance=Infinity;
    for(let j=0;j<Math.max(1,points.length-1);j++) {
      const c=points[j],d=points[j+1]||c,box=bounds([c,d]);
      for (const [a,b,routeBox] of segments) {
        if (!overlaps(routeBox,box,pad)) continue;
        distance=Math.min(distance,segmentDistance(a,b,c,d));
        if(distance<=buffer)break;
      }
      if(distance<=buffer)break;
    }
    if(distance<=buffer)conflicts.push({hazard,distanceKm:distance});
  }
  return conflicts;
};

// Public OSRM community mirrors, tried in order. `.org` is the official demo
// server; `.de` is the FOSSGIS-hosted backup so Safe Route keeps working when
// the demo server rate-limits mid-storm (keyless-first, no API keys needed).
const OSRM_MIRRORS = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-car",
];
let requestQueue=Promise.resolve(),nextRequestAt=0;
const routeCache=new Map(),routePending=new Map();
function scheduledRouteFetch(url) {
  const task=requestQueue.then(async()=>{
    const wait=Math.max(0,nextRequestAt-Date.now());
    if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    nextRequestAt=Date.now()+1100;
    return fetch(url,{signal:AbortSignal.timeout(6000)});
  });
  requestQueue=task.catch(()=>{});return task;
}

// Issue an OSRM route request across mirrors: 5xx responses and network errors
// advance to the next mirror; an OSRM answer (even a NoRoute 4xx body) is final
// and returned as-is, since bad input fails identically on every mirror.
const requestAcrossMirrors = async (routePath) => {
  for (let i = 0; i < OSRM_MIRRORS.length; i++) {
    const mirror = OSRM_MIRRORS[i];
    try {
      const res = await scheduledRouteFetch(`${mirror}${routePath}`);
      if (res.status >= 500 || res.status === 429) {
        if (i >= OSRM_MIRRORS.length - 1) {
          throw new Error(`OSRM routing failed with status ${res.status}`);
        }
        console.warn(`[routing] OSRM mirror ${mirror} outage (HTTP ${res.status}); trying fallback mirror.`);
        continue;
      }
      const data = await res.json();
      return data;
    } catch (err) {
      if (i === OSRM_MIRRORS.length - 1) {
        throw err;
      }
      console.warn(`[routing] OSRM mirror ${mirror} unreachable (${err.message}); trying fallback mirror.`);
    }
  }
  throw new Error("All OSRM routing mirrors are unreachable.");
};
const osrmRouteRequest = async routePath => {
  const cached=routeCache.get(routePath);
  if(cached&&Date.now()-cached.at<60000)return cached.data;
  if(routePending.has(routePath))return routePending.get(routePath);
  const task=requestAcrossMirrors(routePath).then(data=>{
    if(data.code==='Ok'){if(routeCache.size>=60)routeCache.delete(routeCache.keys().next().value);routeCache.set(routePath,{at:Date.now(),data});}return data;
  }).finally(()=>routePending.delete(routePath));
  routePending.set(routePath,task);return task;
};

// Fetch real driving route from OSRM public API
export const fetchDrivingRoute = async (start, end) => {
  if (
    !start ||
    !end ||
    !Number.isFinite(start.lat) ||
    !Number.isFinite(start.lng) ||
    !Number.isFinite(end.lat) ||
    !Number.isFinite(end.lng)
  ) {
    throw new Error("Invalid start or end coordinates for routing.");
  }

  const routePath = `/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const data = await osrmRouteRequest(routePath);

  if (!data.routes || data.routes.length === 0) {
    throw new Error("No driving route found between selected points.");
  }

  const primaryRoute = data.routes[0];
  // Coordinates from GeoJSON are [lng, lat], Leaflet expects [lat, lng]
  const latLngPoints = primaryRoute.geometry.coordinates.map((coord) => [
    coord[1],
    coord[0],
  ]);

  const distanceKm = (primaryRoute.distance / 1000).toFixed(1);
  const durationMin = Math.round(primaryRoute.duration / 60);

  return {
    coordinates: latLngPoints,
    distanceKm,
    durationMin,
    summary: primaryRoute.legs[0]?.summary || "Primary Corridor",
  };
};

// Enhancement: Automated Flood & Hazard Detour calculation
export const fetchDetourRoute = async (start, end, activeHazards = []) => {
  // First calculate standard primary route
  const baseRoute = await fetchDrivingRoute(start, end);
  const initialConflicts = detectRouteHazards(baseRoute.coordinates, activeHazards, 0.45);

  if (initialConflicts.length === 0) {
    return {
      ...baseRoute,
      conflicts: [],
      isDetour: false,
    };
  }

  // Attempt smart avoidance by computing an orthogonal detour waypoint bypassing the hazard
  const worstHazard = initialConflicts[0].hazard;
  const hLat = worstHazard.position.lat;
  const hLng = worstHazard.position.lng;

  // Vector from start to end
  const dLat = end.lat - start.lat;
  const dLng = end.lng - start.lng;
  // Orthogonal offset (~1.2 km offset to bypass local underpass/waterlogging)
  const norm = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const perpLat = (-dLng / norm) * 0.015;
  const perpLng = (dLat / norm) * 0.015;

  const detourWaypoint = {
    lat: hLat + perpLat,
    lng: hLng + perpLng,
  };

  try {
    const detourPath = `/route/v1/driving/${start.lng},${start.lat};${detourWaypoint.lng},${detourWaypoint.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const data = await osrmRouteRequest(detourPath);
    if (data.routes && data.routes.length > 0) {
      const detourRoute = data.routes[0];
      const detourCoords = detourRoute.geometry.coordinates.map((coord) => [
        coord[1],
        coord[0],
      ]);
      const remainingConflicts = detectRouteHazards(detourCoords, activeHazards, 0.45);

      // If detour cleared or reduced conflicts
      if (remainingConflicts.length < initialConflicts.length) {
        const detourDistKm = (detourRoute.distance / 1000).toFixed(1);
        const detourDuration = Math.round(detourRoute.duration / 60);
        return {
          coordinates: detourCoords,
          distanceKm: detourDistKm,
          durationMin: detourDuration,
          summary: `Bypass detour via ${worstHazard.ward || 'arterial bypass'}`,
          conflicts: remainingConflicts,
          isDetour: true,
          bypassedHazard: worstHazard,
          addedMinutes: detourDuration - baseRoute.durationMin,
        };
      }
    }
  } catch (err) {
    console.warn("Detour calculation fallback to base route:", err);
  }

  return {
    ...baseRoute,
    conflicts: initialConflicts,
    isDetour: false,
  };
};

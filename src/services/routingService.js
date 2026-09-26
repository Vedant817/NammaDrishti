// src/services/routingService.js
/**
 * Safe Route Transit & Hazard Avoidance Service for Bengaluru.
 * Calculates turn-by-turn driving paths and checks against active waterlogging & choke points.
 */

// Popular Bengaluru Transit Landmarks
export const BENGALURU_HUBS = [
  { id: "silk_board", name: "Silk Board Junction", lat: 12.9171, lng: 77.6238 },
  { id: "koramangala", name: "Koramangala Sony World", lat: 12.9345, lng: 77.6258 },
  { id: "indiranagar", name: "Indiranagar 100ft Road", lat: 12.9719, lng: 77.6412 },
  { id: "marathahalli", name: "Marathahalli Bridge", lat: 12.9592, lng: 77.6974 },
  { id: "bellandur", name: "Bellandur EcoSpace (ORR)", lat: 12.9260, lng: 77.6744 },
  { id: "whitefield", name: "Whitefield ITPL", lat: 12.9868, lng: 77.7378 },
  { id: "hebbal", name: "Hebbal Flyover Junction", lat: 13.0358, lng: 77.5970 },
  { id: "mg_road", name: "MG Road Metro Station", lat: 12.9754, lng: 77.6068 },
  { id: "electronic_city", name: "Electronic City Toll", lat: 12.8452, lng: 77.6602 },
];

// Distance calculation using Haversine formula (km)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate perpendicular distance from a point to a line segment in kilometers
export const distanceToSegmentKm = (pLat, pLng, aLat, aLng, bLat, bLng) => {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return calculateDistance(pLat, pLng, aLat, aLng);
  }

  // Projection parameter t clamped to [0, 1]
  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;

  return calculateDistance(pLat, pLng, projLat, projLng);
};

// Check if any segment of a route corridor passes close to active hazards
export const detectRouteHazards = (routeCoordinates, activeHazards, hazardBufferKm = 0.45) => {
  if (!routeCoordinates || routeCoordinates.length === 0) return [];
  const encounteredHazards = [];

  for (const hazard of activeHazards) {
    if (
      !hazard.position ||
      !Number.isFinite(hazard.position.lat) ||
      !Number.isFinite(hazard.position.lng)
    ) {
      continue;
    }
    const hLat = hazard.position.lat;
    const hLng = hazard.position.lng;

    let minDistance = Infinity;

    // Check distance to all route segments to catch hazards between vertices
    if (routeCoordinates.length === 1) {
      minDistance = calculateDistance(hLat, hLng, routeCoordinates[0][0], routeCoordinates[0][1]);
    } else {
      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const p1 = routeCoordinates[i];
        const p2 = routeCoordinates[i + 1];
        const segDist = distanceToSegmentKm(hLat, hLng, p1[0], p1[1], p2[0], p2[1]);
        if (segDist < minDistance) {
          minDistance = segDist;
        }
        if (minDistance <= hazardBufferKm) break;
      }
    }

    if (minDistance <= hazardBufferKm) {
      encounteredHazards.push({
        hazard,
        distanceKm: minDistance,
      });
    }
  }

  return encounteredHazards;
};

// Fetch real driving route from OSRM public API without generating fabricated safe routes
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

  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM routing failed with status ${res.status}`);
  const data = await res.json();

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

// src/services/routingService.js
/**
 * Safe Route Transit & Hazard Bypass Service for Bengaluru.
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

// Check if any point in a route passes close to active hazards
export const detectRouteHazards = (routeCoordinates, activeHazards, hazardBufferKm = 0.4) => {
  const encounteredHazards = [];

  for (const hazard of activeHazards) {
    if (!hazard.position) continue;
    const hLat = hazard.position.lat;
    const hLng = hazard.position.lng;

    // Check if any segment of route is within buffer
    for (const pt of routeCoordinates) {
      const dist = calculateDistance(pt[0], pt[1], hLat, hLng);
      if (dist <= hazardBufferKm) {
        encounteredHazards.push({
          hazard,
          distanceKm: dist,
        });
        break;
      }
    }
  }

  return encounteredHazards;
};

// Fetch real driving route from free OSRM public API with fallback
export const fetchDrivingRoute = async (start, end) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM fetch failed");
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
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
    }
  } catch (err) {
    // Graceful fallback to interpolated straight line with midpoints
    const midLat = (start.lat + end.lat) / 2 + 0.005;
    const midLng = (start.lng + end.lng) / 2 + 0.005;
    const fallbackPoints = [
      [start.lat, start.lng],
      [midLat, midLng],
      [end.lat, end.lng],
    ];
    const dist = calculateDistance(start.lat, start.lng, end.lat, end.lng).toFixed(1);

    return {
      coordinates: fallbackPoints,
      distanceKm: dist,
      durationMin: Math.round(dist * 3.5),
      summary: "Direct Urban Corridor",
    };
  }
};

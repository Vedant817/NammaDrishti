import { activeTrafficIncidents, freshSource } from '../utils/sourceTime';

// Provider geometry stays GeoJSON (lng, lat); route coordinates are Leaflet (lat, lng).
export function routeContext(reports, traffic, now = Date.now()) {
  return {
    hazards: [...reports, ...activeTrafficIncidents(traffic, now).map(item => ({
      ...item, type: item.category, description: [item.from, item.to].filter(Boolean).join(' → '),
      provider: true,
    }))],
    coverage: freshSource(traffic, now) && traffic.status === 'available' && !traffic.truncated ? 'current' : 'incomplete',
    fetchedAt: traffic?.fetchedAt || null,
  };
}

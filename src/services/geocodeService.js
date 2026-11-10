import { API_BASE } from './api';
// Explicit Search/Enter or report submission only. Public Nominatim forbids autocomplete.
export async function suggestBengaluruPlaces(query) {
  const response = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query.trim())}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Place search unavailable; use a map pin or try again.');
  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map(p => ({ ...p, shortLabel: typeof p.label === 'string' ? p.label.split(', ').slice(0, 2).join(', ') : String(p.id || '') }));
}
export async function geocodeBengaluruPlace(query) { return (await suggestBengaluruPlaces(query))[0] || null; }

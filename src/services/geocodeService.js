import { API_BASE } from './api';
// Explicit Search/Enter or report submission only. Public Nominatim forbids autocomplete.
export async function suggestBengaluruPlaces(query) {
  const response = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query.trim())}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Place search unavailable; use a map pin or try again.');
  const data = await response.json();
  return data.results.map(p => ({ ...p, shortLabel: p.label.split(', ').slice(0, 2).join(', ') }));
}
export async function geocodeBengaluruPlace(query) { return (await suggestBengaluruPlaces(query))[0] || null; }

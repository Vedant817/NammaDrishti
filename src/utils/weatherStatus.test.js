import { radarFallback } from './weatherStatus';
test('missing weather does not turn default zero into a clear-sky observation', () => {
  expect(radarFallback({ precipitation: 0, loading: true })).toMatch(/unavailable/);
  expect(radarFallback({ precipitation: 0, isOffline: true, lastUpdated: 'cached' })).toMatch(/unavailable/);
  const reading = radarFallback({ precipitation: 0, loading: false, isOffline: false, lastUpdated: 'now' });
  expect(reading).toMatch(/Open-Meteo reports 0/);
  expect(reading).toMatch(/radar observations are not available/);
  expect(reading).not.toMatch(/clear skies|zero.*echoes/i);
});

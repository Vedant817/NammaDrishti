export function radarFallback(weather) {
  const observed = weather && !weather.loading && !weather.isOffline && weather.lastUpdated && Number.isFinite(weather.precipitation);
  const reading = observed ? `Open-Meteo reports ${weather.precipitation} mm precipitation. ` : 'Live weather telemetry is unavailable. ';
  return reading + 'RainViewer radar observations are not available to this answer. Enable Live Radar on the map to inspect the latest frames.';
}

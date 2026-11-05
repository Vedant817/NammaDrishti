import { useState, useEffect } from 'react';
import { API_BASE } from '../services/api';
export const useWeather = (lat = 12.9716, lng = 77.5946) => {
  const [weather, setWeather] = useState({ temp: null, precipitation: null, loading: true, isOffline: false, lastUpdated: null });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`${API_BASE}/weather?lat=${lat}&lng=${lng}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error('Weather unavailable');
        const data = await response.json();
        if (active) setWeather(data);
      } catch { if (active) setWeather(prev => ({ ...prev, loading: false, isOffline: true, stale: true })); }
    }
    refresh();
    const timer = setInterval(refresh, 120000);
    const ageTimer = setInterval(() => setWeather(prev => prev.observedAt && Date.now() - Date.parse(prev.observedAt) > 1800000 ? { ...prev, stale: true, isOffline: true } : prev), 30000);
    return () => { active = false; controller.abort(); clearInterval(timer); clearInterval(ageTimer); };
  }, [lat, lng]);
  return weather;
};
export const useWeatherTelemetry = () => ({ weather: useWeather() });

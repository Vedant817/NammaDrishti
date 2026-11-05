import { useEffect, useState } from 'react';
import { API_BASE } from '../services/api';

export function useTrafficData() {
  const [traffic, setTraffic] = useState({ status: 'loading', segments: [] });
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`${API_BASE}/traffic`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.segments)) throw new Error();
        if (active) setTraffic(data);
      } catch { if (active) setTraffic({ status: 'unavailable', segments: [] }); }
    }
    refresh();
    const refreshTimer = setInterval(refresh, 120000);
    const ageTimer = setInterval(() => setClock(Date.now()), 30000);
    return () => { active = false; clearInterval(refreshTimer); clearInterval(ageTimer); };
  }, []);
  return { traffic, clock };
}

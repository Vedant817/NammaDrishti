import React, { useEffect, useState } from 'react';
import { BENGALURU_UNDERPASSES } from '../../data/bengaluruUnderpasses';
import { calculateDistance } from '../../services/routingService';
import { API_BASE } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
const CityRecap = ({ events = [], onSelectLocation }) => {
  const { t } = useLanguage();
  const [readings, setReadings] = useState({});
  const [observations, setObservations] = useState([]);
  useEffect(() => {
    let active = true;
    async function refresh() {
      const results = await Promise.allSettled(BENGALURU_UNDERPASSES.map(async p => {
        const r = await fetch(`${API_BASE}/weather?lat=${p.lat}&lng=${p.lng}`, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error(); return [p.id, await r.json()];
      }));
      if (active) setReadings(Object.fromEntries(results.filter(r => r.status === 'fulfilled').map(r => r.value)));
      try { const r = await fetch(`${API_BASE}/flood-observations`, { signal: AbortSignal.timeout(10000) }); const data = await r.json(); if (active) setObservations(data.observations || []); } catch { if (active) setObservations([]); }
    }
    refresh(); const timer = setInterval(refresh, 120000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <div className="recap-content">
    <div className="recap-header"><h4>{t.live.overview}</h4><span>{t.live.citizenData}</span></div>
    <div className="recap-grid">{['Traffic','Waterlogging','Accident','Infrastructure'].map(type => <div className="recap-stat-card" key={type}><span className="recap-num">{events.filter(e => e.type === type).length}</span><span>{t.filters[type]}</span></div>)}</div>
    <h5>{t.live.underpasses}</h5><p>{t.live.unverifiedCatalog}</p>
    <div className="underpass-watch-list">{BENGALURU_UNDERPASSES.map(p => {
      const reports = events.filter(e => e.type === 'Waterlogging' && e.position && calculateDistance(e.position.lat,e.position.lng,p.lat,p.lng) <= 1.2);
      const weather = readings[p.id];
      const fresh = weather && !weather.isOffline && Date.now() - Date.parse(weather.observedAt) < 1800000;
      const sensor = observations.filter(o => Date.now() - Date.parse(o.observedAt) < 900000 && calculateDistance(o.lat,o.lng,p.lat,p.lng) < 0.2);
      return <div className="underpass-card" key={p.id} style={{padding:10,borderBottom:'1px solid var(--border-color)'}}>
        <strong>{p.name}</strong><p>{reports.length ? `${reports.length} ${t.live.nearbyReports}` : t.live.unknownCondition}</p>
        <small>{fresh ? `${t.live.modelRain}: ${weather.precipitationAmountMm} mm / ${weather.intervalSeconds / 60} min · ${new Date(weather.observedAt).toLocaleTimeString()}` : t.live.weatherUnavailable}</small>
        {sensor.map(o => <p key={`${o.source}-${o.observedAt}`}><a href={o.sourceUrl} target="_blank" rel="noreferrer">{o.source}</a>: {o.depthCm} cm · {new Date(o.observedAt).toLocaleString()}</p>)}
        <button type="button" onClick={() => onSelectLocation?.({ id:`underpass_${p.id}`,title:p.name,ward:p.zone,description:t.live.unknownCondition,position:{lat:p.lat,lng:p.lng} })}>{t.live.viewMap}</button>
      </div>;
    })}</div><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo</a>
  </div>;
};
export default CityRecap;

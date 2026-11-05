import React from 'react';

export default function TrafficPanel({ traffic, clock, onSelectLocation, onOverview }) {
  return <section className="traffic-panel">
    <h3>Traffic across Bengaluru</h3>
    <p>Road colours show live TomTom flow across the map. Zoom in for local roads; uncoloured roads have no displayed data.</p>
    <div className="traffic-key" aria-label="Traffic colour legend"><span>🟢 Moving</span><span>🟠 Slower</span><span>🔴 Congested</span></div>
    <h4>Junction speed samples</h4>
    <p>These four samples describe individual road segments, not the whole area. Refreshes every 2 minutes.</p>
    {traffic.status === 'loading' && <p role="status">Loading traffic speeds…</p>}
    {traffic.status === 'unconfigured' && <p role="status">Traffic provider is not configured.</p>}
    {traffic.status === 'unavailable' && <p role="status">Traffic speeds unavailable. Try again shortly.</p>}
    {traffic.segments.map(segment => {
      const fresh = !segment.unavailable && clock - Date.parse(segment.fetchedAt) < 180000;
      return <article className="traffic-sample" key={segment.id}>
        <div><strong>{segment.name}</strong><span>{fresh ? `${segment.currentSpeed} km/h` : 'Unavailable'}</span></div>
        {fresh && <><p>Free flow {segment.freeFlowSpeed} km/h · {segment.roadClosure ? 'Road closed' : 'No closure reported'}</p><small>Retrieved {new Date(segment.fetchedAt).toLocaleTimeString()} · confidence {Math.round(segment.confidence * 100)}%</small></>}
        <button type="button" onClick={() => onSelectLocation?.({ id: `traffic_${segment.id}`, title: segment.name, position: { lat: segment.lat, lng: segment.lng } })}>Locate on map</button>
      </article>;
    })}
    <a href="https://www.tomtom.com/" target="_blank" rel="noreferrer">Traffic data © TomTom</a>
    <div className="traffic-other"><h4>Rain & underpasses</h4><p>See rainfall estimates, regional river forecasts and mapped underpass locations in Overview.</p><button type="button" onClick={onOverview}>Open overview</button></div>
    <p>Hazard counts above are community reports. Zero reports does not mean roads are clear.</p>
  </section>;
}

import React from 'react';
import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import {cityTime} from '../../utils/sourceTime';

export default function TrafficPanel({ traffic, clock, onSelectLocation, onOverview }) {
  const copy=useInterfaceCopy();
  return <section className="traffic-panel">
    <h3>{copy.traffic}</h3>
    <p>{copy.flowHelp}</p>
    <div className="traffic-key" aria-label="Traffic colour legend"><span>🟢 {copy.moving}</span><span>🟠 {copy.slower}</span><span>🔴 {copy.congested}</span></div>
    <h4>{copy.sampleDetails}</h4>
    <p>{copy.samplesHelp}</p>
    {traffic.status === 'loading' && <p role="status">{copy.loading}</p>}
    {traffic.status === 'unconfigured' && <p role="status">{copy.unavailable}</p>}
    {traffic.status === 'unavailable' && <p role="status">{copy.unavailable}</p>}
    {traffic.segments.map(segment => {
      const fresh = !segment.unavailable && clock - Date.parse(segment.fetchedAt) < 180000 && Date.parse(segment.fetchedAt)<=clock+300000;
      return <article className="traffic-sample" key={segment.id}>
        <div><strong>{segment.name}</strong><span>{fresh ? `${segment.currentSpeed} km/h` : copy.unavailable}</span></div>
        {fresh && <><p>{copy.freeFlow} {segment.freeFlowSpeed} km/h · {segment.roadClosure ? copy.closure : copy.noClosure}</p><small>{copy.retrieved} {cityTime(segment.fetchedAt)} · {copy.confidence} {Math.round(segment.confidence * 100)}%</small></>}
        <button type="button" onClick={() => onSelectLocation?.({ id: `traffic_${segment.id}`, title: segment.name, position: { lat: segment.lat, lng: segment.lng } })}>{copy.locateMap}</button>
      </article>;
    })}
    <a href="https://www.tomtom.com/" target="_blank" rel="noreferrer">Traffic data © TomTom</a>
    <div className="traffic-other"><h4>Rain & underpasses</h4><p>See rainfall estimates, regional river forecasts and mapped underpass locations in Overview.</p><button type="button" onClick={onOverview}>{copy.openOverview}</button></div>
    <p>{copy.caution}</p>
  </section>;
}

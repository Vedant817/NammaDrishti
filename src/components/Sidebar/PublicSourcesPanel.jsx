import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { cityTime, freshSource, activeAlerts, activeTrafficIncidents } from '../../utils/sourceTime';

function FeedStatus({source,clock,empty}) {
  if(source.status==='loading')return <p role="status">Loading source…</p>;
  if(source.status==='unconfigured')return <p role="status">API key not configured.</p>;
  if(source.status==='access-denied')return <p role="status">Provider denied access to this API. Traffic flow may still be available.</p>;
  if(!freshSource(source,clock))return <p role="status">Source unavailable or stale. Retrying automatically.</p>;
  return <><small>Checked {cityTime(source.fetchedAt)}</small>{source.status==='partial'&&<p role="status">Some source records could not be checked. Coverage is incomplete.</p>}{empty&&<p>No active records returned for Bengaluru. This does not confirm safe conditions.</p>}</>;
}
export default function PublicSourcesPanel({context,clock,onSelectLocation}) {
  const {lang}=useLanguage(), alerts=activeAlerts(context.official,clock), incidents=activeTrafficIncidents(context.traffic,clock);
  const [query,setQuery]=useState(''),[limit,setLimit]=useState(30);
  const matching=incidents.filter(item=>`${item.category} ${item.title} ${item.from} ${item.to}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="public-sources-panel">
    <h3>Public alerts & road incidents</h3>
    <p><time dateTime={new Date(clock).toISOString()}>{cityTime(clock)}</time> · Bengaluru</p>
    <p>Official warnings and provider incidents are separate from citizen reports. Times use Bengaluru’s time zone.</p>
    <h4>Government warnings · NDMA SACHET</h4>
    <FeedStatus source={context.official} clock={clock} empty={!alerts.length}/>
    {alerts.map(alert=>{const copy=alert.languages?.[lang]||alert;return <article className="public-source-card" key={alert.id}>
      <strong>{alert.event} · {alert.severity}</strong><p>{copy.headline}</p>{copy.description&&<p>{copy.description}</p>}
      <p>{alert.area}</p><small>Issued {cityTime(alert.issuedAt)}<br/>Valid {cityTime(alert.effectiveAt)} – {cityTime(alert.expiresAt)}</small>
      {copy.instruction&&<p>{copy.instruction}</p>}<a href={alert.sourceUrl} target="_blank" rel="noreferrer">Read official CAP alert · {alert.sender}</a>
    </article>;})}
    <h4>Road incidents · TomTom</h4>
    <FeedStatus source={context.traffic} clock={clock} empty={!incidents.length}/>
    {context.traffic.truncated&&<p>The source response exceeds the 2,000-record display limit; coverage is incomplete.</p>}
    {incidents.length>0&&<><label className="source-search">Search road incidents<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(30);}} placeholder="Area, road or incident type"/></label><p>{matching.length} matching incidents · showing {Math.min(limit,matching.length)}</p></>}
    {matching.slice(0,limit).map(item=><article className="public-source-card" key={item.id}>
      <strong>{item.category}</strong><p>{item.title}</p><p>{item.from}{item.to?' → '+item.to:''}</p>
      {item.delaySeconds!==null&&<p>Reported delay: {Math.round(item.delaySeconds/60)} min</p>}
      {item.startTime&&<small>Starts {cityTime(item.startTime)}<br/></small>}{item.endTime&&<small>Ends {cityTime(item.endTime)}<br/></small>}
      <small>Retrieved {cityTime(item.fetchedAt)}</small><br/>
      <button type="button" onClick={()=>onSelectLocation?.({id:item.id,title:item.title,position:item.position})}>Locate on map</button> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">TomTom</a>
    </article>)}
    {matching.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+30)}>Show 30 more incidents</button>}
    <h4>Other public sources</h4>
    <p><a href="https://api.imd.gov.in/public/" target="_blank" rel="noreferrer">IMD observations</a> require an approved API key. <a href="https://varunamitra.karnataka.gov.in/" target="_blank" rel="noreferrer">Varunamitra</a> and <a href="https://btp.karnataka.gov.in/en" target="_blank" rel="noreferrer">Bengaluru Traffic Police</a> publish public information; direct automated feeds have not been verified here.</p>
    <p>No live underpass-depth feed or emergency agency dispatch agreement is configured.</p>
  </section>;
}

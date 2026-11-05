import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { cityTime, freshSource, activeAlerts, activeTrafficIncidents } from '../../utils/sourceTime';

function FeedStatus({source,clock,empty}) {
  const copy=useInterfaceCopy();
  if(source.status==='loading')return <p role="status">{copy.loading}</p>;
  if(source.status==='unconfigured')return <p role="status">{copy.unavailable}</p>;
  if(source.status==='access-denied')return <p role="status">{copy.sourceDenied}</p>;
  if(!freshSource(source,clock))return <p role="status">{copy.sourceMissing}</p>;
  return <><small>{copy.checked} {cityTime(source.fetchedAt)}</small>{source.status==='partial'&&<p role="status">{copy.sourcePartial}</p>}{empty&&<p>{copy.sourceEmpty}</p>}</>;
}
export default function PublicSourcesPanel({context,clock,onSelectLocation}) {
  const copy=useInterfaceCopy();
  const {lang}=useLanguage(), alerts=activeAlerts(context.official,clock), incidents=activeTrafficIncidents(context.traffic,clock);
  const [query,setQuery]=useState(''),[limit,setLimit]=useState(30);
  const matching=incidents.filter(item=>`${item.category} ${item.title} ${item.from} ${item.to}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="public-sources-panel">
    <h3>{copy.roadHeading}</h3>
    <p><time dateTime={new Date(clock).toISOString()}>{cityTime(clock)}</time> · Bengaluru</p>
    <p>{copy.roadIntro}</p>
    <h4>{copy.government} · NDMA SACHET</h4>
    <FeedStatus source={context.official} clock={clock} empty={!alerts.length}/>
    {alerts.map(alert=>{const copy=alert.languages?.[lang]||alert;return <article className="public-source-card" key={alert.id}>
      <strong>{alert.event} · {alert.severity}</strong><p>{copy.headline}</p>{copy.description&&<p>{copy.description}</p>}
      <p>{alert.area}</p><small>{copy.issued} {cityTime(alert.issuedAt)}<br/>{copy.valid} {cityTime(alert.effectiveAt)} – {cityTime(alert.expiresAt)}</small>
      {copy.instruction&&<p>{copy.instruction}</p>}<a href={alert.sourceUrl} target="_blank" rel="noreferrer">{copy.officialLink} · {alert.sender}</a>
    </article>;})}
    <h4>{copy.roadIncidents} · TomTom</h4>
    <FeedStatus source={context.traffic} clock={clock} empty={!incidents.length}/>
    {context.traffic.truncated&&<p>The source response exceeds the 2,000-record display limit; coverage is incomplete.</p>}
    {incidents.length>0&&<><label className="source-search">{copy.roadSearch}<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(30);}} placeholder={copy.roadSearchHint}/></label><p>{matching.length} matching incidents · showing {Math.min(limit,matching.length)}</p></>}
    {matching.slice(0,limit).map(item=><article className="public-source-card" key={item.id}>
      <strong>{item.category}</strong><p>{item.title}</p><p>{item.from}{item.to?' → '+item.to:''}</p>
      {item.delaySeconds!==null&&<p>{copy.reportedDelay}: {Math.round(item.delaySeconds/60)} min</p>}
      {item.startTime&&<small>{copy.starts} {cityTime(item.startTime)}<br/></small>}{item.endTime&&<small>{copy.ends} {cityTime(item.endTime)}<br/></small>}
      <small>{copy.retrieved} {cityTime(item.fetchedAt)}</small><br/>
      <button type="button" onClick={()=>onSelectLocation?.({id:item.id,title:item.title,position:item.position})}>{copy.locateMap}</button> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">TomTom</a>
    </article>)}
    {matching.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+30)}>{copy.moreRoads}</button>}
    <h4>{copy.otherSources}</h4>
    <p><a href="https://tdh.dult-karnataka.com/" target="_blank" rel="noreferrer">DULT Transport Data Hub · BMTC / BMRCL</a></p>
    <p><a href="https://api.imd.gov.in/public/" target="_blank" rel="noreferrer">IMD observations</a> require an approved API key. <a href="https://varunamitra.karnataka.gov.in/" target="_blank" rel="noreferrer">Varunamitra</a> and <a href="https://btp.karnataka.gov.in/en" target="_blank" rel="noreferrer">Bengaluru Traffic Police</a> publish public information; direct automated feeds have not been verified here.</p>
    <p>{copy.externalGap}</p>
  </section>;
}

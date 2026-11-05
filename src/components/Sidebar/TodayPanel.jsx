import React from 'react';
import {Route, CloudRain, ChevronRight, Users, TriangleAlert, ArrowRight} from 'lucide-react';
import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import {activeAlerts,freshSource,cityTime} from '../../utils/sourceTime';
import './TodayPanel.css';

export default function TodayPanel({weather,traffic,context,clock,events,onNavigate,onPlan,onReport}){
  const copy=useInterfaceCopy(),alerts=activeAlerts(context.official,clock);
  const weatherFresh=weather&&!weather.isOffline&&!weather.loading&&Number.isFinite(weather.precipitationAmountMm)&&weather.intervalSeconds>0&&Number.isFinite(Date.parse(weather.observedAt))&&clock-Date.parse(weather.observedAt)<1800000&&Date.parse(weather.observedAt)<=clock+300000;
  return <section className="today-panel">
    <div className="today-intro"><p className="today-date">{cityTime(clock)}</p><h2>{copy.heading}</h2><p>{copy.intro}</p></div>
    <button type="button" className="today-plan" onClick={onPlan}><Route size={22} aria-hidden="true"/><span>{copy.plan}<small>{copy.routeHelp}</small></span><ArrowRight size={18} aria-hidden="true"/></button>
    <div className="today-conditions">
      <button type="button" className={`today-condition ${alerts.length?'today-condition--warning':''}`} onClick={()=>onNavigate('sources')}>
        <TriangleAlert size={21} aria-hidden="true"/><span><strong>{copy.warnings}</strong><span>{freshSource(context.official,clock)?alerts.length?`${alerts.length} ${copy.warningCount}`:copy.noWarnings:context.official.status==='loading'?copy.loading:copy.unavailable}</span></span><ChevronRight size={18} aria-hidden="true"/>
      </button>
      <button type="button" className="today-condition" onClick={()=>onNavigate('traffic')}><Route size={21} aria-hidden="true"/><span><strong>{copy.traffic}</strong><span>{traffic.status==='loading'?copy.loading:traffic.status==='available'?copy.trafficHelp:copy.unavailable}</span></span><ChevronRight size={18} aria-hidden="true"/></button>
      <button type="button" className="today-condition" onClick={()=>onNavigate('recap')}><CloudRain size={21} aria-hidden="true"/><span><strong>{copy.weather}{weatherFresh&&Number.isFinite(weather.temp)?` · ${Math.round(weather.temp)}°C`:''}</strong><span>{weatherFresh?weather.precipitationAmountMm>0?copy.rainNow:copy.noRain:weather?.loading?copy.loading:copy.unavailable}</span>{weatherFresh&&<small>{weather.precipitationAmountMm} mm / {weather.intervalSeconds/60} min · {copy.estimate}</small>}</span><ChevronRight size={18} aria-hidden="true"/></button>
      <button type="button" className="today-condition" onClick={()=>onNavigate('feed')}><Users size={21} aria-hidden="true"/><span><strong>{copy.community}</strong><span>{events.length?`${events.length} · ${copy.browse}`:copy.noReports}</span></span><ChevronRight size={18} aria-hidden="true"/></button>
    </div>
    <p className="today-caution">{copy.caution}</p>
    <div className="today-report"><strong>{copy.report}</strong><p>{copy.communityHelp}</p><button type="button" onClick={onReport}>{copy.report} <ArrowRight size={16} aria-hidden="true"/></button></div>
    <details className="today-guide"><summary>{copy.guide}</summary><p>{copy.guideMap}</p><p>{copy.guideData}</p><button type="button" onClick={()=>onNavigate('helpline')}>{copy.help}</button></details>
  </section>;
}

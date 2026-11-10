import SavedActions from './SavedActions';
import { API_BASE } from "../../services/api";
import { authenticatedFetch as fetch } from "../../services/firebaseService";
// src/components/Sidebar/Sidebar.jsx
import React, { useState } from "react";
import PersonalizedFeed from "./PersonalizedFeed";
import CityRecap from "./CityRecap";
import TrafficPanel from './TrafficPanel';
import PublicSourcesPanel from './PublicSourcesPanel';
import TodayPanel from './TodayPanel';
import FilterPanel from '../Filters/FilterPanel';
import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import { EMERGENCY_CONTACTS } from "../../data/constants";
import { useLanguage } from "../../context/LanguageContext";
import "./Sidebar.css";



const Sidebar = ({
  weather, onPlan, onReport, onFilterChange, savedActionsProps, actionSessionKey,
  publicContext = {official:{status:'loading',alerts:[]},traffic:{status:'loading',incidents:[]}},
  sourceClock = Date.now(),
  traffic = { status: 'loading', segments: [] },
  clock = Date.now(),
  activeTab = "today",
  onTabChange,
  events = [],
  allEvents = null,
  selectedEvent,
  onEventSelect,
  onVerifyEvent,
  onResolveEvent,
  hasUserVoted,
  activeFilter = "All",
  rainIntensity = 0,
  isWeatherOffline = false,
  userLocation = null,
}) => {
  const { t } = useLanguage();
  const copy=useInterfaceCopy();
  const [delivery, setDelivery] = useState(null);
  const [sosStatus, setSosStatus] = useState(null);
  const [acquiringGps, setAcquiringGps] = useState(false);

  const handleTriggerSos = () => {
    setAcquiringGps(true);
    setSosStatus(null);
    setDelivery(null);

    const onCoordsAcquired = (lat, lng) => {
      setAcquiringGps(false);
      const mapUrl = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=17/${lat.toFixed(5)}/${lng.toFixed(5)}`;
      const message = copy.sosMessageLocation.replace('{location}', () => mapUrl);
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      // Post dispatch event to backend
      try {
        fetch(`${API_BASE}/sos/dispatch`, {
          signal: AbortSignal.timeout(3000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, timestamp: new Date().toISOString() }),
        }).then(async response => {
          if (!response.ok) throw new Error();
          const data = await response.json();
          const dispatchId = data.dispatchId || data.id;
          setDelivery(data.status||'SAVED');
          if (dispatchId) {
            let attempts = 0;
            const poll = async () => {
              attempts++;
              try {
                const res = await fetch(`${API_BASE}/sos/status/${encodeURIComponent(dispatchId)}`, { signal: AbortSignal.timeout(2000) });
                if (res.ok) {
                  const statusData = await res.json();
                  setDelivery(statusData.status || data.status || 'SAVED');
                  if (statusData.status === 'ACKNOWLEDGED_BY_OPERATOR' || statusData.status === 'FAILED') return;
                }
              } catch {}
              if (attempts < 12) setTimeout(poll, 3000);
              else setDelivery((d) => d === 'ACKNOWLEDGED_BY_OPERATOR' ? d : (d || 'STATUS_UNKNOWN'));
            };
            setTimeout(poll, 1500);
          }
        }).catch((err) => {
          if (err?.code === 'identity-changed' || err?.message === 'identity-changed') { setDelivery('AUTH_NOT_READY'); return; }
          setDelivery('SAVE_FAILED');
        });
      } catch (err) {
        if (err?.code === 'identity-changed' || err?.message === 'identity-changed') { setDelivery('AUTH_NOT_READY'); return; }
        // Continue even if network is restricted
      }

      const popupBlocked = true;

      setSosStatus({
        lat,
        lng,
        whatsappUrl,
        isVerifiedGps: true,
        popupBlocked,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    };

    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onCoordsAcquired(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          setAcquiringGps(false);
          setSosStatus({
            isVerifiedGps: false,
            error: copy.sosErrorDenied,
            whatsappUrl: `https://wa.me/?text=${encodeURIComponent(copy.sosMessageNoGps)}`,
          });
        },
        { timeout: 7000, enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      setAcquiringGps(false);
      setSosStatus({
        isVerifiedGps: false,
        error: copy.sosErrorUnsupported,
        whatsappUrl: `https://wa.me/?text=${encodeURIComponent(copy.sosMessageNoGps)}`,
      });
    }
  };

  return (
    <aside className="sidebar-container">
      <nav className="sidebar-tab-nav" aria-label={copy.today+' / '+copy.reports+' / '+copy.help}>
        {[['today',copy.today],['feed',copy.reports],['helpline',copy.help]].map(([id,label])=>{
          // Strict match: sources/traffic/recap sub-views must not fake-match
          // Today. They render under the back-to-today path instead.
          const active=activeTab===id;
          return <button key={id} type="button" aria-current={active?'page':undefined} className={`sidebar-tab-btn ${active?'active':''}`} onClick={()=>onTabChange(id)}>{label}</button>;
        })}
      </nav>

      <div className="sidebar-scrollable-body">
        {!['today','feed','helpline'].includes(activeTab) && <button type="button" className="back-to-today" onClick={()=>onTabChange('today')}>← {copy.back}</button>}
        {activeTab==='today' && <TodayPanel weather={weather} traffic={traffic} context={publicContext} clock={sourceClock} events={allEvents||events} onNavigate={onTabChange} onPlan={onPlan} onReport={onReport}/>}
        {activeTab==='feed' && <><div className="reports-intro"><h2>{copy.reports}</h2><p>{copy.reportsIntro}</p><button type="button" onClick={onReport}>{copy.report}</button></div><FilterPanel activeFilter={activeFilter} onFilterChange={onFilterChange} events={allEvents||events}/></>}
        {activeTab==='helpline' && <details className="today-guide"><summary>{copy.guide}</summary><p>{copy.guideMap}</p><p>{copy.guideRoute}</p><p>{copy.guideData}</p></details>}

        {activeTab === 'sources' && <PublicSourcesPanel context={publicContext} clock={sourceClock} onSelectLocation={onEventSelect}/>}
        {activeTab === 'traffic' && <TrafficPanel traffic={traffic} clock={clock} onSelectLocation={onEventSelect} onOverview={() => onTabChange('recap')} />}
        {delivery && <p role="status">{delivery==='LOCATION_RECORDED'?copy.locationSaved:delivery==='SAVE_FAILED'?copy.locationSaveFailed:copy.locationQueued} {t.live.call112}</p>}
        {activeTab==='feed'&&savedActionsProps&&<SavedActions key={actionSessionKey} {...savedActionsProps}/>}
        {activeTab === "feed" && (
          <PersonalizedFeed
            events={events}
            allEvents={allEvents}
            selectedEvent={selectedEvent}
            onEventSelect={onEventSelect}
            onVerifyEvent={onVerifyEvent}
            onResolveEvent={onResolveEvent}
            hasUserVoted={hasUserVoted}
            activeFilter={activeFilter}
          />
        )}

        {activeTab === "recap" && (
          <CityRecap
            events={allEvents || events}
            rainIntensity={rainIntensity}
            isWeatherOffline={isWeatherOffline}
            onSelectLocation={onEventSelect}
          />
        )}

        {activeTab === "helpline" && (
          <div className="helpline-tab-content">
            <div className="helpline-header">
              <h4>{t.sidebar.helplineTitle}</h4>
              <p>{t.sidebar.helplineSub}</p>
            </div>

            {/* One-Tap Emergency SOS Dispatch Section */}
            <div className="emergency-sos-box">
              <div className="sos-box-header">
                <span className="sos-badge">{copy.sosBadge}</span>
                <a className="sos-network" href="tel:112">{t.ui["Call 112"]}</a>
              </div>
              <h5>{t.sidebar?.sosTitle || "One-Tap Bengaluru Emergency SOS Dispatch"}</h5>
              <p>{t.sidebar?.sosDesc || "Save your location and choose someone to share it with. For emergency assistance, call 112."}</p>

              <button
                type="button"
                className={`trigger-sos-btn ${acquiringGps ? "loading" : ""}`}
                onClick={handleTriggerSos}
                disabled={acquiringGps}
              >
                {acquiringGps ? copy.locating : t.ui["Share emergency location"]}
              </button>

              {sosStatus && (
                <div className="sos-active-panel">
                  {sosStatus.isVerifiedGps ? (
                    <div className="sos-coords-row">
                      <span>✓ {copy.gpsAcquired}</span>
                      <strong>{sosStatus.lat.toFixed(4)}, {sosStatus.lng.toFixed(4)}</strong>
                    </div>
                  ) : (
                    <div className="sos-coords-row sos-error-coords" style={{ color: "#EF4444" }}>
                      <span>⚠️ {sosStatus.error}</span>
                    </div>
                  )}
                  {sosStatus.popupBlocked && (
                    <div className="sos-coords-row" style={{ color: "#F59E0B", fontSize: "0.82rem" }}>
                      <span>ℹ️ {copy.locationReady}</span>
                    </div>
                  )}
                  <div className="sos-actions-row" style={{ flexWrap: 'wrap' }}>
                    <a
                      href={sosStatus.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sos-whatsapp-btn"
                    >
                      💬 {copy.whatsappSos}
                    </a>
                    <a
                      href={`sms:?body=${encodeURIComponent(
                        sosStatus.isVerifiedGps ? copy.sosSmsWithGps.replace('{lat}', () => sosStatus.lat.toFixed(5)).replace('{lng}', () => sosStatus.lng.toFixed(5)) : copy.sosSmsNoGps
                      )}`}
                      className="sos-sms-btn"
                    >
                      📱 SMS
                    </a>
                    <a href="tel:112" className="sos-dial-btn">
                      📞 {copy.call112Police}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="helpline-list">
              {EMERGENCY_CONTACTS.map((c) => (
                <div key={c.name} className="helpline-card">
                  <div className="helpline-card-info">
                    <h6>{c.name}</h6>
                    <p>{c.desc}</p>
                  </div>
                  <a href={`tel:${c.number.split(" ")[0]}`} className="helpline-call-btn">
                    📞 {c.number}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

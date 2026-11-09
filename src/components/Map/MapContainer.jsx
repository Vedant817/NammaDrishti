import {incidentTime} from '../../utils/incidentTime';
import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import { API_BASE } from '../../services/api';
import { CloudRain, Route, Layers } from "lucide-react";
// src/components/Map/MapContainer.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "../../context/LanguageContext";
import { BENGALURU_UNDERPASSES } from "../../data/bengaluruUnderpasses";
import { activeTrafficIncidents } from '../../utils/sourceTime';
import "./MapContainer.css";

// Fix standard Leaflet default icon path issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Center of Bengaluru
const BENGALURU_CENTER = [12.9716, 77.5946];

const MapResizeController = () => {
  const map = useMap();
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      const resize = () => map.invalidateSize({ pan: false });
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
};

// Component to dynamically pan and zoom to selected event / deep-linked view.
// Deduplicates identical targets so unrelated re-renders can't re-trigger a fly.
const MapViewController = ({ center, zoom }) => {
  const map = useMap();
  const lastTargetRef = useRef(null);
  useEffect(() => {
    if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return undefined;
    const targetKey = `${center[0]},${center[1]},${zoom}`;
    if (lastTargetRef.current === targetKey) return undefined;
    lastTargetRef.current = targetKey;
    map.flyTo(center, zoom, { duration: 1.2 });
    return undefined;
  }, [center, zoom, map]);
  return null;
};

// Component to capture user map clicks for reporting
const MapEventsHandler = ({ onMapClick, onZoom }) => {
  useMapEvents({
    zoomend(e) { onZoom(e.target.getZoom()); },
    click(e) {
      if (onMapClick && e.latlng) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

// Selection moves the camera. Open details after that movement, since Leaflet
// can close a popup opened during the same marker click/fly-to update.
const IncidentMarker=({selected,...props})=>{
  const marker=useRef(null),map=useMap();
  useEffect(()=>{
    if(!selected)return;
    let timer;
    const open=()=>{clearTimeout(timer);map.off?.('moveend',open);marker.current?.openPopup();};
    map.once?.('moveend',open);timer=setTimeout(open,1350);
    return()=>{clearTimeout(timer);map.off?.('moveend',open);};
  },[selected,map]);
  return <Marker ref={marker} bubblingMouseEvents={false} {...props}/>;
};

const CustomMapContainer = ({
  events = [],
  providerIncidents = {status:'loading',incidents:[]},
  clock = Date.now(),
  selectedEvent = null,
  onEventSelect = null,
  onMapClick = null,
  onVerifyEvent = null,
  onResolveEvent = null,
  hasUserVoted = null,
  reportPin = null,
  navigationRoute = null,
  onClearNavigationRoute = () => {},
  initialCamera = null,
}) => {
  const { t,lang } = useLanguage();
  const copy=useInterfaceCopy();
  const [showRadar, setShowRadar] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showRoadIncidents,setShowRoadIncidents]=useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  // RainViewer frame timeline: past observations only
  const [radarError, setRadarError] = useState(null);
  const [showUnderpasses, setShowUnderpasses] = useState(false);
  const [mapZoom, setMapZoom] = useState(12);
  const [tileStatus, setTileStatus] = useState('loading');
  const tileEpoch = Math.floor(clock / 120000);
  useEffect(() => { setTileStatus('loading'); }, [tileEpoch, showTraffic]);
  const [radarData, setRadarData] = useState(null); // { frames: [{time, path}], nowIndex }
  const [radarIndex, setRadarIndex] = useState(null);
  const [isPlayingRadar, setIsPlayingRadar] = useState(false);

  // Fetch past RainViewer observations, auto-refresh every 5 minutes
  const fetchRadar = useCallback(async () => {
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal: AbortSignal.timeout(7000) });
      if (!res.ok) throw new Error("Radar catalog unavailable");
      const data = await res.json();
      const past = (data.radar && data.radar.past) || [];
      const frames = past
        .filter((frame) => frame && /^\/v2\/radar\/[A-Za-z0-9/_-]+$/.test(frame.path) && Number.isFinite(frame.time))
        .map((frame) => ({ time: frame.time, path: frame.path }));
      if (!frames.length || !/^https:\/\/[a-z0-9.-]+\.rainviewer\.com$/.test(data.host)) throw new Error("Invalid radar catalog");
      frames.sort((a, b) => a.time - b.time);
      setRadarError(null);
      setRadarData({ frames, host: data.host, nowIndex: frames.length - 1 });
      setRadarIndex(frames.length - 1);
    } catch (err) {
      setRadarError("Radar unavailable; previous observation may be stale.");
    }
  }, []);

  useEffect(() => {
    fetchRadar();
    const radarInterval = setInterval(fetchRadar, 5 * 60 * 1000);
    return () => clearInterval(radarInterval);
  }, [fetchRadar]);

  // If user turns on radar and the catalog is missing, fetch immediately
  useEffect(() => {
    if (showRadar && !radarData) {
      fetchRadar();
    }
  }, [showRadar, radarData, fetchRadar]);

  // Clamp / initialize the scrub position whenever a fresh frame catalog arrives
  useEffect(() => {
    if (!radarData) return undefined;
    setRadarIndex((idx) => (idx == null || idx >= radarData.frames.length ? radarData.nowIndex : idx));
    return undefined;
  }, [radarData]);

  // Radar timeline playback loop (~0.7s per frame)
  useEffect(() => {
    if (!isPlayingRadar || !radarData || radarData.frames.length === 0) return undefined;
    const totalFrames = radarData.frames.length;
    const playbackInterval = setInterval(() => {
      setRadarIndex((idx) => ((idx == null ? radarData.nowIndex : idx) + 1) % totalFrames);
    }, 700);
    return () => clearInterval(playbackInterval);
  }, [isPlayingRadar, radarData]);

  const radarFrames = radarData ? radarData.frames : [];
  const currentRadarFrame = radarIndex != null ? radarFrames[radarIndex] : null;

  // Age is measured against the wall clock, never against the newest frame.
  const formatRadarLabel = (frame) => {
    if (!frame || !radarData) return "";
    const displayClock = new Date(frame.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const deltaMin = Math.round((frame.time * 1000 - clock) / 60000);
    if (deltaMin === 0) return `${displayClock} • latest observation`;
    return deltaMin < 0 ? `${displayClock} • ${-deltaMin}m ago` : `${displayClock} • +${deltaMin}m`;
  };

  // Modern SVG Pin Generator with semantic colors
  const createCustomIcon = (type, isSelected) => {
    const iconColors = {
      Traffic: "#EF4444",
      Waterlogging: "#06B6D4",
      Accident: "#F59E0B",
      Infrastructure: "#8B5CF6",
      Event: "#EC4899",
      Rain: "#3B82F6",
    };

    const typeIcons = {
      Traffic: "🚗",
      Waterlogging: "🌊",
      Accident: "⚠️",
      Infrastructure: "🔧",
      Event: "🎉",
      Rain: "🌧️",
    };

    const color = iconColors[type] || "#3B82F6";
    const glyph = typeIcons[type] || "📍";
    const scaleClass = isSelected ? "selected-marker" : "";

    return L.divIcon({
      className: `namma-map-pin ${scaleClass}`,
      html: `
        <div class="pin-anchor" style="--pin-color: ${color}">
          <div class="pin-bubble">
            <span class="pin-symbol">${glyph}</span>
          </div>
          <div class="pin-pointer"></div>
        </div>
      `,
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -38],
    });
  };

  // Report pin for user placement
  const reportIcon = L.divIcon({
    className: "namma-report-pin",
    html: `
      <div class="pin-anchor pin-pulse" style="--pin-color: #10B981">
        <div class="pin-bubble">
          <span class="pin-symbol">📍</span>
        </div>
        <div class="pin-pointer"></div>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
  });

  return (
    <div className="map-wrapper">
      {/* Floating Modern Map Controls */}
      <div className="map-toolbar map-toolbar--simple">
        <details className="map-layer-menu" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary').focus();}}}>
          <summary><Layers size={17} aria-hidden="true"/>{copy.layers}</summary>
          <div className="map-layer-options"><p>{copy.layerHint}</p>
        <button
          type="button"
          className={`toolbar-btn ${showRadar ? "active-blue" : ""}`}
          onClick={() => {
            setShowRadar(!showRadar);
            if (!showRadar) {
              setIsPlayingRadar(false);
              setRadarIndex(radarData ? radarData.nowIndex : null);
            }
          }}
          aria-pressed={showRadar} title={t.ui["Toggle rain radar"]}
        >
          <CloudRain size={16} aria-hidden="true" /> {copy.rain}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showTraffic ? "active-amber" : ""}`}
          onClick={() => setShowTraffic(!showTraffic)}
          aria-pressed={showTraffic} title="Toggle citywide traffic flow"
        >
          <Route size={16} aria-hidden="true" /> {copy.traffic}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showHeatmap ? "active-rose" : ""}`}
          onClick={() => setShowHeatmap(!showHeatmap)}
          aria-pressed={showHeatmap} title="Toggle reported hazard density"
        >
          <Layers size={16} aria-hidden="true" /> {copy.clusters}
        </button>

        <button type="button" className={`toolbar-btn ${showUnderpasses ? 'active-blue' : ''}`} aria-pressed={showUnderpasses} onClick={() => setShowUnderpasses(value => !value)}>{copy.underpasses}</button>
        <button type="button" className={`toolbar-btn ${showRoadIncidents ? 'active-amber' : ''}`} aria-pressed={showRoadIncidents} onClick={()=>setShowRoadIncidents(value=>!value)}>{copy.incidents}</button>

          </div>
        </details>
        {/* GEV-style radar timeline: play the past radar observations */}
        {showRadar && radarData && radarFrames.length > 0 && (
          <div className="radar-timeline">
            <button
              type="button"
              className="toolbar-btn"
              aria-pressed={isPlayingRadar}
              onClick={() => setIsPlayingRadar((p) => !p)}
              title="Animate past radar observations"
            >
              {isPlayingRadar ? "⏸ Pause" : "▶ Play"}
            </button>
            <input
              type="range"
              className="radar-scrubber"
              min={0}
              max={radarFrames.length - 1}
              value={radarIndex == null ? radarData.nowIndex : radarIndex}
              onChange={(e) => {
                setIsPlayingRadar(false);
                setRadarIndex(Number(e.target.value));
              }}
              aria-label="Scrub monsoon radar timeline"
              aria-valuetext={formatRadarLabel(currentRadarFrame)}
            />
            <span className="radar-frame-label">{formatRadarLabel(currentRadarFrame)}</span>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => {
                setIsPlayingRadar(false);
                setRadarIndex(radarData.nowIndex);
              }}
              title="Jump to latest observed radar frame"
            >
              ⏭ Latest
            </button>
          </div>
        )}

        {showRadar && <span role="status">{radarError || (currentRadarFrame && clock - currentRadarFrame.time * 1000 > 1800000 ? "Radar observation stale" : "Observed radar · coverage may be incomplete")}</span>}
        {showTraffic && <div className="map-layer-status" role="status">{mapZoom < 10 ? copy.zoomTraffic : tileStatus === 'error' ? copy.trafficIncomplete : tileStatus === 'loading' ? copy.loading : copy.flowLegend}</div>}
        {showHeatmap && <div className="map-layer-status" role="status">{events.length ? `${events.length} · ${copy.reportClustersHint}` : copy.noReports}</div>}
        {showUnderpasses && <div className="map-layer-status">{copy.underpassHint}</div>}
        {navigationRoute && <span role="status">{navigationRoute.status === 'ready' ? copy.routeTime : navigationRoute.status === 'checking' ? copy.routeChecking : copy.routeIncomplete}</span>}
        {navigationRoute && (
          <button
            type="button"
            className="toolbar-btn active-cyan"
            onClick={() => {
              if (typeof onClearNavigationRoute === "function") {
                onClearNavigationRoute();
              }
            }}
            title="Clear active navigation route from map"
          >
            ✕ {copy.clearRoute}
          </button>
        )}

        <div className="toolbar-hint">
          <span>{t.ui["Select a point on the map to report a hazard"]}</span>
        </div>
      </div>

      <MapContainer
        preferCanvas={true}
        center={BENGALURU_CENTER}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        className="leaflet-container"
      >
        <MapEventsHandler onMapClick={onMapClick} onZoom={setMapZoom} />
        <MapResizeController />
        {/* One-shot camera restore for ?view=lat,lng,z deep links (only when nothing is selected) */}
        {!selectedEvent && initialCamera && (
          <MapViewController center={initialCamera.center} zoom={initialCamera.zoom} />
        )}
        {selectedEvent &&
          selectedEvent.position &&
          Number.isFinite(selectedEvent.position.lat) &&
          Number.isFinite(selectedEvent.position.lng) && (
            <MapViewController
              center={[selectedEvent.position.lat, selectedEvent.position.lng]}
              zoom={14}
            />
          )}

        {selectedEvent?.id?.startsWith('underpass_') && selectedEvent.position && (
          <CircleMarker center={[selectedEvent.position.lat, selectedEvent.position.lng]} radius={12} pathOptions={{ color: '#176582', fillColor: '#176582', fillOpacity: 0.5 }}>
            <Popup>{selectedEvent.title} — curated underpass location</Popup>
          </CircleMarker>
        )}
        {/* Clean OpenStreetMap Tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* Live RainViewer Radar Layer — keyed per frame so tiles reload while scrubbing */}
        {showRadar && currentRadarFrame && (
          <TileLayer
            key={currentRadarFrame.path}
            url={`${radarData.host}${currentRadarFrame.path}/256/{z}/{x}/{y}/2/1_1.png`}
            maxNativeZoom={7}
            maxZoom={19}
            attribution='Radar: <a href="https://www.rainviewer.com/">RainViewer</a>'
            eventHandlers={{ tileerror: () => setRadarError("Radar tiles unavailable; coverage is not confirmed.") }}
            opacity={0.65}
            zIndex={200}
          />
        )}

        {showTraffic && <TileLayer
          key={`traffic-${tileEpoch}`}
          url={`${API_BASE}/traffic/tiles/{z}/{x}/{y}.png?v=${tileEpoch}`}
          bounds={[[12.7, 77.3], [13.28, 77.88]]}
          minZoom={10} maxNativeZoom={18} maxZoom={19}
          opacity={0.9} zIndex={300} updateWhenIdle={true} keepBuffer={0}
          attribution='Traffic &copy; <a href="https://www.tomtom.com/">TomTom</a>'
          eventHandlers={{ tileerror: () => setTileStatus('error'), tileload: () => setTileStatus(value => value === 'error' ? value : 'ready') }}
        />}
        {(selectedEvent?.id?.startsWith('traffic_')||selectedEvent?.id?.startsWith('tomtom_')) && <CircleMarker center={[selectedEvent.position.lat, selectedEvent.position.lng]} radius={10} pathOptions={{ color: '#176582' }}><Popup>{selectedEvent.title} · TomTom</Popup></CircleMarker>}
        {showRoadIncidents && activeTrafficIncidents(providerIncidents,clock).map(item=><CircleMarker key={item.id} center={[item.position.lat,item.position.lng]} radius={6} bubblingMouseEvents={false} pathOptions={{color:'#AD5139',fillOpacity:.65}}><Popup><strong>{item.category} · TomTom</strong><p>{item.title}</p><p>{item.from}{item.to?' → '+item.to:''}</p></Popup></CircleMarker>)}
        {showUnderpasses && BENGALURU_UNDERPASSES.map(point => <CircleMarker key={point.id} bubblingMouseEvents={false} center={[point.lat, point.lng]} radius={7} pathOptions={{ color: '#176582', fillColor: '#fff', fillOpacity: 0.85, weight: 2 }}>
          <Popup><strong>{point.name}</strong><p>Approximate underpass location. Current flooding and road clearance are unverified.</p></Popup>
        </CircleMarker>)}
        {/* Citizen report density is distinct from measured traffic. */}
        {showHeatmap &&
          events.map((evt) => {
            if (!evt.position || !Number.isFinite(evt.position.lat) || !Number.isFinite(evt.position.lng)) {
              return null;
            }
            const isHigh = evt.urgency === "High" || evt.type === "Waterlogging";
            const radius = Math.min(65, 30 + (evt.verificationCount || 1) * 6);
            return (
              <CircleMarker
                key={`heatmap_${evt.id}`}
                center={[evt.position.lat, evt.position.lng]}
                radius={radius}
                color={isHigh ? "#EF4444" : "#F59E0B"}
                fillColor={isHigh ? "#EF4444" : "#F59E0B"}
                fillOpacity={0.35}
                weight={0}
              >
                <Popup className="clean-popup">
                  <div className="popup-body">
                    <span className="popup-type-tag" style={{ background: isHigh ? "#EF4444" : "#F59E0B", color: "#fff" }}>
                      Community report location
                    </span>
                    <h4 className="popup-title">{evt.title}</h4>
                    <p className="popup-desc">Confirmations: {evt.verificationCount || 1}. Community report; not a sensor measurement.</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* Navigation Route Display */}
        {navigationRoute && (navigationRoute.coordinates || Array.isArray(navigationRoute)) && (
          <Polyline
            positions={navigationRoute.coordinates || navigationRoute}
            color={navigationRoute.status !== "ready" ? "#64748b" : navigationRoute.hasConflicts ? "#EF4444" : "#176582"}
            weight={7}
            opacity={0.9}
            dashArray={navigationRoute.hasConflicts ? "6, 8" : undefined}
          >
            <Popup className="clean-popup">
              <div className="popup-body">
                <h4>
                  {navigationRoute.status !== 'ready' ? copy.routeIncomplete : navigationRoute.hasConflicts ? copy.routeConflicts : copy.routeClear}
                </h4>
                <p>
                  {copy.routeChecked}
                </p>
              </div>
            </Popup>
          </Polyline>
        )}

        {/* User reporting pin preview */}
        {reportPin &&
          Number.isFinite(reportPin.lat) &&
          Number.isFinite(reportPin.lng) && (
            <Marker position={[reportPin.lat, reportPin.lng]} icon={reportIcon}>
              <Popup autoPan={false}>
                <div className="pin-hint-popup">Selected Location for Report</div>
              </Popup>
            </Marker>
          )}

        {/* Incident Markers - Strictly Guarded against malformed coordinates */}
        {events.map((event) => {
          if (
            !event.position ||
            !Number.isFinite(event.position.lat) ||
            !Number.isFinite(event.position.lng)
          ) {
            return null;
          }
          const isSelected = selectedEvent && selectedEvent.id === event.id;

          if (event.type === "Rain") {
            return (
              <CircleMarker
                key={event.id}
                center={[event.position.lat, event.position.lng]}
                radius={28}
                color="#3B82F6"
                fillColor="#3B82F6"
                fillOpacity={0.25}
                weight={2}
              >
                <Popup className="clean-popup">
                  <div className="popup-body">
                    <div className="popup-badge rain">Rain Cell</div>
                    <h4 className="popup-title">{event.title}</h4>
                    <p className="popup-desc">{event.description}</p>
                  {event.waterDepth && (
                    <div className="popup-water-depth-badge" style={{ margin: '6px 0', padding: '4px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4', fontSize: '0.78rem', fontWeight: 600 }}>
                      🌊 Depth: {event.waterDepth} {event.vehiclePassability ? `• 🚫 ${event.vehiclePassability}` : ''}
                    </div>
                  )}
                    <div className="popup-meta">
                      <span>{event.ward}</span>
                      <span>{incidentTime(event,lang)}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          }

          const translatedType =
            (t.filters && t.filters[event.type]) || event.type;

          return (
            <IncidentMarker
              key={event.id}
              selected={isSelected}
              position={[event.position.lat, event.position.lng]}
              icon={createCustomIcon(event.type, isSelected)}
              eventHandlers={{
                click: () => onEventSelect && onEventSelect(event),
              }}
            >
              <Popup className="clean-popup">
                <div className="popup-body">
                  <div className="popup-header-row">
                    <span className={`popup-type-tag ${event.type.toLowerCase()}`}>
                      {translatedType}
                    </span>
                    <span
                      className={`urgency-pill ${
                        event.urgency ? event.urgency.toLowerCase() : "medium"
                      }`}
                    >
                      {event.urgency || "Medium"}
                    </span>
                  </div>

                  <h4 className="popup-title">{event.title}</h4>
                  <p className="popup-desc">{event.description}</p>

                  {(event.waterDepth || event.vehiclePassability) && (
                    <div className="popup-water-depth-badge" style={{ margin: '6px 0', padding: '4px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4', fontSize: '0.78rem', fontWeight: 600 }}>
                      🌊 {copy.waterDepth}: {event.waterDepth || copy.unknown} {event.vehiclePassability ? `• 🚫 ${event.vehiclePassability}` : ''}
                    </div>
                  )}
                  {event.clusterCount > 1 && (
                    <div className="popup-cluster-badge" style={{ margin: '4px 0', padding: '2px 8px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.15)', color: '#A78BFA', fontSize: '0.72rem', fontWeight: 600, display: 'inline-block' }}>
                      🔗 {event.clusterCount} merged citizen reports
                    </div>
                  )}

                  <div className="popup-ward-row">
                    <span className="ward-label">Ward:</span> {event.ward || "Bengaluru"}
                  </div>

                  {event.mediaUrl && (
                    <div className="popup-image-preview">
                      <img src={event.mediaUrl} alt="Report attachment" />
                    </div>
                  )}

                  <div className="popup-verification-bar">
                    <span className="consensus-count">
                      👥 <strong>{event.verificationCount || 1}</strong> {t.actions.confirmations}
                    </span>
                    {event.isVerified && (
                      <span className="verified-check">{t.actions.verifiedBadge}</span>
                    )}
                  </div>

                  <div className="popup-actions">
                    <button
                      type="button"
                      className="popup-btn confirm"
                      disabled={hasUserVoted?.(event.id,'verify')===true}
                      aria-label={`${t.actions.confirm} — ${event.title}`}
                      onClick={() => onVerifyEvent && onVerifyEvent(event.id)}
                    >
                      {t.actions.confirm}
                    </button>
                    <button
                      type="button"
                      className="popup-btn resolve"
                      disabled={hasUserVoted?.(event.id,'clear')===true}
                      aria-label={`${t.actions.markCleared} — ${event.title}`}
                      onClick={() => onResolveEvent && onResolveEvent(event.id)}
                    >
                      {t.actions.markCleared}
                    </button>
                  </div>
                </div>
              </Popup>
            </IncidentMarker>
          );
        })}

      </MapContainer>
    </div>
  );
};

export default CustomMapContainer;

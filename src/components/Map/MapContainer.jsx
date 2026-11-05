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
import { calculateDistance } from "../../services/routingService";
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
const MapEventsHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick && e.latlng) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

const CustomMapContainer = ({
  events = [],
  selectedEvent = null,
  onEventSelect = null,
  onMapClick = null,
  onVerifyEvent = null,
  onResolveEvent = null,
  reportPin = null,
  navigationRoute = null,
  onClearNavigationRoute = () => {},
  initialCamera = null,
}) => {
  const { t } = useLanguage();
  const [showRadar, setShowRadar] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  // RainViewer frame timeline: observed frames (past) + 30-min nowcast
  const [radarData, setRadarData] = useState(null); // { frames: [{time, path}], nowIndex }
  const [radarIndex, setRadarIndex] = useState(null);
  const [isPlayingRadar, setIsPlayingRadar] = useState(false);

  // Fetch RainViewer frame catalog (past + nowcast), auto-refresh every 5 minutes
  const fetchRadar = useCallback(async () => {
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      if (!res.ok) return;
      const data = await res.json();
      const past = (data.radar && data.radar.past) || [];
      const nowcast = (data.radar && data.radar.nowcast) || [];
      const frames = [...past, ...nowcast]
        .filter((frame) => frame && frame.path && Number.isFinite(frame.time))
        .map((frame) => ({ time: frame.time, path: frame.path }));
      if (frames.length === 0) return;
      setRadarData({ frames, nowIndex: Math.max(0, past.length - 1) });
    } catch (err) {
      // Retain previous frame catalog if temporary network issue
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

  // Label like "14:30 • Now", "14:10 • 20m ago", "15:00 • +30m"
  const formatRadarLabel = (frame) => {
    if (!frame || !radarData) return "";
    const clock = new Date(frame.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const deltaMin = Math.round((frame.time - radarData.frames[radarData.nowIndex].time) / 60);
    if (deltaMin === 0) return `${clock} • Now`;
    return deltaMin < 0 ? `${clock} • ${-deltaMin}m ago` : `${clock} • +${deltaMin}m`;
  };

  // Bengaluru arterial corridors (factual geometry) with live incident correlation.
  // No fabricated speed/delayfiction: status comes only from live citizen reports.
  const baseCorridors = [
    {
      id: "corridor_silk_board",
      name: "Silk Board - BTM Corridor",
      positions: [
        [12.9171, 77.6238],
        [12.919, 77.625],
        [12.923, 77.627],
        [12.928, 77.629],
      ],
    },
    {
      id: "corridor_orr_bellandur",
      name: "Outer Ring Road (Bellandur - Marathahalli)",
      positions: [
        [12.926, 77.674],
        [12.935, 77.685],
        [12.945, 77.692],
        [12.9592, 77.6974],
      ],
    },
    {
      id: "corridor_tin_factory",
      name: "Tin Factory & KR Puram Flyover",
      positions: [
        [12.9972, 77.6672],
        [13.002, 77.675],
        [13.0075, 77.6959],
      ],
    },
    {
      id: "corridor_hebbal",
      name: "Hebbal Flyover to Airport Expressway",
      positions: [
        [13.0358, 77.597],
        [13.045, 77.598],
        [13.055, 77.6],
      ],
    },
  ];

  // Correlate monitored corridors with active nearby hazard density.
  const dynamicCorridors = baseCorridors.map((corridor) => {
    const nearbyHazards = events.filter((evt) => {
      if (!evt.position || !Number.isFinite(evt.position.lat) || !Number.isFinite(evt.position.lng)) {
        return false;
      }
      return corridor.positions.some(
        ([cLat, cLng]) => calculateDistance(evt.position.lat, evt.position.lng, cLat, cLng) <= 1.2
      );
    });

    let status = "No Active Reports Nearby";
    let color = "#10B981"; // Emerald green
    if (nearbyHazards.length >= 2) {
      status = `High Incident Density (${nearbyHazards.length} Active Incidents)`;
      color = "#EF4444"; // Crimson red
    } else if (nearbyHazards.length === 1) {
      status = `Active Caution (${nearbyHazards[0].title})`;
      color = "#F59E0B"; // Amber
    }

    return {
      ...corridor,
      status,
      color,
      hazardCount: nearbyHazards.length,
    };
  });

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
      <div className="map-toolbar">
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
          aria-pressed={showRadar} title="Toggle rain radar"
        >
          <CloudRain size={16} aria-hidden="true" /> {showRadar ? t.actions.hideRadar : t.actions.liveRadar}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showTraffic ? "active-amber" : ""}`}
          onClick={() => setShowTraffic(!showTraffic)}
          aria-pressed={showTraffic} title="Toggle road corridors"
        >
          <Route size={16} aria-hidden="true" /> {showTraffic ? t.actions.hideTraffic : t.actions.trafficFlow}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showHeatmap ? "active-rose" : ""}`}
          onClick={() => setShowHeatmap(!showHeatmap)}
          aria-pressed={showHeatmap} title="Toggle reported hazard density"
        >
          <Layers size={16} aria-hidden="true" /> {showHeatmap ? (t.actions?.hideHeatmap || "Hide Heatmap") : (t.actions?.heatmap || "Risk Heatmap")}
        </button>

        {/* GEV-style radar timeline: play the past 2h + scrub the 30-min nowcast */}
        {showRadar && radarData && radarFrames.length > 0 && (
          <div className="radar-timeline">
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setIsPlayingRadar((p) => !p)}
              title="Animate past radar frames + 30-min nowcast"
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
              ⏭ Now
            </button>
          </div>
        )}

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
            ✕ Clear Route
          </button>
        )}

        <div className="toolbar-hint">
          <span>Select a point on the map to report a hazard</span>
        </div>
      </div>

      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        className="leaflet-container"
      >
        <MapEventsHandler onMapClick={onMapClick} />
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
            url={`https://tilecache.rainviewer.com${currentRadarFrame.path}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.65}
            zIndex={200}
          />
        )}

        {/* Spatial Risk Heatmap / Density Layer */}
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
                      🔥 High Risk Density Zone
                    </span>
                    <h4 className="popup-title">{evt.title}</h4>
                    <p className="popup-desc">Concentration index: {evt.verificationCount || 1} verified alerts.</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* Navigation Route Display */}
        {navigationRoute && (navigationRoute.coordinates || Array.isArray(navigationRoute)) && (
          <Polyline
            positions={navigationRoute.coordinates || navigationRoute}
            color={navigationRoute.hasConflicts ? "#EF4444" : "#10B981"}
            weight={7}
            opacity={0.9}
            dashArray={navigationRoute.hasConflicts ? "6, 8" : undefined}
          >
            <Popup className="clean-popup">
              <div className="popup-body">
                <h4>
                  {navigationRoute.hasConflicts
                    ? "⚠️ Caution: High Hazard Route"
                    : "✓ Safe Navigation Corridor"}
                </h4>
                <p>
                  {navigationRoute.hasConflicts
                    ? "Route intersects active waterlogged underpass or severe choke point."
                    : "Corridor verified clear of major civic hazards."}
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
                      <span>{event.timestamp}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          }

          const translatedType =
            (t.filters && t.filters[event.type]) || event.type;

          return (
            <Marker
              key={event.id}
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
                      🌊 Depth: {event.waterDepth || 'Measured'} {event.vehiclePassability ? `• 🚫 ${event.vehiclePassability}` : ''}
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
                      onClick={() => onVerifyEvent && onVerifyEvent(event.id)}
                    >
                      {t.actions.confirm}
                    </button>
                    <button
                      type="button"
                      className="popup-btn resolve"
                      onClick={() => onResolveEvent && onResolveEvent(event.id)}
                    >
                      {t.actions.markCleared}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Monitored Chokepoint Corridors */}
        {showTraffic &&
          dynamicCorridors.map((corridor) => (
            <Polyline
              key={corridor.id}
              positions={corridor.positions}
              color={corridor.color}
              weight={6}
              opacity={0.85}
            >
              <Popup className="traffic-clean-popup">
                <div className="traffic-popup-body">
                  <div className="traffic-badge" style={{ backgroundColor: corridor.color }}>
                    {corridor.status}
                  </div>
                  <h5>{corridor.name}</h5>
                  <div className="traffic-metrics">
                    <span>Live Citizen Reports Nearby: <strong style={{ color: corridor.color }}>{corridor.hazardCount}</strong></span>
                  </div>
                  <span className="corridor-note" style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "4px", display: "block" }}>
                    * Status derived solely from live citizen reports within 1.2 km — no speed estimates are surfaced.
                  </span>
                </div>
              </Popup>
            </Polyline>
          ))}
      </MapContainer>
    </div>
  );
};

export default CustomMapContainer;

// src/components/Map/MapContainer.jsx
import React, { useState, useEffect, useCallback } from "react";
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

// Component to dynamically pan and zoom to selected event
const MapViewController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
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
}) => {
  const { t } = useLanguage();
  const [showRadar, setShowRadar] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [radarTimestamp, setRadarTimestamp] = useState(null);

  // Fetch latest RainViewer radar layer timestamp with auto-refresh every 5 minutes
  const fetchRadar = useCallback(async () => {
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      if (!res.ok) return;
      const data = await res.json();
      if (data.radar && data.radar.past && data.radar.past.length > 0) {
        const latest = data.radar.past[data.radar.past.length - 1];
        setRadarTimestamp(latest.path);
      }
    } catch (err) {
      // Retain previous timestamp if temporary network issue
    }
  }, []);

  useEffect(() => {
    fetchRadar();
    const radarInterval = setInterval(fetchRadar, 5 * 60 * 1000);
    return () => clearInterval(radarInterval);
  }, [fetchRadar]);

  // If user turns on radar and timestamp is missing, fetch immediately
  useEffect(() => {
    if (showRadar && !radarTimestamp) {
      fetchRadar();
    }
  }, [showRadar, radarTimestamp, fetchRadar]);

  // Bengaluru arterial corridors with live incident correlation
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
      baselineSpeed: "8-12 km/h",
      peakDelay: "+28 min",
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
      baselineSpeed: "14-18 km/h",
      peakDelay: "+18 min",
    },
    {
      id: "corridor_tin_factory",
      name: "Tin Factory & KR Puram Flyover",
      positions: [
        [12.9972, 77.6672],
        [13.002, 77.675],
        [13.0075, 77.6959],
      ],
      baselineSpeed: "10-15 km/h",
      peakDelay: "+22 min",
    },
    {
      id: "corridor_hebbal",
      name: "Hebbal Flyover to Airport Expressway",
      positions: [
        [13.0358, 77.597],
        [13.045, 77.598],
        [13.055, 77.6],
      ],
      baselineSpeed: "20-25 km/h",
      peakDelay: "+14 min",
    },
  ];

  // Synthesize monitored corridors with active nearby hazard density
  const dynamicCorridors = baseCorridors.map((corridor) => {
    const nearbyHazards = events.filter((evt) => {
      if (!evt.position || !Number.isFinite(evt.position.lat) || !Number.isFinite(evt.position.lng)) {
        return false;
      }
      return corridor.positions.some(
        ([cLat, cLng]) => calculateDistance(evt.position.lat, evt.position.lng, cLat, cLng) <= 1.2
      );
    });

    let status = "Normal Baseline Flow";
    let color = "#10B981"; // Emerald green
    if (nearbyHazards.length >= 2) {
      status = `High Congestion (${nearbyHazards.length} Active Incidents)`;
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
          onClick={() => setShowRadar(!showRadar)}
          title="Toggle live Doppler rain radar overlay"
        >
          🌧️ {showRadar ? t.actions.hideRadar : t.actions.liveRadar}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showTraffic ? "active-amber" : ""}`}
          onClick={() => setShowTraffic(!showTraffic)}
          title="Toggle monitored arterial corridor choke points"
        >
          🚗 {showTraffic ? t.actions.hideTraffic : t.actions.trafficFlow}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showHeatmap ? "active-rose" : ""}`}
          onClick={() => setShowHeatmap(!showHeatmap)}
          title="Toggle spatial hazard risk density heatmap"
        >
          🔥 {showHeatmap ? (t.actions?.hideHeatmap || "Hide Heatmap") : (t.actions?.heatmap || "Risk Heatmap")}
        </button>

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
          <span>Click map to set report coordinates</span>
        </div>
      </div>

      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        className="leaflet-container"
      >
        <MapEventsHandler onMapClick={onMapClick} />
        {selectedEvent &&
          selectedEvent.position &&
          Number.isFinite(selectedEvent.position.lat) &&
          Number.isFinite(selectedEvent.position.lng) && (
            <MapViewController
              center={[selectedEvent.position.lat, selectedEvent.position.lng]}
              zoom={14}
            />
          )}

        {/* Clean OpenStreetMap Tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* Live RainViewer Radar Layer */}
        {showRadar && radarTimestamp && (
          <TileLayer
            url={`https://tilecache.rainviewer.com${radarTimestamp}/256/{z}/{x}/{y}/2/1_1.png`}
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
                    <span>Baseline Flow: <strong>{corridor.baselineSpeed}</strong></span>
                    <span>Peak Delay: <strong style={{ color: corridor.color }}>{corridor.peakDelay}</strong></span>
                  </div>
                  <span className="corridor-note" style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "4px", display: "block" }}>
                    * Correlated with active citizen hazard density in corridor
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

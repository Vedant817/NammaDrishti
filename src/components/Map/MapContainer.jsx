// src/components/Map/MapContainer.jsx
import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MapContainer.css";
import { BENGALURU_CENTER } from "../../data/constants";

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Map click listener component
function MapEventsHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

// Map center controller
function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

const MapComponent = ({
  events = [],
  selectedEvent,
  onEventSelect,
  onVerifyEvent,
  onResolveEvent,
  onMapClick,
  reportPin,
}) => {
  const [showRadar, setShowRadar] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [radarTimestamp, setRadarTimestamp] = useState(null);

  // Fetch latest RainViewer radar layer timestamp
  useEffect(() => {
    let isMounted = true;
    const fetchRadar = async () => {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.radar && data.radar.past && data.radar.past.length > 0) {
          const latest = data.radar.past[data.radar.past.length - 1];
          setRadarTimestamp(latest.path);
        }
      } catch (err) {
        // Fallback to static timestamp if offline
      }
    };
    fetchRadar();
    return () => {
      isMounted = false;
    };
  }, []);

  // Bengaluru real-world traffic corridors with speeds & delays
  const trafficCorridors = [
    {
      id: "corridor_silk_board",
      name: "Silk Board - BTM Corridor",
      positions: [
        [12.9171, 77.6238],
        [12.919, 77.625],
        [12.923, 77.627],
        [12.928, 77.629],
      ],
      speed: "6 km/h",
      delay: "+28 min",
      status: "Severe Gridlock",
      color: "#EF4444",
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
      speed: "14 km/h",
      delay: "+18 min",
      status: "Slow Moving",
      color: "#F59E0B",
    },
    {
      id: "corridor_tin_factory",
      name: "Tin Factory & KR Puram Flyover",
      positions: [
        [12.9934, 77.6606],
        [12.998, 77.668],
        [13.003, 77.675],
      ],
      speed: "11 km/h",
      delay: "+22 min",
      status: "Heavy Congestion",
      color: "#EF4444",
    },
    {
      id: "corridor_hebbal",
      name: "Hebbal Flyover to Airport Expressway",
      positions: [
        [13.0358, 77.597],
        [13.045, 77.598],
        [13.055, 77.6],
      ],
      speed: "18 km/h",
      delay: "+14 min",
      status: "Moderate Delay",
      color: "#F59E0B",
    },
  ];

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
          🌧️ {showRadar ? "Hide Radar" : "Live Radar"}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showTraffic ? "active-amber" : ""}`}
          onClick={() => setShowTraffic(!showTraffic)}
          title="Toggle real-time traffic corridor delays"
        >
          🚗 {showTraffic ? "Hide Traffic" : "Traffic Flow"}
        </button>

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
        {selectedEvent && selectedEvent.position && (
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

        {/* User reporting pin preview */}
        {reportPin && (
          <Marker position={[reportPin.lat, reportPin.lng]} icon={reportIcon}>
            <Popup autoPan={false}>
              <div className="pin-hint-popup">Selected Location for Report</div>
            </Popup>
          </Marker>
        )}

        {/* Incident Markers */}
        {events.map((event) => {
          if (!event.position) return null;
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
                      {event.type}
                    </span>
                    <span className={`urgency-pill ${event.urgency ? event.urgency.toLowerCase() : "medium"}`}>
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
                      👥 <strong>{event.verificationCount || 1}</strong> confirmations
                    </span>
                    {event.isVerified && (
                      <span className="verified-check">✓ Verified by consensus</span>
                    )}
                  </div>

                  <div className="popup-actions">
                    <button
                      type="button"
                      className="popup-btn confirm"
                      onClick={() => onVerifyEvent && onVerifyEvent(event.id)}
                    >
                      👍 Confirm (+1)
                    </button>
                    <button
                      type="button"
                      className="popup-btn resolve"
                      onClick={() => onResolveEvent && onResolveEvent(event.id)}
                    >
                      ✓ Mark Cleared
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Real-Time Traffic Corridors */}
        {showTraffic &&
          trafficCorridors.map((corridor) => (
            <Polyline
              key={corridor.id}
              positions={corridor.positions}
              color={corridor.color}
              weight={6}
              opacity={0.85}
            >
              <Popup className="traffic-clean-popup">
                <div className="traffic-popup-body">
                  <div className="traffic-badge">{corridor.status}</div>
                  <h5>{corridor.name}</h5>
                  <div className="traffic-metrics">
                    <span>Speed: <strong>{corridor.speed}</strong></span>
                    <span>Delay: <strong style={{ color: corridor.color }}>{corridor.delay}</strong></span>
                  </div>
                </div>
              </Popup>
            </Polyline>
          ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;

// src/components/Sidebar/CityRecap.jsx
import React from "react";
import { BENGALURU_UNDERPASSES, evaluateUnderpassRisk } from "../../data/bengaluruUnderpasses";

const CityRecap = ({ events = [], rainIntensity = 0, isWeatherOffline = false, onSelectLocation }) => {
  const trafficCount = events.filter((e) => e.type === "Traffic").length;
  const floodCount = events.filter((e) => e.type === "Waterlogging").length;
  const accidentCount = events.filter((e) => e.type === "Accident").length;
  const infraCount = events.filter((e) => e.type === "Infrastructure").length;

  return (
    <div className="recap-content">
      <div className="recap-header">
        <h4>Today's Bengaluru Diagnostic</h4>
        <span className="recap-time">Updated live</span>
      </div>

      <div className="recap-grid">
        <div className="recap-stat-card">
          <span className="recap-num" style={{ color: "#EF4444" }}>{trafficCount}</span>
          <span className="recap-lbl">Traffic Jams</span>
        </div>
        <div className="recap-stat-card">
          <span className="recap-num" style={{ color: "#06B6D4" }}>{floodCount}</span>
          <span className="recap-lbl">Waterlogging</span>
        </div>
        <div className="recap-stat-card">
          <span className="recap-num" style={{ color: "#F59E0B" }}>{accidentCount}</span>
          <span className="recap-lbl">Accidents</span>
        </div>
        <div className="recap-stat-card">
          <span className="recap-num" style={{ color: "#8B5CF6" }}>{infraCount}</span>
          <span className="recap-lbl">Potholes/Infra</span>
        </div>
      </div>

      {/* Bengaluru Chronic Underpass Inundation Watch */}
      <h5 className="recap-subtitle">🌊 Chronic Underpass Vulnerability Watch</h5>
      <div className="underpass-watch-list">
        {BENGALURU_UNDERPASSES.map((up) => {
          const risk = isWeatherOffline
            ? {
                level: "Telemetry Offline",
                color: "#94A3B8",
                action: "Precipitation telemetry unavailable. Exercise caution at low-lying underpasses.",
                isFloodedLikely: false,
              }
            : evaluateUnderpassRisk(up, rainIntensity);

          return (
            <div
              key={up.id}
              className="underpass-card"
              style={{
                padding: '10px',
                background: 'var(--bg-surface)',
                borderRadius: '6px',
                marginBottom: '8px',
                borderLeft: `3px solid ${risk.color}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem' }}>{up.name}</strong>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: risk.color,
                    fontWeight: '600',
                    padding: '2px 6px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                  }}
                >
                  {risk.level}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Zone: {up.zone} • Trigger: &gt;{up.criticalThresholdMmPerHour} mm/hr • Max Depth: {up.maxRecordedDepthFt} ft
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  Pump: {up.pumpStation} • Barrier: {up.gateStatus}
                </span>
                {onSelectLocation && (
                  <button
                    type="button"
                    onClick={() => onSelectLocation({
                      id: `underpass_${up.id}`,
                      title: up.name,
                      ward: up.zone,
                      type: "Waterlogging",
                      urgency: risk.isFloodedLikely ? "High" : "Medium",
                      waterDepth: `${up.maxRecordedDepthFt} ft (Historic Max)`,
                      vehiclePassability: risk.isFloodedLikely ? "Impassable" : "Passable with Caution",
                      description: `${up.name} in ${up.zone}. ${risk.action} Critical rain threshold: ${up.criticalThresholdMmPerHour} mm/hr.`,
                      position: { lat: up.lat, lng: up.lng },
                      verificationCount: 12,
                      isVerified: true,
                      timestamp: "Live Diagnostic"
                    })}
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#60A5FA',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    📍 View on Map
                  </button>
                )}
              </div>
              {risk.action && (
                <div style={{ fontSize: '0.7rem', color: risk.color, marginTop: '3px', fontStyle: 'italic' }}>
                  {risk.action}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h5 className="recap-subtitle">Key Choke Points & Flood Basins</h5>
      <ul className="recap-bullet-list">
        <li className="recap-bullet-item alert">
          <strong>Panathur Railway Underpass:</strong> Inundated following localized showers. Divert via ORR.
        </li>
        <li className="recap-bullet-item">
          <strong>Silk Board Junction:</strong> Average delay +28 mins towards BTM Layout.
        </li>
        <li className="recap-bullet-item">
          <strong>Hebbal Inbound:</strong> Bottleneck at flyover junction with Airport Rd.
        </li>
      </ul>

      <h5 className="recap-subtitle">Predictive Alerts (Next 4 Hours)</h5>
      <ul className="recap-bullet-list">
        <li className="recap-bullet-item">
          🌧️ <strong>Rain Influx:</strong> Evening shower cells likely in South & East Bengaluru.
        </li>
        <li className="recap-bullet-item">
          🚗 <strong>ORR Rush Hour:</strong> Peak congestion anticipated between 5:30 PM – 8:30 PM.
        </li>
      </ul>
    </div>
  );
};

export default CityRecap;

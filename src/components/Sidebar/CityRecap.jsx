// src/components/Sidebar/CityRecap.jsx
import React from "react";
import { BENGALURU_UNDERPASSES, evaluateUnderpassRisk } from "../../data/bengaluruUnderpasses";
import { calculateDistance } from "../../services/routingService";

const RISK_SEVERITY = { "Critical Submersion Risk": 2, "Waterlogging Warning": 1 };
const severityOf = (risk) => RISK_SEVERITY[risk?.level] || 0;

const CityRecap = ({ events = [], rainIntensity = 0, isWeatherOffline = false, onSelectLocation }) => {
  const trafficCount = events.filter((e) => e.type === "Traffic").length;
  const floodCount = events.filter((e) => e.type === "Waterlogging").length;
  const accidentCount = events.filter((e) => e.type === "Accident").length;
  const infraCount = events.filter((e) => e.type === "Infrastructure").length;

  const activeWaterReports = events.filter(
    (e) => e.type === "Waterlogging" && e.position && Number.isFinite(e.position.lat) && Number.isFinite(e.position.lng)
  );

  // Fuse static BBMP pump telemetry with live citizen flood reports (within 1.2 km corridor radius)
  const correlatedUnderpasses = BENGALURU_UNDERPASSES.map((up) => {
    const risk = isWeatherOffline
      ? {
          level: "Telemetry Offline",
          color: "#94A3B8",
          action: "Precipitation telemetry unavailable. Exercise caution at low-lying underpasses.",
          isFloodedLikely: false,
        }
      : evaluateUnderpassRisk(up, rainIntensity);

    const liveReports = activeWaterReports.filter(
      (evt) => calculateDistance(evt.position.lat, evt.position.lng, up.lat, up.lng) <= 1.2
    );

    // Heightened severity when corroborated by on-ground citizen reports
    const isCorroborated = liveReports.length > 0;
    const severity = severityOf(risk) + (isCorroborated ? 1 : 0);

    return { underpass: up, risk, liveReports, isCorroborated, severity };
  }).sort((a, b) => b.severity - a.severity);

  const criticalCount = correlatedUnderpasses.filter((c) => c.risk.level === "Critical Submersion Risk").length;
  const warningCount = correlatedUnderpasses.filter((c) => c.risk.level === "Waterlogging Warning").length;

  return (
    <div className="recap-content">
      <div className="recap-header">
        <h4>Bengaluru overview</h4>
        <span className="recap-time">Based on reports and weather</span>
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

      {/* Bengaluru Chronic Underpass Inundation Watch (curated catalog, live-correlated) */}
      <h5 className="recap-subtitle">Underpass watch ({correlatedUnderpasses.length} locations)</h5>
      {!isWeatherOffline && (criticalCount > 0 || warningCount > 0) && (
        <div
          className="underpass-summary-banner"
          role="status"
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            padding: '8px 10px',
            borderRadius: '6px',
            marginBottom: '10px',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: criticalCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
            color: criticalCount > 0 ? '#EF4444' : '#F59E0B',
          }}
        >
          ⚠️ {criticalCount} critical • {warningCount} warning of {correlatedUnderpasses.length} monitored underpasses
        </div>
      )}
      <div className="underpass-watch-list">
        {correlatedUnderpasses.map(({ underpass: up, risk, liveReports }) => {
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
              {liveReports.length > 0 && (
                <div
                  className="underpass-live-pill"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '5px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#06B6D4',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                  }}
                >
                  🔴 {liveReports.length} live citizen report{liveReports.length > 1 ? 's' : ''} within 1.2 km
                </div>
              )}
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

      {/* Live underpass watch cards above carry the honest state — fabricated
          "choke point basins" and "next 4 hour" prediction bullets were removed:
          this app must not invent forecasts it has no sensor data for. */}
    </div>
  );
};

export default CityRecap;

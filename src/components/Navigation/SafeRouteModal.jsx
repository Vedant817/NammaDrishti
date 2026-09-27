// src/components/Navigation/SafeRouteModal.jsx
import React, { useState } from "react";
import { fetchDrivingRoute, detectRouteHazards } from "../../services/routingService";
import { BENGALURU_HUBS } from "../../data/constants";
import "./SafeRouteModal.css";

const SafeRouteModal = ({
  onClose,
  activeHazards = [],
  onApplyRouteToMap,
  userLocation,
}) => {
  const [startId, setStartId] = useState("silk-board");
  const [destId, setDestId] = useState("marathahalli");
  const [useCurrentGps, setUseCurrentGps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [routingError, setRoutingError] = useState(null);

  const handleCalculateRoute = async () => {
    let startCoords;
    if (useCurrentGps && userLocation) {
      startCoords = userLocation;
    } else {
      const hub = BENGALURU_HUBS.find((h) => h.id === startId) || BENGALURU_HUBS[0];
      startCoords = { lat: hub.lat, lng: hub.lng };
    }

    const endHub = BENGALURU_HUBS.find((h) => h.id === destId) || BENGALURU_HUBS[3];
    const endCoords = { lat: endHub.lat, lng: endHub.lng };

    setLoading(true);
    setRoutingError(null);
    try {
      const routeData = await fetchDrivingRoute(startCoords, endCoords);
      const conflicts = detectRouteHazards(routeData.coordinates, activeHazards, 0.45);

      setRouteResult({
        ...routeData,
        conflicts,
        startCoords,
        endCoords,
      });

      if (onApplyRouteToMap) {
        onApplyRouteToMap({
          coordinates: routeData.coordinates,
          hasConflicts: conflicts.length > 0,
        });
      }
    } catch (err) {
      setRoutingError(
        "Transit corridor calculation failed or OSRM service is temporarily unreachable. Please exercise caution and verify local road status."
      );
      setRouteResult(null);
      if (onApplyRouteToMap) {
        onApplyRouteToMap(null); // Clear previous route line from map on failure
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="safe-route-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="safe-route-header">
          <div className="safe-route-title">
            <span className="route-icon">🧭</span>
            <div>
              <h3>Safe Transit & Hazard Avoidance</h3>
              <span className="route-subtitle">Bengaluru Smart Commute Engine</span>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="safe-route-body">
          <div className="safe-route-controls">
            <div className="route-input-group">
              <label>Origin Hub</label>
              <div className="origin-toggle-row">
                <select
                  value={startId}
                  disabled={useCurrentGps}
                  onChange={(e) => setStartId(e.target.value)}
                  className="route-select"
                >
                  {BENGALURU_HUBS.map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name} ({hub.zone})
                    </option>
                  ))}
                </select>
                {userLocation && (
                  <button
                    type="button"
                    className={`gps-toggle-btn ${useCurrentGps ? "active" : ""}`}
                    onClick={() => setUseCurrentGps(!useCurrentGps)}
                    title="Use current GPS as starting waypoint"
                  >
                    📍 My GPS
                  </button>
                )}
              </div>
            </div>

            <div className="route-input-group">
              <label>Destination Hub</label>
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="route-select"
              >
                {BENGALURU_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name} ({hub.zone})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="calculate-route-btn"
              onClick={handleCalculateRoute}
              disabled={loading}
            >
              {loading ? "Calculating Safest Corridor..." : "🔍 Find Safe Route"}
            </button>
          </div>

          {routingError && (
            <div className="routing-error-box">
              <span>⚠️</span>
              <p>{routingError}</p>
            </div>
          )}

          {routeResult && (
            <div className="route-summary-card">
              <div className="route-metrics-bar">
                <div className="route-metric">
                  <span className="metric-val">{routeResult.distanceKm} km</span>
                  <span className="metric-lbl">Total Distance</span>
                </div>
                <div className="route-metric">
                  <span className="metric-val">{routeResult.durationMins} mins</span>
                  <span className="metric-lbl">Estimated Transit</span>
                </div>
                <div className="route-metric">
                  <span
                    className="metric-val"
                    style={{
                      color:
                        routeResult.conflicts.length === 0
                          ? "var(--status-verified)"
                          : "var(--status-traffic)",
                    }}
                  >
                    {routeResult.conflicts.length === 0 ? "CLEAR" : `${routeResult.conflicts.length} HAZARD(S)`}
                  </span>
                  <span className="metric-lbl">Corridor Safety</span>
                </div>
              </div>

              {routeResult.conflicts.length === 0 ? (
                <div className="route-safe-banner">
                  <span>✓</span>
                  <div>
                    <strong>Clear Corridor Verified</strong>
                    <p>No active waterlogging or major accidents detected along this path.</p>
                  </div>
                </div>
              ) : (
                <div className="route-conflicts-list">
                  <h5>⚠️ Road Hazards Along Transit Route:</h5>
                  {routeResult.conflicts.map((c) => (
                    <div key={c.hazard.id} className="route-conflict-item">
                      <span className="conflict-type">{c.hazard.type}</span>
                      <div className="conflict-info">
                        <strong>{c.hazard.title}</strong>
                        <p>{c.hazard.description}</p>
                        <span className="conflict-dist">
                          Approx. {Math.round(c.distanceKm * 1000)}m from roadway
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SafeRouteModal;

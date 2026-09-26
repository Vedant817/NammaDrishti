// src/components/Navigation/SafeRouteModal.jsx
import React, { useState } from "react";
import {
  BENGALURU_HUBS,
  fetchDrivingRoute,
  detectRouteHazards,
} from "../../services/routingService";
import Button from "../Common/Button";
import "./SafeRouteModal.css";

const SafeRouteModal = ({
  onClose,
  activeHazards = [],
  onApplyRouteToMap,
  userLocation,
}) => {
  const [originId, setOriginId] = useState("koramangala");
  const [destId, setDestId] = useState("bellandur");
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [routingError, setRoutingError] = useState(null);

  const handleComputeRoute = async () => {
    let startCoords;
    if (originId === "current_gps" && userLocation) {
      startCoords = { lat: userLocation.lat, lng: userLocation.lng };
    } else {
      const hub = BENGALURU_HUBS.find((h) => h.id === originId) || BENGALURU_HUBS[0];
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
          <div className="route-selectors">
            <div className="route-field">
              <label>Origin (Start Point)</label>
              <select
                className="route-select"
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
              >
                {userLocation && <option value="current_gps">📍 My Detected Location</option>}
                {BENGALURU_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="route-divider-arrow">↓</div>

            <div className="route-field">
              <label>Destination</label>
              <select
                className="route-select"
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
              >
                {BENGALURU_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id} disabled={hub.id === originId}>
                    {hub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="compute-btn-wrap">
            <Button
              type="button"
              variant="primary"
              onClick={handleComputeRoute}
              disabled={loading}
            >
              {loading ? "Computing Safe Corridor..." : "🔍 Check Route & Hazards"}
            </Button>
          </div>

          {routingError && (
            <div className="route-error-alert" style={{ marginTop: '14px', padding: '12px 14px', background: '#451A1A', border: '1px solid #7F1D1D', borderRadius: '8px', color: '#FCA5A5', fontSize: '0.85rem' }}>
              ⚠️ {routingError}
            </div>
          )}

          {routeResult && (
            <div className="route-results-card">
              <div className="results-summary-row">
                <div className="metric-box">
                  <span className="metric-val">{routeResult.distanceKm} km</span>
                  <span className="metric-lbl">Distance</span>
                </div>
                <div className="metric-box">
                  <span className="metric-val">~{routeResult.durationMin} min</span>
                  <span className="metric-lbl">Est. Duration</span>
                </div>
                <div className="metric-box">
                  <span
                    className={`metric-val ${
                      routeResult.conflicts.length > 0 ? "alert-hazard" : "alert-safe"
                    }`}
                  >
                    {routeResult.conflicts.length === 0
                      ? "✓ Safe"
                      : `${routeResult.conflicts.length} Warning`}
                  </span>
                  <span className="metric-lbl">Hazard Status</span>
                </div>
              </div>

              {routeResult.conflicts.length > 0 ? (
                <div className="route-hazard-alert">
                  <div className="alert-header">
                    <span>⚠️ Active Hazard On / Near Route</span>
                  </div>
                  <ul className="hazard-warning-list">
                    {routeResult.conflicts.map(({ hazard, distanceKm }) => (
                      <li key={hazard.id} className="hazard-warning-item">
                        <strong>{hazard.title}</strong> ({hazard.type})
                        <p>{hazard.description}</p>
                        <span className="hazard-dist-tag">
                          Within {(distanceKm * 1000).toFixed(0)}m of route corridor
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="bypass-tip">
                    💡 <em>Recommendation: Follow secondary bypass to avoid inundation delays.</em>
                  </p>
                </div>
              ) : (
                <div className="route-safe-alert">
                  <span>✓ Corridor clear of reported waterlogging and severe blockades.</span>
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

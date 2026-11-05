// src/components/Navigation/SafeRouteModal.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  fetchDrivingRoute,
  fetchDetourRoute,
  detectRouteHazards,
} from "../../services/routingService";
import {
  geocodeBengaluruPlace,
  suggestBengaluruPlaces,
} from "../../services/geocodeService";
import "./SafeRouteModal.css";

const TYPEAHEAD_DEBOUNCE_MS = 700;

// Debounced live place search input backed by OpenStreetMap Nominatim.
// Users must either select a suggestion or press Enter to geocode the typed text.
const PlaceInput = ({ value, place, onChange, onPick, placeholder }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  // Close the suggestion dropdown on any outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    setSuggestions([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const places = await suggestBengaluruPlaces(trimmed);
      setSuggestions(places);
      setSearching(false);
    }, TYPEAHEAD_DEBOUNCE_MS);
  };

  const handlePick = (p) => {
    setSuggestions([]);
    onChange(p.shortLabel || p.label);
    onPick(p);
  };

  const handleKeyDown = async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (suggestions.length > 0) {
      handlePick(suggestions[0]);
      return;
    }
    if (place) return;
    const resolved = await geocodeBengaluruPlace(value);
    if (resolved) {
      handlePick({ ...resolved, shortLabel: resolved.label });
    }
  };

  const showDropdown = !place && suggestions.length > 0;

  return (
    <div className="route-place-wrap" ref={boxRef}>
      <input
        type="text"
        className="route-select"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {searching && <span className="route-search-hint">🔍…</span>}
      {showDropdown && (
        <div className="route-suggestions" role="listbox">
          {suggestions.map((p) => (
            <button
              type="button"
              key={`${p.lat},${p.lng}`}
              className="route-suggestion-item"
              onClick={() => handlePick(p)}
            >
              {p.shortLabel || p.label}
            </button>
          ))}
        </div>
      )}
      <span className="route-place-help">Pick a suggestion or press Enter to geocode</span>
    </div>
  );
};

const SafeRouteModal = ({
  onClose,
  activeHazards = [],
  hazards = [],
  onApplyRouteToMap,
  userLocation,
}) => {
  const resolvedHazards = activeHazards && activeHazards.length > 0 ? activeHazards : (hazards || []);
  const [startText, setStartText] = useState("");
  const [startPlace, setStartPlace] = useState(null);
  const [endText, setEndText] = useState("");
  const [endPlace, setEndPlace] = useState(null);
  const [useCurrentGps, setUseCurrentGps] = useState(false);
  const [autoDetour, setAutoDetour] = useState(true);
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [routingError, setRoutingError] = useState(null);

  const resolveEndpoint = async (text, pickedPlace, fieldName) => {
    if (pickedPlace) return pickedPlace;
    const resolved = await geocodeBengaluruPlace(text);
    if (!resolved) {
      throw new Error(
        `Could not locate the ${fieldName} with live Bengaluru geocoding. Pick a suggestion or use a different landmark.`
      );
    }
    return resolved;
  };

  const handleCalculateRoute = async () => {
    setRoutingError(null);
    setRouteResult(null);

    let startCoords;
    let endCoords;
    try {
      if (useCurrentGps && userLocation) {
        startCoords = userLocation;
      } else {
        const resolvedStart = await resolveEndpoint(startText, startPlace, "origin");
        startCoords = { lat: resolvedStart.lat, lng: resolvedStart.lng, label: resolvedStart.label };
      }
      const resolvedEnd = await resolveEndpoint(endText, endPlace, "destination");
      endCoords = { lat: resolvedEnd.lat, lng: resolvedEnd.lng, label: resolvedEnd.label };
    } catch (resolveErr) {
      setRoutingError(resolveErr.message);
      return;
    }

    if (
      Math.abs(startCoords.lat - endCoords.lat) < 0.0001 &&
      Math.abs(startCoords.lng - endCoords.lng) < 0.0001
    ) {
      setRoutingError("Origin and destination resolve to the same location. Please choose distinct transit points.");
      return;
    }

    setLoading(true);
    try {
      let routeData;
      if (autoDetour) {
        routeData = await fetchDetourRoute(startCoords, endCoords, resolvedHazards);
      } else {
        const base = await fetchDrivingRoute(startCoords, endCoords);
        const conflicts = detectRouteHazards(base.coordinates, resolvedHazards, 0.45);
        routeData = { ...base, conflicts, isDetour: false };
      }

      setRouteResult({
        ...routeData,
        startCoords,
        endCoords,
      });

      if (onApplyRouteToMap) {
        onApplyRouteToMap({
          coordinates: routeData.coordinates,
          hasConflicts: (routeData.conflicts || []).length > 0,
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
              <span className="route-subtitle">NammaDrishti Smart Commute Radar</span>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="safe-route-body">
          <div className="safe-route-controls">
            <div className="route-input-group">
              <label>Origin</label>
              {useCurrentGps && userLocation ? (
                <div className="route-place-badge">
                  <span className="route-place-text">
                    📍 My GPS ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                  </span>
                </div>
              ) : (
                <div className="origin-toggle-row">
                  <PlaceInput
                    value={startText}
                    place={startPlace}
                    onChange={setStartText}
                    onPick={setStartPlace}
                    placeholder="e.g. Silk Board Junction, MG Road…"
                  />
                </div>
              )}
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

            <div className="route-input-group">
              <label>Destination</label>
              <PlaceInput
                value={endText}
                place={endPlace}
                onChange={setEndText}
                onPick={setEndPlace}
                placeholder="e.g. Whitefield, Kempegowda Airport…"
              />
            </div>

            <div className="auto-detour-toggle">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={autoDetour}
                  onChange={(e) => setAutoDetour(e.target.checked)}
                />
                <span className="checkbox-text">⚡ Auto-Detour around Flooded Underpasses & Chokepoints</span>
              </label>
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
                  <span className="metric-val">{routeResult.durationMin} mins</span>
                  <span className="metric-lbl">Estimated Transit</span>
                </div>
                <div className="route-metric">
                  <span
                    className="metric-val"
                    style={{
                      color:
                        (routeResult.conflicts || []).length === 0
                          ? "var(--status-verified)"
                          : "var(--status-traffic)",
                    }}
                  >
                    {(routeResult.conflicts || []).length === 0 ? "CLEAR" : `${routeResult.conflicts.length} HAZARD(S)`}
                  </span>
                  <span className="metric-lbl">Corridor Safety</span>
                </div>
              </div>

              {routeResult.isDetour && (
                <div className="route-detour-banner">
                  <span className="detour-icon">🛡️</span>
                  <div>
                    <strong>Dynamic Flood / Hazard Detour Activated</strong>
                    <p>
                      Corridor automatically rerouted around {routeResult.bypassedHazard?.title || "active road hazard"} (+{routeResult.addedMinutes || 2} min).
                    </p>
                  </div>
                </div>
              )}

              {(routeResult.conflicts || []).length === 0 ? (
                <div className="route-safe-banner">
                  <span>✓</span>
                  <div>
                    <strong>Clear Corridor Verified</strong>
                    <p>No active waterlogging or major accidents reported near this path.</p>
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
                        {c.hazard.waterDepth && (
                          <span className="conflict-depth-badge" style={{ color: '#06B6D4', fontSize: '0.74rem', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                            🌊 Depth: {c.hazard.waterDepth} {c.hazard.vehiclePassability ? `• 🚫 ${c.hazard.vehiclePassability}` : ''}
                          </span>
                        )}
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

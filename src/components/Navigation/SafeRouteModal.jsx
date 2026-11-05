import { useLanguage } from '../../context/LanguageContext';
import { useInterfaceCopy } from '../../hooks/useInterfaceCopy';
import { useDialog } from "../../hooks/useDialog";
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



// Explicit place search backed by the shared geocoding proxy.
// Users must either select a suggestion or press Enter to geocode the typed text.
const PlaceInput = ({ value, place, onChange, onPick, placeholder, label }) => {
  const { t } = useLanguage();
  const copy=useInterfaceCopy();
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const queryRef = useRef(value);
  queryRef.current = value;
  const [searchError, setSearchError] = useState(null);
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

    };
  }, []);

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    onPick(null);
    setSuggestions([]);

    setSearching(false);
    setSearchError(null);
  };

  const handlePick = (p) => {
    setSuggestions([]);
    onChange(p.shortLabel || p.label);
    onPick(p);
  };

  const search = async () => {
    if (value.trim().length < 2) return;
    const query = value;
    setSearching(true); setSearchError(null);
    try {
      const results = await suggestBengaluruPlaces(query);
      if (queryRef.current === query) { setSuggestions(results); if (!results.length) setSearchError(copy.placeMissing); }
    } catch (error) { if (queryRef.current === query) setSearchError(copy.placeMissing); }
    finally { if (queryRef.current === query) setSearching(false); }
  };
  const handleKeyDown = e => { if (e.key === 'Enter') { e.preventDefault(); search(); } };

  const showDropdown = !place && suggestions.length > 0;

  return (
    <div className="route-place-wrap" ref={boxRef}>
      <input
        aria-label={label}
        type="text"
        className="route-select"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button type="button" onClick={search} disabled={searching}>{t.ui["Search"]}</button>
      {searchError && <span role="status">{searchError}</span>}
      {searching && <span className="route-search-hint">🔍…</span>}
      {showDropdown && (
        <div className="route-suggestions" aria-label={label}>
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
      <span className="route-place-help">{t.ui["Search or press Enter, then choose a result. \u00a9 OpenStreetMap contributors."]}</span>
    </div>
  );
};

const SafeRouteModal = ({
  onClose,
  activeRoute,
  coverage = "incomplete",
  activeHazards = [],
  hazards = [],
  onApplyRouteToMap,
  userLocation,
}) => {
  const { t } = useLanguage();
  const resolvedHazards = activeHazards && activeHazards.length > 0 ? activeHazards : (hazards || []);
  const copy=useInterfaceCopy();
  const dialogRef = useDialog(onClose);
  const [startText, setStartText] = useState("");
  const [startPlace, setStartPlace] = useState(null);
  const [endText, setEndText] = useState("");
  const [endPlace, setEndPlace] = useState(null);
  const [useCurrentGps, setUseCurrentGps] = useState(false);
  const [autoDetour, setAutoDetour] = useState(true);
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [routingError, setRoutingError] = useState(null);

  useEffect(() => { if (activeRoute) setRouteResult(activeRoute); }, [activeRoute]);

  const resolveEndpoint = async (text, pickedPlace, fieldName) => {
    if (pickedPlace) return pickedPlace;
    const resolved = await geocodeBengaluruPlace(text);
    if (!resolved) {
      throw new Error(copy.placeMissing);
    }
    return resolved;
  };

  const handleCalculateRoute = async () => {
    if(loading)return;
    setLoading(true);
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
      setRoutingError(copy.placeMissing);
      setLoading(false);
      return;
    }

    if (
      Math.abs(startCoords.lat - endCoords.lat) < 0.0001 &&
      Math.abs(startCoords.lng - endCoords.lng) < 0.0001
    ) {
      setRoutingError(copy.samePlace);
      setLoading(false);
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
        status: coverage === "current" ? "ready" : "incomplete",
        startCoords,
        endCoords,
      });

      if (onApplyRouteToMap) {
        onApplyRouteToMap({
          ...routeData,
          startCoords, endCoords, autoDetour,
          checkedAt: Date.now(), coverage, status: coverage === "current" ? "ready" : "incomplete",
          coordinates: routeData.coordinates,
          hasConflicts: (routeData.conflicts || []).length > 0,
        });
      }
    } catch (err) {
      setRoutingError(
        copy.routeFailure
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.plan} tabIndex={-1} className="safe-route-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="safe-route-header">
          <div className="safe-route-title">
            <span className="route-icon">🧭</span>
            <div>
              <h3>{copy.plan}</h3>
              <span className="route-subtitle">{t.ui["Check reported hazards along the way"]}</span>
            </div>
          </div>
          <button type="button" className="close-btn" aria-label={t.ui["Close dialog"]} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="safe-route-body">
          <div className="safe-route-controls">
            <div className="route-input-group">
              <label>{copy.origin}</label>
              {useCurrentGps && userLocation ? (
                <div className="route-place-badge">
                  <span className="route-place-text">
                    📍 My GPS ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                  </span>
                </div>
              ) : (
                <div className="origin-toggle-row">
                  <PlaceInput
                    label={copy.origin}
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
              <label>{copy.destination}</label>
              <PlaceInput
                label={copy.destination}
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
                <span className="checkbox-text">{t.ui["Avoid reported floods and road hazards"]}</span>
              </label>
            </div>

            <button
              type="button"
              className="calculate-route-btn"
              onClick={handleCalculateRoute}
              disabled={loading}
            >
              {loading ? t.ui["Checking route..."] : t.ui["Find route"]}
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
                  <span className="metric-lbl">{t.ui["Distance"]}</span>
                </div>
                <div className="route-metric">
                  <span className="metric-val">{routeResult.durationMin} mins</span>
                  <span className="metric-lbl">{t.ui["Estimated time (without traffic)"]}</span>
                </div>
                <div className="route-metric">
                  <span
                    className="metric-val"
                    style={{
                      color:
                        (routeResult.conflicts || []).length === 0 && routeResult.status === "ready"
                          ? "var(--status-verified)"
                          : "var(--status-traffic)",
                    }}
                  >
                    {routeResult.status !== "ready" ? (routeResult.status === "checking" ? copy.routeChecking : copy.unavailable) : (routeResult.conflicts || []).length === 0 ? t.live.noReportedHazards : `${routeResult.conflicts.length} ${t.live.nearbyReports}`}
                  </span>
                  <span className="metric-lbl">{t.ui["Reports nearby"]}</span>
                </div>
              </div>

              {routeResult.isDetour && (
                <div className="route-detour-banner">
                  <span className="detour-icon">🛡️</span>
                  <div>
                    <strong>{copy.detour}</strong>
                    <p>
                      {routeResult.bypassedHazard?.title}<br/>{Number.isFinite(routeResult.addedMinutes) ? `${routeResult.addedMinutes > 0 ? "+" : ""}${routeResult.addedMinutes} min` : copy.etaUnknown}
                    </p>
                  </div>
                </div>
              )}

              {routeResult.status !== 'ready' ? <p role="status">{routeResult.status === 'incomplete' ? copy.routeIncomplete : routeResult.status === 'checking' ? copy.routeChecking : copy.routeFailure}</p> : null}
              {(routeResult.conflicts || []).length === 0 && routeResult.status === 'ready' ? (
                <div className="route-safe-banner">
                  <span>✓</span>
                  <div>
                    <strong>{copy.routeClear}</strong>
                    <p>{copy.routeChecked}</p>
                  </div>
                </div>
              ) : (routeResult.conflicts || []).length > 0 ? (
                <div className="route-conflicts-list">
                  <h5>{copy.routeConflicts}</h5>
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
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SafeRouteModal;

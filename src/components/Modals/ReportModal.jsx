// src/components/Modals/ReportModal.jsx
import React, { useState, useEffect } from "react";
import Button from "../Common/Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useLanguage } from "../../context/LanguageContext";
import { compressImage } from "../../utils/imageOptimizer";
import "./ReportModal.css";

// Comprehensive Bengaluru Locality & Chokepoint Geocoding Map
const BENGALURU_LOCALITY_COORDS = {
  "silk board": { lat: 12.9171, lng: 77.6238 },
  "btm": { lat: 12.9166, lng: 77.6101 },
  "btm layout": { lat: 12.9166, lng: 77.6101 },
  "hsr": { lat: 12.9121, lng: 77.6446 },
  "hsr layout": { lat: 12.9121, lng: 77.6446 },
  "koramangala": { lat: 12.9352, lng: 77.6245 },
  "indiranagar": { lat: 12.9719, lng: 77.6412 },
  "whitefield": { lat: 12.9698, lng: 77.7500 },
  "marathahalli": { lat: 12.9591, lng: 77.6974 },
  "bellandur": { lat: 12.9260, lng: 77.6744 },
  "panathur": { lat: 12.9352, lng: 77.7019 },
  "hebbal": { lat: 13.0358, lng: 77.5970 },
  "electronic city": { lat: 12.8452, lng: 77.6602 },
  "ecity": { lat: 12.8452, lng: 77.6602 },
  "sarjapur": { lat: 12.8596, lng: 77.7884 },
  "sarjapur road": { lat: 12.9150, lng: 77.6830 },
  "jayanagar": { lat: 12.9308, lng: 77.5838 },
  "jp nagar": { lat: 12.9063, lng: 77.5857 },
  "banashankari": { lat: 12.9255, lng: 77.5468 },
  "rajajinagar": { lat: 12.9982, lng: 77.5530 },
  "malleshwaram": { lat: 13.0031, lng: 77.5643 },
  "yelahanka": { lat: 13.1007, lng: 77.5963 },
  "majestic": { lat: 12.9767, lng: 77.5713 },
  "mg road": { lat: 12.9754, lng: 77.6068 },
  "kalyan nagar": { lat: 13.0280, lng: 77.6433 },
  "tin factory": { lat: 12.9972, lng: 77.6672 },
  "kr puram": { lat: 13.0075, lng: 77.6959 },
  "mahadevapura": { lat: 12.9902, lng: 77.6952 },
};

// Sort entries by substring length descending to match specific multi-word locations first (e.g., 'sarjapur road' before 'sarjapur')
const SORTED_LOCALITY_ENTRIES = Object.entries(BENGALURU_LOCALITY_COORDS).sort(
  (a, b) => b[0].length - a[0].length
);

const resolveLocalityCoordinates = (text) => {
  if (!text) return null;
  const clean = text.toLowerCase();
  for (const [name, pos] of SORTED_LOCALITY_ENTRIES) {
    if (clean.includes(name)) return pos;
  }
  return null;
};

const ReportModal = ({
  isOpen,
  onClose,
  onSubmitReport,
  initialCoordinates,
}) => {
  const { getPosition } = useGeolocation();
  const { t } = useLanguage();

  const reportT = {
    modalTitle: t?.report?.modalTitle || t?.reportModal?.title || "Report Civic or Traffic Incident",
    category: t?.report?.category || t?.reportModal?.typeLabel || "Incident Type",
    hazardTitle: t?.report?.hazardTitle || t?.reportModal?.headlineLabel || "Headline / Landmark",
    wardLocality: t?.report?.wardLocality || t?.reportModal?.wardLabel || "Ward / Locality",
    severity: t?.report?.severity || t?.reportModal?.urgencyLabel || "Urgency",
    fieldNotes: t?.report?.fieldNotes || t?.reportModal?.descLabel || "Description & Traffic Impact",
    locationVerification: t?.report?.locationVerification || "Location Pin / GPS Coordinates",
    autoDetectGps: t?.report?.autoDetectGps || t?.actions?.autoGps || "Auto-Detect GPS",
    photoEvidence: t?.report?.photoEvidence || t?.reportModal?.photoLabel || "Attach Evidence Photo (Optional)",
    broadcastHazard: t?.report?.broadcastHazard || t?.actions?.submitReport || "Submit Live Hazard",
  };

  const categoriesT = {
    traffic: t?.categories?.traffic || (t?.filters && t.filters["Traffic"]) || "Traffic Jam",
    waterlogging: t?.categories?.waterlogging || (t?.filters && t.filters["Waterlogging"]) || "Waterlogging",
    accident: t?.categories?.accident || (t?.filters && t.filters["Accident"]) || "Accidents",
    infrastructure: t?.categories?.infrastructure || (t?.filters && t.filters["Infrastructure"]) || "Potholes / Infra",
  };

  const [formData, setFormData] = useState({
    title: "",
    type: "Traffic",
    urgency: "Medium",
    description: "",
    ward: "",
    position: initialCoordinates || null,
    mediaUrl: null,
    waterDepth: "< 6 in (Ankle Deep)",
    vehiclePassability: "Passable with Caution",
  });

  const [locationSource, setLocationSource] = useState(
    initialCoordinates ? "PIN_SELECTED" : "MANUAL"
  );
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialCoordinates) {
      setFormData((prev) => ({ ...prev, position: initialCoordinates }));
      setLocationSource("PIN_SELECTED");
    }
  }, [initialCoordinates]);

  const handleUseGps = () => {
    getPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          position: { lat: pos.lat, lng: pos.lng },
        }));
        setLocationSource("GPS");
        setErrorMsg("");
      },
      (err) => {
        setErrorMsg("Could not fetch GPS. Please select location on map or type landmark name.");
      }
    );
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCompressing(true);
    setErrorMsg("");
    try {
      const result = await compressImage(file, 800, 800, 0.7);
      if (result && result.dataUrl) {
        setFormData((prev) => ({ ...prev, mediaUrl: result.dataUrl }));
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setFormData((prev) => ({ ...prev, mediaUrl: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn("Client compression error, using fallback reader", err);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent double-submit race condition
    setErrorMsg("");

    if (!formData.description || !formData.description.trim()) {
      setErrorMsg("Please provide detailed field notes / description for fellow commuters.");
      return;
    }

    let resolvedCoords = formData.position;

    // Fallback: If no GPS or map pin, attempt lookup from ward or title
    if (!resolvedCoords || !Number.isFinite(Number(resolvedCoords.lat))) {
      resolvedCoords =
        resolveLocalityCoordinates(formData.ward) ||
        resolveLocalityCoordinates(formData.title) ||
        resolveLocalityCoordinates(formData.description);
    }

    if (!resolvedCoords || !Number.isFinite(Number(resolvedCoords.lat)) || !Number.isFinite(Number(resolvedCoords.lng))) {
      setErrorMsg("Please specify a recognized Bengaluru area (e.g. Silk Board, Panathur, Whitefield) or use Auto-Detect GPS / Map Pin.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmitReport({
        ...formData,
        waterDepth: formData.type === "Waterlogging" ? formData.waterDepth : null,
        vehiclePassability: formData.type === "Waterlogging" ? formData.vehiclePassability : null,
        position: resolvedCoords,
      });
      if (res && res.error) {
        setErrorMsg(res.error);
        return;
      }
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Failed to submit hazard report. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{reportT.modalTitle}</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          {errorMsg && <div className="report-error-banner">{errorMsg}</div>}

          <div className="form-group">
            <label>{reportT.category}</label>
            <div className="category-chips">
              {["Traffic", "Waterlogging", "Accident", "Infrastructure"].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`chip ${formData.type === cat ? "active" : ""}`}
                  onClick={() => setFormData({ ...formData, type: cat })}
                >
                  {cat === "Traffic" && categoriesT.traffic}
                  {cat === "Waterlogging" && categoriesT.waterlogging}
                  {cat === "Accident" && categoriesT.accident}
                  {cat === "Infrastructure" && categoriesT.infrastructure}
                </button>
              ))}
            </div>
          </div>

          {formData.type === "Waterlogging" && (
            <div className="form-row monsoon-telemetry-row" style={{ background: "rgba(6, 182, 212, 0.08)", padding: "10px", borderRadius: "6px", marginBottom: "14px", border: "1px solid rgba(6, 182, 212, 0.2)" }}>
              <div className="form-group flex-1">
                <label htmlFor="report-depth" style={{ color: "#06B6D4", fontWeight: 600 }}>🌊 Inundation Depth</label>
                <select
                  id="report-depth"
                  value={formData.waterDepth}
                  onChange={(e) => setFormData({ ...formData, waterDepth: e.target.value })}
                >
                  <option value="< 6 in (Ankle Deep)">&lt; 6 in (Ankle Deep - Passable)</option>
                  <option value="1 - 1.5 ft (Exhaust Level)">1 - 1.5 ft (Exhaust Level - 2W Danger)</option>
                  <option value="> 2.0 ft (Engine Submersion)">&gt; 2.0 ft (Critical Submersion / Closed)</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label htmlFor="report-passability" style={{ color: "#06B6D4", fontWeight: 600 }}>🚫 Vehicle Passability</label>
                <select
                  id="report-passability"
                  value={formData.vehiclePassability}
                  onChange={(e) => setFormData({ ...formData, vehiclePassability: e.target.value })}
                >
                  <option value="Passable with Caution">Passable with Caution</option>
                  <option value="2-Wheelers Blocked">2-Wheelers Blocked</option>
                  <option value="Cars Blocked / SUV Only">Cars Blocked / SUV Only</option>
                  <option value="Completely Impassable">Completely Impassable / Blocked</option>
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="report-title">{reportT.hazardTitle}</label>
            <input
              id="report-title"
              type="text"
              required
              placeholder="e.g. Waterlogging under bridge, Massive crater pothole"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="report-ward">{reportT.wardLocality}</label>
              <input
                id="report-ward"
                type="text"
                required
                placeholder="e.g. Silk Board, Panathur, Indiranagar"
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="report-urgency">{reportT.severity}</label>
              <select
                id="report-urgency"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              >
                <option value="Low">Low (Informational)</option>
                <option value="Medium">Medium (Delay ~15m)</option>
                <option value="High">High (Severe Blockage / Danger)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-desc">{reportT.fieldNotes}</label>
            <textarea
              id="report-desc"
              rows="3"
              required
              placeholder="Provide actionable guidance for fellow commuters..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{reportT.locationVerification}</label>
            <div className="location-action-bar">
              <button
                type="button"
                className="gps-btn"
                onClick={handleUseGps}
              >
                <span>📍</span>
                <span>{reportT.autoDetectGps}</span>
              </button>
              <span className="location-status-badge">
                {locationSource === "GPS" && "✓ GPS Locked"}
                {locationSource === "PIN_SELECTED" && "✓ Map Pin Selected"}
                {locationSource === "MANUAL" && "ℹ Auto-resolving from locality"}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>{reportT.photoEvidence}</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="file-input"
            />
            {compressing && <span className="compressing-hint">Compressing for low-bandwidth uplink...</span>}
            {formData.mediaUrl && (
              <div className="image-preview">
                <img src={formData.mediaUrl} alt="Preview" />
              </div>
            )}
          </div>

          <div className="form-actions">
            <Button variant="secondary" onClick={onClose} type="button">
              {t?.actions?.cancel || "Cancel"}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={compressing || submitting}
            >
              {compressing ? "Optimizing Photo..." : submitting ? "Submitting..." : reportT.broadcastHazard}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;

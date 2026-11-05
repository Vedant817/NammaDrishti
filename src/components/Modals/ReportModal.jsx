import { useDialog } from "../../hooks/useDialog";
import { useInterfaceCopy } from '../../hooks/useInterfaceCopy';
// src/components/Modals/ReportModal.jsx
import React, { useState, useEffect } from "react";
import Button from "../Common/Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useLanguage } from "../../context/LanguageContext";
import { compressImage } from "../../utils/imageOptimizer";
import { geocodeBengaluruPlace } from "../../services/geocodeService";
import "./ReportModal.css";

const ReportModal = ({
  isOpen,
  onClose,
  onSubmitReport,
  initialCoordinates,
}) => {
  const dialogRef = useDialog(onClose);
  const { getPosition } = useGeolocation();
  const { t } = useLanguage();
  const copy=useInterfaceCopy();

  const reportT = {
    modalTitle: t?.report?.modalTitle || t?.reportModal?.title || "Report Civic or Traffic Incident",
    category: t?.report?.category || t?.reportModal?.typeLabel || "Incident Type",
    hazardTitle: t?.report?.hazardTitle || t?.reportModal?.headlineLabel || "Headline / Landmark",
    wardLocality: t?.report?.wardLocality || t?.reportModal?.wardLabel || "Ward / Locality",
    severity: t?.report?.severity || t?.reportModal?.urgencyLabel || "Urgency",
    fieldNotes: t?.report?.fieldNotes || t?.reportModal?.descLabel || "Description & Traffic Impact",
    locationVerification: t?.report?.locationVerification || "Report location",
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
    waterDepth: "",
    vehiclePassability: "",
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

    // Fallback: If no GPS or map pin, resolve live coordinates via Nominatim
    if (!resolvedCoords || !Number.isFinite(Number(resolvedCoords.lat)) || !Number.isFinite(Number(resolvedCoords.lng))) {
      let geocoded = null;

      if (submitting) return; // Geocoding shares the submit guard

      setSubmitting(true);
      try {
        geocoded =
          (await geocodeBengaluruPlace(formData.ward)) ||
          (await geocodeBengaluruPlace(formData.title));
      } catch (geoErr) {
        geocoded = null;
      } finally {
        setSubmitting(false);
      }

      if (geocoded) {
        resolvedCoords = { lat: geocoded.lat, lng: geocoded.lng };
      } else {
        setErrorMsg(
          "No live geocode match found for this location. Use \"Auto-Detect GPS\", click the map to drop a pin before reporting, or name a specific Bengaluru landmark."
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await onSubmitReport({
        ...formData,
        waterDepth: formData.type === "Waterlogging" ? formData.waterDepth || null : null,
        vehiclePassability: formData.type === "Waterlogging" ? formData.vehiclePassability || null : null,
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.report} tabIndex={-1} className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{copy.report}</h3>
          <button type="button" className="close-btn" aria-label={t.ui["Close dialog"]} onClick={onClose}>
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
                <label htmlFor="report-depth" style={{ color: "#06B6D4", fontWeight: 600 }}>{copy.waterDepth}</label>
                <select
                  id="report-depth"
                  value={formData.waterDepth}
                  onChange={(e) => setFormData({ ...formData, waterDepth: e.target.value })}
                >
                  <option value="">{copy.unknown}</option>
                  <option value="< 6 in (Ankle Deep)">{copy.depthAnkle}</option>
                  <option value="1 - 1.5 ft (Exhaust Level)">{copy.depthExhaust}</option>
                  <option value="> 2.0 ft (Engine Submersion)">{copy.depthDeep}</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label htmlFor="report-passability" style={{ color: "#06B6D4", fontWeight: 600 }}>{copy.passability}</label>
                <select
                  id="report-passability"
                  value={formData.vehiclePassability}
                  onChange={(e) => setFormData({ ...formData, vehiclePassability: e.target.value })}
                >
                  <option value="">{copy.unknown}</option>
                  <option value="Passable with Caution">{copy.reportedPassable}</option>
                  <option value="2-Wheelers Blocked">{copy.twoWheelBlocked}</option>
                  <option value="Cars Blocked / SUV Only">{copy.carsBlocked}</option>
                  <option value="Completely Impassable">{copy.allBlocked}</option>
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
              placeholder="e.g. Waterlogging under the railway bridge"
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
                <option value="Low">{copy.lowUrgency}</option>
                <option value="Medium">{copy.mediumUrgency}</option>
                <option value="High">{copy.highUrgency}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-desc">{reportT.fieldNotes}</label>
            <textarea
              id="report-desc"
              rows="3"
              required
              placeholder="Describe what you can see and how it affects the road."
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
                {locationSource === "MANUAL" && "Choose a map location or enter an area."}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-photo">{reportT.photoEvidence}</label>
            <input
              id="report-photo"
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

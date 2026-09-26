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

const resolveLocalityCoordinates = (text) => {
  if (!text) return null;
  const clean = text.toLowerCase();
  for (const [name, pos] of Object.entries(BENGALURU_LOCALITY_COORDS)) {
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
  const { t } = useLanguage();
  const { location, getCurrentLocation, loading: geoLoading } = useGeolocation();

  const [formData, setFormData] = useState({
    type: "Traffic",
    title: "",
    ward: "",
    description: "",
    urgency: "Medium",
    mediaUrl: null,
  });

  const [coords, setCoords] = useState(initialCoordinates || null);
  const [compressing, setCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (initialCoordinates) {
      setCoords(initialCoordinates);
    }
  }, [initialCoordinates]);

  useEffect(() => {
    if (location) {
      setCoords({ lat: location.lat, lng: location.lng });
      setValidationError(null);
    }
  }, [location]);

  // Handle image upload with automatic client-side compression
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setCompressing(true);
        const result = await compressImage(file, 1200, 1200, 0.75);
        setImagePreview(result.dataUrl);
        setCompressionStats({
          original: result.originalSizeKb,
          compressed: result.compressedSizeKb,
        });
        setFormData((prev) => ({ ...prev, mediaUrl: result.dataUrl }));
      } catch (err) {
        // Fallback to basic FileReader if canvas fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
          setFormData((prev) => ({ ...prev, mediaUrl: reader.result }));
        };
        reader.readAsDataURL(file);
      } finally {
        setCompressing(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (compressing) return;
    if (!formData.title.trim() || !formData.description.trim()) return;

    // Resolve geographic position: explicit pin/GPS, or parsed locality
    let position = coords;
    if (!position) {
      position =
        resolveLocalityCoordinates(formData.ward) ||
        resolveLocalityCoordinates(formData.title) ||
        resolveLocalityCoordinates(formData.description);
    }

    if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
      setValidationError(
        "Please pick a point on the map, click 'Use My GPS', or enter a recognized Bengaluru locality (e.g. Whitefield, Silk Board, Koramangala, Hebbal)."
      );
      return;
    }

    const reportPayload = {
      ...formData,
      position,
      timestamp: "Just now",
      reportedBy: "You (Citizen)",
      ward: formData.ward.trim() || "Bengaluru Urban",
      verificationCount: 1,
      isVerified: false,
    };

    if (onSubmitReport) {
      onSubmitReport(reportPayload);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">🚨</span>
            <h3>{t.reportModal.title}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          <div className="form-group-row">
            <div className="form-field flex-2">
              <label>{t.reportModal.typeLabel}</label>
              <select
                className="form-input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              >
                <option value="Traffic">{t.reportModal.types.Traffic}</option>
                <option value="Waterlogging">{t.reportModal.types.Waterlogging}</option>
                <option value="Accident">{t.reportModal.types.Accident}</option>
                <option value="Infrastructure">{t.reportModal.types.Infrastructure}</option>
                <option value="Event">{t.reportModal.types.Event}</option>
              </select>
            </div>

            <div className="form-field flex-1">
              <label>{t.reportModal.urgencyLabel}</label>
              <select
                className="form-input"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              >
                <option value="Low">{t.reportModal.urgencies.Low}</option>
                <option value="Medium">{t.reportModal.urgencies.Medium}</option>
                <option value="High">{t.reportModal.urgencies.High}</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>{t.reportModal.titlePlaceholder}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Heavy waterlogging under Panathur rail bridge"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (validationError) setValidationError(null);
              }}
              required
            />
          </div>

          <div className="form-field">
            <label>{t.reportModal.wardPlaceholder}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Mahadevapura Ward 85 / ORR Bellandur"
              value={formData.ward}
              onChange={(e) => {
                setFormData({ ...formData, ward: e.target.value });
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="form-field">
            <label>{t.reportModal.descPlaceholder}</label>
            <textarea
              className="form-input form-textarea"
              rows={3}
              placeholder="Describe depth of water, lane blockage, vehicle types affected..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* Coordinate Resolution & GPS Status */}
          <div className="location-picker-group">
            <div className="location-status-badge">
              <span className="location-pin-icon">📍</span>
              <span className="location-text">
                {coords
                  ? `Coordinates: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                  : resolveLocalityCoordinates(formData.ward)
                  ? `Detected Locality: ${formData.ward}`
                  : t.reportModal.clickMapInstruction}
              </span>
            </div>
            <button
              type="button"
              className="btn-gps"
              onClick={getCurrentLocation}
              disabled={geoLoading}
            >
              {geoLoading ? "Acquiring GPS..." : t.reportModal.useGpsButton}
            </button>
          </div>

          {validationError && (
            <div className="validation-error-pill" style={{ color: '#F87171', background: '#451A1A', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginTop: '8px', border: '1px solid #7F1D1D' }}>
              {validationError}
            </div>
          )}

          {/* Optimized Photo Attachment */}
          <div className="form-field">
            <label>📸 {t.reportModal.attachPhotoLabel}</label>
            <input
              type="file"
              accept="image/*"
              className="file-input"
              onChange={handleImageChange}
            />
            {compressing && <span className="compressing-pill">Optimizing photo...</span>}
            {compressionStats && (
              <span className="compression-badge">
                📸 Optimized: {compressionStats.original} KB → {compressionStats.compressed} KB
              </span>
            )}
            {imagePreview && (
              <div className="image-preview-thumbnail">
                <img src={imagePreview} alt="Preview" />
              </div>
            )}
          </div>

          <div className="modal-actions">
            <Button type="button" onClick={onClose} variant="secondary">
              {t.actions.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={compressing}>
              {compressing ? "Compressing..." : t.actions.submitReport}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;

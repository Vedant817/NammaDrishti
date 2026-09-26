// src/components/Modals/ReportModal.jsx
import React, { useState, useEffect } from "react";
import Button from "../Common/Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useLanguage } from "../../context/LanguageContext";
import { compressImage } from "../../utils/imageOptimizer";
import "./ReportModal.css";

const ReportModal = ({ onClose, onSubmitReport, initialCoordinates }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    type: "Infrastructure",
    title: "",
    ward: "",
    urgency: "Medium",
    description: "",
    mediaUrl: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [compressionStats, setCompressionStats] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [coords, setCoords] = useState(initialCoordinates || null);

  const { location, loading: geoLoading, error: geoError, getCurrentLocation } =
    useGeolocation();

  // Update coords when geolocation succeeds
  useEffect(() => {
    if (location) {
      setCoords({ lat: location.lat, lng: location.lng });
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
    if (!formData.title.trim() || !formData.description.trim()) return;

    // Use selected coords or fallback to Central Bengaluru
    const position = coords || { lat: 12.9716, lng: 77.5946 };

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
                <option value="High">{t.reportModal.urgencies.High}</option>
                <option value="Medium">{t.reportModal.urgencies.Medium}</option>
                <option value="Low">{t.reportModal.urgencies.Low}</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>{t.reportModal.headlineLabel}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t.reportModal.headlinePlaceholder}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label>{t.reportModal.wardLabel}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t.reportModal.wardPlaceholder}
              value={formData.ward}
              onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label>{t.reportModal.descLabel}</label>
            <textarea
              className="form-input"
              placeholder={t.reportModal.descPlaceholder}
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* Location Picker Section */}
          <div className="location-picker-box">
            <div className="location-picker-status">
              <span className="loc-label">{t.reportModal.coordsLabel}</span>
              <span className="loc-coords">
                {coords
                  ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                  : "Central Bengaluru (Default)"}
              </span>
            </div>
            <button
              type="button"
              className="gps-btn"
              onClick={getCurrentLocation}
              disabled={geoLoading}
            >
              {geoLoading ? t.actions.acquiringGps : t.actions.autoGps}
            </button>
          </div>
          {geoError && <p className="form-warning">{geoError}</p>}

          {/* Photo attachment with compression status */}
          <div className="form-field">
            <label>{t.reportModal.photoLabel}</label>
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
            <Button type="submit" variant="primary">
              {t.actions.submitReport}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;

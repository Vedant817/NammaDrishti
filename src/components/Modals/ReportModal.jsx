// src/components/Modals/ReportModal.jsx
import React, { useState, useEffect } from "react";
import Button from "../Common/Button";
import { useGeolocation } from "../../hooks/useGeolocation";
import "./ReportModal.css";

const ReportModal = ({ onClose, onSubmitReport, initialCoordinates }) => {
  const [formData, setFormData] = useState({
    type: "Infrastructure",
    title: "",
    ward: "",
    urgency: "Medium",
    description: "",
    mediaUrl: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [coords, setCoords] = useState(initialCoordinates || null);

  const { location, loading: geoLoading, error: geoError, getCurrentLocation } =
    useGeolocation();

  // Update coords when geolocation succeeds
  useEffect(() => {
    if (location) {
      setCoords({ lat: location.lat, lng: location.lng });
    }
  }, [location]);

  // Handle image upload and generate preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData((prev) => ({ ...prev, mediaUrl: reader.result }));
      };
      reader.readAsDataURL(file);
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
            <h3>Report Civic or Traffic Incident</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          <div className="form-group-row">
            <div className="form-field flex-2">
              <label>Incident Type</label>
              <select
                className="form-input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              >
                <option value="Traffic">🚗 Traffic Jam / Gridlock</option>
                <option value="Waterlogging">🌊 Waterlogging / Underpass Flooding</option>
                <option value="Accident">⚠️ Road Accident / Vehicle Breakdown</option>
                <option value="Infrastructure">🔧 Pothole / Pipeline / Tree Fall</option>
                <option value="Event">🎉 Public Event / Procession</option>
              </select>
            </div>

            <div className="form-field flex-1">
              <label>Urgency</label>
              <select
                className="form-input"
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              >
                <option value="High">High (Immediate Hazard)</option>
                <option value="Medium">Medium (Slowdown)</option>
                <option value="Low">Low (Informational)</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Headline / Landmark</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Deep Pothole outside Sony World signal"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label>Ward / Locality</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Koramangala 4th Block, Indiranagar, Whitefield"
              value={formData.ward}
              onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label>Description & Traffic Impact</label>
            <textarea
              className="form-input"
              placeholder="Describe road blockage, water level, lane restrictions, etc."
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* Location Picker Section */}
          <div className="location-picker-box">
            <div className="location-picker-status">
              <span className="loc-label">Coordinates:</span>
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
              {geoLoading ? "Acquiring GPS..." : "📍 Auto-Detect GPS"}
            </button>
          </div>
          {geoError && <p className="form-warning">{geoError}</p>}

          {/* Photo attachment */}
          <div className="form-field">
            <label>Attach Evidence Photo (Optional)</label>
            <input
              type="file"
              accept="image/*"
              className="file-input"
              onChange={handleImageChange}
            />
            {imagePreview && (
              <div className="image-preview-thumbnail">
                <img src={imagePreview} alt="Preview" />
              </div>
            )}
          </div>

          <div className="modal-actions">
            <Button type="button" onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit Live Hazard
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;

// src/components/Sidebar/CityRecap.jsx
import React from "react";

const CityRecap = ({ events = [] }) => {
  const trafficCount = events.filter((e) => e.type === "Traffic").length;
  const floodCount = events.filter((e) => e.type === "Waterlogging").length;
  const accidentCount = events.filter((e) => e.type === "Accident").length;
  const infraCount = events.filter((e) => e.type === "Infrastructure").length;

  return (
    <div className="recap-content">
      <div className="recap-header">
        <h4>Today's Bengaluru Diagnostic</h4>
        <span className="recap-time">Updated live</span>
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

      <h5 className="recap-subtitle">Key Choke Points & Flood Basins</h5>
      <ul className="recap-bullet-list">
        <li className="recap-bullet-item alert">
          <strong>Panathur Railway Underpass:</strong> Inundated following localized showers. Divert via ORR.
        </li>
        <li className="recap-bullet-item">
          <strong>Silk Board Junction:</strong> Average delay +28 mins towards BTM Layout.
        </li>
        <li className="recap-bullet-item">
          <strong>Hebbal Inbound:</strong> Bottleneck at flyover junction with Airport Rd.
        </li>
      </ul>

      <h5 className="recap-subtitle">Predictive Alerts (Next 4 Hours)</h5>
      <ul className="recap-bullet-list">
        <li className="recap-bullet-item">
          🌧️ <strong>Rain Influx:</strong> Evening shower cells likely in South & East Bengaluru.
        </li>
        <li className="recap-bullet-item">
          🚗 <strong>ORR Rush Hour:</strong> Peak congestion anticipated between 5:30 PM – 8:30 PM.
        </li>
      </ul>
    </div>
  );
};

export default CityRecap;

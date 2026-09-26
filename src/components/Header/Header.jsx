// src/components/Header/Header.jsx
import React from 'react';
import './Header.css';

const Header = ({ activeEventCount = 0, verifiedPercent = 92, weather }) => {
  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="brand-group">
          <div className="brand-title">
            <span className="live-pulse-dot" title="Live stream connected"></span>
            <h1>NammaPulse</h1>
            <span className="city-pill">Bengaluru</span>
          </div>
          <span className="brand-tagline">Real-Time Civic & Traffic Intelligence</span>
        </div>

        <div className="header-center-info">
          {weather && (
            <div className="weather-pill" title={`Last updated: ${weather.lastUpdated}`}>
              <span className="weather-icon">
                {weather.precipitation > 0 ? '🌧️' : '⛅'}
              </span>
              <span className="weather-temp">{weather.temp}°C</span>
              <span className="weather-divider">•</span>
              <span className="weather-desc">{weather.description}</span>
              <span className={`flood-tag ${weather.floodRisk.toLowerCase()}`}>
                Flood Risk: {weather.floodRisk}
              </span>
            </div>
          )}
        </div>

        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-value">{activeEventCount}</span>
            <span className="stat-label">Active Hazards</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{verifiedPercent}%</span>
            <span className="stat-label">Consensus Rate</span>
          </div>

          <div className="language-selector">
            <select aria-label="Select Language">
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

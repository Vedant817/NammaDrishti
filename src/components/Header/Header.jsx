// src/components/Header/Header.jsx
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getCitizenReputation, getCitizenTier } from '../../utils/reputationService';
import './Header.css';

const Header = ({
  activeEventCount = 0,
  verifiedPercent = 92,
  weather,
  isLiveConnected = false,
}) => {
  const { lang, setLang, t } = useLanguage();
  const [reputation, setReputation] = useState(() => getCitizenReputation());

  useEffect(() => {
    // Refresh reputation on storage changes or user actions
    const updateRep = () => setReputation(getCitizenReputation());
    window.addEventListener('storage', updateRep);
    return () => window.removeEventListener('storage', updateRep);
  }, []);

  const tier = getCitizenTier(reputation.points);

  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="brand-group">
          <div className="brand-title">
            <span
              className={`live-pulse-dot ${isLiveConnected ? 'connected' : 'standalone'}`}
              title={isLiveConnected ? 'Live WebSocket Synced' : 'Civic Stream Active'}
            ></span>
            <h1>NammaPulse</h1>
            <span className="city-pill">{t.city}</span>
          </div>
          <span className="brand-tagline">{t.brandTagline}</span>
        </div>

        <div className="header-center-info">
          {weather && (
            <div
              className={`weather-pill ${weather.isOffline ? 'weather-offline' : ''}`}
              title={`Last updated: ${weather.lastUpdated || 'Pending'}`}
            >
              <span className="weather-icon">
                {weather.isOffline ? '📡' : weather.precipitation > 0 ? '🌧️' : '⛅'}
              </span>
              <span className="weather-temp">
                {weather.temp !== null ? `${weather.temp}°C` : '--'}
              </span>
              <span className="weather-divider">•</span>
              <span className="weather-desc">{weather.description}</span>
              <span
                className={`flood-tag ${
                  weather.floodRisk ? weather.floodRisk.toLowerCase().replace(/\s+/g, '-') : 'low'
                }`}
              >
                {t.floodRiskPrefix} {weather.floodRisk}
              </span>
            </div>
          )}
        </div>

        <div className="header-stats">
          <div
            className="stat-card citizen-tier-badge"
            title={`${tier.description} (${reputation.points} Civic Karma Points)`}
          >
            <span className="stat-value tier-value">
              {tier.icon} {tier.label}
            </span>
            <span className="stat-label">{reputation.points} Karma Pts</span>
          </div>

          <div className="stat-card">
            <span className="stat-value">{activeEventCount}</span>
            <span className="stat-label">{t.activeHazards}</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{verifiedPercent}%</span>
            <span className="stat-label">{t.consensusRate}</span>
          </div>

          <div className="language-selector">
            <select
              aria-label="Select Language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
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

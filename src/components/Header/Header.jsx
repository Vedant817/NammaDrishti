// src/components/Header/Header.jsx
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getCitizenReputation, getCitizenTier } from '../../utils/reputationService';
import './Header.css';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिंदी' },
];

const Header = ({
  activeEventCount = 0,
  verifiedPercent = 0,
  weather,
  isLiveConnected = false,
}) => {
  const { lang, setLang, t } = useLanguage();
  const [reputation, setReputation] = useState(() => getCitizenReputation());

  useEffect(() => {
    // Refresh reputation on storage changes or user actions within same or other tabs
    const updateRep = () => setReputation(getCitizenReputation());
    window.addEventListener('storage', updateRep);
    window.addEventListener('nammapulse:reputation_updated', updateRep);
    return () => {
      window.removeEventListener('storage', updateRep);
      window.removeEventListener('nammapulse:reputation_updated', updateRep);
    };
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
            <div className="brand-text-block">
              <div className="brand-heading-row">
                <h1>NammaPulse</h1>
                <span className="city-pill">{t?.city || 'Bengaluru'}</span>
              </div>
              <p className="brand-subtitle">{t?.brandTagline || 'Real-Time Civic & Traffic Intelligence'}</p>
            </div>
          </div>

          <div className="reputation-badge" style={{ borderColor: tier.badgeColor }}>
            <span className="tier-icon">{tier.icon}</span>
            <div className="tier-info">
              <span className="tier-name" style={{ color: tier.badgeColor }}>
                {tier.label}
              </span>
              <span className="karma-pts">{reputation.points} pts</span>
            </div>
          </div>
        </div>

        <div className="header-meta-group">
          <div className="telemetry-chip">
            <span className="telemetry-label">Active Hazards:</span>
            <span className="telemetry-val alert-count">{activeEventCount}</span>
          </div>

          <div className="telemetry-chip">
            <span className="telemetry-label">Consensus Verified:</span>
            <span className="telemetry-val verified-count">{verifiedPercent}%</span>
          </div>

          {weather && (
            <div className="weather-telemetry-chip" title={weather.isOffline ? 'Using cached telemetry' : 'Live Open-Meteo Feed'}>
              <span className="weather-icon">🌧️</span>
              <div className="weather-details">
                <span className="weather-temp">{weather.temp}°C</span>
                <span className="weather-rain">
                  {weather.precipitation > 0 ? `${weather.precipitation} mm/h` : 'No rain'}
                </span>
              </div>
            </div>
          )}

          <div className="lang-switcher">
            <select
              id="lang-select"
              aria-label="Select Language"
              className="lang-select-hidden"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                onClick={() => setLang(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

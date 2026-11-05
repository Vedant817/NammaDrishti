import React from "react";
import { MapPin, CloudRain, Radio } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./Header.css";

const Header = ({ weather, isLiveConnected = false, offlineQueueCount = 0 }) => {
  const { lang, setLang, t } = useLanguage();
  return (
    <header className="dashboard-header">
      <a className="brand-lockup" href="/" aria-label="NammaDrishti home">
        <span className="brand-symbol" aria-hidden="true"><MapPin size={23} strokeWidth={1.7} /></span>
        <span><h1>{t.brandName}</h1><span className="brand-subtitle">{t.brandTagline}</span></span>
      </a>
      <div className="city-location"><span className="city-location-rule" aria-hidden="true" /><span>{t.city}<small>12.97° N / 77.59° E</small></span></div>
      <div className="header-meta-group">
        <span className={`connection-status ${isLiveConnected ? "connected" : ""}`}><Radio size={14} aria-hidden="true" />{isLiveConnected ? "Connected" : "Reconnecting"}</span>
        {weather && Number.isFinite(weather.temp) && <span className="weather-reading" title={weather.isOffline ? "Cached weather" : "Open-Meteo weather"}><CloudRain size={17} aria-hidden="true" /><strong>{Math.round(weather.temp)}°</strong><span>{weather.isOffline ? "Cached" : weather.precipitation > 0 ? `${weather.precipitation} mm/h` : "No rain"}</span></span>}
        {offlineQueueCount > 0 && <span className="offline-sync-chip">{offlineQueueCount} waiting to sync</span>}
        <label className="language-control"><span className="sr-only">Select Language</span><select aria-label="Select Language" value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिंदी</option></select></label>
      </div>
    </header>
  );
};
export default Header;

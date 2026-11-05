import AccountPanel from './AccountPanel';
import { enableBackgroundAlerts } from '../../services/notifications';
import React, { useState, useEffect } from "react";
import { cityTime } from '../../utils/sourceTime';
import { MapPin, CloudRain, Radio } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./Header.css";

const Header = ({ weather, isLiveConnected = false, offlineQueueCount = 0 }) => {
  const [account, setAccount] = useState(() => new URLSearchParams(window.location.search).get("account") === "1");
  const [notice, setNotice] = useState(null);
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const { lang, setLang, t } = useLanguage();
  return (
    <>
    {account && <AccountPanel onClose={() => setAccount(false)} />}
    <header className="dashboard-header">
      <a className="brand-lockup" href="/" aria-label="NammaDrishti home">
        <span className="brand-symbol" aria-hidden="true"><MapPin size={23} strokeWidth={1.7} /></span>
        <span><h1>{t.brandName}</h1><span className="brand-subtitle">{t.brandTagline}</span></span>
      </a>
      <div className="city-location"><span className="city-location-rule" aria-hidden="true" /><span>{t.city}<small><time dateTime={new Date(clock).toISOString()}>{cityTime(clock)}</time></small></span></div>
      <div className="header-meta-group">
        <button type="button" onClick={() => setAccount(true)}>{t.live.account}</button>
        <button type="button" onClick={async () => { if (!("Notification" in window)) return setNotice(t.live.notifyUnavailable); if (await Notification.requestPermission() !== "granted") return setNotice(t.ui["Notification permission denied"]); if (!navigator.geolocation) return setNotice(t.live.notifyUnavailable); navigator.geolocation.getCurrentPosition(p => enableBackgroundAlerts({lat:p.coords.latitude,lng:p.coords.longitude}).then(() => setNotice(t.live.notifyEnabled)).catch(() => setNotice(t.live.notifyUnavailable)), () => setNotice(t.live.notifyUnavailable), {maximumAge:0,timeout:8000}); }}>{t.live.notifications}</button>
        {notice && <span role="status">{notice}</span>}
        <span className={`connection-status ${isLiveConnected ? "connected" : ""}`}><Radio size={14} aria-hidden="true" />{isLiveConnected ? t.live.connected : t.live.reconnecting}</span>
        {weather && Number.isFinite(weather.temp) && <span className="weather-reading" title={`${weather.source || "Open-Meteo"} · ${weather.observedAt || ""}`}><CloudRain size={17} aria-hidden="true" /><strong>{Math.round(weather.temp)}°</strong><span>{weather.isOffline ? t.live.stale : Number.isFinite(weather.precipitationAmountMm) ? `${weather.precipitationAmountMm} mm / ${weather.intervalSeconds / 60} min` : t.live.weatherUnavailable}</span></span>}
        {offlineQueueCount > 0 && <span className="offline-sync-chip">{offlineQueueCount} waiting to sync</span>}
        <label className="language-control"><span className="sr-only">{t.ui["Select Language"]}</span><select aria-label={t.ui["Select Language"]} value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिंदी</option></select></label>
      </div>
    </header>
    </>
  );
};
export default Header;

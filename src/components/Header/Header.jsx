import {useInterfaceCopy} from '../../hooks/useInterfaceCopy';
import AccountPanel from './AccountPanel';
import { enableBackgroundAlerts, backgroundAlertStatus, disableBackgroundAlerts, testBackgroundAlert } from '../../services/notifications';
import React, { useState, useEffect } from "react";
import { cityTime } from '../../utils/sourceTime';
import { MapPin, Radio } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./Header.css";

const Header = ({ weather, isLiveConnected = false, offlineQueueCount = 0 }) => {
  const [account, setAccount] = useState(() => new URLSearchParams(window.location.search).get("account") === "1");
  const [alerts,setAlerts]=useState({enabled:false,supported:true});
  const [busy,setBusy]=useState(false);
  useEffect(()=>{backgroundAlertStatus().then(setAlerts).catch(()=>{});},[]);
  const [notice, setNotice] = useState(null);
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const { lang, setLang, t } = useLanguage();
  const copy=useInterfaceCopy();
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
        <button type="button" onClick={() => setAccount(true)}>{copy.account}</button>
        <details className="header-settings"><summary>{copy.options}</summary><div className="header-settings-body"><strong>{copy.alertSettings}</strong>
        <p>{!alerts.supported ? copy.notificationUnsupported : alerts.permission === 'denied' ? copy.notificationDenied : alerts.enabled ? copy.notificationOn : copy.notificationOff}</p>
        <button type="button" disabled={busy || !alerts.supported} onClick={async () => {
          setBusy(true);setNotice(null);
          try {
            if(alerts.enabled) { await disableBackgroundAlerts();setAlerts(prev=>({...prev,enabled:false})); }
            else {
              if(Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted')throw new Error('denied');
              const position=await new Promise((resolve,reject)=>navigator.geolocation ? navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),reject,{maximumAge:0,timeout:8000}) : reject(new Error()));
              await enableBackgroundAlerts(position);setAlerts({enabled:true,supported:true,permission:'granted'});
            }
          } catch(error) { setNotice(error.message==='denied' ? copy.notificationDenied : copy.notificationError); }
          finally { setBusy(false); }
        }}>{busy ? copy.notificationBusy : alerts.enabled ? copy.notificationDisable : copy.notificationEnable}</button>
        {alerts.enabled && <button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await testBackgroundAlert();setNotice(copy.notificationTestSent);}catch{setNotice(copy.notificationError);}finally{setBusy(false);}}}>{copy.notificationTest}</button>}
        {notice && <span role="status">{notice}</span>}
        </div></details>
        <span className={`connection-status ${isLiveConnected ? "connected" : ""}`}><Radio size={14} aria-hidden="true" />{isLiveConnected ? t.live.connected : t.live.reconnecting}</span>
        {offlineQueueCount > 0 && <span className="offline-sync-chip">{offlineQueueCount} waiting to sync</span>}
        <label className="language-control"><span className="sr-only">{t.ui["Select Language"]}</span><select aria-label={t.ui["Select Language"]} value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिंदी</option></select></label>
      </div>
    </header>
    </>
  );
};
export default Header;

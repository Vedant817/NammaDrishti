// src/components/Sidebar/Sidebar.jsx
import React, { useState } from "react";
import PersonalizedFeed from "./PersonalizedFeed";
import CityRecap from "./CityRecap";
import { EMERGENCY_CONTACTS } from "../../data/constants";
import { useLanguage } from "../../context/LanguageContext";
import "./Sidebar.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const Sidebar = ({
  activeTab = "feed",
  onTabChange,
  events = [],
  allEvents = null,
  selectedEvent,
  onEventSelect,
  onVerifyEvent,
  onResolveEvent,
  activeFilter = "All",
  rainIntensity = 0,
  isWeatherOffline = false,
  userLocation = null,
}) => {
  const { t } = useLanguage();
  const [sosStatus, setSosStatus] = useState(null);
  const [acquiringGps, setAcquiringGps] = useState(false);

  const handleTriggerSos = () => {
    setAcquiringGps(true);
    setSosStatus(null);

    const onCoordsAcquired = async (lat, lng) => {
      setAcquiringGps(false);
      const googleMapsUrl = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
      const message = `🚨 EMERGENCY SOS DISPATCH [NammaDrishti]\n📍 Location: ${googleMapsUrl}\n🆘 Immediate road/civic assistance required in Bengaluru!`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      // Post dispatch event to backend
      try {
        await fetch(`${API_BASE}/sos/dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, timestamp: new Date().toISOString() }),
        });
      } catch (err) {
        // Continue even if network is restricted
      }

      setSosStatus({
        lat,
        lng,
        whatsappUrl,
        isVerifiedGps: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      // Automatically launch WhatsApp dispatch link
      try {
        if (typeof window !== "undefined") {
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
      } catch (openErr) {}
    };

    if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
      onCoordsAcquired(userLocation.lat, userLocation.lng);
    } else if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => onCoordsAcquired(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          setAcquiringGps(false);
          setSosStatus({
            isVerifiedGps: false,
            error: "GPS Location unavailable or permission denied. Please call 112 directly.",
            whatsappUrl: `https://wa.me/?text=${encodeURIComponent(
              "🚨 EMERGENCY SOS DISPATCH [NammaDrishti]\n🆘 Immediate road/civic assistance required in Bengaluru! (GPS coordinates unavailable - calling 112)"
            )}`,
          });
        },
        { timeout: 7000, enableHighAccuracy: true }
      );
    } else {
      setAcquiringGps(false);
      setSosStatus({
        isVerifiedGps: false,
        error: "Geolocation is not supported on this device. Please call 112 directly.",
        whatsappUrl: `https://wa.me/?text=${encodeURIComponent(
          "🚨 EMERGENCY SOS DISPATCH [NammaDrishti]\n🆘 Immediate road/civic assistance required in Bengaluru! (GPS coordinates unavailable - calling 112)"
        )}`,
      });
    }
  };

  return (
    <aside className="sidebar-container">
      <div className="sidebar-tab-nav">
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "feed" ? "active" : ""}`}
          onClick={() => onTabChange("feed")}
        >
          {t.tabs.feed}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "recap" ? "active" : ""}`}
          onClick={() => onTabChange("recap")}
        >
          {t.tabs.recap}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === "helpline" ? "active" : ""}`}
          onClick={() => onTabChange("helpline")}
        >
          {t.tabs.helpline}
        </button>
      </div>

      <div className="sidebar-scrollable-body">
        {activeTab === "feed" && (
          <PersonalizedFeed
            events={events}
            selectedEvent={selectedEvent}
            onEventSelect={onEventSelect}
            onVerifyEvent={onVerifyEvent}
            onResolveEvent={onResolveEvent}
            activeFilter={activeFilter}
          />
        )}

        {activeTab === "recap" && (
          <CityRecap
            events={allEvents || events}
            rainIntensity={rainIntensity}
            isWeatherOffline={isWeatherOffline}
          />
        )}

        {activeTab === "helpline" && (
          <div className="helpline-tab-content">
            <div className="helpline-header">
              <h4>{t.sidebar.helplineTitle}</h4>
              <p>{t.sidebar.helplineSub}</p>
            </div>

            {/* One-Tap Emergency SOS Dispatch Section */}
            <div className="emergency-sos-box">
              <div className="sos-box-header">
                <span className="sos-badge">EMERGENCY DISPATCH</span>
                <span className="sos-network">BTP & BBMP LINK</span>
              </div>
              <h5>{t.sidebar?.sosTitle || "One-Tap Bengaluru Emergency SOS Dispatch"}</h5>
              <p>{t.sidebar?.sosDesc || "Instantly broadcast your GPS location to BTP & BBMP control and generate emergency WhatsApp dispatch."}</p>

              <button
                type="button"
                className={`trigger-sos-btn ${acquiringGps ? "loading" : ""}`}
                onClick={handleTriggerSos}
                disabled={acquiringGps}
              >
                {acquiringGps ? "📍 Acquiring GPS Coordinates..." : "🚨 Broadcast 1-Tap Emergency SOS"}
              </button>

              {sosStatus && (
                <div className="sos-active-panel">
                  {sosStatus.isVerifiedGps ? (
                    <div className="sos-coords-row">
                      <span>✓ GPS Acquired:</span>
                      <strong>{sosStatus.lat.toFixed(4)}, {sosStatus.lng.toFixed(4)}</strong>
                    </div>
                  ) : (
                    <div className="sos-coords-row sos-error-coords" style={{ color: "#EF4444" }}>
                      <span>⚠️ {sosStatus.error}</span>
                    </div>
                  )}
                  <div className="sos-actions-row">
                    <a
                      href={sosStatus.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sos-whatsapp-btn"
                    >
                      💬 Send WhatsApp SOS
                    </a>
                    <a href="tel:112" className="sos-dial-btn">
                      📞 Call 112 (Police/Med)
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="helpline-list">
              {EMERGENCY_CONTACTS.map((c) => (
                <div key={c.name} className="helpline-card">
                  <div className="helpline-card-info">
                    <h6>{c.name}</h6>
                    <p>{c.desc}</p>
                  </div>
                  <a href={`tel:${c.number.split(" ")[0]}`} className="helpline-call-btn">
                    📞 {c.number}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
